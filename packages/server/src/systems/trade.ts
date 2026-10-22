// Troca entre jogadores: convite → janela com a oferta dos dois → os dois confirmam → troca atômica (inventory.swap).
// Qualquer mudança numa oferta zera as confirmações e sobe a versão (`rev`): o confirm traz a versão que o jogador viu
// e só vale se ainda for a atual (o clique que já estava a caminho quando o outro trocou a oferta não conta).
// Cancela por distância, Coliseu, saída ou pedido (tick/removePlayer/cancel aqui); na morte quem cancela é o onDying do
// WorldRoom, porque o morto renasce com a vida cheia na hora e o tick nunca vê hp ≤ 0.
import {
  S2C, TRADE_INVITE_MS, TRADE_KEEP_RANGE, TRADE_MAX_ITEMS, TRADE_START_RANGE,
  type ItemInstance, type NoticeMsg, type TradeMsg, type TradeOfferItem, type TradeSideView, type TradeStateMsg,
} from "@lemonquest/shared";
import type { PlayerState } from "../state.ts";
import type { InventorySystem } from "./inventory.ts";

interface Offer { items: TradeOfferItem[]; gold: number }
interface Session { a: string; b: string; rev: number; offer: Record<string, Offer>; confirmed: Record<string, boolean> }

export interface TradeHost {
  getPlayer(id: string): PlayerState | undefined;
  send(id: string, type: string, msg: unknown): void;
  inventory: Pick<InventorySystem, "findByUid" | "gold" | "swap">;
  /** Em partida do Coliseu: não troca. */
  inArena(id: string): boolean;
  /** Grava o personagem (depois de uma troca concluída). */
  save(id: string): void;
  now?(): number;
}

const cheb = (a: PlayerState, b: PlayerState) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const isInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n);

export class TradeSystem {
  /** Convites pendentes: destinatário → quem convidou. */
  private readonly invites = new Map<string, { from: string; at: number }>();
  /** Troca aberta por jogador (as duas pontas apontam para a mesma sessão). */
  private readonly sessions = new Map<string, Session>();

  constructor(private readonly o: TradeHost) {}

  private now() { return this.o.now?.() ?? Date.now(); }
  private notice(id: string, text: string, kind: NoticeMsg["kind"] = "info") { this.o.send(id, S2C.Notice, { text, kind } satisfies NoticeMsg); }
  private push(id: string, st: TradeStateMsg) { this.o.send(id, S2C.Trade, st); }
  private pending(id: string): boolean {
    for (const [to, v] of this.invites) if (to === id || v.from === id) return true;
    return false;
  }

  /** A troca (aberta) de `id`, se houver. */
  sessionOf(id: string): { partner: string } | undefined {
    const s = this.sessions.get(id);
    return s ? { partner: s.a === id ? s.b : s.a } : undefined;
  }

  onMessage(p: PlayerState, m: TradeMsg): void {
    if (!m || typeof m !== "object") return;
    switch (m.action) {
      case "request": return this.request(p, String(m.targetId ?? ""));
      case "accept": return this.accept(p);
      case "decline": return this.decline(p);
      case "offer": return this.offer(p, m.items, m.gold);
      case "confirm": return this.confirm(p, m.confirmed === true, m.rev);
      case "cancel": return this.cancel(p.id, `${p.name} cancelou a troca.`);
    }
  }

  // --- convite --------------------------------------------------------------------------------------------------

  private request(p: PlayerState, targetId: string) {
    const t = this.o.getPlayer(targetId);
    if (!t || t.id === p.id) { this.notice(p.id, "Jogador não encontrado.", "warn"); return; }
    if (p.hp <= 0 || t.hp <= 0) { this.notice(p.id, "Agora não dá para trocar.", "warn"); return; }
    if (this.sessions.has(p.id) || this.sessions.has(t.id) || this.pending(p.id) || this.pending(t.id)) {
      this.notice(p.id, this.sessions.has(p.id) || this.pending(p.id) ? "Você já tem uma troca em andamento." : `${t.name} está ocupado com outra troca.`, "warn");
      return;
    }
    if (this.o.inArena(p.id) || this.o.inArena(t.id)) { this.notice(p.id, "Não dá para trocar durante o Coliseu.", "warn"); return; }
    if (cheb(p, t) > TRADE_START_RANGE) { this.notice(p.id, `Chegue mais perto de ${t.name} para trocar.`, "warn"); return; }
    this.invites.set(t.id, { from: p.id, at: this.now() });
    this.push(t.id, { phase: "invite", fromId: p.id, from: p.name });
    this.notice(p.id, `Convite de troca enviado a ${t.name}.`);
  }

  private accept(p: PlayerState) {
    const inv = this.invites.get(p.id);
    if (!inv) return;
    this.invites.delete(p.id);
    const from = this.o.getPlayer(inv.from);
    if (!from || from.hp <= 0 || p.hp <= 0 || this.sessions.has(from.id) || this.sessions.has(p.id) || cheb(from, p) > TRADE_START_RANGE) {
      this.push(p.id, { phase: "closed" });
      this.notice(p.id, "A troca não é mais possível.", "warn");
      if (from) this.notice(from.id, "A troca não é mais possível.", "warn");
      return;
    }
    const s: Session = { a: from.id, b: p.id, rev: 0, offer: { [from.id]: { items: [], gold: 0 }, [p.id]: { items: [], gold: 0 } }, confirmed: { [from.id]: false, [p.id]: false } };
    this.sessions.set(from.id, s);
    this.sessions.set(p.id, s);
    this.pushBoth(s);
  }

  private decline(p: PlayerState) {
    const inv = this.invites.get(p.id);
    if (!inv) return;
    this.invites.delete(p.id);
    this.push(p.id, { phase: "closed" });
    this.notice(inv.from, `${p.name} recusou a troca.`, "warn");
  }

  // --- oferta e confirmação ---------------------------------------------------------------------------------------

  /**
   * Toda mensagem de oferta (aceita ou recusada) sobe a versão, zera as confirmações e manda o estado aos dois: assim o
   * cliente sabe que a versão seguinte à que via é a da própria oferta, e uma oferta recusada (ouro que não tem) volta
   * com o valor real para o campo.
   */
  private offer(p: PlayerState, rawItems: unknown, rawGold: unknown) {
    const s = this.sessions.get(p.id);
    if (!s) return;
    const why = this.parseOffer(p, rawItems, rawGold);
    if (typeof why === "string") this.notice(p.id, why, "warn");
    else s.offer[p.id] = why;
    this.changed(s);
  }

  private parseOffer(p: PlayerState, rawItems: unknown, rawGold: unknown): Offer | string {
    if (!Array.isArray(rawItems) || rawItems.length > TRADE_MAX_ITEMS || !isInt(rawGold) || rawGold < 0) return "Oferta inválida.";
    const items: TradeOfferItem[] = [];
    const seen = new Set<string>();
    for (const r of rawItems as TradeOfferItem[]) {
      const it = r && typeof r.uid === "string" ? this.o.inventory.findByUid(p.id, r.uid) : undefined;
      if (!it || !isInt(r.count) || r.count < 1 || r.count > it.count || seen.has(r.uid)) return "Oferta inválida.";
      seen.add(r.uid);
      items.push({ uid: r.uid, count: r.count });
    }
    if (rawGold > this.o.inventory.gold(p.id)) return "Você não tem todo esse ouro.";
    return { items, gold: rawGold };
  }

  /** As ofertas mudaram (ou podem ter mudado): nova versão, os dois confirmam de novo. */
  private changed(s: Session) {
    s.rev++;
    s.confirmed[s.a] = false; s.confirmed[s.b] = false;
    this.pushBoth(s);
  }

  private confirm(p: PlayerState, confirmed: boolean, rev: unknown) {
    const s = this.sessions.get(p.id);
    if (!s) return;
    // Cliente sem versão no confirm (página aberta antes de uma atualização): não tem como confirmar; pede para recarregar.
    if (confirmed && typeof rev !== "number") {
      this.notice(p.id, "Atualize a página (F5) para concluir a troca.", "warn");
      return;
    }
    // Confirmar uma versão que não é a atual (o outro mudou a oferta enquanto o clique vinha): ignora e reenvia o estado.
    if (confirmed && rev !== s.rev) {
      this.notice(p.id, "A oferta mudou: confira e confirme de novo.", "warn");
      this.push(p.id, this.view(p.id, s));
      return;
    }
    s.confirmed[p.id] = confirmed;
    if (!(s.confirmed[s.a] && s.confirmed[s.b])) { this.pushBoth(s); return; }
    this.execute(s);
  }

  private execute(s: Session) {
    const a = this.o.getPlayer(s.a), b = this.o.getPlayer(s.b);
    if (!a || !b) { this.cancel(s.a, "A troca foi cancelada."); return; }
    const r = this.o.inventory.swap(a, s.offer[s.a]!, b, s.offer[s.b]!);
    if (r === "ok") {
      this.close(s);
      for (const [me, other] of [[a, b], [b, a]] as const) {
        this.notice(me.id, `Troca concluída com ${other.name}.`, "good");
        this.o.save(me.id);
      }
      console.log(`[troca] ${a.name} <-> ${b.name}: ${JSON.stringify(s.offer[s.a])} / ${JSON.stringify(s.offer[s.b])}`);
      return;
    }
    // Nada mudou: a janela continua aberta para ajustar.
    const msg = r === "full" ? "Troca não feita: não cabe na mochila de um dos dois. Libere espaço ou reduza a oferta." : "Troca não feita: uma das ofertas mudou (item ou ouro). Confira e confirme de novo.";
    this.notice(a.id, msg, "warn"); this.notice(b.id, msg, "warn");
    // Ofertas que viraram inválidas saem da lista.
    for (const pl of [a, b]) {
      const o = s.offer[pl.id]!;
      o.items = o.items.filter((x) => { const it = this.o.inventory.findByUid(pl.id, x.uid); return !!it && x.count <= it.count; });
      if (o.gold > this.o.inventory.gold(pl.id)) o.gold = this.o.inventory.gold(pl.id);
    }
    this.changed(s);
  }

  // --- encerramento -----------------------------------------------------------------------------------------------

  private close(s: Session) {
    this.sessions.delete(s.a); this.sessions.delete(s.b);
    this.push(s.a, { phase: "closed" }); this.push(s.b, { phase: "closed" });
  }

  /** Cancela a troca/convite de `id` (e avisa o outro lado com `why`). */
  cancel(id: string, why: string): void {
    const s = this.sessions.get(id);
    if (s) {
      this.close(s);
      const other = s.a === id ? s.b : s.a;
      this.notice(id, "Troca cancelada.");
      this.notice(other, why, "warn");
      return;
    }
    for (const [to, v] of [...this.invites]) {
      if (to !== id && v.from !== id) continue;
      this.invites.delete(to);
      this.push(to, { phase: "closed" });
      if (to === id) this.notice(v.from, why, "warn");
    }
  }

  /**
   * Reenvia o estado atual a `id` (reconexão: o que foi enviado durante a queda se perdeu): a troca aberta, o convite
   * recebido ou "closed".
   */
  resend(id: string): void {
    const s = this.sessions.get(id);
    if (s) { this.push(id, this.view(id, s)); return; }
    const inv = this.invites.get(id);
    const from = inv && this.o.getPlayer(inv.from);
    this.push(id, from ? { phase: "invite", fromId: from.id, from: from.name } : { phase: "closed" });
  }

  /** Saiu do mundo. */
  removePlayer(id: string): void {
    const p = this.o.getPlayer(id);
    this.cancel(id, `${p?.name ?? "O outro jogador"} saiu do jogo.`);
  }

  /** Convites vencidos e trocas em que alguém morreu, se afastou ou entrou no Coliseu. */
  tick(): void {
    const now = this.now();
    for (const [to, v] of [...this.invites]) {
      if (now - v.at >= TRADE_INVITE_MS) {
        this.invites.delete(to);
        this.push(to, { phase: "closed" });
        this.notice(v.from, "Convite de troca expirou.", "warn");
      }
    }
    const seen = new Set<Session>();
    for (const s of this.sessions.values()) {
      if (seen.has(s)) continue;
      seen.add(s);
      const a = this.o.getPlayer(s.a), b = this.o.getPlayer(s.b);
      if (!a || !b) { this.cancel(s.a, "O outro jogador saiu."); continue; }
      if (a.hp <= 0 || b.hp <= 0) this.cancel(s.a, "Troca cancelada.");
      else if (cheb(a, b) > TRADE_KEEP_RANGE) this.cancel(s.a, "Os dois se afastaram demais: troca cancelada.");
      else if (this.o.inArena(s.a) || this.o.inArena(s.b)) this.cancel(s.a, "Troca cancelada (Coliseu).");
    }
  }

  // --- visão ------------------------------------------------------------------------------------------------------

  private side(id: string, s: Session): TradeSideView {
    const o = s.offer[id]!;
    const items: ItemInstance[] = [];
    for (const x of o.items) {
      const it = this.o.inventory.findByUid(id, x.uid);
      if (it) items.push({ ...it, count: x.count });
    }
    return { items, gold: o.gold, confirmed: !!s.confirmed[id] };
  }

  private view(me: string, s: Session): TradeStateMsg {
    const other = s.a === me ? s.b : s.a;
    return { phase: "open", partnerId: other, partner: this.o.getPlayer(other)?.name ?? "?", rev: s.rev, mine: this.side(me, s), theirs: this.side(other, s) };
  }

  private pushBoth(s: Session) {
    this.push(s.a, this.view(s.a, s));
    this.push(s.b, this.view(s.b, s));
  }
}
