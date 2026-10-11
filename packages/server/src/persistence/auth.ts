import crypto from "node:crypto";
import { Router } from "express";
import { MAX_NAME_LEN, VOCATIONS, type LoginRequest, type LoginResponse, type Vocation } from "@tibinha/shared";
import { createAccount, findAccount, getCharacterByName } from "./db.ts";
import type { CharacterRecord } from "./types.ts";

const TOKEN_TTL_MS = 60_000;
const MIN_NAME_LEN = 3;
const MIN_PASSWORD_LEN = 3;

const tokens = new Map<string, { name: string; expires: number }>();
const online = new Set<string>();
const key = (name: string) => name.toLocaleLowerCase("pt-BR");

/** Letras (inclusive acentuadas), palavras separadas por um único espaço. */
export function normalizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim().replace(/\s+/g, " ");
  if (name.length < MIN_NAME_LEN || name.length > MAX_NAME_LEN) return null;
  if (!/^\p{L}+(?: \p{L}+)*$/u.test(name)) return null;
  return name;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function checkPassword(password: string, salt: string, hash: string): boolean {
  const a = Buffer.from(hashPassword(password, salt), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function issueToken(name: string): string {
  const now = Date.now();
  for (const [t, v] of tokens) if (v.expires <= now) tokens.delete(t);
  const token = crypto.randomUUID();
  tokens.set(token, { name, expires: now + TOKEN_TTL_MS });
  return token;
}

/** Lógica pura do login (testável sem HTTP). */
export function handleLogin(req: LoginRequest): LoginResponse {
  if (!req || typeof req !== "object" || typeof req.password !== "string") {
    return { ok: false, error: "invalid_request" };
  }
  const name = normalizeName(req.name);
  if (!name) return { ok: false, error: "invalid_name" };
  if (req.password.length < MIN_PASSWORD_LEN || req.password.length > 200) {
    return { ok: false, error: "wrong_password" };
  }

  const acc = findAccount(name);
  if (!acc) {
    if (req.vocation === undefined) return { ok: false, error: "need_vocation" };
    if (!VOCATIONS.includes(req.vocation)) return { ok: false, error: "invalid_request" };
    const salt = crypto.randomBytes(16).toString("hex");
    const rec = createAccount(name, hashPassword(req.password, salt), salt, req.vocation);
    return { ok: true, token: issueToken(rec.name), name: rec.name, vocation: rec.vocation, isNew: true };
  }

  if (!checkPassword(req.password, acc.salt, acc.pass_hash)) return { ok: false, error: "wrong_password" };
  const ch = getCharacterByName(acc.name);
  if (!ch) return { ok: false, error: "invalid_request" };
  if (online.has(key(ch.name))) return { ok: false, error: "already_online" };
  return { ok: true, token: issueToken(ch.name), name: ch.name, vocation: ch.vocation as Vocation, isNew: false };
}

/** Rotas HTTP montadas em /api (POST /api/login — ver LoginRequest/LoginResponse em shared). */
export const authRouter = Router();
authRouter.post("/login", (req, res) => {
  try {
    res.json(handleLogin(req.body as LoginRequest));
  } catch (e) {
    console.error("[auth] erro no login", e);
    res.status(500).json({ ok: false, error: "invalid_request" } satisfies LoginResponse);
  }
});

/** Valida o token emitido no login e devolve o personagem. Lança Error se inválido/expirado. */
export function consumeToken(token: string): CharacterRecord {
  const entry = tokens.get(token);
  tokens.delete(token);
  if (!entry || entry.expires <= Date.now()) throw new Error("Token inválido ou expirado");
  const rec = getCharacterByName(entry.name);
  if (!rec) throw new Error("Personagem não encontrado");
  return rec;
}

/** Marca o personagem como online/offline (impede login duplo). */
export function setOnline(name: string, isOnline: boolean): void {
  if (isOnline) online.add(key(name));
  else online.delete(key(name));
}
