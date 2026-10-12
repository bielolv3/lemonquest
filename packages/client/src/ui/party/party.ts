// Grupo (party): estado do SEU grupo (S2C.Party), convites recebidos (S2C.PartyInvite) e ações (C2S.Party).
// Sem dependências de UI: o jogo (Phaser) também lê (nomes verdes, minimapa).
import { C2S, S2C, type PartyActionMsg, type PartyInviteMsg, type PartyStateMsg } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { send } from "../items/net.ts";
import { createStore } from "../hud/store.ts";

export type PartyInfo = NonNullable<PartyStateMsg["party"]>;

export const partyStore = createStore<PartyInfo | null>(null);

export interface PendingInvite { fromId: string; fromName: string; expiresAt: number }
export const invitesStore = createStore<PendingInvite[]>([]);

export const partyAction = (msg: PartyActionMsg): void => send(C2S.Party, msg);

/** O id é de um membro do meu grupo (exclui eu mesmo se `others`). */
export function isPartyMember(id: string, others = false): boolean {
  const p = partyStore.get();
  if (!p) return false;
  if (others && id === session.myId) return false;
  return p.members.some((m) => m.id === id);
}

export const amLeader = (): boolean => partyStore.get()?.leaderId === session.myId;

export function answerInvite(fromId: string, accept: boolean): void {
  invitesStore.set((l) => l.filter((i) => i.fromId !== fromId));
  partyAction(accept ? { action: "accept", fromId } : { action: "decline", fromId });
}

let timer = 0;
function pruneLater() {
  window.clearTimeout(timer);
  const list = invitesStore.get();
  if (!list.length) return;
  const next = Math.min(...list.map((i) => i.expiresAt));
  timer = window.setTimeout(() => {
    invitesStore.set((l) => l.filter((i) => i.expiresAt > Date.now()));
    pruneLater();
  }, Math.max(50, next - Date.now()));
}

session.onRoom((room) => {
  partyStore.set(null);
  invitesStore.set([]);
  room.onMessage(S2C.Party, (m: PartyStateMsg) => {
    partyStore.set(m?.party ?? null);
    // Entrou num grupo: convites pendentes perdem o sentido.
    if (m?.party) invitesStore.set([]);
  });
  room.onMessage(S2C.PartyInvite, (m: PartyInviteMsg) => {
    if (!m || typeof m.fromId !== "string") return;
    const inv: PendingInvite = { fromId: m.fromId, fromName: m.fromName, expiresAt: Date.now() + (m.expiresInMs || 60_000) };
    invitesStore.set((l) => [...l.filter((i) => i.fromId !== m.fromId), inv].slice(-3));
    pruneLater();
  });
});
