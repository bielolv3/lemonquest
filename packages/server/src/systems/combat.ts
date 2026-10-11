// Combate estilo Tibia: alvo + ataque automático a cada PLAYER_ATTACK_MS; dano de monstros; XP, level e morte.
import {
  PLAYER_ATTACK_MS, OUT_OF_COMBAT_MS, S2C, VOCATION_ATTACK, baseStats, deathPenalty, levelForXp, mitigate,
  playerAttackDamage, rollInt, splitXp,
  type AttackMsg, type CombatEvent, type CombatMsg, type CreatureDiedMsg, type DiedMsg, type LevelUpMsg,
  type NoticeMsg, type XpGainMsg,
} from "@tibinha/shared";
import type { PlayerState } from "../state.ts";
import { cheb, type Monster, type MonsterManager } from "./monsters.ts";

/** Alvo mais longe que isso (fora da tela) é descartado. */
export const TARGET_MAX_DIST = 12;
/** Level a partir do qual o level up é anunciado para todos. */
export const LEVEL_NOTICE_MIN = 5;

/** Armadura do jogador. M4 (equipamentos) pluga aqui. */
export function playerArmor(_p: PlayerState): number {
  return 0;
}

export interface CombatOptions {
  monsters: MonsterManager;
  players: () => Iterable<PlayerState>;
  getPlayer: (id: string) => PlayerState | undefined;
  /** Teleporte (MovementSystem.teleport) — usado na morte. */
  teleport: (p: PlayerState, x: number, y: number) => void;
  spawn: { x: number; y: number };
  send: (sessionId: string, type: string, msg: unknown) => void;
  broadcast: (type: string, msg: unknown) => void;
  rng?: () => number;
}

export class CombatSystem {
  private events: CombatEvent[] = [];
  /** Mensagens que devem sair DEPOIS do lote de combate do tick (morte, XP...). */
  private after: (() => void)[] = [];
  private readonly nextAttackAt = new Map<string, number>();
  private readonly lastCombatAt = new Map<string, number>();
  private readonly rng: () => number;

  constructor(private readonly o: CombatOptions) {
    this.rng = o.rng ?? Math.random;
    o.monsters.attackHook = (m, p, now) => this.monsterAttack(m, p, now);
  }

  /** C2S.Attack: define/limpa o alvo. */
  onAttack(p: PlayerState, msg: AttackMsg): void {
    if (!msg || typeof msg !== "object") return;
    const id = msg.targetId;
    if (id === null || id === "") { p.targetId = ""; return; }
    if (typeof id !== "string") return;
    const m = this.o.monsters.get(id);
    if (!m || cheb(p.x, p.y, m.s.x, m.s.y) > TARGET_MAX_DIST) return;
    if (this.o.monsters.inPz(p.x, p.y) || this.o.monsters.inPz(m.s.x, m.s.y)) {
      p.targetId = "";
      this.o.send(p.id, S2C.Notice, { text: "Você não pode atacar em zona de proteção.", kind: "warn" } satisfies NoticeMsg);
      return;
    }
    p.targetId = id;
  }

  /** Fora de combate = sem dar/receber dano há OUT_OF_COMBAT_MS. */
  inCombat(playerId: string, now: number): boolean {
    const t = this.lastCombatAt.get(playerId);
    return t !== undefined && now - t < OUT_OF_COMBAT_MS;
  }

  removePlayer(id: string): void {
    this.nextAttackAt.delete(id);
    this.lastCombatAt.delete(id);
    this.o.monsters.clearTargetsOf(id);
  }

  /** Ataques automáticos dos jogadores. */
  tick(now: number): void {
    for (const p of this.o.players()) {
      if (!p.targetId) continue;
      const m = this.o.monsters.get(p.targetId);
      if (!m || this.o.monsters.inPz(p.x, p.y)) { p.targetId = ""; continue; }
      const d = cheb(p.x, p.y, m.s.x, m.s.y);
      if (d > TARGET_MAX_DIST) { p.targetId = ""; continue; }
      const va = VOCATION_ATTACK[p.vocation] ?? VOCATION_ATTACK.knight;
      if (d < 1 || d > va.range || now < (this.nextAttackAt.get(p.id) ?? 0)) continue;
      this.nextAttackAt.set(p.id, now + PLAYER_ATTACK_MS);
      this.lastCombatAt.set(p.id, now);
      const roll = playerAttackDamage(p.vocation, p.level, this.rng);
      const amount = roll.miss ? 0 : Math.min(m.s.hp, mitigate(roll.amount, m.def.armor));
      this.push({
        sourceId: p.id, targetId: m.s.id, amount, kind: va.kind,
        crit: roll.crit && amount > 0 ? true : undefined,
        miss: amount === 0 ? true : undefined,
        ranged: va.ranged ? true : undefined,
      });
      this.o.monsters.onDamaged(m, p.id, amount, now);
      if (amount > 0) {
        m.s.hp -= amount;
        if (m.s.hp <= 0) this.killMonster(m, now);
      }
    }
  }

  /** Um monstro ataca um jogador (chamado pela IA). */
  monsterAttack(m: Monster, p: PlayerState, now: number): void {
    if (p.hp <= 0 || this.o.monsters.inPz(p.x, p.y)) return;
    const raw = rollInt(m.def.damage[0], m.def.damage[1], this.rng);
    const amount = Math.min(p.hp, mitigate(raw, playerArmor(p)));
    this.lastCombatAt.set(p.id, now);
    this.push({
      sourceId: m.s.id, targetId: p.id, amount, kind: m.def.damageKind,
      miss: amount === 0 ? true : undefined,
      ranged: m.def.attackRange > 1 ? true : undefined,
    });
    if (amount <= 0) return;
    p.hp -= amount;
    if (p.hp <= 0) this.playerDied(p, m, now);
  }

  /** Envia o lote de eventos do tick (se houver) e depois as mensagens pendentes. */
  flush(): void {
    if (this.events.length) {
      this.o.broadcast(S2C.Combat, { events: this.events } satisfies CombatMsg);
      this.events = [];
    }
    const after = this.after;
    this.after = [];
    for (const fn of after) fn();
  }

  /** Eventos ainda não enviados (testes). */
  get pending(): readonly CombatEvent[] { return this.events; }

  private push(e: CombatEvent) {
    for (const k of Object.keys(e) as (keyof CombatEvent)[]) if (e[k] === undefined) delete e[k];
    this.events.push(e);
  }

  private killMonster(m: Monster, now: number) {
    const { id, x, y, defId } = m.s;
    const online = [...m.damageBy].filter(([pid]) => this.o.getPlayer(pid));
    const shares = splitXp(m.def.xp, online);
    this.o.monsters.kill(m, now);
    for (const p of this.o.players()) if (p.targetId === id) p.targetId = "";
    this.after.push(() => this.o.broadcast(S2C.CreatureDied, { id, x, y, defId } satisfies CreatureDiedMsg));
    for (const [pid, amount] of shares) {
      const p = this.o.getPlayer(pid);
      if (p) this.gainXp(p, amount, x, y);
    }
  }

  /** Dá XP e processa level ups (vários de uma vez, se for o caso). */
  gainXp(p: PlayerState, amount: number, x: number, y: number): void {
    p.xp += amount;
    const id = p.id;
    this.after.push(() => this.o.send(id, S2C.XpGain, { amount, x, y } satisfies XpGainMsg));
    const level = levelForXp(p.xp);
    if (level <= p.level) return;
    p.level = level;
    const stats = baseStats(p.vocation, level);
    p.maxHp = stats.maxHp;
    p.maxMana = stats.maxMana;
    p.hp = stats.maxHp;
    p.mana = stats.maxMana;
    const name = p.name;
    this.after.push(() => {
      this.o.send(id, S2C.LevelUp, { level, maxHp: stats.maxHp, maxMana: stats.maxMana } satisfies LevelUpMsg);
      if (level >= LEVEL_NOTICE_MIN) this.o.broadcast(S2C.Notice, { text: `${name} chegou ao level ${level}!`, kind: "good" } satisfies NoticeMsg);
    });
  }

  private playerDied(p: PlayerState, killer: Monster, _now: number) {
    const lostXp = deathPenalty(p.level, p.xp);
    p.xp -= lostXp;
    p.targetId = "";
    this.o.monsters.clearTargetsOf(p.id);
    this.lastCombatAt.delete(p.id);
    this.nextAttackAt.delete(p.id);
    this.o.teleport(p, this.o.spawn.x, this.o.spawn.y);
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    const id = p.id, name = p.name, killerName = killer.def.name;
    this.after.push(() => {
      this.o.send(id, S2C.Died, { lostXp, killerName } satisfies DiedMsg);
      this.o.broadcast(S2C.Notice, { text: `${name} foi derrotado por ${killerName}`, kind: "warn" } satisfies NoticeMsg);
    });
  }
}
