// Aba "Missões" da janela de NPC (oferta → Aceitar/Recusar, progresso, Entregar) e o Quadro de Recompensas.
import {
  BOUNTY_CHEST_ID, QUEST_LIST, bountyTitle, itemDef, questsForNpc, type QuestDef, type QuestStatus,
} from "@lemonquest/shared";
import { useState } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { playersStore, selectMe } from "../hud/world.ts";
import { inventoryStore } from "../items/inventory.ts";
import { useTicker } from "../arena/useTicker.ts";
import { inventoryCounter, questAction, questStore, rewardText, stepLines } from "./quests.ts";
import "./quests.css";

const STATUS_LABEL: Partial<Record<QuestStatus, string>> = { available: "Nova", active: "Em andamento", ready: "Pronta" };

export function NpcQuestList({ npcId }: { npcId: string }) {
  const st = useStore(questStore);
  useStore(inventoryStore); // coletar/entregar dependem da mochila
  const me = selectMe(useStore(playersStore));
  const [declined, setDeclined] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<string[]>([]);
  if (!st || !me) return <div class="hud-empty">Carregando missões…</div>;
  const count = inventoryCounter();
  const list = questsForNpc(npcId, st, me.level, count).filter((e) => !declined.includes(e.def.id));
  // Próxima missão deste NPC bloqueada só por level (dica).
  const next = QUEST_LIST.find((d) => d.giver === npcId && !st.done.includes(d.id) && !st.active.some((a) => a.id === d.id)
    && me.level < d.minLevel && (d.requires ?? []).every((r) => st.done.includes(r)));
  if (list.length === 0) {
    return (
      <div class="quest-empty">
        {next ? `Volte quando for level ${next.minLevel}: tenho um trabalho para você.` : "Nenhuma missão por aqui no momento."}
      </div>
    );
  }
  return (
    <ul class="quest-offers">
      {list.map(({ def, status }) => (
        <QuestCard
          key={def.id} def={def} status={status} progress={st.active.find((a) => a.id === def.id)?.progress}
          justAccepted={accepted.includes(def.id)}
          onAccept={() => { setAccepted((l) => [...l, def.id]); questAction({ action: "accept", questId: def.id }); }}
          onDecline={() => setDeclined((l) => [...l, def.id])}
          onTurnIn={() => questAction({ action: "turnIn", questId: def.id })}
          count={count}
        />
      ))}
    </ul>
  );
}

function QuestCard(o: {
  def: QuestDef; status: QuestStatus; progress?: number[]; justAccepted: boolean; count: ReturnType<typeof inventoryCounter>;
  onAccept: () => void; onDecline: () => void; onTurnIn: () => void;
}) {
  const { def, status } = o;
  const text = status === "available" ? def.dialog.offer : status === "ready" ? def.dialog.complete : o.justAccepted ? def.dialog.accept : def.dialog.progress;
  const lines = stepLines(def, o.progress, o.count);
  return (
    <li class={`quest-card st-${status}`} data-quest={def.id}>
      <div class="quest-card-head">
        <span class="quest-mark" aria-hidden="true">{status === "available" ? "!" : "?"}</span>
        <span class="quest-card-name">{def.name}</span>
        <span class="quest-chip">{STATUS_LABEL[status]}</span>
      </div>
      <div class="quest-say">“{text}”</div>
      <ul class="quest-steps">
        {lines.map((l, i) => (
          <li key={i} class={l.done ? "done" : ""}>
            <span>{l.label}</span>
            <span class="quest-step-n">{l.max > 1 || status !== "available" ? `${l.cur}/${l.max}` : ""}</span>
          </li>
        ))}
      </ul>
      <div class="quest-reward"><b>Recompensa:</b> {rewardText(def.rewards)}{def.rewards.unlock ? " · desbloqueio especial" : ""}</div>
      <div class="quest-actions">
        {status === "available" && <>
          <button class="quest-btn primary" onClick={o.onAccept}>Aceitar</button>
          <button class="quest-btn" onClick={o.onDecline}>Recusar</button>
        </>}
        {status === "ready" && <button class="quest-btn primary" onClick={o.onTurnIn}>Entregar</button>}
      </div>
    </li>
  );
}

/** "5 h 12 min" / "8 min" */
export function fmtUntil(ms: number): string {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} h ${m % 60} min` : `${m} min`;
}

export function BountyBoard() {
  const st = useStore(questStore);
  useTicker(30_000);
  if (!st) return <div class="hud-empty">Carregando recompensas…</div>;
  const chest = itemDef(BOUNTY_CHEST_ID)?.name ?? "Baú";
  return (
    <div class="bounty-board">
      <ul class="quest-offers">
        {st.bounties.list.map((b, i) => {
          const ready = b.status === "active" && b.progress >= b.count;
          const pct = Math.round((Math.min(b.progress, b.count) / b.count) * 100);
          return (
            <li key={i} class={`quest-card bounty st-${b.status}${ready ? " ready" : ""}`} data-bounty={i}>
              <div class="quest-card-head">
                <span class="quest-mark" aria-hidden="true">{b.status === "open" ? "!" : b.status === "done" ? "✓" : "?"}</span>
                <span class="quest-card-name">{bountyTitle(b)}</span>
                <span class="quest-chip">{b.status === "open" ? "Nova" : b.status === "done" ? "Paga" : ready ? "Cumprida" : "Em andamento"}</span>
              </div>
              {b.status !== "open" && (
                <div class="bounty-bar" role="progressbar" aria-valuenow={b.progress} aria-valuemax={b.count}>
                  <span style={{ width: `${pct}%` }} />
                  <em>{Math.min(b.progress, b.count)}/{b.count}</em>
                </div>
              )}
              <div class="quest-reward"><b>Recompensa:</b> {rewardText({ xp: b.xp, gold: b.gold, items: [] })} · {chest}</div>
              <div class="quest-actions">
                {b.status === "open" && <button class="quest-btn primary" onClick={() => questAction({ action: "bountyAccept", index: i })}>Aceitar</button>}
                {ready && <button class="quest-btn primary" onClick={() => questAction({ action: "bountyTurnIn", index: i })}>Entregar</button>}
              </div>
            </li>
          );
        })}
      </ul>
      <div class="bounty-reset">Novas recompensas em {fmtUntil(st.bounties.resetsAt - Date.now())} (todo dia às 6h).</div>
    </div>
  );
}
