import { describe, expect, it } from "vitest";
import { CHALLENGES, CHALLENGE_BONUS, S2C, challengeTarget, xpForLevel } from "@lemonquest/shared";
import { ChallengeSystem } from "./challenges.ts";
import { makeItem } from "./inventory.ts";
import { invWorld } from "./m4kit.ts";
import { rollWeek } from "./weekly.ts";

const WED = new Date(2026, 9, 14, 12).getTime();

function setup(level = 10) {
  const w = invWorld();
  const p = w.mk("p", { level });
  let t = WED;
  const rec: any = { id: 1, name: "p", xp: xpForLevel(level), data: { ach: { done: {}, stats: {}, killed: [] } } };
  rollWeek(rec, new Date(t)); // linha de base no começo da semana
  const out: { type: string; msg: any }[] = [];
  const saved: string[] = [];
  const xp: number[] = [];
  const sys = new ChallengeSystem({
    getPlayer: () => p, record: () => rec, send: (_to, type, msg) => out.push({ type, msg: structuredClone(msg) }),
    inventory: w.inv, gainXp: (_p, n) => xp.push(n), save: (id) => saved.push(id), now: () => t,
  });
  const last = () => out.filter((o) => o.type === S2C.Challenges).at(-1)!.msg;
  const notices = () => out.filter((o) => o.type === S2C.Notice).map((o) => o.msg.text as string);
  const gain = (key: "kills" | "fish" | "bosses", n: number) => { rec.data.ach.stats[key] = (rec.data.ach.stats[key] ?? 0) + n; };
  return { w, p, rec, sys, out, last, notices, saved, xp, gain, setTime: (ms: number) => { t = ms; } };
}

describe("desafios da semana", () => {
  it("a lista traz as 3 metas com progresso zerado; meta de XP = um level do começo da semana (mín. 300)", () => {
    const s = setup(10);
    s.sys.onMessage(s.p, { action: "list" });
    const v = s.last();
    expect(v.goals.map((g: any) => g.id)).toEqual(CHALLENGES.map((c) => c.id));
    expect(v.goals.every((g: any) => g.progress === 0 && !g.claimed)).toBe(true);
    expect(v.goals.find((g: any) => g.id === "evolucao").target).toBe(xpForLevel(11) - xpForLevel(10));
    expect(challengeTarget(CHALLENGES[2]!, 1)).toBeGreaterThanOrEqual(300);
    expect(v.weekEndsAt).toBe(new Date(2026, 9, 19).getTime());
    expect(v.bonus.claimed).toBe(false);
  });

  it("o progresso é o ganho desde o começo da semana (limitado à meta) e sobe com o jogo", () => {
    const s = setup();
    s.gain("kills", 40);
    s.sys.onMessage(s.p, { action: "list" });
    expect(s.last().goals.find((g: any) => g.id === "cacada").progress).toBe(40);
    s.gain("kills", 500);
    s.sys.onMessage(s.p, { action: "list" });
    expect(s.last().goals.find((g: any) => g.id === "cacada").progress).toBe(150); // teto = meta
  });

  it("resgatar sem cumprir, duas vezes ou com mochila cheia é recusado; cumprido entrega ouro, XP e itens", () => {
    const s = setup();
    s.sys.onMessage(s.p, { action: "claim", id: "cacada" });
    expect(s.notices().at(-1)).toContain("não concluído");
    s.gain("kills", 150);
    s.sys.onMessage(s.p, { action: "claim", id: "cacada" });
    expect(s.w.inv.gold("p")).toBe(400);
    expect(s.w.inv.countItem("p", "health_potion")).toBe(10);
    expect(s.saved).toEqual(["p"]);
    expect(s.last().goals.find((g: any) => g.id === "cacada").claimed).toBe(true);
    s.sys.onMessage(s.p, { action: "claim", id: "cacada" });
    expect(s.notices().at(-1)).toContain("já resgatou");
    expect(s.w.inv.gold("p")).toBe(400);

    const f = setup();
    f.gain("fish", 12);
    for (let i = 0; i < f.w.inv.get("p")!.backpack.length; i++) f.w.inv.addItem(f.p, makeItem("vest"));
    f.sys.onMessage(f.p, { action: "claim", id: "pescaria" });
    expect(f.notices().at(-1)).toContain("mochila está cheia");
    expect(f.w.inv.gold("p")).toBe(0);
    expect(f.rec.data.challenges.claimed).toEqual([]);
  });

  it("o bônus só sai com os três resgatados, uma vez", () => {
    const s = setup();
    s.sys.onMessage(s.p, { action: "claimBonus" });
    expect(s.notices().at(-1)).toContain("três desafios");
    s.gain("kills", 150); s.gain("fish", 12);
    s.rec.xp += challengeTarget(CHALLENGES[2]!, 10);
    for (const c of CHALLENGES) s.sys.onMessage(s.p, { action: "claim", id: c.id });
    const gold0 = s.w.inv.gold("p");
    s.sys.onMessage(s.p, { action: "claimBonus" });
    expect(s.w.inv.gold("p")).toBe(gold0 + CHALLENGE_BONUS.gold!);
    expect(s.xp).toContain(CHALLENGE_BONUS.xp);
    expect(s.w.inv.countItem("p", "health_potion_medium")).toBe(5);
    s.sys.onMessage(s.p, { action: "claimBonus" });
    expect(s.notices().at(-1)).toContain("já resgatou");
    expect(s.w.inv.gold("p")).toBe(gold0 + CHALLENGE_BONUS.gold!);
  });

  it("na semana seguinte tudo zera: sem progresso nem resgates, e a meta de XP usa o level da nova semana", () => {
    const s = setup(10);
    s.gain("fish", 12);
    s.sys.onMessage(s.p, { action: "claim", id: "pescaria" });
    expect(s.rec.data.challenges.claimed).toEqual(["pescaria"]);
    const next = new Date(2026, 9, 21, 12).getTime();
    s.setTime(next);
    s.p.level = 20;
    rollWeek(s.rec, new Date(next)); // a sala faz isso na virada
    s.sys.onMessage(s.p, { action: "list" });
    const v = s.last();
    expect(v.goals.every((g: any) => g.progress === 0 && !g.claimed)).toBe(true);
    expect(v.goals.find((g: any) => g.id === "evolucao").target).toBe(xpForLevel(21) - xpForLevel(20));
  });

  it("mensagens malformadas e ids desconhecidos são ignorados", () => {
    const s = setup();
    s.sys.onMessage(s.p, null as any);
    s.sys.onMessage(s.p, { action: "claim", id: "nada" });
    s.sys.onMessage(s.p, { action: "explodir" } as any);
    expect(s.out).toEqual([]);
  });
});
