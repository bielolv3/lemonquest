import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccount, findAccount, getCharacterByName, initDb, migrateForTest, nameKey, saveCharacter } from "./db.ts";

describe("db", () => {
  beforeEach(() => { initDb(":memory:"); });

  it("cria e encontra conta/personagem (nome case-insensitive)", () => {
    const rec = createAccount("Leo", "hash", "salt", "knight");
    expect(rec).toMatchObject({ name: "Leo", vocation: "knight", level: 1, xp: 0, x: null, y: null, dir: 4 });
    expect(findAccount("leo")?.pass_hash).toBe("hash");
    expect(getCharacterByName("LEO")?.id).toBe(rec.id);
    expect(findAccount("outro")).toBeUndefined();
  });

  it("rejeita nome duplicado, inclusive com acentos em outra caixa ou forma NFD", () => {
    createAccount("Leo", "h", "s", "druid");
    expect(() => createAccount("leo", "h", "s", "druid")).toThrow();
    createAccount("Ána", "h", "s", "druid");
    expect(() => createAccount("ÁNA", "h", "s", "druid")).toThrow();
    expect(() => createAccount("Ána", "h", "s", "druid")).toThrow();
    expect(findAccount("áNA")?.name).toBe("Ána");
    expect(nameKey("ÁNA")).toBe("ána");
  });

  it("saveCharacter persiste os campos", () => {
    const rec = createAccount("Ana", "h", "s", "paladin");
    saveCharacter({ ...rec, level: 5, xp: 123, x: 10, y: 12, dir: 2 });
    expect(getCharacterByName("Ana")).toMatchObject({ level: 5, xp: 123, x: 10, y: 12, dir: 2 });
  });

  it("migração v2: backfill do name_key; colisão antiga é mantida e logada", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = new DatabaseSync(":memory:");
    // Base v1 (antes do name_key): "Ána" e "ána" coexistiam (NOCASE só cobre ASCII).
    d.exec(`CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE characters (id INTEGER PRIMARY KEY, account_id INTEGER UNIQUE NOT NULL REFERENCES accounts(id), name TEXT UNIQUE COLLATE NOCASE NOT NULL,
        vocation TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, x INTEGER, y INTEGER, dir INTEGER NOT NULL DEFAULT 4,
        data TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL);
      INSERT INTO accounts VALUES (1, 'Ána', 'h', 's', 0), (2, 'ána', 'h', 's', 0), (3, 'Leo', 'h', 's', 0);
      INSERT INTO characters (id, account_id, name, vocation, updated_at) VALUES (1, 1, 'Ána', 'knight', 0), (2, 2, 'ána', 'knight', 0), (3, 3, 'Leo', 'knight', 0);
      PRAGMA user_version = 1;`);
    migrateForTest(d);
    const keys = d.prepare("SELECT id, name_key FROM accounts ORDER BY id").all();
    expect(keys).toEqual([{ id: 1, name_key: "ána" }, { id: 2, name_key: "ána#2" }, { id: 3, name_key: "leo" }]);
    expect(d.prepare("SELECT COUNT(*) AS n FROM characters").get()).toEqual({ n: 3 });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
