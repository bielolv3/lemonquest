import { describe, expect, it } from "vitest";
import { WEEKLY_EVENTS, eventBonusText, nextScheduled, scheduledEvent, type GameEventDef } from "./events.ts";

// 2026-10-14 é uma quarta-feira (dia 3); 2026-10-16, sexta (5); 2026-10-17, sábado (6).
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min, 0, 0);

describe("eventos semanais", () => {
  it("a definição é coerente: ids únicos, dia/hora válidos, bônus positivos", () => {
    expect(new Set(WEEKLY_EVENTS.map((e) => e.id)).size).toBe(WEEKLY_EVENTS.length);
    for (const e of WEEKLY_EVENTS) {
      expect(e.day).toBeGreaterThanOrEqual(0); expect(e.day).toBeLessThanOrEqual(6);
      expect(e.hour).toBeLessThan(24);
      expect(e.durationMin).toBeGreaterThan(0);
      expect(e.xpMult).toBeGreaterThanOrEqual(1); expect(e.lootMult).toBeGreaterThanOrEqual(1);
      expect(e.id).toMatch(/^[a-z_]+$/); // digitável no /evento
    }
  });

  it("agenda: ativo só dentro da janela (início inclusivo, fim exclusivo)", () => {
    expect(scheduledEvent(at(2026, 10, 16, 18, 59))).toBeNull();
    expect(scheduledEvent(at(2026, 10, 16, 19, 0))).toMatchObject({ id: "noite_de_cacada", xpMult: 2 });
    expect(scheduledEvent(at(2026, 10, 16, 19, 59))?.id).toBe("noite_de_cacada");
    expect(scheduledEvent(at(2026, 10, 16, 20, 0))).toBeNull();
    expect(scheduledEvent(at(2026, 10, 14, 12, 30))?.id).toBe("mare_de_tesouros"); // quarta
    expect(scheduledEvent(at(2026, 10, 15, 12, 30))).toBeNull(); // quinta: nenhum
  });

  it("o fim vem em ms epoch e a janela que atravessa a meia-noite continua no dia seguinte", () => {
    const late: GameEventDef = { id: "tarde", name: "T", desc: "", xpMult: 2, lootMult: 1, day: 5, hour: 23, durationMin: 120 };
    expect(scheduledEvent(at(2026, 10, 16, 23, 30), [late])?.until).toBe(at(2026, 10, 17, 1, 0).getTime());
    expect(scheduledEvent(at(2026, 10, 17, 0, 30), [late])?.id).toBe("tarde"); // já é sábado
    expect(scheduledEvent(at(2026, 10, 17, 1, 0), [late])).toBeNull();
  });

  it("próximo evento: o mais cedo depois de agora", () => {
    const n = nextScheduled(at(2026, 10, 14, 13, 0))!; // quarta depois da Maré: o próximo é sexta
    expect(n.def.id).toBe("noite_de_cacada");
    expect(n.at).toBe(at(2026, 10, 16, 19, 0).getTime());
    expect(nextScheduled(at(2026, 10, 17, 15, 0))!.def.id).toBe("mare_de_tesouros"); // sábado depois das 14h → quarta
  });

  it("texto do bônus: só o que passa de 1, com vírgula decimal", () => {
    expect(eventBonusText({ xpMult: 2, lootMult: 1 })).toBe("XP ×2");
    expect(eventBonusText({ xpMult: 1, lootMult: 1.5 })).toBe("loot ×1,5");
    expect(eventBonusText({ xpMult: 1.5, lootMult: 1.25 })).toBe("XP ×1,5 · loot ×1,25");
    expect(eventBonusText({ xpMult: 1, lootMult: 1 })).toBe("");
  });
});
