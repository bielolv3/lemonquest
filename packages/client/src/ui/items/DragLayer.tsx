// Fantasma do item sendo arrastado + diálogos (quantidade / jogar fora).
import { useEffect, useRef, useState } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { bindGhost, dragStore } from "./dnd.ts";
import { closeDialog, dialogStore } from "./dialogs.ts";
import { ItemIcon } from "./ItemIcon.tsx";

export function DragLayer() {
  const drag = useStore(dragStore);
  const el = useRef<HTMLDivElement>(null);
  const reasonEl = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    bindGhost((x, y, reason) => {
      if (el.current) el.current.style.transform = `translate(${x + 10}px, ${y + 10}px)`;
      if (reasonEl.current) {
        reasonEl.current.textContent = reason;
        reasonEl.current.style.display = reason ? "block" : "none";
      }
    });
    return () => bindGhost(null);
  }, []);

  // Cursor "agarrando" enquanto arrasta.
  useEffect(() => {
    document.body.classList.toggle("item-dragging", !!drag);
    return () => document.body.classList.remove("item-dragging");
  }, [drag]);

  return (
    <>
      {drag && (
        <div class="drag-ghost" ref={el} style={{ transform: "translate(-999px,-999px)" }}>
          <ItemIcon inst={drag.inst} def={drag.def} box={36} />
          <span class="drag-reason" ref={reasonEl} style={{ display: "none" }} />
        </div>
      )}
      <ItemDialogs />
    </>
  );
}

function ItemDialogs() {
  const d = useStore(dialogStore);
  if (!d) return null;
  return (
    <div class="item-dialog-backdrop" onPointerDown={(e) => { if (e.target === e.currentTarget) closeDialog(); }}>
      {d.kind === "count" ? <CountDialog d={d} /> : <DiscardDialog d={d} />}
    </div>
  );
}

function CountDialog({ d }: { d: Extract<NonNullable<ReturnType<typeof dialogStore.get>>, { kind: "count" }> }) {
  const [n, setN] = useState(d.initial);
  const clamp = (v: number) => Math.max(1, Math.min(d.max, Math.round(v) || 1));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); input.current?.select(); }, []);
  const set = (v: number) => setN(clamp(v));
  return (
    <div class="hud-card item-dialog" role="dialog" aria-label={d.title}>
      <div class="dlg-title">{d.title}</div>
      <div class="dlg-row">
        <button class="dlg-step" onClick={() => set(n - 1)}>−</button>
        <input
          ref={input} class="dlg-num" type="number" min={1} max={d.max} value={n}
          onInput={(e) => set(Number((e.target as HTMLInputElement).value))}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") d.onConfirm(n);
            else if (e.key === "Escape") closeDialog();
          }}
        />
        <button class="dlg-step" onClick={() => set(n + 1)}>+</button>
        <button class="dlg-step wide" onClick={() => set(d.max)}>Tudo</button>
      </div>
      <input class="dlg-range" type="range" min={1} max={d.max} value={n} onInput={(e) => set(Number((e.target as HTMLInputElement).value))} />
      <div class="dlg-actions">
        <button class="dlg-btn" onClick={closeDialog}>Cancelar</button>
        <button class="dlg-btn primary" onClick={() => d.onConfirm(n)}>Mover {n}</button>
      </div>
    </div>
  );
}

function DiscardDialog({ d }: { d: Extract<NonNullable<ReturnType<typeof dialogStore.get>>, { kind: "discard" }> }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter") { e.preventDefault(); d.onConfirm(); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [d]);
  return (
    <div class="hud-card item-dialog" role="alertdialog" aria-label="Jogar fora">
      <div class="dlg-title">Jogar fora?</div>
      <div class="dlg-text">{d.count > 1 ? `${d.count}× ` : ""}<b>{d.name}</b> será destruído para sempre.</div>
      <div class="dlg-actions">
        <button class="dlg-btn" onClick={closeDialog}>Cancelar</button>
        <button class="dlg-btn danger" onClick={d.onConfirm}>Jogar fora</button>
      </div>
    </div>
  );
}
