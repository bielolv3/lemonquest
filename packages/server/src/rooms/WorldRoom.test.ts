import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { findObjects, objectTile } from "@lemonquest/shared";
import { CLOSE_REPLACED, REPLACED_REASON, WorldRoom, currentWorld } from "./WorldRoom.ts";
import { createAccount, getCharacterByName, initDb, saveCharacter } from "../persistence/db.ts";
import { handleLogin, onlineOwner, resetAuthState, type AuthData } from "../persistence/auth.ts";

// Sala real (mapa real), fora do matchmaker: __init + onCreate; clientes falsos.
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
const auth = (name: string, weakPassword = false): AuthData => ({ name, key: name.toLowerCase(), weakPassword });

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

describe("WorldRoom: onAuth estático", () => {
  it("aceita token válido (uma vez), recusa reuso e lixo", async () => {
    const r = await handleLogin({ name: "Leo", password: "segredo1", vocation: "knight" });
    if (!r.ok) throw new Error("login falhou");
    await expect(WorldRoom.onAuth("", { token: r.token })).resolves.toMatchObject({ name: "Leo", key: "leo" });
    await expect(WorldRoom.onAuth("", { token: r.token })).rejects.toThrow();
    await expect(WorldRoom.onAuth("", { token: "lixo" })).rejects.toThrow();
    await expect(WorldRoom.onAuth("", undefined)).rejects.toThrow();
  });

  it("login novo invalida o token pendente anterior (reserva do nome)", async () => {
    await handleLogin({ name: "Leo", password: "segredo1", vocation: "knight" });
    const a = await handleLogin({ name: "Leo", password: "segredo1" });
    const b = await handleLogin({ name: "Leo", password: "segredo1" });
    if (!a.ok || !b.ok) throw new Error("login falhou");
    await expect(WorldRoom.onAuth("", { token: a.token })).rejects.toThrow();
    await expect(WorldRoom.onAuth("", { token: b.token })).resolves.toMatchObject({ name: "Leo" });
  });
});

describe("WorldRoom: sala única", () => {
  it("segunda instância é recusada; depois do dispose pode criar de novo", () => {
    const a = makeRoom();
    expect(currentWorld()).toBe(a);
    const b = new WorldRoom() as any;
    b["__init"]();
    expect(() => b.onCreate({})).toThrow(/cheio/);
    expect(currentWorld()).toBe(a);
    dispose(rooms.pop());
    expect(currentWorld()).toBeNull();
    makeRoom();
  });
});

describe("WorldRoom: sessões", () => {
  it("login duplo: salva e derruba a sessão antiga (4100); onLeave da antiga não libera o nome da nova", () => {
    const r = makeRoom();
    createAccount("Leo", "h", "s", "knight");
    const c1 = fakeClient(r, "s1");
    r.onJoin(c1, {}, auth("Leo"));
    const p1 = r.state.players.get("s1");
    p1.xp = 777;
    const c2 = fakeClient(r, "s2");
    r.onJoin(c2, {}, auth("Leo"));
    expect(c1.leave).toHaveBeenCalledWith(CLOSE_REPLACED, REPLACED_REASON);
    expect(r.state.players.has("s1")).toBe(false);
    expect(r.state.players.get("s2").xp).toBe(777); // a nova sessão leu o que a antiga salvou
    expect(onlineOwner("leo")).toBe("s2");
    r.onLeave(c1, 4100); // o close da sessão antiga chega depois
    expect(onlineOwner("Leo")).toBe("s2");
    expect(r.state.players.has("s2")).toBe(true);
    r.onLeave(c2, 4000);
    expect(onlineOwner("Leo")).toBeUndefined();
  });

  it("onLeave: se salvar lançar, a limpeza e a liberação do nome acontecem mesmo assim", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = makeRoom();
    createAccount("Ana", "h", "s", "druid");
    const c = fakeClient(r, "a1");
    r.onJoin(c, {}, auth("Ana"));
    r.persist = () => { throw new Error("disco cheio"); };
    r.onLeave(c, 4000);
    expect(r.state.players.has("a1")).toBe(false);
    expect(r.records.size).toBe(0);
    expect(onlineOwner("Ana")).toBeUndefined();
    expect(err).toHaveBeenCalled();
  });

  it("onDrop mantém o jogador; WITH_ERROR/sessão desconhecida não reserva reconexão", () => {
    const r = makeRoom();
    createAccount("Bia", "h", "s", "paladin");
    const c = fakeClient(r, "b1");
    r.onJoin(c, {}, auth("Bia"));
    const allow = vi.spyOn(r, "allowReconnection").mockImplementation(() => {
      let reject!: (e: unknown) => void;
      const promise = new Promise((_res, rej) => { reject = rej; });
      return Object.assign(promise, { reject }) as any;
    });
    r.onDrop(c, 1006);
    expect(allow).toHaveBeenCalledWith(c, 20);
    expect(r.state.players.has("b1")).toBe(true);
    r.onDrop({ sessionId: "zzz" }, 1006);
    r.onDrop(c, 4002);
    expect(allow).toHaveBeenCalledTimes(1);
  });

  it("senha fraca (conta antiga) recebe aviso após entrar", () => {
    const r = makeRoom();
    createAccount("Caio", "h", "s", "sorcerer");
    const c = fakeClient(r, "c1");
    r.onJoin(c, {}, auth("Caio", true));
    expect(c.send.mock.calls.some(([t, m]: [string, any]) => t === "notice" && /senha/i.test(m.text))).toBe(true);
  });
});

describe("WorldRoom: tick isolado", () => {
  it("um sistema que lança não impede os seguintes; log limitado", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = makeRoom();
    const after = vi.fn();
    r.setSteps([["quebrado", () => { throw new Error("bug"); }], ["depois", after]]);
    r.tick();
    r.tick();
    expect(after).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalledTimes(1); // 1 linha por 10 s por sistema
  });
});

describe("WorldRoom: posição salva", () => {
  it("parede, portal e NPC → spawn; tile válido é mantido", () => {
    const r = makeRoom();
    const sp = r.spawnPoint;
    expect(r.validStart(sp.x, sp.y)).toBe(true);
    expect(r.validStart(null, null)).toBe(false);
    expect(r.validStart(-5, 3)).toBe(false);
    const g = r.map.grid;
    let wall: { x: number; y: number } | null = null;
    for (let y = 0; y < g.height && !wall; y++) for (let x = 0; x < g.width && !wall; x++) if (!g.isWalkable(x, y)) wall = { x, y };
    expect(r.validStart(wall!.x, wall!.y)).toBe(false);
    const portal = findObjects(r.map.tiled, "portal")[0];
    if (portal) { const t = objectTile(portal, r.map.tiled.tilewidth); expect(r.validStart(t.x, t.y)).toBe(false); }
    const npc = r.npcs.list[0];
    if (npc) expect(r.validStart(npc.x, npc.y)).toBe(false);

    createAccount("Davi", "h", "s", "knight");
    const rec = getCharacterByName("Davi")!;
    saveCharacter({ ...rec, x: wall!.x, y: wall!.y });
    const c = fakeClient(r, "d1");
    r.onJoin(c, {}, auth("Davi"));
    expect([r.state.players.get("d1").x, r.state.players.get("d1").y]).toEqual([sp.x, sp.y]);
  });
});
