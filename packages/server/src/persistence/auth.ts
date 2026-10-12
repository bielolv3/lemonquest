import crypto from "node:crypto";
import { promisify } from "node:util";
import { Router, type Response } from "express";
import {
  MAX_CHARACTERS_PER_ACCOUNT, MAX_NAME_LEN, VOCATIONS,
  type AccountSession, type AuthFail, type CharacterSummary, type CreateCharacterRequest, type LoginRequest,
  type PlayRequest, type PlayResponse,
} from "@lemonquest/shared";
import {
  countCharacters, createAccount, createCharacter, findAccount, getCharacterByName, listCharacters, nameKey,
} from "./db.ts";
import { FailureLimiter, RateCounter } from "./ratelimit.ts";
import type { CharacterRecord } from "./types.ts";
import { loadOutfit } from "../systems/outfit.ts";

/** Validade do token de entrada no mundo (uso único, emitido pelo /api/play). */
export const TOKEN_TTL_MS = 60_000;
/** Sessão da conta (lista de personagens): expira após 30 min sem uso; logout invalida. */
export const SESSION_IDLE_MS = 30 * 60_000;
/** Sessões simultâneas por conta (abas/PCs): passou disso, a mais antiga cai. */
const MAX_SESSIONS_PER_ACCOUNT = 8;
const MIN_NAME_LEN = 3;
export const MIN_ACCOUNT_LEN = 3;
export const MAX_ACCOUNT_LEN = 20;
/** Senha mínima para contas NOVAS. Contas antigas (mínimo antigo 3) ainda entram, com aviso. */
export const MIN_PASSWORD_LEN = 6;
const LEGACY_MIN_PASSWORD_LEN = 3;
const MAX_PASSWORD_LEN = 200;

/** 5 falhas/min (por IP e por conta) → 5 min de bloqueio. */
export const LOGIN_MAX_FAILS = 5;
export const LOGIN_FAIL_WINDOW_MS = 60_000;
export const LOGIN_LOCK_MS = 5 * 60_000;
/** 3 contas novas por IP por hora. */
export const CREATE_MAX_PER_HOUR = 3;
/** 10 tentativas de criar personagem por conta por hora (anti-spam/varredura de nomes). */
export const CHAR_CREATE_MAX_PER_HOUR = 10;

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: string, len: number) => Promise<Buffer>;

/** Dados que o onAuth estático entrega ao onJoin (client.auth). Precisa ser JSON puro (passa por IPC). */
export interface AuthData {
  name: string;
  key: string;
  /** Senha abaixo do mínimo atual (conta antiga): o jogo sugere trocar. */
  weakPassword: boolean;
}

interface TokenEntry extends AuthData { expires: number }
const tokens = new Map<string, TokenEntry>();
/** Reserva do nome no /play: um token pendente por personagem (pedido novo invalida o anterior). */
const pendingByKey = new Map<string, string>();
/** Personagens no mundo: name_key -> sessionId dono. */
const online = new Map<string, string>();

interface AccountSessionEntry { accountId: number; account: string; weakPassword: boolean; created: number; expires: number }
/** Sessões de conta em memória: token aleatório (32 bytes) → conta. */
const sessions = new Map<string, AccountSessionEntry>();

const ipFails = new FailureLimiter(LOGIN_MAX_FAILS, LOGIN_FAIL_WINDOW_MS, LOGIN_LOCK_MS);
const accountFails = new FailureLimiter(LOGIN_MAX_FAILS, LOGIN_FAIL_WINDOW_MS, LOGIN_LOCK_MS);
const creations = new RateCounter(CREATE_MAX_PER_HOUR, 3600_000);
const charCreations = new RateCounter(CHAR_CREATE_MAX_PER_HOUR, 3600_000);
let lastSweep = 0;

/** Zera o estado em memória (testes). */
export function resetAuthState(): void {
  tokens.clear(); pendingByKey.clear(); online.clear(); sessions.clear();
  for (const l of [ipFails, accountFails]) l.sweep(Number.MAX_SAFE_INTEGER);
  creations.sweep(Number.MAX_SAFE_INTEGER);
  charCreations.sweep(Number.MAX_SAFE_INTEGER);
  lastSweep = 0;
}

const LETTER = String.raw`(?:(?=\p{L})\p{Script=Latin})`;
const NAME_RE = new RegExp(`^${LETTER}+(?: ${LETTER}+)*$`, "u");
const ACC_CHAR = String.raw`(?:${LETTER}|[0-9._-])`;
const ACCOUNT_RE = new RegExp(`^${ACC_CHAR}+(?: ${ACC_CHAR}+)*$`, "u");

/** Nome de PERSONAGEM: NFC; só letras do alfabeto latino (com acentos), palavras separadas por um único espaço. */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < MIN_NAME_LEN || name.length > MAX_NAME_LEN) return null;
  if (!NAME_RE.test(name)) return null;
  return name;
}

/** Nome de CONTA (privado): NFC; 3–20 letras latinas/dígitos e . _ - (espaços simples entre partes). */
export function normalizeAccount(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.normalize("NFC").trim().replace(/\s+/g, " ");
  if (name.length < MIN_ACCOUNT_LEN || name.length > MAX_ACCOUNT_LEN) return null;
  if (!ACCOUNT_RE.test(name)) return null;
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
  for (const [t, s] of sessions) if (s.expires <= now) sessions.delete(t);
  ipFails.sweep(now); accountFails.sweep(now); creations.sweep(now); charCreations.sweep(now);
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

function openSession(accountId: number, account: string, weakPassword: boolean, now: number): string {
  const mine = [...sessions].filter(([, s]) => s.accountId === accountId).sort((a, b) => a[1].created - b[1].created);
  while (mine.length >= MAX_SESSIONS_PER_ACCOUNT) sessions.delete(mine.shift()![0]);
  const token = crypto.randomBytes(32).toString("base64url");
  sessions.set(token, { accountId, account, weakPassword, created: now, expires: now + SESSION_IDLE_MS });
  return token;
}

/** Sessão válida (e renovada: expiração conta a partir do último uso). */
function touchSession(token: unknown, now: number): AccountSessionEntry | null {
  if (typeof token !== "string" || token.length > 100) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires <= now) { sessions.delete(token); return null; }
  s.expires = now + SESSION_IDLE_MS;
  return s;
}

export function summarize(rec: CharacterRecord): CharacterSummary {
  const look = loadOutfit(rec);
  const s: CharacterSummary = { name: rec.name, vocation: rec.vocation, level: rec.level, outfit: look.outfit, addons: look.addons };
  const t = rec.data.offlineTraining;
  if (t && typeof t.skill === "string" && typeof t.sinceMs === "number") s.training = { skill: t.skill, sinceMs: t.sinceMs };
  if (online.has(nameKey(rec.name))) s.online = true;
  return s;
}

function sessionResponse(token: string, s: AccountSessionEntry): AccountSession {
  return { ok: true, session: token, account: s.account, characters: listCharacters(s.accountId).map(summarize) };
}

const limited = (ms: number): AuthFail => {
  const s = Math.max(1, Math.ceil(ms / 1000));
  return { ok: false, error: "too_many_attempts", retryAfterSec: s, message: `Muitas tentativas. Tente de novo em ${s >= 60 ? `${Math.ceil(s / 60)} min` : `${s} s`}.` };
};
const fail = (error: AuthFail["error"], message?: string): AuthFail => (message ? { ok: false, error, message } : { ok: false, error });

export interface LoginContext {
  /** IP do cliente (req.socket.remoteAddress — sem proxy na LAN). */
  ip?: string;
  now?: () => number;
}

/** POST /api/login — entra na conta (ou cria, com create=true) e devolve a sessão + lista de personagens. */
export async function handleLogin(req: LoginRequest, ctx: LoginContext = {}): Promise<AccountSession> {
  const now = ctx.now ?? Date.now;
  const ip = ctx.ip ?? "?";
  if (!req || typeof req !== "object" || typeof req.password !== "string") return fail("invalid_request");
  const account = normalizeAccount(req.account);
  if (!account) return fail("invalid_account");
  if (req.password.length > MAX_PASSWORD_LEN) return fail("wrong_password");
  const key = nameKey(account);
  sweep(now());

  const wait = Math.max(ipFails.lockedFor(ip, now()), accountFails.lockedFor(key, now()));
  if (wait > 0) return limited(wait);

  const acc = findAccount(account);
  if (req.create === true) {
    if (acc) return fail("account_taken");
    if (req.password.length < MIN_PASSWORD_LEN) {
      return fail("weak_password", `A senha precisa ter pelo menos ${MIN_PASSWORD_LEN} caracteres.`);
    }
    const cw = creations.waitFor(ip, now());
    if (cw > 0) return limited(cw);
    creations.record(ip, now());
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = await hashPassword(req.password, salt);
    let row;
    try {
      row = createAccount(account, hash, salt);
    } catch {
      return fail("account_taken"); // corrida: alguém criou a mesma conta (ou variante de caixa/acentos) durante o hash
    }
    console.log(`[auth] conta criada: ${row.name} de ${ip}`);
    const s = openSession(row.id, row.name, false, now());
    return sessionResponse(s, sessions.get(s)!);
  }

  if (!acc) {
    // Conta inexistente conta como falha do IP (freia varredura de nomes de conta).
    ipFails.begin(ip);
    ipFails.end(ip, true, now());
    return fail("no_account");
  }

  ipFails.begin(ip);
  accountFails.begin(key);
  let ok = false;
  try {
    ok = req.password.length >= LEGACY_MIN_PASSWORD_LEN && await checkPassword(req.password, acc.salt, acc.pass_hash);
  } finally {
    ipFails.end(ip, !ok, now());
    accountFails.end(key, !ok, now());
  }
  if (!ok) {
    console.warn(`[auth] senha errada para a conta "${account}" de ${ip}`);
    return fail("wrong_password");
  }
  accountFails.reset(key); // o contador por IP não zera: login na própria conta não "recarrega" tentativas contra outra
  const s = openSession(acc.id, acc.name, req.password.length < MIN_PASSWORD_LEN, now());
  return sessionResponse(s, sessions.get(s)!);
}

/** POST /api/characters — cria um personagem na conta da sessão. */
export function handleCreateCharacter(req: CreateCharacterRequest, ctx: LoginContext = {}): AccountSession {
  const now = (ctx.now ?? Date.now)();
  if (!req || typeof req !== "object") return fail("invalid_request");
  sweep(now);
  const s = touchSession(req.session, now);
  if (!s) return fail("invalid_session");
  if (countCharacters(s.accountId) >= MAX_CHARACTERS_PER_ACCOUNT) return fail("too_many_characters");
  // Toda tentativa conta (inclusive nome inválido/ocupado): freia spam e varredura de nomes.
  const ck = String(s.accountId);
  const cw = charCreations.waitFor(ck, now);
  if (cw > 0) return limited(cw);
  charCreations.record(ck, now);
  const name = normalizeName(req.name);
  if (!name) return fail("invalid_name");
  if (!VOCATIONS.includes(req.vocation)) return fail("invalid_request");
  if (getCharacterByName(name)) return fail("name_taken");
  let rec;
  try {
    rec = createCharacter(s.accountId, name, req.vocation);
  } catch {
    return fail("name_taken");
  }
  console.log(`[auth] personagem criado: ${rec.name} (${rec.vocation}) na conta ${s.account}`);
  return sessionResponse(req.session, s);
}

/** POST /api/play — emite o token de uso único para entrar no mundo com um personagem da conta. */
export function handlePlay(req: PlayRequest, ctx: LoginContext = {}): PlayResponse {
  const now = (ctx.now ?? Date.now)();
  if (!req || typeof req !== "object") return fail("invalid_request");
  sweep(now);
  const s = touchSession(req.session, now);
  if (!s) return fail("invalid_session");
  if (typeof req.name !== "string" || req.name.length > 64) return fail("no_character");
  const key = nameKey(req.name.normalize("NFC").trim());
  const rec = listCharacters(s.accountId).find((c) => nameKey(c.name) === key);
  if (!rec) return fail("no_character");
  // Personagem já online: o join com este token derruba a sessão antiga (CLOSE_REPLACED, ver WorldRoom.onJoin).
  return { ok: true, token: issueToken(rec.name, s.weakPassword, now), name: rec.name, vocation: rec.vocation };
}

/** POST /api/session — revalida uma sessão guardada (voltar à lista de personagens após desconectar). */
export function handleResume(req: { session?: unknown }, ctx: LoginContext = {}): AccountSession {
  const now = (ctx.now ?? Date.now)();
  sweep(now);
  const s = touchSession(req?.session, now);
  if (!s) return fail("invalid_session");
  return sessionResponse(req.session as string, s);
}

/** POST /api/logout — encerra a sessão da conta. */
export function handleLogout(req: { session?: unknown }): { ok: true } {
  if (typeof req?.session === "string") sessions.delete(req.session);
  return { ok: true };
}

function send(res: Response, r: { ok: boolean; error?: string }) {
  if (!r.ok && r.error === "too_many_attempts") res.status(429);
  else if (!r.ok && r.error === "invalid_session") res.status(401);
  res.json(r);
}

function route(fn: (body: any, ctx: LoginContext) => Promise<{ ok: boolean; error?: string }> | { ok: boolean; error?: string }) {
  return async (req: import("express").Request, res: Response) => {
    try {
      send(res, await fn(req.body ?? {}, { ip: req.socket.remoteAddress ?? "?" }));
    } catch (e) {
      console.error(`[auth] erro em ${req.path}`, e);
      res.status(500).json({ ok: false, error: "invalid_request" } satisfies AuthFail);
    }
  };
}

/** Rotas HTTP montadas em /api (ver o fluxo de contas em shared/messages.ts). */
export const authRouter = Router();
authRouter.post("/login", route(handleLogin));
authRouter.post("/session", route(handleResume));
authRouter.post("/characters", route(handleCreateCharacter));
authRouter.post("/play", route(handlePlay));
authRouter.post("/logout", route(handleLogout));

/** Valida (e consome) o token emitido no /play. Lança Error se inválido/expirado. */
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
