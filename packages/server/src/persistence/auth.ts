import crypto from "node:crypto";
import { promisify } from "node:util";
import { Router } from "express";
import { MAX_NAME_LEN, VOCATIONS, type LoginRequest, type LoginResponse, type Vocation } from "@lemonquest/shared";
import { createAccount, findAccount, getCharacterByName, nameKey } from "./db.ts";
import { FailureLimiter, RateCounter } from "./ratelimit.ts";

export const TOKEN_TTL_MS = 60_000;
const MIN_NAME_LEN = 3;
/** Senha mínima para contas NOVAS. Contas antigas (mínimo antigo 3) ainda entram, com aviso. */
export const MIN_PASSWORD_LEN = 6;
const LEGACY_MIN_PASSWORD_LEN = 3;
const MAX_PASSWORD_LEN = 200;

/** 5 falhas/min (por IP e por nome) → 5 min de bloqueio. */
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_FAIL_WINDOW_MS = 60_000;
export const LOGIN_LOCK_MS = 5 * 60_000;
/** 3 contas novas por IP por hora. */
export const CREATE_MAX_PER_HOUR = 3;

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

/** Dados que o onAuth estático entrega ao onJoin (client.auth). Precisa ser JSON puro (passa por IPC). */
export interface AuthData {
  name: string;
  key: string;
  /** Senha abaixo do mínimo atual (conta antiga): o jogo sugere trocar. */
  weakPassword: boolean;
}

export type ServerLoginResponse = LoginResponse;

interface TokenEntry extends AuthData { expires: number }
const tokens = new Map<string, TokenEntry>();
/** Reserva do nome no login: um token pendente por personagem (login novo invalida o anterior). */
const pendingByKey = new Map<string, string>();
/** Personagens no mundo: name_key -> sessionId dono. */
const online = new Map<string, string>();

const ipFails = new FailureLimiter(LOGIN_MAX_FAILS, LOGIN_FAIL_WINDOW_MS, LOGIN_LOCK_MS);
const nameFails = new FailureLimiter(LOGIN_MAX_FAILS, LOGIN_FAIL_WINDOW_MS, LOGIN_LOCK_MS);
const creations = new RateCounter(CREATE_MAX_PER_HOUR, 3600_000);
let lastSweep = 0;

/** Zera o estado em memória (testes). */
export function resetAuthState(): void {
  tokens.clear(); pendingByKey.clear(); online.clear();
  for (const l of [ipFails, nameFails]) l.sweep(Number.MAX_SAFE_INTEGER);
  creations.sweep(Number.MAX_SAFE_INTEGER);
  lastSweep = 0;
}

const LETTER = String.raw`(?:(?=\p{L})\p{Script=Latin})`;
const NAME_RE = new RegExp(`^${LETTER}+(?: ${LETTER}+)*$`, "u");

/** NFC; só letras do alfabeto latino (com acentos), palavras separadas por um único espaço. */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < MIN_NAME_LEN || name.length > MAX_NAME_LEN) return null;
  if (!NAME_RE.test(name)) return null;
  return name;
}

async function hashPassword(password: string, salt: string): Promise<string> {
  return (await scrypt(password, salt, 64)).toString("hex");
}

async function checkPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const a = Buffer.from(await hashPassword(password, salt), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function sweep(now: number) {
  for (const [t, v] of tokens) {
    if (v.expires > now) continue;
    tokens.delete(t);
    if (pendingByKey.get(v.key) === t) pendingByKey.delete(v.key);
  }
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  ipFails.sweep(now); nameFails.sweep(now); creations.sweep(now);
}

function issueToken(name: string, weakPassword: boolean, now: number): string {
  sweep(now);
  const key = nameKey(name);
  const prev = pendingByKey.get(key);
  if (prev) tokens.delete(prev);
  const token = crypto.randomUUID();
  tokens.set(token, { name, key, weakPassword, expires: now + TOKEN_TTL_MS });
  pendingByKey.set(key, token);
  return token;
}

const limited = (ms: number): ServerLoginResponse => {
  const s = Math.max(1, Math.ceil(ms / 1000));
  return { ok: false, error: "too_many_attempts", retryAfterSec: s, message: `Muitas tentativas. Tente de novo em ${s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`}.` };
};

export interface LoginContext {
  /** IP do cliente (req.socket.remoteAddress — sem proxy na LAN). */
  ip?: string;
  now?: () => number;
}

/** Lógica pura do login (testável sem HTTP). */
export async function handleLogin(req: LoginRequest, ctx: LoginContext = {}): Promise<ServerLoginResponse> {
  const now = ctx.now ?? Date.now;
  const ip = ctx.ip ?? "?";
  if (!req || typeof req !== "object" || typeof req.password !== "string") {
    return { ok: false, error: "invalid_request" };
  }
  const name = normalizeName(req.name);
  if (!name) return { ok: false, error: "invalid_name" };
  if (req.password.length > MAX_PASSWORD_LEN) return { ok: false, error: "wrong_password" };
  const key = nameKey(name);
  sweep(now());

  const wait = Math.max(ipFails.lockedFor(ip, now()), nameFails.lockedFor(key, now()));
  if (wait > 0) return limited(wait);

  const acc = findAccount(name);
  if (!acc) {
    if (req.vocation === undefined) return { ok: false, error: "need_vocation" };
    if (!VOCATIONS.includes(req.vocation)) return { ok: false, error: "invalid_request" };
    if (req.password.length < MIN_PASSWORD_LEN) {
      return { ok: false, error: "weak_password", message: `A senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.` };
    }
    const cw = creations.waitFor(ip, now());
    if (cw > 0) return limited(cw);
    creations.record(ip, now());
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await hashPassword(req.password, salt);
    let rec;
    try {
      rec = createAccount(name, hash, salt, req.vocation);
    } catch {
      return { ok: false, error: "invalid_name" }; // corrida: alguém criou o mesmo nome (ou variante de caixa/acentos)
    }
    console.log(`[auth] conta criada: ${rec.name} (${rec.vocation}) de ${ip}`);
    return { ok: true, token: issueToken(rec.name, false, now()), name: rec.name, vocation: rec.vocation, isNew: true };
  }

  ipFails.begin(ip);
  nameFails.begin(key);
  let ok = false;
  try {
    ok = req.password.length >= LEGACY_MIN_PASSWORD_LEN && await checkPassword(req.password, acc.salt, acc.pass_hash);
  } finally {
    ipFails.end(ip, !ok, now());
    nameFails.end(key, !ok, now());
  }
  if (!ok) {
    console.warn(`[auth] senha errada para "${name}" de ${ip}`);
    return { ok: false, error: "wrong_password" };
  }
  nameFails.reset(key); // o contador por IP não zera: login na própria conta não "recarrega" tentativas contra outra
  const ch = getCharacterByName(acc.name);
  if (!ch) return { ok: false, error: "invalid_request" };
  const weak = req.password.length < MIN_PASSWORD_LEN;
  return { ok: true, token: issueToken(ch.name, weak, now()), name: ch.name, vocation: ch.vocation as Vocation, isNew: false };
}

/** Rotas HTTP montadas em /api (POST /api/login — ver LoginRequest/LoginResponse em shared). */
export const authRouter = Router();
authRouter.post("/login", async (req, res) => {
  try {
    const r = await handleLogin(req.body as LoginRequest, { ip: req.socket.remoteAddress ?? "?" });
    if (!r.ok && r.error === "too_many_attempts") res.status(429);
    res.json(r);
  } catch (e) {
    console.error("[auth] erro no login", e);
    res.status(500).json({ ok: false, error: "invalid_request" } satisfies LoginResponse);
  }
});

/** Valida (e consome) o token emitido no login. Lança Error se inválido/expirado. */
export function consumeToken(token: string, now = Date.now()): AuthData {
  const entry = typeof token === "string" ? tokens.get(token) : undefined;
  if (entry) {
    tokens.delete(token);
    if (pendingByKey.get(entry.key) === token) pendingByKey.delete(entry.key);
  }
  if (!entry || entry.expires <= now) throw new Error("Token inválido ou expirado");
  if (!getCharacterByName(entry.name)) throw new Error("Personagem não encontrado");
  return { name: entry.name, key: entry.key, weakPassword: entry.weakPassword };
}

/** Marca o personagem como online para `owner` (sessionId). Devolve o dono anterior, se havia outro. */
export function claimOnline(name: string, owner: string): string | undefined {
  const key = nameKey(name);
  const prev = online.get(key);
  online.set(key, owner);
  return prev !== undefined && prev !== owner ? prev : undefined;
}

/** Libera o nome — só se `owner` ainda for o dono (uma sessão chutada não derruba a nova). */
export function releaseOnline(name: string, owner: string): boolean {
  const key = nameKey(name);
  if (online.get(key) !== owner) return false;
  online.delete(key);
  return true;
}

export const onlineOwner = (name: string): string | undefined => online.get(nameKey(name));
