// Estado da encomenda semanal de material (Quadro de Recompensas): S2C.MaterialRequestState e ações (C2S.MaterialRequest).
import { C2S, S2C, type MaterialRequestActionMsg, type MaterialRequestMsg } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { createStore } from "../hud/store.ts";
import { send } from "../items/net.ts";

export const materialRequestStore = createStore<MaterialRequestMsg["request"] | null>(null);

export function materialRequestAction(m: MaterialRequestActionMsg): void { send(C2S.MaterialRequest, m); }

session.onRoom((room) => {
  materialRequestStore.set(null);
  room.onMessage(S2C.MaterialRequestState, (m: MaterialRequestMsg) => materialRequestStore.set(m.request));
});
