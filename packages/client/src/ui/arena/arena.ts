// Coliseu (cliente): stores da janela de lobbies, do estado da partida e do resultado + envio de ações.
import {
  C2S, S2C, type ArenaActionMsg, type ArenaLobbiesMsg, type ArenaResultMsg, type ArenaStateMsg,
} from "@lemonquest/shared";
import { session } from "../../session.ts";
import { createStore } from "../hud/store.ts";
import { send } from "../items/net.ts";

export type ArenaState = NonNullable<ArenaStateMsg["state"]>;

/** Janela "Coliseu" aberta (ao falar com o Mestre do Coliseu). */
export const arenaWindowOpen = createStore(false);
export const arenaLobbiesStore = createStore<ArenaLobbiesMsg | null>(null);
/** Estado do SEU lobby/partida (null = fora). `offset` = relógio do servidor − relógio local. */
export const arenaStateStore = createStore<{ s: ArenaState; offset: number } | null>(null);
export const arenaResultStore = createStore<ArenaResultMsg | null>(null);
/** Faixa "Onda N!" (nonce muda a cada onda). */
export const arenaBannerStore = createStore<{ wave: number; boss: boolean; nonce: number } | null>(null);

export const arenaAction = (m: ArenaActionMsg): void => send(C2S.Arena, m);

export function openArenaWindow(): void {
  arenaWindowOpen.set(true);
  arenaAction({ action: "list" });
}
export function closeArenaWindow(): void { arenaWindowOpen.set(false); }

/** Ms restantes da fase atual (contagem/pausa), corrigindo a diferença de relógio. */
export function phaseRemaining(st: { s: ArenaState; offset: number } | null): number {
  if (!st?.s.phaseEndsAt) return 0;
  return Math.max(0, st.s.phaseEndsAt - (Date.now() + st.offset));
}

let nonce = 0;
export function handleArenaState(m: ArenaStateMsg): void {
  // Fora da partida: some também a faixa "Onda N!" (senão ela cruzava com o banner da zona ao sair da arena).
  if (!m.state) { arenaStateStore.set(null); arenaBannerStore.set(null); return; }
  const prev = arenaStateStore.get()?.s;
  const offset = m.state.serverNow !== undefined ? m.state.serverNow - Date.now() : 0;
  arenaStateStore.set({ s: m.state, offset });
  if (m.state.phase === "fight" && (prev?.phase !== "fight" || prev.wave !== m.state.wave)) {
    arenaBannerStore.set({ wave: m.state.wave, boss: m.state.wave % 5 === 0, nonce: ++nonce });
  }
  // Entrou na arena: a janela de lobbies não serve mais.
  if (m.state.arenaId) arenaWindowOpen.set(false);
}

session.onRoom((room) => {
  room.onMessage(S2C.ArenaLobbies, (m: ArenaLobbiesMsg) => arenaLobbiesStore.set(m));
  room.onMessage(S2C.ArenaState, (m: ArenaStateMsg) => handleArenaState(m));
  room.onMessage(S2C.ArenaResult, (m: ArenaResultMsg) => { arenaResultStore.set(m); arenaBannerStore.set(null); arenaWindowOpen.set(false); });
});
