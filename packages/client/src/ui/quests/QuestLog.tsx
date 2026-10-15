// Diário de missões (tecla L / trilho): ativas e concluídas, com descrição, passos e recompensas.
import { MAX_TRACKED_QUESTS, QUEST_LIST, npcDef, questDef, questReady, unlockText } from "@lemonquest/shared";
import { useEffect, useState } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { inventoryStore } from "../items/inventory.ts";
import { inventoryCounter, questAction, questLogOpen, questStore, rewardText, stepLines } from "./quests.ts";
import "./quests.css";

export function QuestLog() {
  const open = useStore(questLogOpen);
  if (!open) return null;
  return <QuestLogDialog />;
}

function QuestLogDialog() {
  const st = useStore(questStore);
  useStore(inventoryStore);
  const count = inventoryCounter();
  const active = (st?.active ?? []).flatMap((a) => { const d = questDef(a.id); return d ? [{ def: d, a }] : []; });
  const done = QUEST_LIST.filter((d) => st?.done.includes(d.id));
  const [sel, setSel] = useState<string>(active[0]?.def.id ?? done[0]?.id ?? "");
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); questLogOpen.set(false); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  const def = questDef(sel);
  const act = st?.active.find((a) => a.id === sel);
  const isDone = !!st?.done.includes(sel);
  const tracked = !!st?.tracked.includes(sel);
  return (
    <div class="hud-card hud-window quest-log" role="dialog" aria-label="Diário de missões">
      <div class="win-title">
        <span class="win-grip" />
        <span>Diário de missões</span>
        <button class="win-close" onClick={() => questLogOpen.set(false)} data-tip="Fechar" data-tip-sub="Esc" aria-label="Fechar">×</button>
      </div>
      <div class="ql-body">
        <div class="ql-list">
          <div class="ql-group">Ativas ({active.length})</div>
          {active.length === 0 && <div class="hud-empty">Nenhuma. Procure NPCs com “!”.</div>}
          {active.map(({ def: d, a }) => {
            const ready = questReady(d, a.progress, count);
            return (
              <button key={d.id} class={`ql-item${sel === d.id ? " sel" : ""}`} onClick={() => { setSel(d.id); setConfirmAbandon(false); }}>
                <span class="quest-mark" style={ready ? undefined : { color: "#a9adba" }}>?</span>{d.name}
              </button>
            );
          })}
          <div class="ql-group">Concluídas ({done.length})</div>
          {done.map((d) => (
            <button key={d.id} class={`ql-item done${sel === d.id ? " sel" : ""}`} onClick={() => setSel(d.id)}>
              <span class="quest-mark" style={{ color: "#8fd18f" }}>✓</span>{d.name}
            </button>
          ))}
        </div>
        <div class="ql-detail">
          {!def || (!act && !isDone) ? <div class="ql-empty">Selecione uma missão.</div> : <>
            <h3>{def.name}</h3>
            <div class="ql-meta">{npcDef(def.giver)?.name ?? def.giver} · level {def.minLevel}+{isDone ? " · concluída" : act && questReady(def, act.progress, count) ? " · pronta para entregar" : ""}</div>
            <div class="ql-summary">{def.summary}</div>
            <ul class="quest-steps">
              {stepLines(def, isDone ? def.steps.map((s) => s.count) : act?.progress, isDone ? () => 1e9 : count).map((l, i) => (
                <li key={i} class={l.done ? "done" : ""}><span>{l.label}</span><span class="quest-step-n">{l.cur}/{l.max}</span></li>
              ))}
            </ul>
            <div class="quest-reward"><b>Recompensa:</b> {rewardText(def.rewards)}{def.rewards.unlock ? ` · ${unlockText(def.rewards.unlock)}` : ""}</div>
            {act && (
              <div class="quest-actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <label class="ql-track">
                  <input type="checkbox" checked={tracked} onChange={() => questAction({ action: "track", questId: def.id, on: !tracked })} />
                  Rastrear (máx. {MAX_TRACKED_QUESTS})
                </label>
                {confirmAbandon
                  ? <button class="quest-btn" onClick={() => { questAction({ action: "abandon", questId: def.id }); setConfirmAbandon(false); }}>Confirmar abandono</button>
                  : <button class="quest-btn" onClick={() => setConfirmAbandon(true)}>Abandonar</button>}
              </div>
            )}
          </>}
        </div>
      </div>
    </div>
  );
}
