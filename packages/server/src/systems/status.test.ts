import { describe, expect, it } from "vitest";
import { formatUptime, statusLines } from "./status.ts";

describe("status", () => {
  it("formata o tempo no ar", () => {
    expect(formatUptime(45_000)).toBe("45 s");
    expect(formatUptime(5 * 60_000 + 1)).toBe("5 min");
    expect(formatUptime(3 * 3600_000 + 7 * 60_000)).toBe("3 h 7 min");
    expect(formatUptime(2 * 86400_000 + 5 * 3600_000)).toBe("2 d 5 h");
  });

  it("resume o servidor em 4 linhas, com a carga do tick em % do orçamento", () => {
    const lines = statusLines({
      uptimeMs: 3600_000, online: 7, peakOnline: 12, joins: 30, monsters: 135, pendingRespawns: 4, groundItems: 21,
      tickAvgMs: 0.5, tickMaxMs: 5, tickBudgetMs: 50, rssMb: 180, heapMb: 60, errors: 0,
    });
    expect(lines).toHaveLength(4);
    expect(lines[0]).toContain("7 online (pico 12)");
    expect(lines[1]).toContain("135 monstros (4 voltando)");
    expect(lines[2]).toContain("1% do orçamento");
    expect(lines[3]).toContain("180 MB");
  });
});
