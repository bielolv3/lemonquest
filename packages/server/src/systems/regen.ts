// Regeneração (a cada REGEN_INTERVAL_MS; ×3 na zona de proteção): HP fora de combate; mana sempre (metade em combate).
// Monstros regeneram por completo ao voltar ao spawn (ai.ts).
import { REGEN_INTERVAL_MS, manaRegenAmount, regenAmount } from "@tibinha/shared";
import type { PlayerState } from "../state.ts";

export interface RegenOptions {
  inCombat: (playerId: string, now: number) => boolean;
  inPz: (x: number, y: number) => boolean;
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
      if (p.mana < p.maxMana) p.mana = Math.min(p.maxMana, p.mana + manaRegenAmount(p.maxMana, p.level, fighting, pz));
      if (fighting) continue;
      if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + regenAmount(p.maxHp, p.level, pz));
    }
  }

  removePlayer(id: string): void {
    this.nextAt.delete(id);
  }
}
