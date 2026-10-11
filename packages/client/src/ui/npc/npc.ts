// Estado da janela de NPC (diálogo/loja/depot). O mundo (Phaser) chama openNpc(npcId) ao clicar num NPC.
import { C2S, type NpcInteractMsg, type NpcOpenMsg, type NpcTradeMsg } from "@tibinha/shared";
import { createStore } from "../hud/store.ts";
import { send } from "../items/net.ts";

export type NpcTab = "buy" | "sell" | "depot";
export interface NpcState { msg: NpcOpenMsg; tab: NpcTab; /** muda a cada nova abertura (reinicia a digitação). */ nonce: number }

export const npcStore = createStore<NpcState | null>(null);
let nonce = 0;

/** Pede ao servidor para falar com o NPC (a janela abre quando chegar S2C.NpcOpen). */
export function openNpc(npcId: string): void {
  const m: NpcInteractMsg = { npcId };
  send(C2S.NpcInteract, m);
}

export function closeNpc(): void { npcStore.set(null); }

export const npcTabs = (m: NpcOpenMsg): NpcTab[] => {
  const t: NpcTab[] = [];
  if (m.shop?.sells.length) t.push("buy");
  if (m.shop?.buys?.length) t.push("sell");
  if (m.depot) t.push("depot");
  return t;
};

/** S2C.NpcOpen: npcId "" fecha; senão abre/atualiza a janela. */
export function handleNpcOpen(m: NpcOpenMsg): void {
  if (!m.npcId) { closeNpc(); return; }
  const cur = npcStore.get();
  if (cur && cur.msg.npcId === m.npcId) {
    const tabs = npcTabs(m);
    npcStore.set({ ...cur, msg: m, tab: tabs.includes(cur.tab) ? cur.tab : tabs[0] ?? "buy" });
    return;
  }
  npcStore.set({ msg: m, tab: npcTabs(m)[0] ?? "buy", nonce: ++nonce });
}

export function setNpcTab(tab: NpcTab): void {
  npcStore.set((s) => (s ? { ...s, tab } : s));
}

export function buyItem(npcId: string, itemId: string, count: number): void {
  const m: NpcTradeMsg = { npcId, action: "buy", itemId, count };
  send(C2S.NpcTrade, m);
}
export function sellItem(npcId: string, index: number, count: number): void {
  const m: NpcTradeMsg = { npcId, action: "sell", index, count };
  send(C2S.NpcTrade, m);
}
