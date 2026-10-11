import type { DamageKind } from "../types.ts";
import type { LootEntry } from "./items.ts";

/**
 * VERIFICACAO DE LAYOUT (sheets abertos e ampliados 4x): Mouse, Slime, Snake, SpiderRed, BlueBat, Skull,
 * Spirit, Lizard, Beast, Racoon, Flam, Cyclope, KappaGreen, Reptile, Bear, YellowsBat, Beast2, Panda,
 * Cyclope2, Mole, SkullBlue, Spirit2, Lizard2, Reptile2, GoldRacoon, Snake3, Larva, Mushroom, Flam2,
 * LanternRed, Owl: TODOS 64x64 = grid4 (colunas = baixo, cima, esquerda, direita; linhas = 4 frames
 * de caminhada). Nenhum monstro 16x16 fugiu do padrao.
 * NAO e grid4: os chefes (Actor/Boss/*) sao tiras horizontais 50x50 de UMA direcao (frontal, sem
 * lados). Por isso goblin_king e swamp_lich usam layout "custom" com a mesma tira nas 4 direcoes
 * (DemonCyclop2/Walk.png 6 frames; GiantSpirit/Idle.png 5 frames).
 */

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
  /** Ouro por abate [min, max] (0 = nenhum). */
  gold?: [number, number];
  /** Tabela de loot (ids de ITEMS). */
  loot?: LootEntry[];
  sprite: CreatureSprite;
}

const grid4 = (url: string, extra: Partial<CreatureSprite> = {}): CreatureSprite =>
  ({ url, frameWidth: 16, frameHeight: 16, layout: "grid4", ...extra });

/** Tira horizontal de um chefe (uma direcao so): usa os mesmos frames nas 4 direcoes. */
const strip = (url: string, size: number, frames: number, extra: Partial<CreatureSprite> = {}): CreatureSprite => {
  const f = Array.from({ length: frames }, (_, i) => i);
  return { url, frameWidth: size, frameHeight: size, layout: "custom", walk: { down: f, up: f, left: f, right: f }, ...extra };
};

const M = "ninja/Actor/Monster/";
const B = "ninja/Actor/Boss/";

/** Catálogo de monstros. Ids batem com `monster` dos spawns do mapa (world.json). */
export const MONSTERS: Record<string, MonsterDef> = {
  rat: {
    id: "rat", name: "Rato", level: 1, hp: 25, xp: 6, damage: [1, 4], damageKind: "physical", armor: 0,
    attackMs: 2000, attackRange: 1, stepMs: 320, aggroRange: 4, fleeAtHpPct: 0.15, respawnMs: 20_000,
    sprite: grid4(M + "Mouse/SpriteSheet.png"),
  },
  slime: {
    id: "slime", name: "Gosma", level: 2, hp: 34, xp: 10, damage: [1, 5], damageKind: "earth", armor: 1,
    attackMs: 2000, attackRange: 1, stepMs: 420, aggroRange: 3, fleeAtHpPct: 0, respawnMs: 25_000,
    sprite: grid4(M + "Slime/Slime.png"),
  },
  bee: {
    id: "bee", name: "Abelha", level: 5, hp: 45, xp: 14, damage: [3, 10], damageKind: "physical", armor: 0,
    attackMs: 1800, attackRange: 1, stepMs: 260, aggroRange: 0, fleeAtHpPct: 0, respawnMs: 30_000,
    sprite: grid4(M + "Owl/Owl.png"),
  },
  wolf: {
    id: "wolf", name: "Lobo", level: 8, hp: 90, xp: 35, damage: [8, 18], damageKind: "physical", armor: 1,
    attackMs: 1600, attackRange: 1, stepMs: 280, aggroRange: 6, fleeAtHpPct: 0, respawnMs: 40_000,
    sprite: grid4(M + "Racoon/SpriteSheet.png", { tint: 0xc0c0d0 }),
  },
  /** Invocação da magia "Invocar Lobo" (druida): aliado temporário, nunca nasce no mapa. */
  summoned_wolf: {
    id: "summoned_wolf", name: "Lobo Espiritual", level: 20, hp: 180, xp: 0, damage: [14, 26], damageKind: "physical", armor: 3,
    attackMs: 1600, attackRange: 1, stepMs: 240, aggroRange: 0, fleeAtHpPct: 0, respawnMs: 0,
    sprite: grid4(M + "Racoon/SpriteSheet.png", { tint: 0x9fd8ff }),
  },
  snake: {
    id: "snake", name: "Cobra", level: 12, hp: 140, xp: 60, damage: [10, 22], damageKind: "earth", armor: 3,
    attackMs: 2000, attackRange: 1, stepMs: 380, aggroRange: 5, fleeAtHpPct: 0, respawnMs: 45_000,
    sprite: grid4(M + "Snake3/Snake3.png"),
  },
  spider: {
    id: "spider", name: "Aranha", level: 16, hp: 180, xp: 100, damage: [12, 26], damageKind: "earth", armor: 4,
    attackMs: 2200, attackRange: 3, stepMs: 360, aggroRange: 6, fleeAtHpPct: 0, respawnMs: 50_000,
    sprite: grid4(M + "SpiderRed/SpriteSheet.png"),
  },
  bat: {
    id: "bat", name: "Morcego", level: 18, hp: 170, xp: 100, damage: [14, 28], damageKind: "physical", armor: 2,
    attackMs: 1800, attackRange: 1, stepMs: 240, aggroRange: 7, fleeAtHpPct: 0, respawnMs: 45_000,
    sprite: grid4(M + "BlueBat/SpriteSheet.png"),
  },
  skeleton: {
    id: "skeleton", name: "Esqueleto", level: 24, hp: 280, xp: 200, damage: [20, 42], damageKind: "physical", armor: 6,
    attackMs: 2000, attackRange: 1, stepMs: 400, aggroRange: 5, fleeAtHpPct: 0, respawnMs: 60_000,
    sprite: grid4(M + "SkullBlue/SpriteSheet.png"),
  },
  goblin: {
    id: "goblin", name: "Goblin", level: 25, hp: 280, xp: 200, damage: [18, 40], damageKind: "physical", armor: 6,
    attackMs: 1800, attackRange: 1, stepMs: 340, aggroRange: 6, fleeAtHpPct: 0.2, respawnMs: 60_000,
    sprite: grid4(M + "Reptile2/Reptile2.png"),
  },
  ghost: {
    id: "ghost", name: "Fantasma", level: 31, hp: 380, xp: 360, damage: [25, 50], damageKind: "death", armor: 5,
    attackMs: 2000, attackRange: 1, stepMs: 360, aggroRange: 6, fleeAtHpPct: 0, respawnMs: 70_000,
    sprite: grid4(M + "Spirit/SpriteSheet.png"),
  },
  lizardman: {
    id: "lizardman", name: "Homem-Lagarto", level: 34, hp: 450, xp: 460, damage: [30, 60], damageKind: "physical", armor: 10,
    attackMs: 1800, attackRange: 1, stepMs: 360, aggroRange: 6, fleeAtHpPct: 0, respawnMs: 75_000,
    sprite: grid4(M + "Lizard/Lizard.png"),
  },
  flame_spirit: {
    id: "flame_spirit", name: "Espírito de Chama", level: 38, hp: 480, xp: 600, damage: [35, 70], damageKind: "fire", armor: 8,
    attackMs: 2000, attackRange: 4, stepMs: 380, aggroRange: 7, fleeAtHpPct: 0, respawnMs: 80_000,
    sprite: grid4(M + "Flam/SpriteSheet.png"),
  },
  goblin_king: {
    id: "goblin_king", name: "Rei Goblin", level: 40, hp: 6000, xp: 6000, damage: [60, 120], damageKind: "physical", armor: 15,
    attackMs: 2000, attackRange: 1, stepMs: 420, aggroRange: 8, fleeAtHpPct: 0, respawnMs: 7_200_000, boss: true,
    sprite: strip(B + "DemonCyclop2/Walk.png", 50, 6, { scale: 1.5 }),
  },
  swamp_lich: {
    id: "swamp_lich", name: "Lich do Pântano", level: 25, hp: 3500, xp: 2500, damage: [30, 70], damageKind: "death", armor: 8,
    attackMs: 2200, attackRange: 5, stepMs: 500, aggroRange: 8, fleeAtHpPct: 0, respawnMs: 7_200_000, boss: true,
    sprite: strip(B + "GiantSpirit/Idle.png", 50, 5, { tint: 0xb090e0, scale: 1.5 }),
  },
};

export function monsterDef(id: string): MonsterDef | undefined {
  return MONSTERS[id];
}

/*
 * TABELA DE BALANCEAMENTO (acertos medios de um cavaleiro no level da zona: 6+1.6*lvl - armor)
 * monstro        lvl   hp    xp   dano medio   acertos p/ matar
 * rat             1    25     6     3.5         3.3 (lv1)
 * slime           2    40    10     5           ~4
 * bee             5    45    14     6.5         3.2 (passiva)
 * wolf            8    90    35    13           5   (perigoso lv1-3: ~8 dps vs 150 HP)
 * snake          12   140    60    16           6.4
 * spider         16   180   100    19 (dist 3)  6.5
 * bat            18   170   100    21           5.2
 * skeleton       24   280   200    31           7.3
 * goblin         25   280   200    29           7   (foge a 20%)
 * ghost          31   380   360    37.5         7.5
 * lizardman      34   450   460    45           8.9
 * flame_spirit   38   480   600    52.5 (dist 4) 8.2
 * swamp_lich*    25  3500  2500    50 (dist 5)  ~90 acertos => grupo de 3-4 (~1 min)
 * goblin_king*   40  6000  6000    90           ~110 acertos => grupo de 3-4 (~1 min), respawn 2 h
 * (*boss). Magos causam ~30% menos por acerto: 4+1.1*lvl.
 */
