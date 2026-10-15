// Bestiário: quais monstros listar, se o jogador já os conhece e como mostrar chances. Puro (sem DOM) para testar.
import type { MonsterDef } from "@lemonquest/shared";

export interface BestiaryRow {
  id: string;
  name: string;
  level: number;
  boss: boolean;
  /** Abates (0 = ainda não derrotado: os detalhes ficam escondidos). */
  kills: number;
  known: boolean;
}

/** Monstros do bestiário: os que dão XP e podem ser mortos (sem bonecos de treino e invocações), por level. */
export function bestiaryRows(defs: readonly MonsterDef[], bestiary: Record<string, number> | undefined): BestiaryRow[] {
  return defs
    .filter((d) => !d.invulnerable && d.xp > 0)
    .map((d) => {
      const kills = Math.max(0, Math.floor(bestiary?.[d.id] ?? 0));
      return { id: d.id, name: d.name, level: d.level, boss: !!d.boss, kills, known: kills > 0 };
    })
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "pt-BR"));
}

/** "sempre", "35%", "2,5%" */
export function chanceText(c: number): string {
  if (c >= 1) return "sempre";
  const p = c * 100;
  if (p >= 10) return `${Math.round(p)}%`;
  return `${p.toFixed(1).replace(".", ",").replace(/,0$/, "")}%`;
}

export const DAMAGE_LABEL: Record<string, string> = {
  physical: "físico", fire: "fogo", ice: "gelo", earth: "terra", energy: "energia", death: "morte", holy: "sagrado",
};
export const damageLabel = (k: string): string => DAMAGE_LABEL[k] ?? k;

/** "12 de 40 conhecidos" */
export function progressText(rows: readonly BestiaryRow[]): string {
  return `${rows.filter((r) => r.known).length} de ${rows.length} conhecidos`;
}
