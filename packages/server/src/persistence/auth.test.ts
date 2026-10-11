import { beforeEach, describe, expect, it } from "vitest";
import { initDb } from "./db.ts";
import { consumeToken, handleLogin, setOnline } from "./auth.ts";

describe("auth", () => {
  beforeEach(() => { initDb(":memory:"); });

  it("valida nomes", () => {
    for (const name of ["ab", "a".repeat(17), "Leo123", "Leo!", "", "Leo  ", "  "]) {
      const r = handleLogin({ name, password: "abc", vocation: "knight" });
      if (name.trim() === "Leo") continue; // "Leo  " é aparado e válido
      expect(r, name).toEqual({ ok: false, error: "invalid_name" });
    }
    expect(handleLogin({ name: "  José  da Silva ", password: "abc", vocation: "druid" }))
      .toMatchObject({ ok: true, name: "José da Silva" });
  });

  it("fluxo: need_vocation, criar, senha errada, login existente", () => {
    expect(handleLogin({ name: "Leo", password: "abc" })).toEqual({ ok: false, error: "need_vocation" });
    const created = handleLogin({ name: "Leo", password: "abc", vocation: "knight" });
    expect(created).toMatchObject({ ok: true, isNew: true, vocation: "knight", name: "Leo" });
    expect(handleLogin({ name: "leo", password: "errada" })).toEqual({ ok: false, error: "wrong_password" });
    const again = handleLogin({ name: "leo", password: "abc" });
    expect(again).toMatchObject({ ok: true, isNew: false, name: "Leo" });
  });

  it("token é de uso único", () => {
    const r = handleLogin({ name: "Leo", password: "abc", vocation: "sorcerer" });
    if (!r.ok) throw new Error("login falhou");
    expect(consumeToken(r.token)).toMatchObject({ name: "Leo", vocation: "sorcerer" });
    expect(() => consumeToken(r.token)).toThrow();
    expect(() => consumeToken("lixo")).toThrow();
  });

  it("bloqueia login duplo", () => {
    handleLogin({ name: "Leo", password: "abc", vocation: "knight" });
    setOnline("Leo", true);
    expect(handleLogin({ name: "Leo", password: "abc" })).toEqual({ ok: false, error: "already_online" });
    setOnline("Leo", false);
    expect(handleLogin({ name: "Leo", password: "abc" })).toMatchObject({ ok: true });
  });
});
