import { describe, expect, it } from "vitest";
import { S2C, requestBand, weekId } from "@lemonquest/shared";
import { generateRequest, MaterialRequestSystem } from "./materialRequest.ts";
import { makeItem } from "./inventory.ts";
import { invWorld } from "./m4kit.ts";

const MON = new Date(2026, 9, 19, 12).getTime(); // segunda

function setup(level = 10) {
  const w = invWorld();
  const p = w.mk("p", { level });
  const rec: any = { id: 1, data: {} };
  const t = MON;
  const out: { type: string; msg: any }[] = [];
  const saved: string[] = [];
  const sys = new MaterialRequestSystem({
    record: () => rec, send: (_to, type, msg) => out.push({ type, msg: structuredClone(msg) }),
    inventory: w.inv, save: (id) => saved.push(id), now: () => t,
  });
  const last = () => out.filter((o) => o.type === S2C.MaterialRequestState).at(-1)!.msg.request;
  const notices = () => out.filter((o) => o.type === S2C.Notice).map((o) => o.msg.text as string);
  return { w, p, rec, sys, out, last, notices, saved };
}

describe("encomenda semanal de material", () => {
  it("gera a mesma encomenda pra mesma semana+faixa; faixa diferente pode mudar o material", () => {
    const week = weekId(new Date(MON));
    const defsLike = { defs: (id: string) => (id === "cheese" ? { value: 10 } : { value: 100 }) } as any;
    const a = generateRequest(week, 0, defsLike);
    const b = generateRequest(week, 0, defsLike);
    expect(a).toEqual(b);
    expect(requestBand(1)).toBe(0);
    expect(requestBand(88)).toBe(9);
  });

  it("lista a encomenda da semana com o progresso da mochila", () => {
    const s = setup(5);
    s.sys.onMessage(s.p, { action: "list" });
    const v = s.last();
    expect(v.have).toBe(0);
    expect(v.claimed).toBe(false);
    expect(v.count).toBeGreaterThan(0);
    expect(v.gold).toBeGreaterThan(0);
  });

  it("entrega: precisa da quantidade certa, consome os itens, paga ouro, e só uma vez por semana", () => {
    const s = setup(5);
    s.sys.onMessage(s.p, { action: "list" });
    const v = s.last();
    s.sys.onMessage(s.p, { action: "turnIn" });
    expect(s.notices().at(-1)).toBe("Você não tem o suficiente ainda.");
    s.w.inv.addItem(s.p, makeItem(v.materialId, v.count));
    s.sys.onMessage(s.p, { action: "turnIn" });
    expect(s.w.inv.gold("p")).toBe(v.gold);
    expect(s.w.inv.get("p")!.backpack.filter(Boolean)).toHaveLength(0);
    expect(s.saved).toContain("p");
    s.w.inv.addItem(s.p, makeItem(v.materialId, v.count));
    s.sys.onMessage(s.p, { action: "turnIn" });
    expect(s.notices().at(-1)).toBe("Você já entregou a encomenda desta semana.");
    expect(s.w.inv.gold("p")).toBe(v.gold); // não pagou de novo
  });
});
