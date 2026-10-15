// Troca entre jogadores: estado (S2C.Trade) e ações (C2S.Trade). Sem dependências de UI.
import { C2S, S2C, type ItemInstance, type TradeMsg, type TradeStateMsg } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { send } from "../items/net.ts";
import { createStore } from "../hud/store.ts";

export const tradeStore = createStore<TradeStateMsg>({ phase: "closed" });

export const tradeAction = (msg: TradeMsg): void => send(C2S.Trade, msg);

export const requestTrade = (targetId: string): void => tradeAction({ action: "request", targetId });
export const acceptTrade = (): void => tradeAction({ action: "accept" });
export const declineTrade = (): void => { tradeStore.set({ phase: "closed" }); tradeAction({ action: "decline" }); };
export const cancelTrade = (): void => { tradeStore.set({ phase: "closed" }); tradeAction({ action: "cancel" }); };
export const confirmTrade = (confirmed: boolean): void => tradeAction({ action: "confirm", confirmed });

/** Oferta atual do jogador (itens por uid + ouro), a partir do último estado da troca. */
function mine() {
  const st = tradeStore.get();
  return st.phase === "open" ? st.mine : null;
}

function sendOffer(items: { uid: string; count: number }[], gold: number) {
  tradeAction({ action: "offer", items, gold });
}

/** Põe um item da mochila na oferta (`count` unidades; o resto da pilha fica). */
export function offerItem(inst: ItemInstance, count = inst.count): void {
  const m = mine();
  if (!m || m.items.some((i) => i.uid === inst.uid)) return;
  sendOffer([...m.items.map((i) => ({ uid: i.uid, count: i.count })), { uid: inst.uid, count: Math.max(1, Math.min(count, inst.count)) }], m.gold);
}

export function unofferItem(uid: string): void {
  const m = mine();
  if (!m) return;
  sendOffer(m.items.filter((i) => i.uid !== uid).map((i) => ({ uid: i.uid, count: i.count })), m.gold);
}

export function offerGold(gold: number): void {
  const m = mine();
  if (!m) return;
  sendOffer(m.items.map((i) => ({ uid: i.uid, count: i.count })), Math.max(0, Math.floor(gold) || 0));
}

session.onRoom((room) => {
  tradeStore.set({ phase: "closed" });
  room.onMessage(S2C.Trade, (m: TradeStateMsg) => tradeStore.set(m && typeof m === "object" && "phase" in m ? m : { phase: "closed" }));
});
