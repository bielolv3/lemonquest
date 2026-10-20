import { describe, expect, it } from "vitest";
import { NPCS, S2C, TRAVEL_FREE_LEVEL, npcDef } from "@lemonquest/shared";
import { NpcSystem } from "./npcs.ts";
import { invWorld } from "./m4kit.ts";
import type { PlayerState } from "../state.ts";

function setup(o: { busy?: boolean } = {}) {
  const w = invWorld();
  const players = new Map<string, PlayerState>();
  const out: { to: string; type: string; msg: any }[] = [];
  const trips: { id: string; x: number; y: number }[] = [];
  const npcs = new NpcSystem({
    npcs: [{ id: "coach_village", x: 98, y: 100 }],
    inventory: w.inv, defs: npcDef, players: () => players.values(), getPlayer: (id) => players.get(id),
    send: (to, type, msg) => out.push({ to, type, msg }), broadcast: () => {}, rng: () => 0.5,
    travel: (p, x, y) => { p.x = x; p.y = y; trips.push({ id: p.id, x, y }); },
    travelBlocked: () => (o.busy ? "Você está em combate." : null),
  });
  const add = (id: string, level: number) => {
    const p = w.mk(id, { level });
    p.x = 97; p.y = 100;
    players.set(id, p);
    return p;
  };
  const last = () => out.at(-1)!.msg;
  return { w, npcs, out, trips, add, last };
}

describe("viagem (cocheiros)", () => {
  const dest = NPCS.coach_village!.travel![0]!;

  it("abre com destinos e preço; cobra o ouro e leva ao destino", () => {
    const t = setup();
    const p = t.add("p1", 20);
    t.npcs.onInteract(p, { npcId: "coach_village" });
    expect(t.out.find((o) => o.type === S2C.NpcOpen)!.msg.travel).toEqual(NPCS.coach_village!.travel!.map((d) => ({ id: d.id, label: d.label, price: d.price })));
    t.npcs.onTravel(p, { npcId: "coach_village", dest: dest.id });
    expect(t.last().text).toBe("Ouro insuficiente.");
    expect(t.trips).toHaveLength(0);
    t.w.inv.addGold(p, dest.price + 10);
    t.npcs.onTravel(p, { npcId: "coach_village", dest: dest.id });
    expect(t.trips).toEqual([{ id: "p1", x: dest.x, y: dest.y }]);
    expect(t.w.inv.gold("p1")).toBe(10);
  });

  it("grátis até o level TRAVEL_FREE_LEVEL", () => {
    const t = setup();
    const p = t.add("p1", TRAVEL_FREE_LEVEL);
    t.npcs.onInteract(p, { npcId: "coach_village" });
    expect(t.out.find((o) => o.type === S2C.NpcOpen)!.msg.travel[0].price).toBe(0);
    t.npcs.onTravel(p, { npcId: "coach_village", dest: dest.id });
    expect(t.trips).toHaveLength(1);
  });

  it("não viaja em combate, com destino inválido ou sem o diálogo aberto", () => {
    const busy = setup({ busy: true });
    const p = busy.add("p1", 1);
    busy.npcs.onInteract(p, { npcId: "coach_village" });
    busy.npcs.onTravel(p, { npcId: "coach_village", dest: dest.id });
    expect(busy.last().text).toBe("Você está em combate.");
    const t = setup();
    const q = t.add("q", 1);
    t.npcs.onTravel(q, { npcId: "coach_village", dest: dest.id }); // sem abrir
    t.npcs.onInteract(q, { npcId: "coach_village" });
    t.npcs.onTravel(q, { npcId: "coach_village", dest: "lua" });
    expect(busy.trips.length + t.trips.length).toBe(0);
  });

  it("os dois cocheiros levam um ao outro (e ambos levam a Porto Esperança)", () => {
    expect(NPCS.coach_frontier!.travel![0]!.id).toBe("village");
    expect(dest.id).toBe("frontier");
    for (const id of ["coach_village", "coach_frontier"]) expect(NPCS[id]!.travel!.map((d) => d.id)).toContain("port");
    expect(NPCS.port_captain!.travel!.map((d) => d.id).sort()).toEqual(["frontier", "village"]);
  });
});
