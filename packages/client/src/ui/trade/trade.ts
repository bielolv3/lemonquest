// Troca entre jogadores: estado (S2C.Trade) e ações (C2S.Trade). Sem dependências de UI.
import { C2S, S2C, type ItemInstance, type TradeMsg, type TradeStateMsg } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { send } from "../items/net.ts";
import { createStore } from "../hud/store.ts";

export const tradeStore = createStore<TradeStateMsg>({ phase: "closed" });
/** Ouro digitado e ainda não confirmado pelo servidor (null = o campo mostra o valor da oferta). */
export const goldDraftStore = createStore<string | null>(null);

/** Depois de digitar, a oferta de ouro sai sozinha após este tempo (ou antes: Enter, sair do campo, confirmar). */
export const GOLD_SEND_DELAY_MS = 600;

export const tradeAction = (msg: TradeMsg): void => send(C2S.Trade, msg);

/**
 * Versão das ofertas que vai no confirm: a do último estado recebido ou, se este cliente acabou de mandar uma oferta
 * que ainda não voltou, a seguinte (cada oferta sobe a versão em 1 no servidor). Se o outro mudou a oferta no meio, a
 * versão não bate e o servidor ignora o confirm (e reenvia o estado). Todo estado "open" recebido realinha com a versão
 * do servidor: uma oferta que se perdeu (queda, limite de mensagens) não deixa o confirm adiantado para sempre.
 */
let sentRev = 0;
/** Ouro da última oferta enviada (vale enquanto ela não volta do servidor). */
let sentGold = 0;
let goldTimer: ReturnType<typeof setTimeout> | undefined;

function stopGoldTimer() {
  if (goldTimer !== undefined) clearTimeout(goldTimer);
  goldTimer = undefined;
}

export const requestTrade = (targetId: string): void => tradeAction({ action: "request", targetId });
export const acceptTrade = (): void => tradeAction({ action: "accept" });
export const declineTrade = (): void => { applyTradeState({ phase: "closed" }); tradeAction({ action: "decline" }); };
export const cancelTrade = (): void => { applyTradeState({ phase: "closed" }); tradeAction({ action: "cancel" }); };

/** Confirma (ou desfaz) a troca. Ouro digitado e não enviado sai antes, e o confirm vale para a oferta com ele. */
export function confirmTrade(confirmed: boolean): void {
  const st = tradeStore.get();
  if (st.phase !== "open") return;
  if (confirmed) flushGold();
  tradeAction({ action: "confirm", confirmed, rev: Math.max(st.rev, sentRev) });
}

/** Oferta atual do jogador (itens por uid + ouro), a partir do último estado da troca. */
function mine() {
  const st = tradeStore.get();
  return st.phase === "open" ? st.mine : null;
}

const parseGold = (v: string): number => Math.max(0, Math.floor(Number(v)) || 0);

function sendOffer(items: { uid: string; count: number }[], gold: number) {
  const st = tradeStore.get();
  if (st.phase !== "open") return;
  stopGoldTimer(); // o ouro pendente vai junto nesta oferta
  sentRev = Math.max(sentRev, st.rev) + 1;
  sentGold = gold;
  tradeAction({ action: "offer", items, gold });
}

/** Ouro da oferta: o digitado (ainda não enviado) ou o que o servidor tem. */
function offerGoldNow(m: { gold: number }): number {
  const draft = goldDraftStore.get();
  return draft === null ? m.gold : parseGold(draft);
}

const itemsOf = (m: { items: { uid: string; count: number }[] }) => m.items.map((i) => ({ uid: i.uid, count: i.count }));

/** Põe um item da mochila na oferta (`count` unidades; o resto da pilha fica). */
export function offerItem(inst: ItemInstance, count = inst.count): void {
  const m = mine();
  if (!m || m.items.some((i) => i.uid === inst.uid)) return;
  sendOffer([...itemsOf(m), { uid: inst.uid, count: Math.max(1, Math.min(count, inst.count)) }], offerGoldNow(m));
}

export function unofferItem(uid: string): void {
  const m = mine();
  if (!m) return;
  sendOffer(itemsOf(m).filter((i) => i.uid !== uid), offerGoldNow(m));
}

export function offerGold(gold: number): void {
  const m = mine();
  if (!m) return;
  sendOffer(itemsOf(m), Math.max(0, Math.floor(gold) || 0));
}

/** Campo de ouro mudou: guarda o rascunho e manda sozinho depois de GOLD_SEND_DELAY_MS sem digitar. */
export function typeGold(value: string): void {
  goldDraftStore.set(value);
  stopGoldTimer();
  goldTimer = setTimeout(flushGold, GOLD_SEND_DELAY_MS);
}

/** Manda já o ouro digitado, se for diferente da oferta. true = mandou uma oferta nova. */
export function flushGold(): boolean {
  stopGoldTimer();
  const m = mine(), draft = goldDraftStore.get();
  if (!m || draft === null) return false;
  const gold = parseGold(draft);
  const st = tradeStore.get();
  const pending = st.phase === "open" && sentRev > st.rev; // oferta minha ainda a caminho?
  if (gold === (pending ? sentGold : m.gold)) { if (!pending) goldDraftStore.set(null); return false; }
  sendOffer(itemsOf(m), gold);
  return true;
}

/** Estado novo do servidor. Fora da digitação, o campo de ouro volta ao valor que o servidor tem (aceito ou recusado). */
export function applyTradeState(m: TradeStateMsg): void {
  if (m.phase !== "open") { stopGoldTimer(); sentRev = 0; goldDraftStore.set(null); }
  else {
    sentRev = m.rev;
    if (goldTimer === undefined) goldDraftStore.set(null);
  }
  tradeStore.set(m);
}

session.onRoom((room) => {
  applyTradeState({ phase: "closed" });
  room.onMessage(S2C.Trade, (m: TradeStateMsg) => applyTradeState(m && typeof m === "object" && "phase" in m ? m : { phase: "closed" }));
});
