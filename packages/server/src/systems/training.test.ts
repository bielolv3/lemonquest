import { describe, expect, it } from "vitest";
import {
  CLOSE_TRAINING, MONSTERS, OFFLINE_TRAINING_MAX_MIN, PLAYER_ATTACK_MS, S2C, offlineTrainingMinutes, offlineTrainingTries,
  skillTriesFor, statueDistance, type MonsterDef, type SpellDef,
} from "@lemonquest/shared";
import { ConditionSystem } from "./conditions.ts";
import { SkillSystem } from "./skills.ts";
import { SpellSystem } from "./spells.ts";
import { SummonSystem } from "./summons.ts";
import { TrainingSystem, parseStatues } from "./training.ts";
import { def, openGrid, player, world } from "./testkit.ts";

const dummyDef = (over: Partial<MonsterDef> = {}): MonsterDef =>
  def({ id: "training_dummy", name: "Boneco de Treino", hp: 1_000_000, xp: 0, damage: [50, 50], aggroRange: 8, stationary: true, invulnerable: true, ...over });
/** PZ = x,y em 0..9 (o centro de treinamento do teste). */
const PZ = [{ x0: 0, y0: 0, x1: 9, y1: 9 }];

function setup(o: { dummyAt?: { x: number; y: number }; rat?: { x: number; y: number } } = {}) {
  const dAt = o.dummyAt ?? { x: 5, y: 5 };
  const spawns = [{ defId: "training_dummy", x: dAt.x, y: dAt.y, count: 1, radius: 0 }];
  if (o.rat) spawns.push({ defId: "rat", x: o.rat.x, y: o.rat.y, count: 1, radius: 0 });
  const defs: Record<string, MonsterDef> = {
    training_dummy: dummyDef(), rat: def({ id: "rat", hp: 100, xp: 10, aggroRange: 0 }),
    pet: def({ id: "pet", hp: 100, damage: [7, 7], aggroRange: 0, xp: 0 }),
  };
  const w = world({ grid: openGrid(30, 30), spawns, defs: (id) => defs[id], safeZones: PZ, spawn: { x: 25, y: 25 } });
  w.mm.spawnAll();
  const send = (to: string, type: string, msg: unknown) => w.sent.push({ to, type, msg });
  const skills = new SkillSystem(send);
  w.combat.hooks = {
    onAutoAttack: (p) => { if (p.vocation === "knight") skills.addTries(p, "melee", 1); },
  };
  const dummy = [...w.mm.all()].find((m) => m.def.id === "training_dummy")!;
  const rat = [...w.mm.all()].find((m) => m.def.id === "rat");
  const addP = (id: string, x: number, y: number, over: Record<string, unknown> = {}) => {
    const p = w.add(player(id, x, y, over as never));
    skills.load(p);
    w.mm.playerList = [...w.players.values()];
    return p;
  };
  const events = () => { w.combat.flush(); return w.sent.filter((s) => s.type === S2C.Combat).flatMap((s) => s.msg.events); };
  return { ...w, send, skills, dummy, rat, addP, events, defs };
}

describe("boneco de treino (definição)", () => {
  it("existe, é estacionário/invulnerável, sem xp/loot, dano 0 e sprite grid4", () => {
    const d = MONSTERS.training_dummy;
    expect(d).toMatchObject({ name: "Boneco de Treino", stationary: true, invulnerable: true, xp: 0, aggroRange: 0 });
    expect(d.damage).toEqual([0, 0]);
    expect(d.loot ?? []).toEqual([]);
    expect(d.sprite.layout).toBe("grid4");
  });
});

describe("boneco de treino (servidor)", () => {
  it("é invulnerável: mostra dano, vida constante, sem XP/loot/morte", () => {
    const w = setup();
    const p = w.addP("k", 6, 5);
    w.combat.onAttack(p, { targetId: w.dummy.s.id });
    expect(p.targetId).toBe(w.dummy.s.id); // dentro da PZ, atacar o boneco é permitido
    w.run(PLAYER_ATTACK_MS * 8);
    const mine = w.events().filter((e: any) => e.sourceId === "k" && e.targetId === w.dummy.s.id);
    expect(mine.length).toBeGreaterThanOrEqual(7);
    expect(mine.some((e: any) => e.amount > 0)).toBe(true);
    expect(w.dummy.s.hp).toBe(1_000_000);
    expect(w.mm.get(w.dummy.s.id)).toBe(w.dummy);
    expect(w.sent.some((s) => s.type === S2C.XpGain || s.type === S2C.CreatureDied)).toBe(false);
    expect(p.xp).toBe(0);
    expect(w.dummy.damageBy.size).toBe(0);
    expect(p.targetId).toBe(w.dummy.s.id); // o alvo continua
  });

  it("dano enorme também não o derruba", () => {
    const w = setup();
    expect(w.combat.damageMonster(w.dummy, "x", 5_000_000, "physical", w.now())).toBe(5_000_000);
    expect(w.dummy.s.hp).toBe(1_000_000);
    expect(w.mm.size).toBe(1);
  });

  it("é estacionário: não anda, não persegue nem ataca (mesmo com aggro/dano no def)", () => {
    const w = setup();
    const p = w.addP("k", 6, 5);
    const sx = w.dummy.s.x, sy = w.dummy.s.y;
    w.run(8000);
    expect([w.dummy.s.x, w.dummy.s.y]).toEqual([sx, sy]);
    expect(w.dummy.mode).toBe("idle");
    expect(p.hp).toBe(150);
    // nem ao ser ferido (monstros normais revidam)
    w.combat.damageMonster(w.dummy, "k", 10, "physical", w.now());
    w.run(4000);
    expect([w.dummy.s.x, w.dummy.s.y]).toEqual([sx, sy]);
    expect(w.dummy.mode).toBe("idle");
    expect(p.hp).toBe(150);
  });

  it("nasce dentro da PZ (monstros normais não)", () => {
    const w = setup();
    expect(w.mm.inPz(w.dummy.s.x, w.dummy.s.y)).toBe(true);
  });

  it("treina a skill: cada ataque no boneco conta uma tentativa", () => {
    const w = setup();
    const p = w.addP("k", 6, 5);
    w.combat.onAttack(p, { targetId: w.dummy.s.id });
    w.run(PLAYER_ATTACK_MS * 10);
    const s = w.skills.get("k", "melee")!;
    expect(s.tries + (s.level - 10) * 30).toBeGreaterThanOrEqual(9);
  });

  it("PZ: só permite atacar bonecos; monstro normal continua protegido", () => {
    const w = setup({ rat: { x: 12, y: 5 } });
    const p = w.addP("k", 9, 5); // dentro da PZ (borda)
    w.combat.onAttack(p, { targetId: w.rat!.s.id });
    expect(p.targetId).toBe("");
    expect(w.sent.some((s) => s.type === S2C.Notice && /zona de prote/.test(s.msg.text))).toBe(true);
    w.combat.onAttack(p, { targetId: w.dummy.s.id });
    expect(p.targetId).toBe(w.dummy.s.id);
    // fora da PZ o rato pode ser atacado normalmente
    const q = w.addP("q", 11, 5);
    w.combat.onAttack(q, { targetId: w.rat!.s.id });
    expect(q.targetId).toBe(w.rat!.s.id);
  });

  it("invocações ignoram o boneco que o dono mira", () => {
    const w = setup({ dummyAt: { x: 16, y: 5 } });
    const p = w.addP("k", 15, 5, { vocation: "druid" });
    const summons = new SummonSystem({ monsters: w.mm, combat: w.combat, getPlayer: (id) => w.players.get(id), defs: (id) => w.defs[id] });
    p.targetId = w.dummy.s.id; // o dono ataca o boneco (fora da PZ), mas a invocação não
    expect(summons.summon(p, { monsterId: "pet", count: 1, durationMs: 20_000 }, w.now())).toBe(1);
    w.run(6000);
    const ev = w.events().filter((e: any) => e.targetId === w.dummy.s.id);
    expect(ev.length).toBeGreaterThan(0);
    expect(ev.every((e: any) => e.sourceId === "k")).toBe(true);
  });
});

const F = (base: number) => ({ base, perLevel: 0, perMagic: 0, variance: 0 });
const SP: Record<string, SpellDef> = {
  bolt: { id: "bolt", name: "b", words: "exori", vocations: ["druid"], level: 1, mana: 10, cooldownMs: 0, global: false, target: "target", range: 4, damage: { ...F(20), kind: "ice" }, fx: "ice", description: "" },
  ring: { id: "ring", name: "r", words: "exevo", vocations: ["druid"], level: 1, mana: 5, cooldownMs: 0, global: false, target: "area_self", radius: 2, damage: { ...F(10), kind: "fire" }, fx: "fire", description: "" },
  taunt: { id: "taunt", name: "t", words: "exeta", vocations: ["druid"], level: 1, mana: 0, cooldownMs: 0, global: false, target: "area_self", radius: 5, taunt: true, fx: "taunt", description: "" },
};

describe("magias no boneco de treino", () => {
  function spellSetup(o: Parameters<typeof setup>[0] = {}, at = { x: 6, y: 5 }) {
    const w = setup(o);
    const conditions = new ConditionSystem({ monsters: w.mm, combat: w.combat, getPlayer: (id) => w.players.get(id), players: () => w.players.values(), send: w.send });
    const summons = new SummonSystem({ monsters: w.mm, combat: w.combat, getPlayer: (id) => w.players.get(id), defs: (id) => w.defs[id] });
    const spells = new SpellSystem({
      grid: openGrid(30, 30), monsters: w.mm, combat: w.combat, conditions, summons, skills: w.skills,
      players: () => w.players.values(), getPlayer: (id) => w.players.get(id),
      teleport: (p, x, y) => { p.x = x; p.y = y; }, send: w.send, broadcast: (t, m) => w.send("*", t, m),
      now: w.now, rng: () => 0.5, spells: (id) => SP[id],
    });
    const p = w.addP("d", at.x, at.y, { vocation: "druid", mana: 500, maxMana: 500, hp: 100, maxHp: 200, magicLevel: 0, speedPct: 100 });
    return { ...w, spells, p };
  }

  it("na PZ: magia de alvo e de área acertam o boneco (números), gastam mana e treinam magic level", () => {
    const w = spellSetup();
    w.p.targetId = w.dummy.s.id;
    expect(w.spells.cast(w.p, "bolt")).toMatchObject({ ok: true });
    expect(w.spells.cast(w.p, "ring")).toMatchObject({ ok: true });
    const hits = w.events().filter((e: any) => e.targetId === w.dummy.s.id && e.amount > 0);
    expect(hits).toHaveLength(2);
    expect(w.dummy.s.hp).toBe(1_000_000);
    expect(w.p.mana).toBe(500 - 15);
    const ml = w.skills.get("d", "magic")!;
    expect(ml.tries + (ml.level * 0)).toBe(15);
    expect(w.sent.some((s) => s.type === S2C.XpGain)).toBe(false);
  });

  it("na PZ: magia ofensiva sem boneco ao alcance falha (pz); taunt não pega o boneco", () => {
    const w = spellSetup({ dummyAt: { x: 2, y: 2 } }, { x: 8, y: 8 });
    expect(w.spells.cast(w.p, "ring")).toMatchObject({ ok: false, reason: "pz" }); // boneco a 6 tiles, raio 2
    w.p.targetId = w.dummy.s.id;
    expect(w.spells.cast(w.p, "bolt")).toMatchObject({ ok: false, reason: "range" }); // alvo válido, mas longe
    w.p.x = 3; w.p.y = 3;
    expect(w.spells.cast(w.p, "taunt")).toMatchObject({ ok: true });
    expect(w.dummy.tauntBy).toBeUndefined();
    expect(w.p.mana).toBe(500);
  });

  it("de dentro da PZ, a área só atinge o boneco, não o monstro normal fora dela", () => {
    const w = spellSetup({ dummyAt: { x: 7, y: 5 }, rat: { x: 11, y: 5 } }, { x: 9, y: 5 });
    expect(w.spells.cast(w.p, "ring")).toMatchObject({ ok: true }); // raio 2 a partir de (9,5): boneco (7,5) e rato (11,5)
    const ev = w.events();
    expect(ev.some((e: any) => e.targetId === w.dummy.s.id)).toBe(true);
    expect(ev.some((e: any) => e.targetId === w.rat!.s.id)).toBe(false);
    expect(w.rat!.s.hp).toBe(100);
  });
});

describe("treino offline: fórmula", () => {
  it("limites: 0 min, <1 min, teto de 12 h", () => {
    for (const sk of ["melee", "distance", "magic", "shield"] as const) {
      expect(offlineTrainingTries(sk, 0, "knight", 10)).toBe(0);
      expect(offlineTrainingTries(sk, 0.9, "knight", 10)).toBe(0);
      expect(offlineTrainingTries(sk, -5, "knight", 10)).toBe(0);
      expect(offlineTrainingTries(sk, NaN, "knight", 10)).toBe(0);
      expect(offlineTrainingTries(sk, 721, "knight", 10)).toBe(offlineTrainingTries(sk, OFFLINE_TRAINING_MAX_MIN, "knight", 10));
      expect(offlineTrainingTries(sk, 99999, "druid", 30)).toBe(offlineTrainingTries(sk, 720, "druid", 30));
    }
  });

  it("melee/distance/shield: 50% de 1 ataque a cada 2 s = 15 por minuto", () => {
    expect(offlineTrainingTries("melee", 60, "knight", 1)).toBe(900);
    expect(offlineTrainingTries("shield", 720, "paladin", 50)).toBe(10_800);
    expect(offlineTrainingTries("distance", 1, "paladin", 1)).toBe(15);
  });

  it("magic: 50% da regeneração de mana por minuto (cresce com o level)", () => {
    // druid lv20: maxMana 620, regen/tique = round(12.4 + 10) = 22 → 22 × 30 tiques × 0,5 = 330/min
    expect(offlineTrainingTries("magic", 1, "druid", 20)).toBe(330);
    expect(offlineTrainingTries("magic", 60, "druid", 20)).toBe(19_800);
    expect(offlineTrainingTries("magic", 60, "druid", 50)).toBeGreaterThan(offlineTrainingTries("magic", 60, "druid", 20));
  });

  it("minutos entre dois instantes: clamp [0, 720]", () => {
    expect(offlineTrainingMinutes(1000, 1000)).toBe(0);
    expect(offlineTrainingMinutes(5000, 1000)).toBe(0); // relógio voltou
    expect(offlineTrainingMinutes(0, 3 * 3600_000 + 12 * 60_000)).toBe(192);
    expect(offlineTrainingMinutes(0, 100 * 3600_000)).toBe(720);
  });
});

describe("treino offline: estátuas e validação", () => {
  const STATUE = { id: "s1", x: 10, y: 10 };
  function tsetup(over: { inCombat?: boolean } = {}) {
    const sent: { to: string; type: string; msg: any }[] = [];
    const skills = new SkillSystem((to, type, msg) => sent.push({ to, type, msg }));
    const training = new TrainingSystem({
      statues: [STATUE], skills, inCombat: () => !!over.inCombat,
      send: (to, type, msg) => sent.push({ to, type, msg }),
      isFree: (x, y) => !(x === 10 && y === 11), // (10,11) ocupado
    });
    const mk = (x: number, y: number, o: Record<string, unknown> = {}) => {
      const p = player("p", x, y, { vocation: "knight", ...o } as never);
      skills.load(p);
      return p;
    };
    return { sent, skills, training, mk };
  }

  it("parseStatues lê objetos training_statue (statueId ou nome)", () => {
    const map: any = {
      width: 20, height: 20, tilewidth: 16, tileheight: 16, tilesets: [],
      layers: [{ name: "objects", type: "objectgroup", objects: [
        { id: 1, name: "a", type: "training_statue", x: 32, y: 48, width: 0, height: 0, properties: [{ name: "statueId", type: "string", value: "est1" }] },
        { id: 2, name: "est2", class: "training_statue", x: 0, y: 16, width: 0, height: 0 },
        { id: 3, name: "npc", type: "npc", x: 0, y: 0, width: 0, height: 0 },
      ] }],
    };
    expect(parseStatues(map)).toEqual([{ id: "est1", x: 2, y: 3 }, { id: "est2", x: 0, y: 1 }]);
  });

  it("TrainOpen: só adjacente (Chebyshev 1) e com id existente", () => {
    const t = tsetup();
    t.training.onOpen(t.mk(11, 11), { statueId: "s1" });
    expect(t.sent.at(-1)).toMatchObject({ type: S2C.TrainingOpen, msg: { statueId: "s1" } });
    t.sent.length = 0;
    t.training.onOpen(t.mk(13, 10), { statueId: "s1" });
    t.training.onOpen(t.mk(10, 11), { statueId: "nope" });
    expect(t.sent.map((s) => s.type)).toEqual([S2C.Notice, S2C.Notice]);
  });

  it("TrainOffline: aceita adjacente/fora de combate/vivo e devolve o registro", () => {
    const t = tsetup();
    expect(t.training.begin(t.mk(9, 9), { skill: "magic" }, 123_456)).toEqual({ skill: "magic", sinceMs: 123_456, statueId: "s1" });
  });

  it("TrainOffline: recusa longe, em combate, morto, skill inválida", () => {
    const far = tsetup();
    expect(far.training.begin(far.mk(14, 10), { skill: "melee" }, 1)).toBeNull();
    expect(far.sent.at(-1)!.type).toBe(S2C.Notice);
    const combat = tsetup({ inCombat: true });
    expect(combat.training.begin(combat.mk(10, 11), { skill: "melee" }, 1)).toBeNull();
    expect(combat.sent.at(-1)!.msg.text).toMatch(/combate/);
    const dead = tsetup();
    expect(dead.training.begin(dead.mk(10, 11, { hp: 0 }), { skill: "melee" }, 1)).toBeNull();
    const bad = tsetup();
    for (const skill of ["xp", "", 3, null, undefined, {}] as never[]) expect(bad.training.begin(bad.mk(10, 11), { skill }, 1)).toBeNull();
    expect(bad.training.begin(bad.mk(10, 11), undefined as never, 1)).toBeNull();
  });

  it("returnTile: tile livre ao lado da estátua; desconhecida → null", () => {
    const t = tsetup();
    const r = t.training.returnTile("s1", "p")!;
    expect(statueDistance(STATUE, r.x, r.y)).toBe(1);
    expect(r).not.toEqual({ x: 10, y: 11 });
    expect(t.training.returnTile("zzz", "p")).toBeNull();
  });

  it("applyOffline: aplica tentativas, sobe vários níveis, reporta resultado", () => {
    const t = tsetup();
    const p = t.mk(10, 11);
    const r = t.training.applyOffline(p, { skill: "melee", sinceMs: 0 }, 60 * 60_000); // 1 h = 900 tentativas
    expect(r.minutes).toBe(60);
    expect(r.levelsGained).toBeGreaterThan(1);
    expect(r.newLevel).toBe(10 + r.levelsGained);
    expect(t.sent.filter((s) => s.type === S2C.SkillUp)).toHaveLength(r.levelsGained);
    const s = t.skills.get("p", "melee")!;
    expect(r.pct).toBe(Math.floor((s.tries * 100) / skillTriesFor("melee", s.level, "knight")));
    let spent = s.tries; // conservação: gastas + restantes = 900
    for (let l = 10; l < s.level; l++) spent += skillTriesFor("melee", l, "knight");
    expect(spent).toBe(900);
  });

  it("applyOffline: login em < 1 min não rende nada; 12 h é o teto", () => {
    const t = tsetup();
    expect(t.training.applyOffline(t.mk(10, 11), { skill: "magic", sinceMs: 1_000_000 }, 1_000_000 + 30_000))
      .toMatchObject({ minutes: 0, levelsGained: 0, newLevel: 0 });
    const t2 = tsetup();
    const a = t2.training.applyOffline(t2.mk(10, 11), { skill: "shield", sinceMs: 0 }, 720 * 60_000);
    const t3 = tsetup();
    const b = t3.training.applyOffline(t3.mk(10, 11), { skill: "shield", sinceMs: 0 }, 30 * 24 * 3600_000);
    expect(b).toEqual(a);
    expect(a.minutes).toBe(720);
  });

  it("CLOSE_TRAINING é 4101", () => {
    expect(CLOSE_TRAINING).toBe(4101);
  });
});
