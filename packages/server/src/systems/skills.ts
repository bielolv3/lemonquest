// Skills (melee, distance, magic, shield): tentativas → nível, espelhadas no PlayerState e persistidas em rec.data.skills.
import { S2C, SKILLS, SKILL_START, skillTriesFor, type SkillId, type SkillUpMsg } from "@tibinha/shared";
import type { PlayerState } from "../state.ts";
import type { CharacterData } from "../persistence/types.ts";

export type SkillData = Record<SkillId, { level: number; tries: number }>;

const LEVEL_FIELD = { melee: "skillMelee", distance: "skillDistance", magic: "magicLevel", shield: "skillShield" } as const;
const PCT_FIELD = { melee: "meleePct", distance: "distancePct", magic: "magicPct", shield: "shieldPct" } as const;
/** Teto de segurança. */
export const MAX_SKILL = 200;

export class SkillSystem {
  private readonly data = new Map<string, SkillData>();

  constructor(private readonly send: (sessionId: string, type: string, msg: unknown) => void = () => {}) {}

  /** Carrega (ou inicia em SKILL_START) e escreve os campos do jogador. */
  load(p: PlayerState, saved?: CharacterData["skills"]): void {
    const d = {} as SkillData;
    for (const k of SKILLS) {
      const s = saved?.[k];
      const level = Number.isFinite(s?.level) ? Math.max(SKILL_START[k], Math.min(MAX_SKILL, Math.floor(s!.level))) : SKILL_START[k];
      const tries = Number.isFinite(s?.tries) ? Math.max(0, Math.floor(s!.tries)) : 0;
      d[k] = { level, tries };
    }
    this.data.set(p.id, d);
    for (const k of SKILLS) this.write(p, k);
  }

  serialize(id: string): SkillData | undefined {
    const d = this.data.get(id);
    if (!d) return undefined;
    return Object.fromEntries(SKILLS.map((k) => [k, { ...d[k] }])) as SkillData;
  }

  get(id: string, skill: SkillId): { level: number; tries: number } | undefined {
    return this.data.get(id)?.[skill];
  }

  removePlayer(id: string): void {
    this.data.delete(id);
  }

  /** Soma tentativas; sobe de nível quantas vezes couber (S2C.SkillUp a cada nível). */
  addTries(p: PlayerState, skill: SkillId, n: number): void {
    const d = this.data.get(p.id);
    if (!d || !(n > 0)) return;
    const s = d[skill];
    s.tries += n;
    let need = skillTriesFor(skill, s.level, p.vocation);
    while (s.tries >= need && s.level < MAX_SKILL) {
      s.tries -= need;
      s.level++;
      this.send(p.id, S2C.SkillUp, { skill, level: s.level } satisfies SkillUpMsg);
      need = skillTriesFor(skill, s.level, p.vocation);
    }
    this.write(p, skill);
  }

  /** Define o nível (comandos de dev). Zera as tentativas. */
  setLevel(p: PlayerState, skill: SkillId, level: number): void {
    const d = this.data.get(p.id);
    if (!d || !Number.isFinite(level)) return;
    d[skill] = { level: Math.max(SKILL_START[skill], Math.min(MAX_SKILL, Math.floor(level))), tries: 0 };
    this.write(p, skill);
  }

  private write(p: PlayerState, skill: SkillId) {
    const s = this.data.get(p.id)![skill];
    const need = skillTriesFor(skill, s.level, p.vocation);
    (p as unknown as Record<string, number>)[LEVEL_FIELD[skill]] = s.level;
    (p as unknown as Record<string, number>)[PCT_FIELD[skill]] = need > 0 ? Math.min(99, Math.floor((s.tries * 100) / need)) : 0;
  }
}
