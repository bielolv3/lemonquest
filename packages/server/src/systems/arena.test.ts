import { describe, expect, it } from "vitest";
import {
  ARENA_BREAK_MS, ARENA_COUNTDOWN_MS, ARENA_MAX_WAVE, arenaWave, ARENA_INTRO_MS, ARENA_SHOP_PAUSE_MS, ARENA_SPAWN_DELAY_MS, S2C, arenaWaveGold,
  arenaWaveSpawns, monsterDef, type TiledMap,
} from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import { ArenaSystem, parseArenas, type ArenaLayout } from "./arena.ts";
import { openGrid, player, world } from "./testkit.ts";
import { loadMap } from "../world/map.ts";

const MASTER = { x: 5, y: 5 };
const EXIT = { x: 5, y: 8 };

function layout(n: number): ArenaLayout {
  return {
    exit: EXIT,
    arenas: Array.from({ length: n }, (_, i) => {
      const x0 = 20 + i * 20;
      return {
        id: i + 1, rect: { x0, y0: 2, x1: x0 + 15, y1: 17 }, entry: { x: x0 + 2, y: 10 },
        spawns: [{ x: x0 + 13, y: 5 }, { x: x0 + 13, y: 10 }, { x: x0 + 13, y: 15 }],
      };
    }),
  };
}

function setup(nArenas = 1, extra: Partial<ConstructorParameters<typeof ArenaSystem>[0]> = {}) {
  const w = world({ grid: openGrid(20 + nArenas * 20 + 5, 25), spawns: [] });
  const gold = new Map<string, number>();
  const best = new Map<string, number>();
  const exited: string[] = [];
  const arena = new ArenaSystem({
    layout: layout(nArenas), master: () => MASTER, fallbackExit: { x: 1, y: 1 },
    monsters: w.mm, combat: w.combat,
    players: () => w.players.values(), getPlayer: (id) => w.players.get(id),
    teleport: (p, x, y) => { p.x = x; p.y = y; },
    isFree: (x, y, self) => w.mm.grid.isWalkable(x, y) && !w.mm.isMonsterAt(x, y) &&
      ![...w.players.values()].some((o) => o.id !== self && o.x === x && o.y === y),
    addGold: (p, n) => gold.set(p.id, (gold.get(p.id) ?? 0) + n),
    getBest: (id) => best.get(id) ?? 0, setBest: (id, n) => best.set(id, n),
    onExit: (p) => exited.push(p.id),
    send: (to, type, msg) => w.sent.push({ to, type, msg }),
    broadcast: (type, msg) => w.sent.push({ to: "*", type, msg }),
    now: w.now, rng: () => 0.5, ...extra,
  });
  w.combat.hooks.interceptDeath = (p) => arena.interceptDeath(p);
  const run = (ms: number) => w.run(ms, () => arena.tick(w.now()));
  const add = (id: string, over: Partial<PlayerState> = {}) =>
    w.add(player(id, MASTER.x + 1 + w.players.size, MASTER.y + 1, { level: 1, ...over }));
  const arenaMonsters = () => [...w.mm.all()].filter((m) => m.arenaId);
  const killAll = () => { for (const m of arenaMonsters()) w.combat.damageMonster(m, "", 1e9, "physical", w.now()); };
  const lastOf = (to: string, type: string) => [...w.sent].reverse().find((s) => s.to === to && s.type === type)?.msg;
  const notices = (to: string) => w.sent.filter((s) => s.to === to && s.type === S2C.Notice).map((s) => s.msg.text as string);
  /** Do "iniciar" até a onda 1 começar a nascer (contagem + teleporte + 3-2-1 + aviso do spawn). */
  const toWave1 = () => run(ARENA_COUNTDOWN_MS + ARENA_INTRO_MS + ARENA_SPAWN_DELAY_MS + 1000);
  return { w, arena, gold, best, exited, run, add, arenaMonsters, killAll, lastOf, notices, toWave1 };
}

describe("coliseu: mapa", () => {
  it("lê arenas, entradas, spawns e saída de objetos do mapa", () => {
    const obj = (id: number, type: string, x: number, y: number, props: Record<string, unknown> = {}, w = 0, h = 0) =>
      ({ id, name: "", type, x: x * 16, y: y * 16, width: w * 16, height: h * 16, properties: Object.entries(props).map(([name, value]) => ({ name, type: "int", value })) });
    const map: TiledMap = {
      width: 50, height: 50, tilewidth: 16, tileheight: 16, tilesets: [],
      layers: [{ name: "objects", type: "objectgroup", objects: [
        obj(1, "arena", 10, 10, { arenaId: 2 }, 5, 4), obj(2, "arena_entry", 11, 12, { arenaId: 2 }),
        obj(3, "arena_spawn", 13, 11, { arenaId: 2 }), obj(4, "arena_spawn", 13, 12, { arenaId: 2 }),
        obj(5, "arena_spawn", 30, 30, { arenaId: 1 }), obj(6, "arena_exit", 3, 4),
      ] }],
    };
    const l = parseArenas(map);
    expect(l.exit).toEqual({ x: 3, y: 4 });
    expect(l.arenas).toEqual([{ id: 2, rect: { x0: 10, y0: 10, x1: 14, y1: 13 }, entry: { x: 11, y: 12 }, spawns: [{ x: 13, y: 11 }, { x: 13, y: 12 }] }]);
  });

  it("o mapa real tem as 4 arenas com entrada e spawns dentro do retângulo", () => {
    const m = loadMap("world");
    const l = parseArenas(m.tiled);
    expect(l.arenas.map((a) => a.id)).toEqual([1, 2, 3, 4]);
    expect(l.exit).not.toBeNull();
    for (const a of l.arenas) {
      const inside = (p: { x: number; y: number }) => p.x >= a.rect.x0 && p.x <= a.rect.x1 && p.y >= a.rect.y0 && p.y <= a.rect.y1;
      expect(inside(a.entry) && m.grid.isWalkable(a.entry.x, a.entry.y)).toBe(true);
      expect(a.spawns.length).toBeGreaterThanOrEqual(4);
      for (const s of a.spawns) expect(inside(s) && m.grid.isWalkable(s.x, s.y)).toBe(true);
    }
  });
});

describe("coliseu: lobbies", () => {
  it("criar com o grupo (party): membros perto do Mestre entram juntos; longe/ocupado fica de fora", () => {
    const mates: Record<string, string[]> = { a: ["b", "c", "d"] };
    const k = setup(1, { partyMates: (id) => mates[id] ?? [], isPartyLeader: (id) => id === "a" });
    const a = k.add("a"), b = k.add("b"), c = k.add("c");
    k.add("d", { x: 19, y: 19 }); // longe do Mestre
    k.arena.onAction(c, { action: "create" }); // c já está em outro lobby
    k.arena.onAction(a, { action: "create", withParty: true });
    expect(k.arena.partyFor("a")!.members.map((m) => m.id)).toEqual(["a", "b"]);
    expect(k.notices("b")).toContain("a te colocou no grupo do Coliseu.");
    expect(k.notices("a").pop()).toMatch(/Ficaram de fora.*c, d/);
    // Quem não é líder do grupo não traz ninguém.
    k.arena.onAction(b, { action: "leave" });
    k.arena.onAction(b, { action: "create", withParty: true });
    expect(k.arena.partyFor("b")!.members.map((m) => m.id)).toEqual(["b"]);
  });

  it("criar, entrar, sair; líder passa adiante; sem limite de membros", () => {
    const k = setup();
    const [a, b, c, d, e, f] = ["a", "b", "c", "d", "e", "f"].map((id) => k.add(id));
    k.arena.onAction(a!, { action: "create" });
    const id = k.arena.partyFor("a")!.id;
    for (const p of [b, c, d, e]) k.arena.onAction(p!, { action: "join", lobbyId: id });
    expect(k.arena.partyFor("a")!.members.map((m) => m.id)).toEqual(["a", "b", "c", "d", "e"]);
    k.arena.onAction(b!, { action: "start" });
    expect(k.notices("b")).toContain("Só o líder pode iniciar.");
    k.arena.onAction(f!, { action: "list" }); // abriu a janela: passa a receber atualizações
    k.arena.onAction(a!, { action: "leave" });
    expect(k.arena.partyFor("a")).toBeUndefined();
    expect(k.arena.partyFor("b")!.leader).toBe("b");
    k.run(100);
    const lobbies = k.lastOf("f", S2C.ArenaLobbies);
    expect(lobbies.lobbies).toEqual([{ id, leader: "b", members: ["b", "c", "d", "e"], avgLevel: 1 }]);
    expect(lobbies.freeArenas).toBe(1);
  });

  it("quem se afasta do mestre sai do lobby", () => {
    const k = setup();
    const a = k.add("a"), b = k.add("b");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(b, { action: "join", lobbyId: k.arena.partyFor("a")!.id });
    b.x = MASTER.x + 9;
    k.run(100);
    expect(k.arena.partyFor("b")).toBeUndefined();
    expect(k.arena.partyFor("a")!.members).toHaveLength(1);
    expect(k.notices("b").some((t) => t.includes("afastou"))).toBe(true);
    expect(k.lastOf("b", S2C.ArenaState)).toEqual({ state: null });
  });

  it("criar longe do mestre é recusado", () => {
    const k = setup();
    const a = k.add("a", { x: 40 });
    k.arena.onAction(a, { action: "create" });
    expect(k.arena.partyFor("a")).toBeUndefined();
  });
});

describe("coliseu: partida", () => {
  it("solo: contagem, teletransporte para a entrada, onda 1 com 3 ratos", () => {
    const k = setup();
    const a = k.add("a");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(a, { action: "start" });
    expect(k.lastOf("a", S2C.ArenaState).state.phase).toBe("countdown");
    k.run(ARENA_COUNTDOWN_MS + 100);
    expect(a.x).toBeGreaterThanOrEqual(20);
    expect(k.lastOf("a", S2C.ArenaState).state).toMatchObject({ phase: "countdown", arenaId: 1 });
    expect(k.arenaMonsters()).toHaveLength(0);
    k.run(ARENA_INTRO_MS + ARENA_SPAWN_DELAY_MS + 500);
    const ms = k.arenaMonsters();
    expect(ms.map((m) => m.s.defId)).toEqual(["rat", "rat", "rat"]);
    expect(k.lastOf("a", S2C.ArenaState).state).toMatchObject({ phase: "fight", wave: 1, monstersLeft: 3 });
    expect(k.arena.freeArenas).toBe(0);
  });

  it("quantidade escala com o grupo (2 → ×1.6, 4 → ×2.8)", () => {
    expect(arenaWaveSpawns(1, 1, 1)).toHaveLength(3);
    expect(arenaWaveSpawns(1, 2, 1)).toHaveLength(5);
    expect(arenaWaveSpawns(1, 4, 1)).toHaveLength(8);
    // elite: sempre 1, a vida escala com o grupo
    const solo = arenaWaveSpawns(5, 1, 6).find((s) => s.elite)!, quad = arenaWaveSpawns(5, 4, 6).find((s) => s.elite)!;
    expect(quad.hpMult).toBeGreaterThan(solo.hpMult * 3);
    const k = setup();
    const a = k.add("a"), b = k.add("b");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(b, { action: "join", lobbyId: k.arena.partyFor("a")!.id });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    expect(k.arenaMonsters()).toHaveLength(5);
  });

  it("monstros da arena ficam no retângulo e só atacam membros", () => {
    const k = setup();
    const a = k.add("a");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    const outsider = k.add("x");
    outsider.x = 27; outsider.y = 3; // dentro da arena, mas não é membro
    a.hp = 1e9; a.maxHp = 1e9;
    k.run(8000);
    for (const m of k.arenaMonsters()) {
      expect(m.s.x).toBeGreaterThanOrEqual(20);
      expect(m.s.x).toBeLessThanOrEqual(35);
      expect(m.s.targetId).not.toBe("x");
    }
    expect(outsider.hp).toBe(150);
    expect(a.hp).toBeLessThan(1e9);
  });

  it("vencer a onda paga XP e ouro divididos, cura 30% e dá um respiro curto; sem loot nem XP por abate", () => {
    const k = setup();
    const a = k.add("a"), b = k.add("b");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(b, { action: "join", lobbyId: k.arena.partyFor("a")!.id });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    a.hp = 50;
    const xp = Math.round((5 * monsterDef("rat")!.xp * 1.2) / 2);
    k.killAll();
    expect(a.xp).toBe(0); // abate não dá XP
    k.run(100);
    expect(a.xp).toBe(xp);
    expect(b.xp).toBe(xp);
    expect(k.gold.get("a")).toBe(arenaWaveGold(1));
    expect(a.hp).toBe(Math.min(a.maxHp, 50 + Math.round(a.maxHp * 0.3)));
    const st = k.lastOf("a", S2C.ArenaState).state;
    expect(st).toMatchObject({ phase: "break", wave: 1, earned: { xp, gold: arenaWaveGold(1) } });
    expect(st.phaseEndsAt - k.w.now()).toBeLessThanOrEqual(ARENA_BREAK_MS);
    expect(k.w.sent.some((s) => s.type === S2C.Loot)).toBe(false);
  });

  it("XP das ondas só para quem está na faixa de level do grupo (2/3 do maior); o resto ganha só o ouro", () => {
    const k = setup();
    const hi = k.add("hi", { level: 30 }), lo = k.add("lo", { level: 5 }), mid = k.add("mid", { level: 20 });
    k.arena.onAction(hi, { action: "create" });
    for (const p of [lo, mid]) k.arena.onAction(p, { action: "join", lobbyId: k.arena.partyFor("hi")!.id });
    k.arena.onAction(hi, { action: "start" });
    k.toWave1();
    const xp0 = { hi: hi.xp, lo: lo.xp, mid: mid.xp };
    k.killAll();
    k.run(100);
    expect(hi.xp).toBeGreaterThan(xp0.hi);
    expect(mid.xp - xp0.mid).toBe(hi.xp - xp0.hi); // 20 ≥ 2/3 de 30
    expect(lo.xp).toBe(xp0.lo);
    expect(k.gold.get("lo")).toBe(arenaWaveGold(1));
    expect(k.notices("lo").at(-1)).toMatch(/Sem XP: level abaixo de 20/);
    expect(k.lastOf("lo", S2C.ArenaState).state.earned.xp).toBe(0);
    // A janela mostra o level de cada membro (para marcar quem fica sem XP).
    expect(k.lastOf("lo", S2C.ArenaState).state.members.map((m: any) => m.level).sort((x: number, y: number) => x - y)).toEqual([5, 20, 30]);
  });

  it("ondas comuns emendam: respiro de 3 s, sem loja nem Pronto", () => {
    const k = setup();
    const a = k.add("a"), b = k.add("b");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(b, { action: "join", lobbyId: k.arena.partyFor("a")!.id });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    k.killAll();
    k.run(100);
    expect(k.arena.partyFor("a")!.phase).toBe("break");
    k.arena.onAction(a, { action: "ready" }); // ignorado no respiro
    expect(k.lastOf("a", S2C.ArenaState).state.members.every((m: any) => m.ready === undefined)).toBe(true);
    expect(k.arena.canUseShop(a, "arena_shop_1")).toBe(false);
    k.run(ARENA_BREAK_MS);
    expect(k.arena.partyFor("a")).toMatchObject({ phase: "fight", wave: 2 });
  });

  it("pausa com vendedor só depois da onda-chefe (5); acaba no tempo ou quando todos clicam em Pronto", () => {
    const k = setup();
    const a = k.add("a", { level: 50, maxHp: 1e6, hp: 1e6 }), b = k.add("b", { level: 50, maxHp: 1e6, hp: 1e6 });
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(b, { action: "join", lobbyId: k.arena.partyFor("a")!.id });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    for (let w = 1; w <= 5; w++) {
      k.killAll();
      k.run(100);
      if (w < 5) {
        expect(k.arena.partyFor("a")!.phase).toBe("break");
        k.run(ARENA_BREAK_MS + ARENA_SPAWN_DELAY_MS + 2000);
      }
    }
    const st = k.lastOf("a", S2C.ArenaState).state;
    expect(st).toMatchObject({ phase: "pause", wave: 5 });
    expect(st.phaseEndsAt - k.w.now()).toBeGreaterThan(ARENA_SHOP_PAUSE_MS - 500);
    expect(k.arena.canUseShop(a, "arena_shop_1")).toBe(true);
    k.arena.onAction(a, { action: "ready" });
    expect(k.lastOf("b", S2C.ArenaState).state.members).toEqual([
      { name: "a", alive: true, level: 50, ready: true }, { name: "b", alive: true, level: 50, ready: false },
    ]);
    k.run(3500);
    expect(k.arena.partyFor("a")!.phase).toBe("pause");
    k.arena.onAction(b, { action: "ready" });
    k.run(3100);
    expect(k.arena.partyFor("a")).toMatchObject({ phase: "fight", wave: 6 });
  });

  it("morte: sem penalidade, volta na saída com vida cheia, resultado; o grupo segue; wipe libera a arena", () => {
    const k = setup();
    const a = k.add("a"), b = k.add("b");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(b, { action: "join", lobbyId: k.arena.partyFor("a")!.id });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    k.killAll();
    k.run(100);
    const xp = a.xp;
    k.run(ARENA_BREAK_MS + ARENA_SPAWN_DELAY_MS + 2000);
    k.w.combat.damagePlayer(a, "", 1e6, "physical", k.w.now(), { killerName: "Rato" });
    expect(a.xp).toBe(xp);
    expect(a.hp).toBe(a.maxHp);
    expect(Math.max(Math.abs(a.x - EXIT.x), Math.abs(a.y - EXIT.y))).toBeLessThanOrEqual(1);
    expect(k.lastOf("a", S2C.ArenaResult)).toEqual({ wavesCleared: 1, xp, gold: arenaWaveGold(1), best: 1, reason: "wiped" });
    expect(k.w.sent.some((s) => s.type === S2C.Died)).toBe(false);
    expect(k.best.get("a")).toBe(1);
    expect(k.exited).toContain("a");
    expect(k.arena.partyFor("b")!.members.find((m) => m.id === "a")!.alive).toBe(false);
    expect(k.arenaMonsters().length).toBeGreaterThan(0);
    // b morre → wipe: monstros somem, arena livre
    k.w.combat.damagePlayer(b, "", 1e6, "physical", k.w.now(), { killerName: "Rato" });
    expect(k.arenaMonsters()).toHaveLength(0);
    expect(k.arena.freeArenas).toBe(1);
    expect(k.lastOf("b", S2C.ArenaResult).reason).toBe("wiped");
    // livre para outro lobby
    k.arena.onAction(a, { action: "create" });
    expect(k.arena.partyFor("a")!.phase).toBe("lobby");
  });

  it("desistir ('leave') na arena: gave_up e libera a arena", () => {
    const k = setup();
    const a = k.add("a");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    k.arena.onAction(a, { action: "leave" });
    expect(k.lastOf("a", S2C.ArenaResult)).toMatchObject({ wavesCleared: 0, reason: "gave_up" });
    expect(k.arena.freeArenas).toBe(1);
    expect(a.x).toBeLessThan(20);
  });

  it("fila: com as arenas ocupadas o grupo espera e começa sozinho quando uma libera", () => {
    const k = setup(1);
    const a = k.add("a"), b = k.add("b");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(a, { action: "start" });
    k.arena.onAction(b, { action: "create" });
    k.arena.onAction(b, { action: "start" });
    expect(k.arena.partyFor("b")!.phase).toBe("queued");
    expect(k.arena.queueLength).toBe(1);
    k.toWave1();
    expect(k.arena.partyFor("b")!.phase).toBe("queued");
    k.arena.onAction(a, { action: "leave" });
    expect(k.arena.partyFor("b")!.phase).toBe("countdown");
    expect(k.notices("b")).toContain("Uma arena ficou livre! Prepare-se.");
    k.toWave1();
    expect(k.arena.partyFor("b")).toMatchObject({ phase: "fight", wave: 1 });
    expect(b.x).toBeGreaterThanOrEqual(20);
  });

  it("4 arenas em paralelo; a 5ª entra na fila", () => {
    const k = setup(4);
    const ps = ["a", "b", "c", "d", "e"].map((id) => k.add(id));
    for (const p of ps) { k.arena.onAction(p, { action: "create" }); k.arena.onAction(p, { action: "start" }); }
    expect(ps.map((p) => k.arena.partyFor(p.id)!.phase)).toEqual(["countdown", "countdown", "countdown", "countdown", "queued"]);
    k.toWave1();
    expect(new Set(ps.slice(0, 4).map((p) => k.arena.partyFor(p.id)!.arena!.id)).size).toBe(4);
  });

  it("desconexão (fim da janela de reconexão) = desistência sem penalidade, salvo na saída", () => {
    const k = setup();
    const a = k.add("a");
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    k.killAll();
    k.run(100);
    k.arena.removePlayer("a");
    expect(a.x).toBeLessThan(20);
    expect(k.best.get("a")).toBe(1);
    expect(k.arena.freeArenas).toBe(1);
    expect(k.arenaMonsters()).toHaveLength(0);
  });

  it("posição salva dentro de uma arena → saída do coliseu", () => {
    const k = setup();
    expect(k.arena.loginPosition(25, 10)).toEqual(EXIT);
    expect(k.arena.loginPosition(5, 5)).toBeNull();
    expect(k.arena.loginPosition(null, null)).toBeNull();
  });

  it("loja da arena só na pausa (depois da onda-chefe) e só para a partida daquela arena", () => {
    const k = setup();
    const a = k.add("a", { level: 50, maxHp: 1e6, hp: 1e6 });
    expect(k.arena.canUseShop(a, "arena_shop_1")).toBe(false);
    expect(k.arena.canUseShop(a, "shop")).toBe(true);
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    expect(k.arena.canUseShop(a, "arena_shop_1")).toBe(false);
    for (let w = 1; w <= 5; w++) {
      k.killAll();
      k.run(100);
      if (w < 5) { expect(k.arena.canUseShop(a, "arena_shop_1")).toBe(false); k.run(ARENA_BREAK_MS + ARENA_SPAWN_DELAY_MS + 2000); }
    }
    expect(k.arena.canUseShop(a, "arena_shop_1")).toBe(true);
    expect(k.arena.canUseShop(a, "arena_shop_2")).toBe(false);
  });

  it("feed global para resultados notáveis", () => {
    const k = setup();
    const a = k.add("a", { level: 99, maxHp: 1e7, hp: 1e7 }), b = k.add("b", { level: 99, maxHp: 1e7, hp: 1e7 });
    k.arena.onAction(a, { action: "create" });
    k.arena.onAction(b, { action: "join", lobbyId: k.arena.partyFor("a")!.id });
    k.arena.onAction(a, { action: "start" });
    k.toWave1();
    for (let w = 1; w <= 10; w++) {
      k.killAll();
      k.run(100);
      k.arena.onAction(a, { action: "ready" });
      k.arena.onAction(b, { action: "ready" });
      k.run(3100 + ARENA_SPAWN_DELAY_MS + 3000);
    }
    k.arena.onAction(a, { action: "leave" });
    k.arena.onAction(b, { action: "leave" });
    const feed = k.w.sent.filter((s) => s.type === S2C.Feed).map((s) => s.msg.text);
    expect(feed).toContain("🏟️ a e b chegaram à onda 10 do Coliseu! Novo recorde!");
  });
});

/**
 * Sanidade do balanço (modelo grosseiro): o grupo foca um monstro por vez; todos os monstros batem desde o início.
 * dps por jogador ≈ (6 + 1.6·L)·1.35/2 (arma + magias), vida média 150 + 10·(L−1), armadura ≈ L/4.
 * razão = dano recebido por jogador ÷ vida máxima numa onda (sem poções/cura/kiting).
 * Leitura: < 1 tranquilo; 1–2 exige poções; 2–3 sofrido; > 3 alguém cai.
 */
function estimate(wave: number, n: number, L: number): number {
  const dps = ((6 + 1.6 * L) * 1.35) / 2, hp = 150 + 10 * (L - 1), armor = Math.round(L / 4);
  let t = 0, dmg = 0;
  for (const s of arenaWaveSpawns(wave, n, L)) {
    const d = monsterDef(s.defId)!;
    t += (d.hp * s.hpMult) / (dps * n);
    dmg += (Math.max(0, ((d.damage[0] + d.damage[1]) / 2) * s.dmgMult - armor) / (d.attackMs / 1000)) * t;
  }
  return dmg / n / hp;
}

describe("coliseu: balanço (estimativa)", () => {
  it("solo level 10: ondas 1–6 tranquilas, sofre entre 8 e 10", () => {
    for (let w = 1; w <= 6; w++) expect(estimate(w, 1, 10)).toBeLessThan(1);
    expect(estimate(8, 1, 10)).toBeGreaterThan(1.2);
    expect(estimate(10, 1, 10)).toBeGreaterThan(2);
    expect(estimate(10, 1, 10)).toBeLessThan(5);
  });

  it("grupo de 4 level 25: ondas 1–14 sem drama, limite entre 15 e 20", () => {
    for (let w = 1; w <= 14; w++) expect(estimate(w, 4, 25)).toBeLessThan(2);
    expect(estimate(18, 4, 25)).toBeGreaterThan(2.5);
    expect(estimate(20, 4, 25)).toBeGreaterThan(2.5);
  });

  it("grupo de 4 level 40 chega longe, mas o fim ainda é difícil", () => {
    for (let w = 1; w <= 20; w++) expect(estimate(w, 4, 40)).toBeLessThan(3.5);
    expect(estimate(29, 4, 40)).toBeGreaterThan(3);
  });

  it("ondas 31–60 (fim de jogo): grupo de 4 no level justo de cada onda fica na faixa do fim antigo (2,5–5,5)", () => {
    expect(ARENA_MAX_WAVE).toBe(60);
    for (let w = 31; w <= ARENA_MAX_WAVE; w++) {
      const L = arenaWave(w)!.level;
      expect(estimate(w, 4, L), `onda ${w}`).toBeGreaterThan(2.5);
      expect(estimate(w, 4, L), `onda ${w}`).toBeLessThan(5.5);
    }
    for (let w = 31; w <= ARENA_MAX_WAVE; w++) expect(arenaWave(w)!.level).toBeGreaterThan(arenaWave(w - 1)!.level);
  });

  it("a dificuldade cresce com as ondas (média por bloco de 5)", () => {
    const block = (b: number) => [1, 2, 3, 4, 5].reduce((s, i) => s + estimate(b * 5 + i, 1, 20), 0);
    for (let b = 1; b < 6; b++) expect(block(b)).toBeGreaterThan(block(b - 1));
  });
});
