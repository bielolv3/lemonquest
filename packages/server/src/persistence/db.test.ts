import { beforeEach, describe, expect, it } from "vitest";
import { createAccount, findAccount, getCharacterByName, initDb, saveCharacter } from "./db.ts";

describe("db", () => {
  beforeEach(() => { initDb(":memory:"); });

  it("cria e encontra conta/personagem (nome case-insensitive)", () => {
    const rec = createAccount("Leo", "hash", "salt", "knight");
    expect(rec).toMatchObject({ name: "Leo", vocation: "knight", level: 1, xp: 0, x: null, y: null, dir: 4 });
    expect(findAccount("leo")?.pass_hash).toBe("hash");
    expect(getCharacterByName("LEO")?.id).toBe(rec.id);
    expect(findAccount("outro")).toBeUndefined();
  });

  it("rejeita nome duplicado e não deixa lixo", () => {
    createAccount("Leo", "h", "s", "druid");
    expect(() => createAccount("leo", "h", "s", "druid")).toThrow();
  });

  it("saveCharacter persiste os campos", () => {
    const rec = createAccount("Ana", "h", "s", "paladin");
    saveCharacter({ ...rec, level: 5, xp: 123, x: 10, y: 12, dir: 2 });
    expect(getCharacterByName("Ana")).toMatchObject({ level: 5, xp: 123, x: 10, y: 12, dir: 2 });
  });
});
