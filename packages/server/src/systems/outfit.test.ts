import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { C2S, DEFAULT_OUTFIT } from "@lemonquest/shared";
import { WorldRoom } from "../rooms/WorldRoom.ts";
import { createAccountWithCharacter as createAccount, getCharacterByName, initDb, saveCharacter } from "../persistence/db.ts";
import { handleCreateCharacter, handleLogin, resetAuthState, type AuthData } from "../persistence/auth.ts";
import { isOutfitUnlocked, loadOutfit, validateSetOutfit } from "./outfit.ts";

const rooms: any[] = [];
function makeRoom(): any {
  const r = new WorldRoom() as any;
  r["__init"]();
  r.onCreate({});
  rooms.push(r);
  return r;
}
function dispose(r: any) {
  r.clock.clear();
  clearInterval(r._simulationInterval);
  r.onDispose();
}
function fakeClient(r: any, sessionId: string) {
  const c = { sessionId, send: vi.fn(), leave: vi.fn() } as any;
  r.clients.push(c);
  return c;
}
const auth = (name: string): AuthData => ({ name, key: name.toLowerCase() }) as AuthData;
const send = (r: any, c: any, type: string, m: unknown) => r.onMessageEvents.emit(type, c, m);

beforeEach(() => {
  initDb(":memory:");
  resetAuthState();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  while (rooms.length) dispose(rooms.pop());
  vi.restoreAllMocks();
});

describe("outfit: validação", () => {
  it("aceita ids do catálogo e bits 0..3; recusa o resto", () => {
    expect(validateSetOutfit({ outfit: "mago", addons: 3 })).toEqual({ outfit: "mago", addons: 3 });
    expect(validateSetOutfit({ outfit: "cidadao", addons: 0 })).toEqual({ outfit: "cidadao", addons: 0 });
    for (const bad of [
      null, 1, "mago", {}, { outfit: "mago" }, { outfit: "xx", addons: 0 }, { outfit: "mago", addons: 4 },
      { outfit: "mago", addons: -1 }, { outfit: "mago", addons: 1.5 }, { outfit: "mago", addons: "3" },
      { outfit: "__proto__", addons: 0 }, { outfit: "toString", addons: 0 }, { outfit: 5, addons: 0 },
    ]) expect(validateSetOutfit(bad), JSON.stringify(bad)).toBeNull();
  });

  it("hoje tudo é liberado (gancho futuro das conquistas)", () => {
    expect(isOutfitUnlocked(undefined, "mago", 0)).toBe(true);
    expect(isOutfitUnlocked(undefined, "mago", 2)).toBe(true);
    expect(isOutfitUnlocked(undefined, "inexistente", 0)).toBe(false);
  });

  it("personagem legado (sem campo) usa a roupa padrão da vocação; id inválido também", () => {
    const rec = createAccount("Velho", "h", "s", "sorcerer");
    rec.data = {};
    expect(loadOutfit(rec)).toEqual({ outfit: "mago", addons: 0 });
    rec.data = { outfit: "sumiu", addons: 3 };
    expect(loadOutfit(rec)).toEqual({ outfit: "mago", addons: 0 });
    rec.data = { outfit: "pirata", addons: 7 };
    expect(loadOutfit(rec)).toEqual({ outfit: "pirata", addons: 3 });
  });
});

describe("outfit: criação de personagem", () => {
  it("novo personagem nasce com a roupa padrão da vocação (e aparece no resumo da conta)", async () => {
    const a = await handleLogin({ account: "conta1", password: "segredo1", create: true });
    if (!a.ok) throw new Error("login");
    for (const [name, voc] of [["Kai", "knight"], ["Pala", "paladin"], ["Sora", "sorcerer"], ["Dru", "druid"]] as const) {
      const r = handleCreateCharacter({ session: a.session, name, vocation: voc });
      if (!r.ok) throw new Error(r.error);
      expect(getCharacterByName(name)!.data).toMatchObject({ outfit: DEFAULT_OUTFIT[voc], addons: 0 });
      expect(r.characters.find((c) => c.name === name)).toMatchObject({ outfit: DEFAULT_OUTFIT[voc], addons: 0 });
    }
  });
});

describe("outfit: sala", () => {
  it("SetOutfit muda o estado (todos veem), persiste e volta ao entrar de novo", () => {
    const r = makeRoom();
    createAccount("Leo", "h", "s", "knight");
    const c = fakeClient(r, "s1");
    r.onJoin(c, {}, auth("Leo"));
    const p = r.state.players.get("s1");
    expect(p.outfit).toBe("cavaleiro");
    expect(p.addons).toBe(0);

    send(r, c, C2S.SetOutfit, { outfit: "mago", addons: 3 });
    expect(p.outfit).toBe("mago");
    expect(p.addons).toBe(3);

    send(r, c, C2S.SetOutfit, { outfit: "nada", addons: 1 }); // inválido: ignora
    expect(p.outfit).toBe("mago");

    r.onLeave(c, 4000);
    expect(getCharacterByName("Leo")!.data).toMatchObject({ outfit: "mago", addons: 3 });
    const c2 = fakeClient(r, "s2");
    r.onJoin(c2, {}, auth("Leo"));
    expect(r.state.players.get("s2")).toMatchObject({ outfit: "mago", addons: 3 });
  });

  it("legado sem roupa entra com a padrão da vocação", () => {
    const r = makeRoom();
    const rec = createAccount("Ana", "h", "s", "druid");
    rec.data = { hp: 10 };
    saveCharacter(rec);
    const c = fakeClient(r, "a1");
    r.onJoin(c, {}, auth("Ana"));
    expect(r.state.players.get("a1")).toMatchObject({ outfit: "druida", addons: 0 });
  });

  it("limite de 2 trocas por segundo (excesso descartado)", () => {
    const r = makeRoom();
    createAccount("Bia", "h", "s", "paladin");
    const c = fakeClient(r, "b1");
    r.onJoin(c, {}, auth("Bia"));
    const p = r.state.players.get("b1");
    send(r, c, C2S.SetOutfit, { outfit: "pirata", addons: 1 });
    send(r, c, C2S.SetOutfit, { outfit: "nobre", addons: 2 });
    send(r, c, C2S.SetOutfit, { outfit: "assassino", addons: 3 });
    expect(p.outfit).toBe("nobre");
    expect(p.addons).toBe(2);
  });
});
