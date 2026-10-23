import { DatabaseSync } from "node:sqlite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import {
  createAccountWithCharacter as createAccount, createCharacter, findAccount, getCharacterByName, initDb, listCharacters,
  getKv, loadGroundRows, migrateForTest, nameKey, replaceGroundRows, saveCharacter, setKv,
} from "./db.ts";
import { consumeToken, handleCreateCharacter, handleLogin, handlePlay, resetAuthState } from "./auth.ts";

describe("db: estado do mundo", () => {
  beforeEach(() => { initDb(":memory:"); });

  it("kv: lê, grava e sobrescreve", () => {
    expect(getKv("arena.serverBest")).toBeUndefined();
    setKv("arena.serverBest", "7");
    setKv("arena.serverBest", "9");
    expect(getKv("arena.serverBest")).toBe("9");
  });

  it("itens no chão: substitui a lista inteira, preservando a ordem", () => {
    const row = (x: number, owner: string | null = null) => ({ x, y: 1, item: `{"n":${x}}`, expiresAt: 1000 + x, owner, ownerUntil: owner ? 5 : null });
    replaceGroundRows([row(1), row(2, "kiko"), row(3)]);
    expect(loadGroundRows().map((r) => r.x)).toEqual([1, 2, 3]);
    expect(loadGroundRows()[1]).toMatchObject({ owner: "kiko", ownerUntil: 5, expiresAt: 1002 });
    expect(loadGroundRows()[0]!.createdAt).toBeNull(); // sem "nascimento" (registro antigo)
    replaceGroundRows([{ ...row(9), createdAt: 777 }]);
    expect(loadGroundRows().map((r) => r.x)).toEqual([9]);
    expect(loadGroundRows()[0]!.createdAt).toBe(777);
    replaceGroundRows([]);
    expect(loadGroundRows()).toEqual([]);
  });
});

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

  it("vários personagens por conta; nome de personagem único entre contas", () => {
    const leo = createAccount("Leo", "h", "s", "knight");
    const acc = findAccount("leo")!;
    createCharacter(acc.id, "Leo Mago", "sorcerer");
    expect(listCharacters(acc.id).map((c) => c.name)).toEqual(["Leo", "Leo Mago"]);
    expect(() => createCharacter(acc.id, "LEO MAGO", "druid")).toThrow();
    expect(listCharacters(acc.id)[0]!.id).toBe(leo.id);
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

describe("migração v3 (vários personagens por conta)", () => {
  it("base antiga (v2, 1 personagem por conta) → v3: dados intactos, login da conta mostra o personagem", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lq-mig-"));
    const file = path.join(dir, "old.db");
    const salt = "abcd";
    const hash = crypto.scryptSync("segredo1", salt, 64).toString("hex");
    const old = new DatabaseSync(file);
    // Esquema exato da v2 (v1 + name_key), account_id UNIQUE.
    old.exec(`CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL, name_key TEXT);
      CREATE TABLE characters (id INTEGER PRIMARY KEY, account_id INTEGER UNIQUE NOT NULL REFERENCES accounts(id), name TEXT UNIQUE COLLATE NOCASE NOT NULL,
        vocation TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, x INTEGER, y INTEGER, dir INTEGER NOT NULL DEFAULT 4,
        data TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL, name_key TEXT);
      CREATE UNIQUE INDEX accounts_name_key ON accounts(name_key);
      CREATE UNIQUE INDEX characters_name_key ON characters(name_key);
      PRAGMA user_version = 2;`);
    old.prepare("INSERT INTO accounts VALUES (7, 'Leo', ?, ?, 111, 'leo'), (9, 'Ána', ?, ?, 222, 'ána')").run(hash, salt, hash, salt);
    old.prepare(`INSERT INTO characters (id, account_id, name, vocation, level, xp, x, y, dir, data, updated_at, name_key) VALUES
      (3, 7, 'Leo', 'knight', 12, 9999, 40, 41, 2, '{"gold":500,"skills":{"melee":{"level":30,"tries":5}}}', 333, 'leo'),
      (5, 9, 'Ána', 'druid', 4, 120, NULL, NULL, 4, '{}', 444, 'ána')`).run();
    old.close();

    const d = initDb(file);
    expect((d.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBeGreaterThanOrEqual(4);
    expect(d.prepare("SELECT id, account_id, name, name_key, vocation, level, xp, x, y, dir, data, updated_at FROM characters ORDER BY id").all()).toEqual([
      { id: 3, account_id: 7, name: "Leo", name_key: "leo", vocation: "knight", level: 12, xp: 9999, x: 40, y: 41, dir: 2,
        data: '{"gold":500,"skills":{"melee":{"level":30,"tries":5}}}', updated_at: 333 },
      { id: 5, account_id: 9, name: "Ána", name_key: "ána", vocation: "druid", level: 4, xp: 120, x: null, y: null, dir: 4, data: "{}", updated_at: 444 },
    ]);
    expect(d.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect(d.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });

    resetAuthState();
    const r = await handleLogin({ account: "leo", password: "segredo1" });
    expect(r).toMatchObject({ ok: true, account: "Leo", characters: [{ name: "Leo", vocation: "knight", level: 12 }] });
    if (!r.ok) return;
    // A conta antiga agora aceita mais personagens.
    expect(handleCreateCharacter({ session: r.session, name: "Leo Druida", vocation: "druid" }))
      .toMatchObject({ ok: true, characters: [{ name: "Leo" }, { name: "Leo Druida" }] });
    expect(handleCreateCharacter({ session: r.session, name: "ána", vocation: "druid" })).toEqual({ ok: false, error: "name_taken" });
    const p = handlePlay({ session: r.session, name: "Leo" });
    if (!p.ok) throw new Error("play falhou");
    expect(consumeToken(p.token).name).toBe("Leo");
    expect(getCharacterByName("Leo")?.data).toEqual({ gold: 500, skills: { melee: { level: 30, tries: 5 } } });

    // Reabrir não reaplica a migração.
    initDb(file);
    expect(listCharacters(7)).toHaveLength(2);
    initDb(":memory:");
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("v1 → v3 numa tacada (sem name_key)", () => {
    const d = new DatabaseSync(":memory:");
    d.exec(`CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE characters (id INTEGER PRIMARY KEY, account_id INTEGER UNIQUE NOT NULL REFERENCES accounts(id), name TEXT UNIQUE COLLATE NOCASE NOT NULL,
        vocation TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, x INTEGER, y INTEGER, dir INTEGER NOT NULL DEFAULT 4,
        data TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL);
      INSERT INTO accounts VALUES (1, 'Bia', 'h', 's', 0), (2, 'Caio', 'h', 's', 0);
      INSERT INTO characters (id, account_id, name, vocation, updated_at) VALUES (10, 1, 'Bia', 'paladin', 0), (20, 2, 'Caio', 'knight', 0);
      PRAGMA user_version = 1;`);
    migrateForTest(d);
    d.prepare("INSERT INTO characters (account_id, name, name_key, vocation, updated_at) VALUES (1, 'Bia Dois', 'bia dois', 'druid', 0)").run();
    expect(d.prepare("SELECT COUNT(*) AS n FROM characters WHERE account_id = 1").get()).toEqual({ n: 2 });
    expect(() => d.prepare("INSERT INTO characters (account_id, name, name_key, vocation, updated_at) VALUES (2, 'BIA', 'bia', 'druid', 0)").run()).toThrow();
  });
});

describe("migração v3 → atual (base de produção antiga com dados reais)", () => {
  it("1 conta com 2 personagens (inventário, missões, atalhos sem hotkeysVersion) chega intacta à versão atual", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lq-mig3-"));
    const file = path.join(dir, "v3.db");
    const old = new DatabaseSync(file);
    // Esquema exato da v3 (ver MIGRATIONS[2] em db.ts): name_key nas duas tabelas, account_id sem UNIQUE, sem
    // password_resets/deleted_characters (v4), kv/ground_items (v5), account_sessions (v6) nem created_at (v7).
    old.exec(`CREATE TABLE accounts (id INTEGER PRIMARY KEY, name TEXT UNIQUE COLLATE NOCASE NOT NULL, pass_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL, name_key TEXT);
      CREATE UNIQUE INDEX accounts_name_key ON accounts(name_key);
      CREATE TABLE characters (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), name TEXT UNIQUE COLLATE NOCASE NOT NULL,
        name_key TEXT NOT NULL, vocation TEXT NOT NULL, level INTEGER NOT NULL DEFAULT 1, xp INTEGER NOT NULL DEFAULT 0, x INTEGER, y INTEGER,
        dir INTEGER NOT NULL DEFAULT 4, data TEXT NOT NULL DEFAULT '{}', updated_at INTEGER NOT NULL);
      CREATE UNIQUE INDEX characters_name_key ON characters(name_key);
      CREATE INDEX characters_account ON characters(account_id);
      PRAGMA user_version = 3;`);
    const dataLeo = {
      gold: 1234, hp: 300, mana: 80, stance: "offensive", chase: true,
      skills: { melee: { level: 25, tries: 7 }, shield: { level: 18, tries: 0 } },
      equipment: { weapon: { uid: "w1", defId: "long_sword", count: 1, rarity: "rare" }, armor: { uid: "a1", defId: "leather_armor", count: 1 } },
      backpack: [{ uid: "b1", defId: "health_potion", count: 3 }, null, { uid: "b2", defId: "meat", count: 5 }, null, null, null, null, null, null, null],
      depot: [{ uid: "d1", defId: "wolf_pelt", count: 12 }],
      quests: { active: { rats_barn: { progress: 2 } }, done: ["first_steps"] },
      hotkeys: [{ key: "1", spellId: "exura" }, { key: "2", spellId: "exori" }], // barra antiga: sem hotkeysVersion
      outfit: "knight", addons: 1, explored: "AAECAwQ=", exploredW: 400,
    };
    const dataAna = { gold: 0, hotkeys: [{ key: "1", spellId: "exura" }], depot: [], ach: { done: {}, stats: { kills: 3 }, killed: ["rat"] } };
    old.prepare("INSERT INTO accounts VALUES (4, 'Leo', 'hash', 'salt', 100, 'leo')").run();
    old.prepare(`INSERT INTO characters (id, account_id, name, name_key, vocation, level, xp, x, y, dir, data, updated_at) VALUES
      (11, 4, 'Leo', 'leo', 'knight', 23, 150000, 79, 92, 2, ?, 200),
      (12, 4, 'Ána Mago', 'ána mago', 'sorcerer', 3, 90, NULL, NULL, 4, ?, 300)`).run(JSON.stringify(dataLeo), JSON.stringify(dataAna));
    old.close();

    const d = initDb(file);
    // Migrou até a versão atual (todas as tabelas novas existem) e a base está íntegra.
    const version = (d.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
    expect(version).toBeGreaterThanOrEqual(7);
    const tables = (d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[]).map((t) => t.name);
    expect(tables).toEqual(expect.arrayContaining(["accounts", "characters", "password_resets", "deleted_characters", "kv", "ground_items", "account_sessions"]));
    expect(d.prepare("PRAGMA integrity_check").get()).toEqual({ integrity_check: "ok" });
    expect(d.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    expect((d.prepare("PRAGMA table_info(ground_items)").all() as { name: string }[]).map((c) => c.name)).toContain("created_at");

    // Personagens carregam pelo nome (chave NFC + minúsculas) com os dados exatamente como estavam.
    const leo = getCharacterByName("LEO")!;
    expect(leo).toMatchObject({ id: 11, accountId: 4, name: "Leo", vocation: "knight", level: 23, xp: 150000, x: 79, y: 92, dir: 2 });
    expect(leo.data).toEqual(dataLeo);
    expect(leo.data.hotkeysVersion).toBeUndefined(); // a migração do banco não mexe na barra: isso é do login
    const ana = getCharacterByName("ÁNA MAGO")!;
    expect(ana).toMatchObject({ id: 12, accountId: 4, name: "Ána Mago", vocation: "sorcerer", level: 3, xp: 90, x: null, y: null });
    expect(ana.data).toEqual(dataAna);
    expect(listCharacters(4).map((c) => c.name)).toEqual(["Leo", "Ána Mago"]);
    expect(findAccount("leo")).toMatchObject({ id: 4, pass_hash: "hash", salt: "salt" });

    // Itens no chão: a tabela nasce vazia na migração e aceita o ciclo completo (gravar → ler, com created_at da v7).
    expect(loadGroundRows()).toEqual([]);
    replaceGroundRows([
      { x: 60, y: 80, item: '{"uid":"g1","defId":"mana_potion","count":1}', expiresAt: 5000, owner: null, ownerUntil: null, createdAt: 4000 },
      { x: 61, y: 80, item: '{"uid":"g2","defId":"cheese","count":2}', expiresAt: 6000, owner: null, ownerUntil: null },
    ]);
    expect(loadGroundRows()).toEqual([
      { x: 60, y: 80, item: '{"uid":"g1","defId":"mana_potion","count":1}', expiresAt: 5000, owner: null, ownerUntil: null, createdAt: 4000 },
      { x: 61, y: 80, item: '{"uid":"g2","defId":"cheese","count":2}', expiresAt: 6000, owner: null, ownerUntil: null, createdAt: null },
    ]);

    // Reabrir não reaplica nada nem perde linhas (initDb fecha o handle anterior: a versão foi lida antes).
    const d2 = initDb(file);
    expect((d2.prepare("PRAGMA user_version").get() as { user_version: number }).user_version).toBe(version);
    expect(getCharacterByName("Leo")?.data).toEqual(dataLeo);
    expect(loadGroundRows()).toHaveLength(2);
    initDb(":memory:");
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
