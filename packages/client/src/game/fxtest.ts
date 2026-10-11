// Harness de desenvolvimento (?fxtest, só em modo dev): cria criaturas falsas e dispara eventos de combate
// a cada segundo para validar visualmente barras de HP, números, projéteis, mortes e level-up sem servidor.
import { MONSTERS, type CombatEvent, type DamageKind, type MonsterView, type PlayerView } from "@tibinha/shared";
import type { WorldScene } from "../scenes/WorldScene.ts";
import { playersStore } from "../ui/hud/world.ts";
import { subscribeTarget } from "../ui/hud/target.ts";
import { hideDeath } from "../ui/combat/combatUi.ts";

export const FXTEST = import.meta.env.DEV && new URLSearchParams(location.search).has("fxtest");

const ME = "fxme";
const KINDS: DamageKind[] = ["fire", "ice", "energy", "earth", "holy", "death"];
const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];
const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));

export function startFxTest(scene: WorldScene, spawn: { x: number; y: number }, walkable: (x: number, y: number) => boolean) {
  const me: PlayerView = {
    id: ME, name: "QA Combate", vocation: "knight", level: 8, x: spawn.x, y: spawn.y, dir: 4, stepMs: 280, seq: 0,
    hp: 160, maxHp: 200, mana: 80, maxMana: 100, xp: 400, targetId: "",
  };
  (window as unknown as Record<string, unknown>).__scene = scene;
  scene.setLocalId(ME);
  scene.addPlayer(ME, me);
  const publish = () => {
    const { stepMs: _s, seq: _q, ...snap } = me;
    playersStore.set(new Map([[ME, snap]]));
  };
  publish();
  // O "servidor" falso ecoa o alvo escolhido pelo jogador.
  const offTarget = subscribeTarget((t) => { me.targetId = t?.id ?? ""; });
  scene.events.once("shutdown", offTarget);

  // Anel de criaturas ao redor do spawn (uma de cada def + um defId desconhecido).
  const defs = [...Object.keys(MONSTERS), "def_inexistente"];
  const tiles: { x: number; y: number }[] = [];
  for (let r = 2; r <= 7 && tiles.length < defs.length * 2; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || (dx + dy) % 2 !== 0) continue;
      if (walkable(spawn.x + dx, spawn.y + dy)) tiles.push({ x: spawn.x + dx, y: spawn.y + dy });
    }
  }
  const mons = new Map<string, MonsterView>();
  const home = new Map<string, { x: number; y: number }>();
  defs.forEach((defId, i) => {
    const t = tiles[i * 2 % Math.max(1, tiles.length)];
    if (!t) return;
    const hp = MONSTERS[defId]?.hp ?? 50;
    const m: MonsterView = { id: `m${i}`, defId, x: t.x, y: t.y, dir: 4, stepMs: 300, hp, maxHp: hp, targetId: "" };
    mons.set(m.id, m);
    home.set(m.id, t);
    scene.addMonster(m.id, m);
  });

  const alive = () => [...mons.values()].filter((m) => m.hp > 0);
  const hitMonster = (m: MonsterView, ev: Partial<CombatEvent>) => {
    const amount = ev.miss ? 0 : (ev.amount ?? rnd(3, 40));
    scene.onCombat([{ sourceId: ME, targetId: m.id, amount, kind: "physical", ...ev }]);
    if (!ev.miss) {
      const delay = ev.ranged ? 200 : 0;
      setTimeout(() => {
        m.hp = Math.max(0, m.hp - amount);
        scene.onMonsterChange(m.id, m);
        if (m.hp <= 0) kill(m);
      }, delay);
    }
  };
  const kill = (m: MonsterView) => {
    scene.onCreatureDied({ id: m.id, x: m.x, y: m.y, defId: m.defId });
    scene.onXpGain(MONSTERS[m.defId]?.xp ?? 10);
    setTimeout(() => scene.removeMonster(m.id), 120);
    setTimeout(() => {
      m.hp = m.maxHp; m.x = home.get(m.id)!.x; m.y = home.get(m.id)!.y;
      scene.addMonster(m.id, m);
    }, 3000);
  };
  const hurtMe = (m: MonsterView, amount: number, extra: Partial<CombatEvent> = {}) => {
    scene.onCombat([{ sourceId: m.id, targetId: ME, amount, kind: "physical", ...extra }]);
    setTimeout(() => {
      me.hp = Math.max(20, me.hp - amount);
      scene.onPlayerChange(ME, me); publish();
    }, extra.ranged ? 200 : 0);
  };

  let step = 0;
  const actions: (() => void)[] = [
    () => { const m = pick(alive()); if (m) hitMonster(m, { amount: rnd(4, 30) }); },
    () => { const m = pick(alive()); if (m) hitMonster(m, { amount: rnd(10, 40), ranged: true }); },
    () => { const m = pick(alive()); if (m) hitMonster(m, { amount: rnd(40, 90), crit: true, kind: "fire", ranged: true }); },
    () => { const m = pick(alive()); if (m) hurtMe(m, rnd(5, 25)); },
    () => { const m = pick(alive()); if (m) hitMonster(m, { miss: true }); },
    () => { const m = pick(alive()); if (m) hitMonster(m, { kind: pick(KINDS), amount: rnd(15, 60), ranged: Math.random() < 0.5 }); },
    () => { me.hp = Math.min(me.maxHp, me.hp + 40); scene.onCombat([{ sourceId: ME, targetId: ME, amount: 40, kind: "heal" }]); scene.onPlayerChange(ME, me); publish(); },
    () => { const m = pick(alive()); if (m) hurtMe(m, rnd(45, 60), { crit: true, ranged: true, kind: "physical" }); },
    () => { const m = pick(alive()); if (m) hitMonster(m, { amount: rnd(5, 20) }); },
    () => { const m = pick(alive()); if (m) { m.hp = Math.min(m.hp, 1); scene.onMonsterChange(m.id, m); hitMonster(m, { amount: 5, crit: true }); } },
  ];
  const timer = window.setInterval(() => {
    step++;
    actions[step % actions.length]();
    if (step % 18 === 0) {
      me.level++; me.maxHp += 15; me.hp = me.maxHp;
      scene.onPlayerChange(ME, me); scene.onLevelUp(me.level); publish();
    }
    if (step % 50 === 0) { scene.onDied("Rato", 123); setTimeout(hideDeath, 4000); }
  }, 1000);
  scene.events.once("shutdown", () => window.clearInterval(timer));
}
