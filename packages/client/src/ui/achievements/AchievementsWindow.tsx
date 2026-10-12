// Janela de conquistas (tecla J): lista com barras de progresso, filtros, pontos e seletor de título.
import { useState } from "preact/hooks";
import { ACHIEVEMENTS, TITLES, TOTAL_ACHIEVEMENT_POINTS, unlockText, type AchievementDef } from "@lemonquest/shared";
import { useStore } from "../hud/store.ts";
import { achievementsOpen, achievementsStore, fmtNum, fmtProgress, sendTitle, titleText } from "./achievements.ts";
import "./achievements.css";

type Filter = "all" | "done" | "locked";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "done", label: "Desbloqueadas" },
  { id: "locked", label: "Bloqueadas" },
];

export function AchievementsWindow() {
  const open = useStore(achievementsOpen);
  if (!open) return null;
  return <AchievementsDialog />;
}

function AchievementsDialog() {
  const st = useStore(achievementsStore);
  const [filter, setFilter] = useState<Filter>("all");
  const done = st?.done ?? {};
  const progress = st?.progress ?? {};
  const doneCount = ACHIEVEMENTS.filter((a) => done[a.id]).length;
  const titles = (st?.unlocks ?? []).filter((u) => u.startsWith("title:")).map((u) => u.slice(6)).filter((t) => t in TITLES);
  const list = ACHIEVEMENTS.filter((a) => (filter === "all" ? true : filter === "done" ? !!done[a.id] : !done[a.id]));

  return (
    <div class="hud-card hud-window ach-win" role="dialog" aria-label="Conquistas">
      <div class="win-title">
        <span class="win-grip" aria-hidden="true" />
        <span>Conquistas</span>
        <button class="win-close" onClick={() => achievementsOpen.set(false)} data-tip="Fechar" data-tip-sub="J ou Esc">×</button>
      </div>
      <div class="ach-head">
        <div class="ach-points" data-tip="Pontos de conquista">
          <b>{fmtNum(st?.points ?? 0)}</b> / {fmtNum(TOTAL_ACHIEVEMENT_POINTS)} pts
          <small>{doneCount} de {ACHIEVEMENTS.length} conquistas</small>
        </div>
        <label class="ach-title-pick">
          <small>Título</small>
          <select
            class="ach-select"
            value={st?.title ?? ""}
            onChange={(e) => sendTitle((e.currentTarget as HTMLSelectElement).value)}
            aria-label="Título ativo"
          >
            <option value="">Sem título</option>
            {titles.map((t) => <option key={t} value={t}>{titleText(t)}</option>)}
          </select>
        </label>
      </div>
      <div class="ach-filters" role="tablist" aria-label="Filtro">
        {FILTERS.map((f) => (
          <button key={f.id} role="tab" aria-selected={filter === f.id} class={`ach-filter${filter === f.id ? " on" : ""}`} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      <ul class="ach-list">
        {list.map((a) => <Row key={a.id} a={a} at={done[a.id]} value={progress[a.id] ?? 0} />)}
        {list.length === 0 && <li class="ach-empty">Nada por aqui ainda.</li>}
      </ul>
    </div>
  );
}

function Row({ a, at, value }: { a: AchievementDef; at: number | undefined; value: number }) {
  const isDone = !!at;
  const secret = !!a.hidden && !isDone;
  const pct = isDone ? 100 : Math.max(0, Math.min(100, (value * 100) / a.target));
  return (
    <li class={`ach-row${isDone ? " done" : ""}`} data-ach={a.id}>
      <span class="ach-icon" aria-hidden="true">{secret ? "❓" : a.icon}</span>
      <div class="ach-main">
        <div class="ach-top">
          <span class="ach-name">{secret ? "???" : a.name}</span>
          <span class="ach-pts">{a.points} pts</span>
        </div>
        <div class="ach-desc">{secret ? "Conquista secreta" : a.desc}</div>
        {!secret && !isDone && (
          <div class="ach-bar" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${pct}%` }} />
            <em>{fmtProgress(a, value)}</em>
          </div>
        )}
        {isDone && <div class="ach-when">Conquistada em {new Date(at!).toLocaleDateString("pt-BR")}</div>}
        {!secret && a.rewards && (
          <div class="ach-rewards">
            {a.rewards.map((r) => <span key={r} class={`ach-chip${isDone ? " got" : ""}`}>{unlockText(r)}</span>)}
          </div>
        )}
      </div>
    </li>
  );
}
