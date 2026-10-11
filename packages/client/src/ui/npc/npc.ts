// STUB — o agente de UI substitui
import { C2S, type NpcInteractMsg } from "@tibinha/shared";
import { session } from "../../session.ts";

/** Abre o diálogo/loja/depot de um NPC (pede ao servidor; ele responde com S2C.NpcOpen). */
export function openNpc(npcId: string): void {
  session.room?.send(C2S.NpcInteract, { npcId } satisfies NpcInteractMsg);
}
