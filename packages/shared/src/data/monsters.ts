import type { DamageKind } from "../types.ts";

/**
 * Sprite de criatura. Ninja Adventure: sheet 64x64, frames 16x16, 4x4.
 * `layout: "grid4"` = mesmo layout dos personagens (coluna = lado: 0 baixo, 1 cima, 2 esquerda, 3 direita; linhas = frames de caminhada).
 * Se algum sheet for diferente, use `layout: "custom"` com `walk` explícito.
 */
export interface CreatureSprite {
  url: string;               // relativo ao publicDir (assets/), ex.: "ninja/Actor/Monster/Slime/Slime.png"
  frameWidth: number;
  frameHeight: number;
  layout: "grid4" | "custom";
  walk?: { down: number[]; up: number[]; left: number[]; right: number[] };
  /** Escala visual (bosses maiores). Padrão 1. */
  scale?: number;
  tint?: number;
}

export interface MonsterDef {
  id: string;
  name: string;              // PT-BR, exibido no jogo
  level: number;             // nível sugerido (para cor do nome e balanceamento)
  hp: number;
  xp: number;                // XP dada ao morrer
  /** Dano por ataque [min, max] antes da defesa do alvo. */
  damage: [number, number];
  damageKind: DamageKind;
  /** Redução fixa de dano recebido. */
  armor: number;
  /** Intervalo entre ataques (ms). */
  attackMs: number;
  /** 1 = corpo a corpo; >1 = ataque à distância até esse alcance (Chebyshev). */
  attackRange: number;
  /** Duração do passo (ms) em chão normal. Menor = mais rápido. */
  stepMs: number;
  /** Distância (tiles) em que percebe e persegue jogadores. 0 = passivo (só revida). */
  aggroRange: number;
  /** Foge quando o HP fica abaixo desta fração (0 = nunca). */
  fleeAtHpPct: number;
  /** Respawn após morrer (ms). */
  respawnMs: number;
  boss?: boolean;
  sprite: CreatureSprite;
}

const grid4 = (url: string, extra: Partial<CreatureSprite> = {}): CreatureSprite =>
  ({ url, frameWidth: 16, frameHeight: 16, layout: "grid4", ...extra });

/** Catálogo de monstros. O agente de conteúdo completa a lista; ids batem com `monster` dos spawns do mapa. */
export const MONSTERS: Record<string, MonsterDef> = {
  rat: {
    id: "rat", name: "Rato", level: 1, hp: 25, xp: 6, damage: [1, 6], damageKind: "physical", armor: 0,
    attackMs: 2000, attackRange: 1, stepMs: 320, aggroRange: 5, fleeAtHpPct: 0.15, respawnMs: 20_000,
    sprite: grid4("ninja/Actor/Monster/Mouse/SpriteSheet.png"),
  },
  slime: {
    id: "slime", name: "Gosma", level: 2, hp: 40, xp: 10, damage: [2, 8], damageKind: "earth", armor: 1,
    attackMs: 2000, attackRange: 1, stepMs: 420, aggroRange: 4, fleeAtHpPct: 0, respawnMs: 25_000,
    sprite: grid4("ninja/Actor/Monster/Slime/Slime.png"),
  },
};

export function monsterDef(id: string): MonsterDef | undefined {
  return MONSTERS[id];
}
