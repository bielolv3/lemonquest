import { beforeEach, describe, expect, it, vi } from "vitest";
import { initDb } from "./db.ts";
import {
  CREATE_MAX_PER_HOUR, LOGIN_LOCK_MS, LOGIN_MAX_FAILS, claimOnline, consumeToken, handleLogin, normalizeName, onlineOwner,
  releaseOnline, resetAuthState,
} from "./auth.ts";

describe("auth", () => {
  beforeEach(() => {
    initDb(":memory:");
    resetAuthState();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("valida nomes (NFC, só alfabeto latino, espaços simples)", async () => {
    for (const name of ["ab", "a".repeat(17), "Leo123", "Leo!", "", "  ", "Лео", "Λεων", "Leo_X", "Le​o"]) {
      expect(normalizeName(name), name).toBeNull();
    }
    expect(normalizeName("  José  da Silva ")).toBe("José da Silva");
    expect(normalizeName("José")).toBe("José"); // NFD → NFC
    expect(await handleLogin({ name: "Leo123", password: "segredo1", vocation: "knight" })).toEqual({ ok: false, error: "invalid_name" });
  });

  it("fluxo: need_vocation, senha fraca, criar, senha errada, login existente", async () => {
    expect(await handleLogin({ name: "Leo", password: "segredo1" })).toEqual({ ok: false, error: "need_vocation" });
    expect(await handleLogin({ name: "Leo", password: "abc", vocation: "knight" })).toMatchObject({ ok: false, error: "weak_password" });
    const created = await handleLogin({ name: "Leo", password: "segredo1", vocation: "knight" });
    expect(created).toMatchObject({ ok: true, isNew: true, vocation: "knight", name: "Leo" });
    expect(await handleLogin({ name: "leo", password: "errada" })).toEqual({ ok: false, error: "wrong_password" });
    expect(await handleLogin({ name: "LEO", password: "segredo1" })).toMatchObject({ ok: true, isNew: false, name: "Leo" });
  });

  it("acentos/caixa: Ána e ÁNA são o mesmo personagem", async () => {
    await handleLogin({ name: "Ána", password: "segredo1", vocation: "druid" });
    expect(await handleLogin({ name: "ÁNA", password: "segredo1" })).toMatchObject({ ok: true, name: "Ána" });
    expect(await handleLogin({ name: "Ána", password: "segredo1" })).toMatchObject({ ok: true, name: "Ána" });
  });

  it("token é de uso único e traz o aviso de senha fraca", async () => {
    const r = await handleLogin({ name: "Leo", password: "segredo1", vocation: "sorcerer" });
    if (!r.ok) throw new Error("login falhou");
    expect(consumeToken(r.token)).toEqual({ name: "Leo", key: "leo", weakPassword: false });
    expect(() => consumeToken(r.token)).toThrow();
    expect(() => consumeToken("lixo")).toThrow();
  });

  it("token expira", async () => {
    const r = await handleLogin({ name: "Leo", password: "segredo1", vocation: "sorcerer" });
    if (!r.ok) throw new Error("login falhou");
    expect(() => consumeToken(r.token, Date.now() + 61_000)).toThrow();
  });

  it("brute force: 5 falhas → bloqueio (por nome e por IP) que expira", async () => {
    let t = 1_000_000;
    const now = () => t;
    await handleLogin({ name: "Leo", password: "segredo1", vocation: "knight" }, { ip: "1.1.1.1", now });
    for (let i = 0; i < LOGIN_MAX_FAILS; i++) {
      expect(await handleLogin({ name: "Leo", password: "errada" + i }, { ip: "6.6.6.6", now })).toMatchObject({ error: "wrong_password" });
    }
    // Bloqueado mesmo com a senha certa, de outro IP (por nome) e para outro nome a partir do IP atacante.
    expect(await handleLogin({ name: "Leo", password: "segredo1" }, { ip: "6.6.6.6", now })).toMatchObject({ error: "too_many_attempts" });
    expect(await handleLogin({ name: "Leo", password: "segredo1" }, { ip: "2.2.2.2", now })).toMatchObject({ error: "too_many_attempts" });
    expect(await handleLogin({ name: "Outro", password: "x".repeat(8), vocation: "knight" }, { ip: "6.6.6.6", now }))
      .toMatchObject({ error: "too_many_attempts", retryAfterSec: LOGIN_LOCK_MS / 1000 });
    t += LOGIN_LOCK_MS + 1;
    expect(await handleLogin({ name: "Leo", password: "segredo1" }, { ip: "6.6.6.6", now })).toMatchObject({ ok: true });
  });

  it("rajada paralela não passa do limite", async () => {
    await handleLogin({ name: "Leo", password: "segredo1", vocation: "knight" });
    const rs = await Promise.all(Array.from({ length: 20 }, (_, i) => handleLogin({ name: "Leo", password: "x" + i }, { ip: "9.9.9.9" })));
    expect(rs.filter((r) => !r.ok && r.error === "wrong_password").length).toBeLessThanOrEqual(LOGIN_MAX_FAILS);
  });

  it("criação de contas: 3 por IP por hora", async () => {
    let t = 5_000_000;
    const now = () => t;
    const names = ["Aaa", "Bbb", "Ccc", "Ddd"];
    for (let i = 0; i < CREATE_MAX_PER_HOUR; i++) {
      expect(await handleLogin({ name: names[i]!, password: "segredo1", vocation: "knight" }, { ip: "3.3.3.3", now })).toMatchObject({ ok: true });
    }
    expect(await handleLogin({ name: "Ddd", password: "segredo1", vocation: "knight" }, { ip: "3.3.3.3", now })).toMatchObject({ error: "too_many_attempts" });
    expect(await handleLogin({ name: "Ddd", password: "segredo1", vocation: "knight" }, { ip: "4.4.4.4", now })).toMatchObject({ ok: true });
    t += 3600_001;
    expect(await handleLogin({ name: "Eee", password: "segredo1", vocation: "knight" }, { ip: "3.3.3.3", now })).toMatchObject({ ok: true });
  });

  it("online: só o dono atual libera o nome", () => {
    expect(claimOnline("Leo", "s1")).toBeUndefined();
    expect(claimOnline("LEO", "s2")).toBe("s1");
    expect(releaseOnline("leo", "s1")).toBe(false);
    expect(onlineOwner("Leo")).toBe("s2");
    expect(releaseOnline("Leo", "s2")).toBe(true);
    expect(onlineOwner("Leo")).toBeUndefined();
  });
});
