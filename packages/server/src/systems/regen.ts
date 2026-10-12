// Regeneração (a cada REGEN_INTERVAL_MS; ×3 na zona de proteção): HP fora de combate; mana sempre (metade em combate).
// Monstros regeneram por completo ao voltar ao spawn (ai.ts).
import { REGEN_INTERVAL_MS, manaRegenAmount, regenAmount } from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";

export interface RegenOptions {
  inCombat: (playerId: string, now: number) => boolean;
  inPz: (x: number, y: number) => boolean;
  /** Bônus de regen do equipamento (hpRegen/manaRegen), somados a cada tique em que a regen ocorre. */
  bonus?: (playerId: string) => { hp: number; mana: number };
}

export class RegenSystem {
  private readonly nextAt = new Map<string, number>();

  constructor(private readonly o: RegenOptions) {}

  tick(now: number, players: Iterable<PlayerState>): void {
    for (const p of players) {
      const due = this.nextAt.get(p.id);
      if (due === undefined) { this.nextAt.set(p.id, now + REGEN_INTERVAL_MS); continue; }
      if (now < due) continue;
      this.nextAt.set(p.id, now + REGEN_INTERVAL_MS);
      if (p.hp <= 0) continue;
      const fighting = this.o.inCombat(p.id, now);
      const pz = this.o.inPz(p.x, p.y);
      // Mana flui sempre (metade em combate), para os magos conseguirem conjurar; vida só fora de combate.
      const b = this.o.bonus?.(p.id);
      if (p.mana < p.maxMana) p.mana = Math.min(p.maxMana, p.mana + manaRegenAmount(p.maxMana, p.level, fighting, pz) + Math.max(0, b?.mana ?? 0));
      if (fighting) continue;
      if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regenAmount(p.maxHp, p.level, pz) + Math.max(0, b?.hp ?? 0));
    }
  }

  removePlayer(id: string): void {
    this.nextAt.delete(id);
  }
}
