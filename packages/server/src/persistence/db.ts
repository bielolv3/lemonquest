import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import type { Vocation } from "@tibinha/shared";
import type { CharacterData, CharacterRecord } from "./types.ts";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

/** Migrações incrementais: índice i leva a base da versão i para i+1 (PRAGMA user_version). */
const MIGRATIONS: string[] = [
  `CREATE TABLE accounts (
     id INTEGER PRIMARY KEY,
     name TEXT UNIQUE COLLATE NOCASE NOT NULL,
     pass_hash TEXT NOT NULL,
     salt TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE characters (
     id INTEGER PRIMARY KEY,
     account_id INTEGER UNIQUE NOT NULL REFERENCES accounts(id),
     name TEXT UNIQUE COLLATE NOCASE NOT NULL,
     vocation TEXT NOT NULL,
     level INTEGER NOT NULL DEFAULT 1,
     xp INTEGER NOT NULL DEFAULT 0,
     x INTEGER,
     y INTEGER,
     dir INTEGER NOT NULL DEFAULT 4,
     data TEXT NOT NULL DEFAULT '{}',
     updated_at INTEGER NOT NULL
   );`,
];

export interface AccountRow {
  id: number;
  name: string;
  pass_hash: string;
  salt: string;
  created_at: number;
}

let db: DatabaseSync | null = null;

function migrate(d: DatabaseSync) {
  const cur = (d.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
  for (let v = cur; v < MIGRATIONS.length; v++) {
    d.exec("BEGIN");
    try {
      d.exec(MIGRATIONS[v]!);
      d.exec(`PRAGMA user_version = ${v + 1}`);
      d.exec("COMMIT");
    } catch (e) {
      d.exec("ROLLBACK");
      throw e;
    }
  }
}

/** Abre (ou reabre) a base. `file` = caminho ou ":memory:". Útil para testes. */
export function initDb(file?: string): DatabaseSync {
  db?.close();
  const target = file ?? process.env.TIBINHA_DB ?? path.join(rootDir, "data", "tibinha.db");
  if (target !== ":memory:") fs.mkdirSync(path.dirname(target), { recursive: true });
  const d = new DatabaseSync(target);
  d.exec("PRAGMA journal_mode = WAL");
  d.exec("PRAGMA foreign_keys = ON");
  migrate(d);
  db = d;
  return d;
}

function getDb(): DatabaseSync {
  return db ?? initDb();
}

interface CharRow {
  id: number; name: string; vocation: string; level: number; xp: number;
  x: number | null; y: number | null; dir: number; data: string | null;
}

const toRecord = (r: CharRow): CharacterRecord => ({
  id: r.id, name: r.name, vocation: r.vocation as Vocation, level: r.level, xp: r.xp,
  x: r.x, y: r.y, dir: r.dir, data: parseData(r.data),
});

function parseData(raw: string | null): CharacterData {
  try { return raw ? (JSON.parse(raw) as CharacterData) : {}; } catch { return {}; }
}

export function findAccount(name: string): AccountRow | undefined {
  return getDb().prepare("SELECT * FROM accounts WHERE name = ?").get(name) as AccountRow | undefined;
}

/** Cria conta + personagem (mesmo nome) numa transação. */
export function createAccount(name: string, passHash: string, salt: string, vocation: Vocation): CharacterRecord {
  const d = getDb();
  const now = Date.now();
  d.exec("BEGIN");
  try {
    const acc = d.prepare("INSERT INTO accounts (name, pass_hash, salt, created_at) VALUES (?, ?, ?, ?)")
      .run(name, passHash, salt, now);
    const accountId = Number(acc.lastInsertRowid);
    const ch = d.prepare(
      "INSERT INTO characters (account_id, name, vocation, level, xp, x, y, dir, updated_at) VALUES (?, ?, ?, 1, 0, NULL, NULL, 4, ?)",
    ).run(accountId, name, vocation, now);
    d.exec("COMMIT");
    return { id: Number(ch.lastInsertRowid), name, vocation, level: 1, xp: 0, x: null, y: null, dir: 4, data: {} };
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}

export function getCharacterByName(name: string): CharacterRecord | undefined {
  const r = getDb().prepare("SELECT * FROM characters WHERE name = ?").get(name) as CharRow | undefined;
  return r ? toRecord(r) : undefined;
}

export function saveCharacter(c: CharacterRecord): void {
  getDb().prepare(
    "UPDATE characters SET vocation = ?, level = ?, xp = ?, x = ?, y = ?, dir = ?, data = ?, updated_at = ? WHERE id = ?",
  ).run(c.vocation, c.level, c.xp, c.x, c.y, c.dir, JSON.stringify(c.data ?? {}), Date.now(), c.id);
}
