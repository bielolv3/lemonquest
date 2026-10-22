// PvP (estilo Tibia): quem pode atacar quem, caveiras e bloqueio de zona de proteção. Regras e tempos em shared/src/pvp.ts.
// Ataque é "justo" se a vítima tem caveira ou atacou o agressor nos últimos PVP_AGGRESSION_MS; senão o agressor ganha
// caveira branca. Matar de forma injusta conta para a caveira vermelha (RED_SKULL_KILLS em 24 h, salvo no personagem).
import {
  PVP_AGGRESSION_MS, PZ_LOCK_MS, RED_SKULL_KILLS, recentKills, S2C,
  type NoticeMsg, type Skull,
} from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";

export interface PvpOptions {
  inPz: (x: number, y: number) => boolean;
  /** Jogador numa partida do Coliseu (lá não há PvP). */
  inArena?: (id: string) => boolean;
  sameParty?: (a: string, b: string) => boolean;
  send?: (sessionId: string, type: string, msg: unknown) => void;
  now?: () => number;
}

/** Segundos (arredondados para cima) de um bloqueio de PZ restante, para os avisos. */
export const pzLockSeconds = (ms: number): number => Math.max(1, Math.ceil(ms / 1000));

/** Aviso de "não pode entrar na PZ" no máximo a cada isto (ms) por jogador. */
const PZ_NOTICE_MS = 3000;

export class PvpSystem {
  /** agressor → (vítima → até quando o revide da vítima é justo). */
  private readonly attacks = new Map<string, Map<string, number>>();
  private readonly whiteUntil = new Map<string, number>();
  private readonly pzLockUntil = new Map<string, number>();
  private readonly pzNoticeAt = new Map<string, number>();
  /** Mortes injustas (timestamps), por id de jogador; persistidas em rec.data.pvpKills. */
  private readonly kills = new Map<string, number[]>();
  private readonly now: () => number;

  constructor(private readonly o: PvpOptions) {
    this.now = o.now ?? Date.now;
  }

  /** Carrega as mortes injustas e os prazos da caveira branca e do bloqueio de PZ salvos (relogar não apaga nada). */
  load(p: PlayerState, kills?: unknown, whiteUntil?: unknown, pzLockUntil?: unknown): void {
    const now = this.now();
    const list = Array.isArray(kills) ? kills.filter((t): t is number => typeof t === "number") : [];
    this.kills.set(p.id, recentKills(list, now));
    // Teto de PVP_AGGRESSION_MS: um valor salvo absurdo (relógio adiantado) não deixa caveira eterna.
    if (typeof whiteUntil === "number" && whiteUntil > now) this.whiteUntil.set(p.id, Math.min(whiteUntil, now + PVP_AGGRESSION_MS));
    if (typeof pzLockUntil === "number" && pzLockUntil > now) this.pzLockUntil.set(p.id, Math.min(pzLockUntil, now + PZ_LOCK_MS));
    p.skull = this.skullOf(p.id, now);
  }

  /** Para salvar no personagem. */
  savedKills(id: string): number[] {
    return recentKills(this.kills.get(id) ?? [], this.now());
  }

  /** Fim da caveira branca (ms epoch) para salvar no personagem; undefined = sem caveira branca. */
  savedWhiteUntil(id: string): number | undefined {
    const t = this.whiteUntil.get(id) ?? 0;
    return t > this.now() ? t : undefined;
  }

  removePlayer(id: string): void {
    this.attacks.delete(id);
    for (const m of this.attacks.values()) m.delete(id);
    this.whiteUntil.delete(id);
    this.pzLockUntil.delete(id);
    this.pzNoticeAt.delete(id);
    this.kills.delete(id);
  }

  /** Motivo pelo qual `a` não pode atacar `b` (null = pode). */
  canAttack(a: PlayerState, b: PlayerState): string | null {
    if (a.id === b.id || b.hp <= 0 || a.hp <= 0) return "Alvo inválido.";
    if (this.o.inPz(a.x, a.y) || this.o.inPz(b.x, b.y)) return "Você não pode atacar em zona de proteção.";
    if (this.o.inArena?.(a.id) || this.o.inArena?.(b.id)) return "Não há luta entre jogadores no Coliseu.";
    if (this.o.sameParty?.(a.id, b.id)) return "Você não pode atacar alguém do seu grupo.";
    return null;
  }

  /** Atacar `b` agora seria justo para `a`? (b tem caveira ou atacou `a` há pouco) */
  justified(a: PlayerState, b: PlayerState, now = this.now()): boolean {
    if (b.skull) return true;
    return (this.attacks.get(b.id)?.get(a.id) ?? 0) > now;
  }

  /** `a` causou (ou tentou causar) dano a `b`. Chamar ANTES de aplicar o dano. */
  onHit(a: PlayerState, b: PlayerState, now = this.now()): void {
    const fair = this.justified(a, b, now);
    let m = this.attacks.get(a.id);
    if (!m) { m = new Map(); this.attacks.set(a.id, m); }
    m.set(b.id, now + PVP_AGGRESSION_MS);
    this.pzLockUntil.set(a.id, now + PZ_LOCK_MS);
    if (!fair) {
      const was = a.skull;
      this.whiteUntil.set(a.id, now + PVP_AGGRESSION_MS);
      a.skull = this.skullOf(a.id, now);
      if (!was && a.skull === "white") this.notice(a, "Você atacou um jogador inocente e recebeu uma caveira branca.", "warn");
    }
  }

  /** `killer` matou `victim` (chamar antes da penalidade da morte). */
  onKill(killer: PlayerState, victim: PlayerState, now = this.now()): void {
    if (this.justified(killer, victim, now)) return;
    const list = recentKills(this.kills.get(killer.id) ?? [], now);
    list.push(now);
    this.kills.set(killer.id, list);
    const was = killer.skull;
    killer.skull = this.skullOf(killer.id, now);
    if (was !== "red" && killer.skull === "red") {
      this.notice(killer, `Caveira vermelha: ${RED_SKULL_KILLS} mortes injustas em 24 h. Se morrer, perde o dobro de XP e metade do ouro.`, "warn");
    }
  }

  /**
   * `p` morreu (chamar depois de onKill e da penalidade): perde a caveira branca, o bloqueio de PZ e os direitos de
   * revide (dele e contra ele). A caveira vermelha fica até as mortes injustas saírem da janela de 24 h.
   */
  onDeath(p: PlayerState, now = this.now()): void {
    this.attacks.delete(p.id);
    for (const m of this.attacks.values()) m.delete(p.id);
    this.whiteUntil.delete(p.id);
    this.pzLockUntil.delete(p.id);
    p.skull = this.skullOf(p.id, now);
  }

  /** Bloqueado de entrar na zona de proteção (atacou um jogador há pouco)? */
  pzLocked(id: string, now = this.now()): boolean {
    return (this.pzLockUntil.get(id) ?? 0) > now;
  }

  /** Fim do bloqueio de PZ (ms epoch) para salvar; undefined = livre. */
  savedPzLockUntil(id: string): number | undefined {
    const t = this.pzLockUntil.get(id) ?? 0;
    return t > this.now() ? t : undefined;
  }

  /** Quanto falta do bloqueio de PZ (ms; 0 = livre). Enquanto bloqueado, sair do jogo não tira o personagem do mundo. */
  pzLockRemaining(id: string, now = this.now()): number {
    return Math.max(0, (this.pzLockUntil.get(id) ?? 0) - now);
  }

  /** Guarda do movimento: impede o passo para dentro da PZ enquanto bloqueado. true = bloqueia. */
  blocksStep(p: PlayerState, x: number, y: number, now = this.now()): boolean {
    if (!this.pzLocked(p.id, now) || this.o.inPz(p.x, p.y) || !this.o.inPz(x, y)) return false;
    if (now - (this.pzNoticeAt.get(p.id) ?? -Infinity) >= PZ_NOTICE_MS) {
      this.pzNoticeAt.set(p.id, now);
      this.notice(p, `Você atacou um jogador há pouco e não pode entrar na zona de proteção ainda (mais ${pzLockSeconds(this.pzLockRemaining(p.id, now))} s).`, "warn");
    }
    return true;
  }

  /** Atualiza as caveiras (a branca expira). */
  tick(now: number, players: Iterable<PlayerState>): void {
    for (const p of players) {
      const s = this.skullOf(p.id, now);
      if (p.skull !== s) p.skull = s;
    }
  }

  private skullOf(id: string, now: number): Skull {
    if (recentKills(this.kills.get(id) ?? [], now).length >= RED_SKULL_KILLS) return "red";
    return (this.whiteUntil.get(id) ?? 0) > now ? "white" : "";
  }

  private notice(p: PlayerState, text: string, kind: NoticeMsg["kind"]): void {
    this.o.send?.(p.id, S2C.Notice, { text, kind } satisfies NoticeMsg);
  }
}
