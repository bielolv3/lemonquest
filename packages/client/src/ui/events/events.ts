// Evento com bônus em andamento (S2C.Event). Null = nenhum.
import { S2C, type ActiveEvent, type EventMsg } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { createStore } from "../hud/store.ts";

export const eventStore = createStore<ActiveEvent | null>(null);

session.onRoom((room) => {
  eventStore.set(null);
  room.onMessage(S2C.Event, (m: EventMsg) => eventStore.set(m?.active && typeof m.active.id === "string" ? m.active : null));
});
