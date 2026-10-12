// Comida estilo Tibia: comer concede/estende o estado "alimentado" (condição "fed"): a cada FOOD_TICK_MS o jogador
// recupera hpPerTick de vida e manaPerTick de mana (dentro e fora de combate, somado à regen normal).
// Regra: taxas = máximo entre as atuais e as da comida nova; duração soma, limitada a FOOD_MAX_MS.
import { FOOD_MAX_MS, FOOD_TICK_MS, type ConditionsMsg } from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import type { CharacterData } from "../persistence/types.ts";

/** Folga do teto: a menos de 10 s do máximo já conta como "satisfeito" (senão o teto exato nunca seria atingido). */
const FULL_MARGIN_MS = 10_000;

export interface FoodEffect { hpPerTick: number; manaPerTick: number; durationMs: number }

interface Fed { until: number; hpPerTick: number; manaPerTick: number; nextTickAt: number }

export interface FoodOptions {
  /** Cura (evento "heal"); só chamado quando há vida a recuperar. */
  heal: (p: PlayerState, amount: number) => void;
  /** Mana (evento "mana"); só chamado quando há mana a recuperar. */
  restoreMana: (p: PlayerState, amount: number) => void;
}

export class FoodSystem {
  private readonly fed = new Map<string, Fed>();

  constructor(private readonly o: FoodOptions) {}

  /** Come. Retorna false (sem consumir) se já está no teto de tempo (satisfeito). */
  eat(p: PlayerState, food: FoodEffect, now: number): boolean {
    const cur = this.fed.get(p.id);
    const remaining = cur ? Math.max(0, cur.until - now) : 0;
    if (remaining >= FOOD_MAX_MS - FULL_MARGIN_MS) return false;
    this.fed.set(p.id, {
      until: now + Math.min(FOOD_MAX_MS, remaining + food.durationMs),
      hpPerTick: Math.max(cur?.hpPerTick ?? 0, food.hpPerTick),
      manaPerTick: Math.max(cur?.manaPerTick ?? 0, food.manaPerTick),
      nextTickAt: cur ? cur.nextTickAt : now + FOOD_TICK_MS,
    });
    return true;
  }

  tick(now: number, players: Iterable<PlayerState>): void {
    for (const p of players) {
      const f = this.fed.get(p.id);
      if (!f) continue;
      while (now >= f.nextTickAt && f.nextTickAt <= f.until) {
        f.nextTickAt += FOOD_TICK_MS;
        if (p.hp <= 0) continue;
        if (f.hpPerTick > 0 && p.hp < p.maxHp) this.o.heal(p, f.hpPerTick);
        if (f.manaPerTick > 0 && p.mana < p.maxMana) this.o.restoreMana(p, f.manaPerTick);
      }
      if (now >= f.until) this.fed.delete(p.id);
    }
  }

  /** Entrada da lista de condições (S2C.Conditions), se alimentado. */
  condition(id: string, now: number): ConditionsMsg["list"][number] | undefined {
    const f = this.fed.get(id);
    if (!f || now >= f.until) return undefined;
    return { id: "fed", remainingMs: f.until - now, value: f.hpPerTick, value2: f.manaPerTick };
  }

  remainingMs(id: string, now: number): number {
    const f = this.fed.get(id);
    return f ? Math.max(0, f.until - now) : 0;
  }

  load(id: string, data: CharacterData | undefined, now: number): void {
    const f = data?.fed;
    if (!f || !(f.remainingMs > 0)) { this.fed.delete(id); return; }
    this.fed.set(id, {
      until: now + Math.min(FOOD_MAX_MS, f.remainingMs),
      hpPerTick: Math.max(0, f.hpPerTick | 0), manaPerTick: Math.max(0, f.manaPerTick | 0),
      nextTickAt: now + FOOD_TICK_MS,
    });
  }

  serialize(id: string, now: number): CharacterData["fed"] {
    const f = this.fed.get(id);
    if (!f || now >= f.until) return undefined;
    return { remainingMs: f.until - now, hpPerTick: f.hpPerTick, manaPerTick: f.manaPerTick };
  }

  removePlayer(id: string): void {
    this.fed.delete(id);
  }
}
