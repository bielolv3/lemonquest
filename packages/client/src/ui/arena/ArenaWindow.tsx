// Janela "Coliseu" (Mestre do Coliseu): lista de grupos abertos, criar/entrar/sair/iniciar.
import { ARENA_COUNT, ARENA_MAX_PARTY } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { useStore } from "../hud/store.ts";
import { arenaAction, arenaLobbiesStore, arenaStateStore, arenaWindowOpen, closeArenaWindow, phaseRemaining } from "./arena.ts";
import { useTicker } from "./useTicker.ts";
import { ArenaQuests } from "../quests/NpcQuests.tsx";
import { partyStore } from "../party/party.ts";
import "./arena.css";

export function ArenaWindow() {
  const open = useStore(arenaWindowOpen);
  const list = useStore(arenaLobbiesStore);
  const st = useStore(arenaStateStore);
  const party = useStore(partyStore);
  useTicker(open && st?.s.phase === "countdown" ? 250 : 0);
  if (!open) return null;
  const mine = st && !st.s.arenaId ? st.s : null;
  const myName = session.myName;
  const leader = mine?.leader === myName;
  return (
    <div class="hud-card hud-window arena-window" role="dialog" aria-label="Coliseu">
      <div class="win-title">
        <span class="win-grip" />
        <span>Coliseu</span>
        <button class="win-close" onClick={closeArenaWindow} data-tip="Fechar" data-tip-sub="Esc" aria-label="Fechar">×</button>
      </div>
      <div class="arena-body">
        <div class="arena-info">
          Arenas livres: <b>{list?.freeArenas ?? "?"}/{ARENA_COUNT}</b> · Fila: <b>{list?.queue ?? 0}</b>
        </div>
        <div class="arena-hint">Enfrente ondas de monstros sozinho ou em grupo (até {ARENA_MAX_PARTY}). Pausas entre as ondas para comprar e curar. Cair aqui não tem penalidade.</div>
        <ArenaQuests />
        {mine ? (
          <div class="arena-mine">
            <div class="arena-mine-title">
              Seu grupo · {mine.phase === "queued" ? "na fila" : mine.phase === "countdown" ? `entrando em ${Math.ceil(phaseRemaining(st) / 1000)} s` : "aguardando"}
            </div>
            <ul class="arena-members">
              {mine.members.map((m) => <li key={m.name}>{m.name === mine.leader ? "👑 " : ""}{m.name}</li>)}
            </ul>
            <div class="arena-actions">
              {leader && mine.phase === "lobby" && (
                <button class="arena-btn primary" onClick={() => arenaAction({ action: "start" })}>
                  Iniciar{mine.members.length === 1 ? " (solo)" : ""}
                </button>
              )}
              {mine.phase !== "countdown" && <button class="arena-btn" onClick={() => arenaAction({ action: "leave" })}>Sair</button>}
            </div>
          </div>
        ) : (
          <div class="arena-actions">
            <button class="arena-btn primary" onClick={() => arenaAction({ action: "create" })}>Criar grupo</button>
            {party && party.leaderId === session.myId && party.members.length > 1 && (
              <button
                class="arena-btn"
                onClick={() => arenaAction({ action: "create", withParty: true })}
                data-tip="Cria o grupo do Coliseu já com os membros do seu grupo que estão perto do Mestre"
              >Criar grupo do Coliseu com meu grupo</button>
            )}
          </div>
        )}
        <div class="arena-sub">Grupos abertos</div>
        {!list?.lobbies.length ? <div class="hud-empty">Nenhum grupo aberto. Crie o seu!</div> : (
          <ul class="arena-lobbies">
            {list.lobbies.map((l) => {
              const isMine = mine?.lobbyId === l.id;
              const full = l.members.length >= l.max;
              return (
                <li key={l.id} class={`arena-lobby${isMine ? " mine" : ""}`}>
                  <div class="arena-lobby-main">
                    <div class="arena-lobby-leader">{l.leader}</div>
                    <div class="arena-lobby-sub">{l.members.join(", ")} · lv médio {l.avgLevel}</div>
                  </div>
                  <span class="arena-slots">{l.members.length}/{l.max}</span>
                  {!mine && (
                    <button class="arena-btn" disabled={full} onClick={() => arenaAction({ action: "join", lobbyId: l.id })}>
                      {full ? "Cheio" : "Entrar"}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
