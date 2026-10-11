// Magias: validação (vocação, level, vida, mana, cooldowns, alvo/alcance, PZ), gasto de mana, efeitos
// (dano/cura/condição/investida/provocação/invocação), CastResult ao conjurador e SpellCast para todos.
// Os números de dano/cura saem no lote de CombatEvent do CombatSystem.
import {
  DIR_DELTA, Dir, GLOBAL_SPELL_COOLDOWN_MS, S2C, canStepTerrain, dirFromDelta, evalSpellFormula, mitigateSpell,
  spellByWords, spellDef,
  type CastFailReason, type CastMsg, type CastResultMsg, type CollisionGrid, type SpellCastMsg, type SpellDef,
} from "@tibinha/shared";
import type { PlayerState } from "../state.ts";
import type { CombatSystem } from "./combat.ts";
import type { ConditionSystem } from "./conditions.ts";
import { cheb, type Monster, type MonsterManager } from "./monsters.ts";
import type { Point } from "./pathfinding.ts";
import type { SkillSystem } from "./skills.ts";
import type { SummonSystem } from "./summons.ts";

/** Alcance padrão de magias de alvo sem `range`. */
export const DEFAULT_SPELL_RANGE = 7;
/** Raio padrão de provocação sem `radius`. */
export const DEFAULT_TAUNT_RADIUS = 3;
export const DEFAULT_TAUNT_MS = 5000;

// --- áreas (funções puras) ---------------------------------------------------------

/**
 * Círculo "Chebyshev arredondado" de raio r: dx²+dy² ≤ r²+r (r=1 → 3×3; r=2 → 5×5 sem os cantos).
 * `blocked` (paredes) exclui tiles. Ordem: linha a linha.
 */
export function circleTiles(cx: number, cy: number, r: number, blocked?: (x: number, y: number) => boolean): Point[] {
  const out: Point[] = [];
  const rr = Math.max(0, Math.floor(r));
  for (let dy = -rr; dy <= rr; dy++)
    for (let dx = -rr; dx <= rr; dx++)
      if (dx * dx + dy * dy <= rr * rr + rr && !blocked?.(cx + dx, cy + dy)) out.push({ x: cx + dx, y: cy + dy });
  return out;
}

/** Direção ortogonal da onda (diagonais usam o lado horizontal, como a face do sprite). */
export function waveDir(dir: Dir): Dir {
  if (dir === Dir.NE || dir === Dir.SE) return Dir.E;
  if (dir === Dir.NW || dir === Dir.SW) return Dir.W;
  return dir;
}

/** Meia-largura da onda no passo i (1..length): cresce de 0 até (width-1)/2. */
function waveHalf(i: number, length: number, width: number): number {
  const max = Math.max(0, Math.floor((Math.max(1, width) - 1) / 2));
  return length <= 1 ? max : Math.round((max * (i - 1)) / (length - 1));
}

/**
 * Cone à frente de (x,y): `length` tiles, alargando até `width`. Paredes param cada "raio" (coluna lateral);
 * colunas que se abrem atrás de um raio bloqueado também ficam bloqueadas.
 */
export function waveTiles(x: number, y: number, dir: Dir, length: number, width: number,
  blocked?: (x: number, y: number) => boolean): Point[] {
  const { dx: fx, dy: fy } = DIR_DELTA[waveDir(dir)];
  const lx = -fy, ly = fx;
  const out: Point[] = [];
  const stopped = new Set<number>();
  let prevHalf = -1;
  for (let i = 1; i <= Math.max(1, Math.floor(length)); i++) {
    const h = waveHalf(i, length, width);
    for (let o = -h; o <= h; o++) {
      if (stopped.has(o)) continue;
      if (Math.abs(o) > prevHalf && o !== 0 && stopped.has(o - Math.sign(o))) { stopped.add(o); continue; }
      const tx = x + fx * i + lx * o, ty = y + fy * i + ly * o;
      if (blocked?.(tx, ty)) { stopped.add(o); continue; }
      out.push({ x: tx, y: ty });
    }
    prevHalf = Math.max(prevHalf, h);
  }
  return out;
}

const flat = (pts: Point[]) => pts.flatMap((t) => [t.x, t.y]);

// --- sistema -----------------------------------------------------------------------------

export interface SpellSystemOptions {
  grid: CollisionGrid;
  monsters: MonsterManager;
  combat: CombatSystem;
  conditions: ConditionSystem;
  summons: SummonSystem;
  skills?: SkillSystem;
  players: () => Iterable<PlayerState>;
  getPlayer: (id: string) => PlayerState | undefined;
  /** Move o jogador instantaneamente (MovementSystem.teleport) — investida. */
  teleport: (p: PlayerState, x: number, y: number) => void;
  send: (sessionId: string, type: string, msg: unknown) => void;
  broadcast: (type: string, msg: unknown) => void;
  now?: () => number;
  rng?: () => number;
  spells?: (id: string) => SpellDef | undefined;
}

type Resolved =
  | { ok: false; reason: CastFailReason }
  | { ok: true; monster?: Monster; ally?: PlayerState };

/** Magia ofensiva (proibida na PZ). */
export function isAggressive(s: SpellDef): boolean {
  if (s.damage || s.taunt || s.dash) return true;
  return !!s.condition && !s.heal && s.target !== "self" && s.target !== "party";
}

export class SpellSystem {
  private readonly cd = new Map<string, Map<string, number>>();
  private readonly globalCd = new Map<string, number>();
  private readonly now: () => number;
  private readonly rng: () => number;

  constructor(private readonly o: SpellSystemOptions) {
    this.now = o.now ?? Date.now;
    this.rng = o.rng ?? Math.random;
  }

  removePlayer(id: string): void {
    this.cd.delete(id);
    this.globalCd.delete(id);
  }

  /** C2S.Cast */
  onCast(p: PlayerState, msg: CastMsg): void {
    if (!msg || typeof msg !== "object" || typeof msg.spellId !== "string") return;
    const tid = typeof msg.targetId === "string" ? msg.targetId : undefined;
    this.cast(p, msg.spellId, tid);
  }

  /** Palavras mágicas no chat. Retorna true se o texto é de uma magia (o chat não deve repassar). */
  castWords(p: PlayerState, text: string): boolean {
    const s = spellByWords(text);
    if (!s) return false;
    this.cast(p, s.id);
    return true;
  }

  /** Pipeline completo. Envia CastResult (só ao conjurador) e, se deu certo, SpellCast (a todos). */
  cast(p: PlayerState, spellId: string, targetId?: string): CastResultMsg {
    const now = this.now();
    const res = this.tryCast(p, spellId, targetId, now);
    this.o.send(p.id, S2C.CastResult, res);
    return res;
  }

  private fail(spellId: string, reason: CastFailReason, extra: Partial<CastResultMsg> = {}): CastResultMsg {
    return { spellId, ok: false, reason, ...extra };
  }

  private tryCast(p: PlayerState, spellId: string, targetId: string | undefined, now: number): CastResultMsg {
    const s = (this.o.spells ?? spellDef)(spellId);
    if (!s) return this.fail(spellId, "unknown");
    if (p.hp <= 0) return this.fail(s.id, "dead");
    if (s.vocation !== p.vocation) return this.fail(s.id, "vocation");
    if (p.level < s.level) return this.fail(s.id, "level");
    const mm = this.o.monsters;
    const aggressive = isAggressive(s);
    if ((aggressive || s.summon) && mm.inPz(p.x, p.y)) return this.fail(s.id, "pz");
    const usesGlobal = s.global !== false;
    const cdLeft = Math.max(0, (this.cd.get(p.id)?.get(s.id) ?? 0) - now);
    const gLeft = usesGlobal ? Math.max(0, (this.globalCd.get(p.id) ?? 0) - now) : 0;
    if (cdLeft > 0 || gLeft > 0) return this.fail(s.id, "cooldown", { cooldownMs: cdLeft, globalMs: gLeft });
    if (p.mana < s.mana) return this.fail(s.id, "mana");

    const r = this.resolveTarget(p, s, targetId);
    if (!r.ok) return this.fail(s.id, r.reason);
    if (s.summon) {
      if (!this.o.summons.def(s.summon.monsterId)) return this.fail(s.id, "unknown");
      if (this.o.summons.freeTilesAround(p.x, p.y, 1).length === 0) return this.fail(s.id, "target");
    }

    // --- sucesso ---
    p.mana -= s.mana;
    if (s.mana > 0) this.o.skills?.addTries(p, "magic", s.mana);
    let map = this.cd.get(p.id);
    if (!map) { map = new Map(); this.cd.set(p.id, map); }
    map.set(s.id, now + s.cooldownMs);
    if (usesGlobal) this.globalCd.set(p.id, now + GLOBAL_SPELL_COOLDOWN_MS);
    if (aggressive) this.o.combat.markCombat(p.id, now);

    const msg = this.apply(p, s, r, now);
    this.o.broadcast(S2C.SpellCast, msg);
    return { spellId: s.id, ok: true, cooldownMs: s.cooldownMs, globalMs: usesGlobal ? GLOBAL_SPELL_COOLDOWN_MS : 0 };
  }

  private resolveTarget(p: PlayerState, s: SpellDef, targetId: string | undefined): Resolved {
    if (s.target !== "target" && s.target !== "area_target") return { ok: true };
    const range = s.range ?? DEFAULT_SPELL_RANGE;
    const mm = this.o.monsters;
    // Cura/buff em alvo: jogador indicado, senão o próprio conjurador.
    if (!s.damage && s.heal) {
      const ally = (targetId ? this.o.getPlayer(targetId) : undefined) ?? p;
      if (ally.hp <= 0) return { ok: false, reason: "target" };
      if (cheb(p.x, p.y, ally.x, ally.y) > range) return { ok: false, reason: "range" };
      return { ok: true, ally };
    }
    const m = mm.wild(targetId || p.targetId);
    if (!m) return { ok: false, reason: "target" };
    if (cheb(p.x, p.y, m.s.x, m.s.y) > range) return { ok: false, reason: "range" };
    if (mm.inPz(m.s.x, m.s.y)) return { ok: false, reason: "pz" };
    return { ok: true, monster: m };
  }

  private wall = (x: number, y: number) => !this.o.grid.isWalkable(x, y);

  private apply(p: PlayerState, s: SpellDef, r: Resolved & { ok: true }, now: number): SpellCastMsg {
    const mm = this.o.monsters;
    if (s.dash && r.monster) this.dash(p, r.monster, s.range ?? DEFAULT_SPELL_RANGE);
    if (r.monster) {
      const f = dirFromDelta(Math.sign(r.monster.s.x - p.x), Math.sign(r.monster.s.y - p.y));
      if (f !== null) p.dir = f;
    }

    // Tiles da área.
    let tiles: Point[] | undefined;
    const center = r.monster ? { x: r.monster.s.x, y: r.monster.s.y } : r.ally ? { x: r.ally.x, y: r.ally.y } : { x: p.x, y: p.y };
    if (s.target === "area_self") tiles = circleTiles(p.x, p.y, s.radius ?? 1, this.wall);
    else if (s.target === "area_target") tiles = circleTiles(center.x, center.y, s.radius ?? 1, this.wall);
    else if (s.target === "wave") tiles = waveTiles(p.x, p.y, p.dir, s.length ?? 3, s.width ?? 1, this.wall);

    // Quem é atingido.
    const hitMonsters: Monster[] = [];
    const allies: PlayerState[] = [];
    if (s.target === "target") {
      if (r.monster) hitMonsters.push(r.monster);
      if (r.ally) allies.push(r.ally);
    } else if (s.target === "self") {
      allies.push(p);
    } else if (s.target === "party") {
      const rad = s.radius ?? 3;
      for (const o of this.o.players()) if (o.hp > 0 && cheb(p.x, p.y, o.x, o.y) <= rad) allies.push(o);
    } else if (tiles) {
      const seen = new Set<string>();
      for (const t of tiles) {
        const m = mm.monsterAt(t.x, t.y);
        if (m && !m.s.ownerId && !seen.has(m.s.id)) { seen.add(m.s.id); hitMonsters.push(m); }
      }
      if (s.heal) {
        const set = new Set(tiles.map((t) => t.y * this.o.grid.width + t.x));
        for (const o of this.o.players()) if (o.hp > 0 && set.has(o.y * this.o.grid.width + o.x)) allies.push(o);
      }
    }

    const ml = p.magicLevel ?? 0;
    if (s.damage) {
      for (const m of hitMonsters) {
        const raw = evalSpellFormula(s.damage, p.level, ml, this.rng);
        const amount = mitigateSpell(raw, m.def.armor, s.damage.kind);
        this.o.combat.damageMonster(m, p.id, amount, s.damage.kind, now,
          { ranged: false }); // projétil da magia vem do SpellCast
      }
    }
    if (s.heal) for (const a of allies) this.o.combat.healPlayer(a, p.id, evalSpellFormula(s.heal, p.level, ml, this.rng));

    const c = s.condition;
    if (c && c.id !== "taunted") {
      const onAllies = s.target === "self" || s.target === "party" || (!s.damage && !!s.heal);
      if (onAllies) for (const a of allies) this.o.conditions.apply(a.id, c.id, c.durationMs, c.value, p.id, now);
      else for (const m of hitMonsters) if (mm.get(m.s.id) === m) this.o.conditions.apply(m.s.id, c.id, c.durationMs, c.value, p.id, now);
    }

    if (s.taunt) {
      const rad = s.radius ?? DEFAULT_TAUNT_RADIUS;
      const dur = c?.durationMs ?? DEFAULT_TAUNT_MS;
      for (const m of mm.all()) {
        if (m.s.ownerId || cheb(p.x, p.y, m.s.x, m.s.y) > rad) continue;
        this.o.conditions.apply(m.s.id, "taunted", dur, c?.id === "taunted" ? c.value : undefined, p.id, now);
      }
    }

    if (s.summon) this.o.summons.summon(p, s.summon, now);

    const out: SpellCastMsg = { spellId: s.id, casterId: p.id, x: center.x, y: center.y, dir: p.dir };
    if (r.monster) out.targetId = r.monster.s.id;
    else if (r.ally && r.ally !== p) out.targetId = r.ally.id;
    if (tiles) out.tiles = flat(tiles);
    return out;
  }

  /** Investida: anda em linha reta até `range` tiles em direção ao alvo, parando ao lado dele ou em obstáculos. */
  private dash(p: PlayerState, target: Monster, range: number): void {
    const mm = this.o.monsters;
    let x = p.x, y = p.y;
    const free = (tx: number, ty: number) => {
      if (mm.isMonsterAt(tx, ty)) return false;
      for (const o of this.o.players()) if (o.id !== p.id && o.x === tx && o.y === ty) return false;
      return true;
    };
    for (let i = 0; i < range; i++) {
      if (cheb(x, y, target.s.x, target.s.y) <= 1) break;
      const sx = Math.sign(target.s.x - x), sy = Math.sign(target.s.y - y);
      const options: [number, number][] = [[sx, sy]];
      if (sx !== 0 && sy !== 0) {
        // Diagonal bloqueada: tenta o eixo de maior distância primeiro.
        if (Math.abs(target.s.x - x) >= Math.abs(target.s.y - y)) options.push([sx, 0], [0, sy]);
        else options.push([0, sy], [sx, 0]);
      }
      const step = options.find(([dx, dy]) => canStepTerrain(this.o.grid, x, y, dx, dy) && free(x + dx, y + dy));
      if (!step) break;
      x += step[0];
      y += step[1];
    }
    if (x !== p.x || y !== p.y) this.o.teleport(p, x, y);
  }
}
