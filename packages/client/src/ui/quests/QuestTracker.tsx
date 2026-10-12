// Rastreador compacto (canto superior esquerdo, até 3 missões) e cartão "Missão concluída".
import { questDef, questReady } from "@lemonquest/shared";
import { useEffect, useRef } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { inventoryStore } from "../items/inventory.ts";
import { inventoryCounter, questDoneStore, questLogOpen, questStore, rewardText, stepLines, trackerCollapsed } from "./quests.ts";
import "./quests.css";

export function QuestTracker() {
  const st = useStore(questStore);
  useStore(inventoryStore);
  const collapsed = useStore(trackerCollapsed);
  const prev = useRef(new Map<string, number>());
  const tracked = (st?.tracked ?? []).flatMap((id) => {
    const def = questDef(id);
    const a = st?.active.find((x) => x.id === id);
    return def && a ? [{ def, a }] : [];
  });
  // Destaque rápido no número que acabou de subir ("+1 Lobo").
  const bumped = new Set<string>();
  const count = inventoryCounter();
  for (const { def, a } of tracked) {
    stepLines(def, a.progress, count).forEach((l, i) => {
      const k = `${def.id}:${i}`;
      const was = prev.current.get(k);
      if (was !== undefined && l.cur > was) bumped.add(k);
    });
  }
  useEffect(() => {
    const m = new Map<string, number>();
    for (const { def, a } of tracked) stepLines(def, a.progress, inventoryCounter()).forEach((l, i) => m.set(`${def.id}:${i}`, l.cur));
    prev.current = m;
  });
  if (tracked.length === 0) return null;
  return (
    <div class="quest-tracker" aria-label="Missões rastreadas">
      <div class="quest-tracker-head" onClick={() => trackerCollapsed.set((v) => !v)}>
        <span />
        <span>Missões</span>
        <button aria-label={collapsed ? "Expandir" : "Recolher"} data-tip={collapsed ? "Expandir" : "Recolher"}>{collapsed ? "+" : "−"}</button>
      </div>
      {!collapsed && (
        <ul>
          {tracked.map(({ def, a }) => {
            const ready = questReady(def, a.progress, count);
            return (
              <li key={def.id} data-quest={def.id}>
                <div class={`qt-name${ready ? " ready" : ""}`} onClick={() => questLogOpen.set(true)} data-tip="Abrir o diário" data-tip-sub="Tecla L">{def.name}</div>
                {stepLines(def, a.progress, count).map((l, i) => (
                  <div key={`${i}:${bumped.has(`${def.id}:${i}`) ? l.cur : ""}`} class={`qt-step${l.done ? " done" : ""}${bumped.has(`${def.id}:${i}`) ? " bump" : ""}`}>
                    <span>{l.label}</span>
                    <span>{l.max > 1 ? `${l.cur}/${l.max}` : l.done ? "✓" : "…"}</span>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function QuestDoneCard() {
  const m = useStore(questDoneStore);
  if (!m) return null;
  return (
    <div class="quest-done" key={m.id} role="status">
      <div class="quest-done-kicker">{m.bounty ? "Recompensa paga" : "Missão concluída"}</div>
      <div class="quest-done-name">{m.name}</div>
      <div class="quest-done-reward">{rewardText(m)}</div>
    </div>
  );
}
