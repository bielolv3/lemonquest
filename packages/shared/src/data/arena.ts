// Coliseu: tabela de ondas, escalas (tamanho do grupo, level médio) e recompensas. Servidor (systems/arena.ts) e
// cliente (textos/HUD) usam estas funções; o teste arena.test.ts estima dano × vida por onda (sanidade do balanço).
import { monsterDef } from "./monsters.ts";

/** Membros do lobby precisam ficar a até esta distância (Chebyshev) do NPC do coliseu, senão saem do lobby. */
export const ARENA_LOBBY_RANGE = 8;
/** Contagem na vila (ao iniciar com arena livre) antes do teletransporte. */
export const ARENA_COUNTDOWN_MS = 5000;
/** Contagem dentro da arena (3-2-1) antes da onda 1. */
export const ARENA_INTRO_MS = 3000;
/** Pausa entre ondas (loja/cura); a cada ARENA_BOSS_EVERY ondas a pausa é maior. */
export const ARENA_PAUSE_MS = 25_000;
export const ARENA_LONG_PAUSE_MS = 45_000;
/** Todos os vivos "prontos" → próxima onda em ARENA_READY_MS. */
export const ARENA_READY_MS = 3000;
/** Aviso visual antes de cada monstro aparecer (o tile de spawn "brilha"); monstros seguintes escalonados. */
export const ARENA_SPAWN_DELAY_MS = 800;
export const ARENA_SPAWN_STAGGER_MS = 150;
/** Cura no fim de cada onda (fração de vida e mana máximas). */
export const ARENA_PAUSE_HEAL = 0.3;
/** Última onda (vencê-la = "completed", com bônus). */
export const ARENA_MAX_WAVE = 30;
/** Ondas-chefe: múltiplos disto. */
export const ARENA_BOSS_EVERY = 5;
/** XP por onda = soma da XP dos monstros da onda × isto ÷ membros vivos. */
export const ARENA_XP_MULT = 1.2;

export interface ArenaWaveEntry {
  /** Id em MONSTERS. */
  id: string;
  /** Quantidade para 1 jogador (escala com o grupo, ver arenaCountMult). */
  count: number;
  /** Elite: multiplicador de vida (e de XP) da instância. Elites/chefes não escalam a QUANTIDADE com o grupo, e sim a vida. */
  elite?: number;
  /** Multiplicador de dano da elite (padrão 1). */
  eliteDmg?: number;
}

export interface ArenaWave {
  wave: number;
  /** Level "justo" para 1 jogador nesta onda (base da escala por level do grupo). */
  level: number;
  boss?: boolean;
  monsters: ArenaWaveEntry[];
}

const W = (wave: number, level: number, monsters: ArenaWaveEntry[], boss = false): ArenaWave =>
  ({ wave, level, monsters, ...(boss ? { boss } : {}) });
const m = (id: string, count: number): ArenaWaveEntry => ({ id, count });
const elite = (id: string, hp: number, dmg = 1.25): ArenaWaveEntry => ({ id, count: 1, elite: hp, eliteDmg: dmg });

/**
 * TABELA DE ONDAS (quantidades para 1 jogador; `level` = level justo para jogar sozinho).
 *  1-4   ratos, gosmas, abelhas (aquecimento)
 *  5     CHEFE: Lobo de elite (vida ×2.5, dano ×1.25)
 *  6-9   lobos, depois cobras
 *  10    CHEFE: Cobra de elite (vida ×3)
 *  11-14 aranhas (distância), morcegos
 *  15    CHEFE: Morcego de elite (vida ×3.5)
 *  16-19 esqueletos e goblins
 *  20    CHEFE: Esqueleto de elite (vida ×4)
 *  21-24 fantasmas e homens-lagarto
 *  25    CHEFE: Lich do Pântano (chefe de zona)
 *  26-29 espíritos de chama e homens-lagarto
 *  30    CHEFE FINAL: Rei Goblin (chefe de zona)
 */
export const ARENA_WAVES: ArenaWave[] = [
  W(1, 1, [m("rat", 3)]),
  W(2, 2, [m("rat", 2), m("slime", 2)]),
  W(3, 3, [m("slime", 3), m("bee", 1)]),
  W(4, 4, [m("bee", 3), m("slime", 1)]),
  W(5, 6, [elite("wolf", 2.5), m("rat", 2)], true),
  W(6, 7, [m("wolf", 2), m("bee", 1)]),
  W(7, 8, [m("wolf", 3)]),
  W(8, 10, [m("wolf", 2), m("snake", 2)]),
  W(9, 11, [m("snake", 3), m("wolf", 1)]),
  W(10, 13, [elite("snake", 3), m("wolf", 2)], true),
  W(11, 14, [m("spider", 2), m("snake", 2)]),
  W(12, 16, [m("spider", 2), m("bat", 2)]),
  W(13, 17, [m("bat", 3), m("spider", 1), m("snake", 1)]),
  W(14, 18, [m("spider", 3), m("bat", 2)]),
  W(15, 20, [elite("bat", 3.5), m("spider", 2)], true),
  W(16, 21, [m("skeleton", 2), m("bat", 2)]),
  W(17, 23, [m("goblin", 2), m("skeleton", 2)]),
  W(18, 24, [m("skeleton", 3), m("goblin", 2)]),
  W(19, 25, [m("goblin", 3), m("skeleton", 2), m("bat", 1)]),
  W(20, 27, [elite("skeleton", 4), m("goblin", 2)], true),
  W(21, 28, [m("ghost", 2), m("skeleton", 2)]),
  W(22, 30, [m("ghost", 3), m("goblin", 1)]),
  W(23, 31, [m("lizardman", 2), m("ghost", 2)]),
  W(24, 33, [m("lizardman", 3), m("ghost", 1)]),
  W(25, 34, [{ id: "swamp_lich", count: 1, elite: 1 }, m("ghost", 2)], true),
  W(26, 35, [m("flame_spirit", 2), m("lizardman", 2)]),
  W(27, 36, [m("flame_spirit", 3), m("ghost", 2)]),
  W(28, 37, [m("lizardman", 3), m("flame_spirit", 2)]),
  W(29, 38, [m("flame_spirit", 3), m("lizardman", 2)]),
  W(30, 40, [{ id: "goblin_king", count: 1, elite: 1 }, m("flame_spirit", 2)], true),
];

export const arenaWave = (wave: number): ArenaWave | undefined => ARENA_WAVES[wave - 1];
export const isBossWave = (wave: number): boolean => wave > 0 && wave % ARENA_BOSS_EVERY === 0;
/** Duração da pausa DEPOIS de vencer a onda `wave`. */
export const arenaPauseMs = (wave: number): number => (isBossWave(wave) ? ARENA_LONG_PAUSE_MS : ARENA_PAUSE_MS);

/** Quantidade de monstros comuns: base × (1 + 0.6 × (n − 1)). */
export const arenaCountMult = (n: number): number => 1 + 0.6 * (Math.max(1, n) - 1);
/**
 * Vida/dano extra por membro além do primeiro (+10% cada): sem isto um grupo de 4 recebe metade do dano por cabeça
 * (4× o dano causado contra 2.8× os monstros) e o coliseu fica fácil demais em grupo.
 */
export const arenaPartyStatMult = (n: number): number => 1 + 0.1 * (Math.max(1, n) - 1);
/** Elites/chefes (1 por onda): a vida escala com o grupo no lugar da quantidade. Chefes de zona (6000 de vida) já são para 3-4. */
export function arenaEliteHpMult(n: number, zoneBoss: boolean): number {
  const k = arenaCountMult(n) * arenaPartyStatMult(n);
  return zoneBoss ? Math.max(0.3, k / (arenaCountMult(4) * arenaPartyStatMult(4))) : k;
}

/**
 * Escala por level: um grupo acima do level justo da onda (+6 de folga) enfrenta monstros mais fortes
 * (+4% de vida e +2% de dano por level acima, até ×2 / ×1.5). Assim um grupo level 40 não passa
 * as primeiras ondas no tédio total (elas ficam curtas), e a progressão continua valendo.
 */
export function arenaLevelMult(avgLevel: number, waveLevel: number): { hp: number; dmg: number } {
  const over = Math.max(0, avgLevel - waveLevel - 6);
  return { hp: Math.min(2, 1 + 0.04 * over), dmg: Math.min(1.5, 1 + 0.02 * over) };
}

export interface ArenaSpawnSpec {
  defId: string;
  hpMult: number;
  dmgMult: number;
  /** XP que o monstro vale para a recompensa da onda (XP do def × hpMult). */
  xp: number;
  elite: boolean;
}

/** Lista de monstros da onda para um grupo de `n` com level médio `avgLevel`. */
export function arenaWaveSpawns(wave: number, n: number, avgLevel: number): ArenaSpawnSpec[] {
  const w = arenaWave(wave);
  if (!w) return [];
  const lv = arenaLevelMult(avgLevel, w.level);
  const party = arenaPartyStatMult(n);
  const out: ArenaSpawnSpec[] = [];
  for (const e of w.monsters) {
    const def = monsterDef(e.id);
    if (!def || def.stationary || def.invulnerable) continue; // nunca bonecos de treino
    if (e.elite !== undefined) {
      const hpMult = e.elite * arenaEliteHpMult(n, !!def.boss) * lv.hp;
      const dmgMult = (e.eliteDmg ?? 1) * party * lv.dmg;
      out.push({ defId: def.id, hpMult, dmgMult, xp: Math.round(def.xp * e.elite * lv.hp), elite: true });
      continue;
    }
    const count = Math.max(1, Math.round(e.count * arenaCountMult(n)));
    const hpMult = party * lv.hp, dmgMult = party * lv.dmg;
    for (let i = 0; i < count; i++) out.push({ defId: def.id, hpMult, dmgMult, xp: Math.round(def.xp * lv.hp), elite: false });
  }
  return out;
}

/** XP por membro vivo ao vencer a onda. */
export function arenaWaveXp(spawns: readonly ArenaSpawnSpec[], aliveMembers: number): number {
  const sum = spawns.reduce((s, x) => s + x.xp, 0);
  return Math.round((sum * ARENA_XP_MULT) / Math.max(1, aliveMembers));
}

/** Ouro por membro vivo ao vencer a onda: wave × (8 + 2 × wave). */
export const arenaWaveGold = (wave: number): number => wave * (8 + 2 * wave);

/** Bônus por completar as 30 ondas (cada sobrevivente): ouro fixo + 25% da XP ganha na partida. */
export const ARENA_COMPLETE_GOLD = 5000;
export const ARENA_COMPLETE_XP_PCT = 0.25;
