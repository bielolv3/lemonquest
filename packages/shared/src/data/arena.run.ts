import { arenaWaveSpawns } from "./arena.ts";
import { monsterDef } from "./monsters.ts";
export function estimate(wave: number, n: number, L: number) {
  const dps = ((6 + 1.6 * L) * 1.35) / 2;
  const hp = 150 + 10 * (L - 1);
  const armor = Math.round(L / 4);
  const sp = arenaWaveSpawns(wave, n, L);
  let t = 0, dmg = 0;
  const party = dps * n;
  for (const s of sp) {
    const d = monsterDef(s.defId)!;
    const mhp = Math.max(0, d.hp * s.hpMult - 0);
    const eff = Math.max(0, ((d.damage[0] + d.damage[1]) / 2) * s.dmgMult - armor);
    t += mhp / party;
    dmg += (eff / (d.attackMs / 1000)) * t;
  }
  return { wave, count: sp.length, time: Math.round(t), ratio: +(dmg / n / hp).toFixed(2) };
}
for (const [n, L] of [[1, 10], [4, 25], [1, 25], [2, 15], [4, 40], [1, 5]] as const) {
  console.log(`n=${n} L=${L}: ` + Array.from({ length: 30 }, (_, i) => { const e = estimate(i + 1, n, L); return `${e.wave}:${e.ratio}/${e.time}s`; }).join(" "));
}
