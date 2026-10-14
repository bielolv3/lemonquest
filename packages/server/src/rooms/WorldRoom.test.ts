import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CLOSE_REPLACED, findObjects, objectTile } from "@lemonquest/shared";
import { RECONNECT_S, REPLACED_REASON, TRANSFER_SAVE_MS, WorldRoom, currentWorld } from "./WorldRoom.ts";
import { createAccountWithCharacter as createAccount, getCharacterByName, initDb, loadGroundRows, saveCharacter } from "../persistence/db.ts";
import { makeItem } from "../systems/inventory.ts";
import { handleCreateCharacter, handleLogin, handlePlay, onlineOwner, resetAuthState, type AuthData } from "../persistence/auth.ts";

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

/** Conta "leo" com o personagem "Leo"; devolve a sessão da conta. */
async function accountWithLeo(): Promise<string> {
  const a = await handleLogin({ account: "leo", password: "segredo1", create: true });
  if (!a.ok) throw new Error("login falhou");
  const c = handleCreateCharacter({ session: a.session, name: "Leo", vocation: "knight" });
  if (!c.ok) throw new Error("criação falhou");
  return a.session;
}

describe("WorldRoom: onAuth estático", () => {
  it("aceita token válido (uma vez), recusa reuso e lixo", async () => {
    const session = await accountWithLeo();
    const r = handlePlay({ session, name: "Leo" });
    if (!r.ok) throw new Error("play falhou");
    await expect(WorldRoom.onAuth("", { token: r.token })).resolves.toMatchObject({ name: "Leo", key: "leo" });
    await expect(WorldRoom.onAuth("", { token: r.token })).rejects.toThrow();
    await expect(WorldRoom.onAuth("", { token: "lixo" })).rejects.toThrow();
    await expect(WorldRoom.onAuth("", undefined)).rejects.toThrow();
  });

  it("novo /play invalida o token pendente anterior (reserva do nome)", async () => {
    const session = await accountWithLeo();
    const other = await handleLogin({ account: "leo", password: "segredo1" });
    if (!other.ok) throw new Error("login falhou");
    const a = handlePlay({ session, name: "Leo" });
    const b = handlePlay({ session: other.session, name: "leo" });
    if (!a.ok || !b.ok) throw new Error("play falhou");
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
  it("conta → /play → onAuth → onJoin; outro /play do mesmo personagem derruba a sessão antiga", async () => {
    const r = makeRoom();
    const session = await accountWithLeo();
    const t1 = handlePlay({ session, name: "Leo" });
    if (!t1.ok) throw new Error("play falhou");
    const c1 = fakeClient(r, "s1");
    r.onJoin(c1, {}, await WorldRoom.onAuth("", { token: t1.token }));
    const list = await handleLogin({ account: "LEO", password: "segredo1" });
    expect(list).toMatchObject({ ok: true, characters: [{ name: "Leo", online: true }] });
    if (!list.ok) return;
    const t2 = handlePlay({ session: list.session, name: "Leo" });
    if (!t2.ok) throw new Error("play falhou");
    const c2 = fakeClient(r, "s2");
    r.onJoin(c2, {}, await WorldRoom.onAuth("", { token: t2.token }));
    expect(c1.leave).toHaveBeenCalledWith(CLOSE_REPLACED, REPLACED_REASON);
    expect(onlineOwner("Leo")).toBe("s2");
  });

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

  it("kick de quem caiu e espera reconexão cancela a reconexão (troca de senha, /kick)", () => {
    const r = makeRoom();
    createAccount("Bel", "h", "s", "knight");
    const c = fakeClient(r, "k1");
    r.onJoin(c, {}, auth("Bel"));
    const reject = vi.fn();
    vi.spyOn(r, "allowReconnection").mockImplementation(() => Object.assign(new Promise(() => {}), { reject }) as any);
    r.onDrop(c, 1006);
    r.kick("k1", "senha trocada");
    expect(reject).toHaveBeenCalledTimes(1);
    expect(r.reconnecting.has("k1")).toBe(false);
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

describe("WorldRoom: item entre mochila e chão", () => {
  it("largar/pegar grava jogador e chão juntos no fim do tick (sem esperar o autosave)", () => {
    const r = makeRoom();
    createAccount("Gil", "h", "s", "knight");
    const c = fakeClient(r, "g1");
    r.onJoin(c, {}, auth("Gil"));
    const p = r.state.players.get("g1");
    r.inventory.addItem(p, makeItem("health_potion", 3));
    r.saveAll();
    const idx = r.inventory.serialize("g1").backpack.findIndex((it: any) => it?.defId === "health_potion");
    const potions = () => (getCharacterByName("Gil")!.data.backpack ?? []).filter((it: any) => it?.defId === "health_potion").length;
    const onGround = () => loadGroundRows().filter((g) => JSON.parse(g.item).defId === "health_potion").length;
    expect(potions()).toBe(1);

    r.ground.onDrop(p, { from: { where: "backpack", index: idx }, x: p.x, y: p.y });
    r.tick();
    expect(potions()).toBe(0);
    expect(onGround()).toBe(1);

    const gid = [...r.state.groundItems.keys()][0];
    r.ground.onPickup(p, { groundId: gid });
    const t = Date.now();
    r.tick(); // menos de 1 s depois da última gravação: espera
    expect(potions()).toBe(0);
    vi.spyOn(Date, "now").mockReturnValue(t + TRANSFER_SAVE_MS + 1);
    r.tick();
    expect(potions()).toBe(1);
    expect(onGround()).toBe(0);
  });
});

describe("WorldRoom: sair em combate", () => {
  const join = (r: any, name: string, sid: string) => {
    createAccount(name, "h", "s", "knight");
    const c = fakeClient(r, sid);
    r.onJoin(c, {}, auth(name));
    return c;
  };
  const expire = (r: any, sid: string) => r.lingering.get(sid).tick(RECONNECT_S * 1000 + 1);

  it("sair de propósito logo após lutar: fica no mundo RECONNECT_S s (pode apanhar), depois sai e libera o nome", () => {
    const r = makeRoom();
    const c = join(r, "Rui", "r1");
    r.combat.markCombat("r1", Date.now());
    r.onLeave(c, 4000);
    expect(r.state.players.has("r1")).toBe(true);
    expect(onlineOwner("Rui")).toBe("r1");
    expire(r, "r1");
    expect(r.state.players.has("r1")).toBe(false);
    expect(onlineOwner("Rui")).toBeUndefined();
    expect(r.lingering.size).toBe(0);
  });

  it("fora de combate (ou morto) sai na hora, como antes", () => {
    const r = makeRoom();
    const c = join(r, "Lia", "l1");
    r.onLeave(c, 4000);
    expect(r.state.players.has("l1")).toBe(false);
    const c2 = join(r, "Ivo", "i1");
    r.combat.markCombat("i1", Date.now());
    r.state.players.get("i1").hp = 0;
    r.onLeave(c2, 4000);
    expect(r.state.players.has("i1")).toBe(false);
  });

  it("relogar durante a permanência troca a sessão; o timer antigo não derruba a nova", () => {
    const r = makeRoom();
    const c = join(r, "Bob", "b1");
    r.combat.markCombat("b1", Date.now());
    r.onLeave(c, 4000);
    const c2 = fakeClient(r, "b2");
    r.onJoin(c2, {}, auth("Bob"));
    expect(r.state.players.has("b1")).toBe(false);
    expect(r.state.players.has("b2")).toBe(true);
    expect(r.lingering.size).toBe(0);
    expect(onlineOwner("Bob")).toBe("b2");
  });

  it("ao ficar no mundo, para de andar (não chega sozinho a uma zona de proteção)", () => {
    const r = makeRoom();
    const c = join(r, "Edu", "e1");
    r.combat.markCombat("e1", Date.now());
    const stop = vi.spyOn(r.movement, "teleport");
    r.onLeave(c, 4000);
    const p = r.state.players.get("e1");
    expect(stop).toHaveBeenCalledWith(p, p.x, p.y);
  });

  it("kick durante a permanência tira o personagem na hora", () => {
    const r = makeRoom();
    const c = join(r, "Gus", "g1");
    r.combat.markCombat("g1", Date.now());
    r.onLeave(c, 4000);
    r.kick("g1", "tchau");
    expect(r.state.players.has("g1")).toBe(false);
    expect(r.lingering.size).toBe(0);
  });
});

describe("WorldRoom: crédito de missão só para quem está perto", () => {
  it("quem bateu e foi para longe não conta o abate na missão", () => {
    const r = makeRoom();
    for (const [n, id] of [["Ana", "a1"], ["Bia", "b1"]] as const) {
      createAccount(n, "h", "s", "knight");
      r.onJoin(fakeClient(r, id), {}, auth(n));
    }
    const m = [...r.monsters.all()].find((x: any) => !x.def.invulnerable && !x.arenaId);
    const near = r.state.players.get("a1"), far = r.state.players.get("b1");
    near.x = m.s.x + 1; near.y = m.s.y;
    far.x = m.s.x + 30; far.y = m.s.y;
    m.damageBy.set("b1", 90);
    m.damageBy.set("a1", 10);
    expect(r.questCredit(m)).toEqual(["a1"]);
  });
});
