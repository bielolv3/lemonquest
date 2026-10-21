// Painel de atalhos de magia (tecla H ou ⚙ na barra): cada linha = [tecla] [magia] [remover]. Clicar na tecla espera a
// próxima tecla apertada (Esc cancela); as teclas do próprio jogo são recusadas com o motivo. Salva no personagem.
import { HOTKEY_MAX, defaultHotkeys, spellsFor, type Hotkey, type Vocation } from "@lemonquest/shared";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { persistedJson, useStore } from "../hud/store.ts";
import { meStore } from "../hud/world.ts";
import { addRow, assignKey, isModifierCode, removeRow, setRowSpell } from "./edit.ts";
import { effectiveHotkeys, hotkeyLabel, hotkeysOpen, hotkeysStore, keyFromEvent, layoutStore, setHotkeys } from "./hotkeys.ts";
import "./hotkeys.css";

const W = 360;
const posStore = persistedJson<{ x: number; y: number }>("hotkeysPos", { x: -1, y: -1 });

const clampPos = (x: number, y: number) => ({
  x: Math.max(4, Math.min(window.innerWidth - W - 4, x)),
  y: Math.max(4, Math.min(window.innerHeight - 80, y)),
});

export function HotkeysWindow() {
  const open = useStore(hotkeysOpen);
  const me = useStore(meStore);
  useStore(hotkeysStore);
  useStore(layoutStore);
  const stored = useStore(posStore);
  const [capturing, setCapturing] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const msgTimer = useRef(0);

  const voc = me?.vocation as Vocation | undefined;
  const list = effectiveHotkeys(voc);

  const say = (text: string | undefined, error?: boolean) => {
    window.clearTimeout(msgTimer.current);
    setMsg(text ? { text, error } : null);
    if (text) msgTimer.current = window.setTimeout(() => setMsg(null), 4000);
  };
  const apply = (next: Hotkey[]) => setHotkeys(next);

  // Captura da tecla: antes de qualquer outro atalho do jogo (fase de captura + stopImmediatePropagation). Layout effect:
  // fica ativo antes de o "Pressione uma tecla…" aparecer (senão uma tecla apertada logo depois ia para o jogo).
  useLayoutEffect(() => {
    if (capturing === null || !open || !voc) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.repeat || isModifierCode(e.code)) return;
      if (e.code === "Escape") { setCapturing(null); say(undefined); return; }
      const key = keyFromEvent(e);
      if (!key) { say("Ctrl e Alt não podem: o navegador usa essas combinações.", true); return; }
      const r = assignKey(effectiveHotkeys(voc), capturing, key, hotkeyLabel);
      say(r.message, r.error);
      if (r.error) return;
      apply(r.list);
      setCapturing(null);
    };
    // Clicar em outro lugar ou focar um campo de texto (chat) cancela a captura: senão ela engoliria o que for digitado.
    const cancel = (e: Event) => {
      if (!(e.target as HTMLElement | null)?.closest?.(".hk-key.capturing")) setCapturing(null);
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", cancel, true);
    window.addEventListener("focusin", cancel, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", cancel, true);
      window.removeEventListener("focusin", cancel, true);
    };
  }, [capturing, voc, open]);

  useEffect(() => { if (!open || !voc) { setCapturing(null); setMsg(null); } }, [open, voc]);

  if (!open || !me || !voc) return null;
  const pos = stored.x < 0 ? clampPos((window.innerWidth - W) / 2 - 110, 90) : clampPos(stored.x, stored.y);
  const spells = spellsFor(voc);

  const onDragTitle = (e: PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    const sx = e.clientX - pos.x, sy = e.clientY - pos.y;
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => posStore.set(clampPos(ev.clientX - sx, ev.clientY - sy));
    const up = () => { t.removeEventListener("pointermove", move); t.removeEventListener("pointerup", up); t.removeEventListener("pointercancel", up); };
    t.addEventListener("pointermove", move);
    t.addEventListener("pointerup", up);
    t.addEventListener("pointercancel", up);
  };

  return (
    <div class="hud-card hud-window hotkeys-win" style={{ left: `${pos.x}px`, top: `${pos.y}px`, width: `${W}px` }} role="dialog" aria-label="Atalhos de magia">
      <div class="win-title" onPointerDown={onDragTitle}>
        <span class="win-grip" aria-hidden="true" />
        <span>Atalhos de magia</span>
        <button class="win-close" onClick={() => hotkeysOpen.set(false)} data-tip="Fechar" data-tip-sub="H ou Esc">×</button>
      </div>
      <div class="win-body">
        <p class="hk-hint">Clique na tecla e aperte a nova (pode usar Shift). Arrastar na barra também troca as magias de lugar.</p>
        <ul class="hk-list">
          {list.map((h, i) => (
            <li key={`${i}-${h.key}`} class="hk-row">
              <button
                class={`hk-key${capturing === i ? " capturing" : ""}`}
                aria-label={`Tecla do atalho ${i + 1}`}
                onClick={() => { setCapturing(capturing === i ? null : i); say(undefined); }}
                data-tip={capturing === i ? "Aperte a nova tecla" : "Trocar a tecla"}
                data-tip-sub="Esc cancela"
              >
                {capturing === i ? "…" : hotkeyLabel(h.key)}
              </button>
              <select
                class="hk-spell"
                aria-label={`Magia do atalho ${hotkeyLabel(h.key)}`}
                value={h.spellId}
                onChange={(e) => apply(setRowSpell(list, i, (e.currentTarget as HTMLSelectElement).value))}
              >
                {spells.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {s.words}{me.level < s.level ? ` (lv ${s.level})` : ""}
                  </option>
                ))}
              </select>
              <button class="hk-remove" aria-label={`Remover atalho ${hotkeyLabel(h.key)}`} onClick={() => apply(removeRow(list, i))} data-tip="Remover">✕</button>
            </li>
          ))}
        </ul>
        {capturing !== null && <div class="hk-capture" role="status">Pressione uma tecla… <span>(Esc cancela)</span></div>}
        {msg && <div class={`hk-msg${msg.error ? " error" : ""}`} role="status">{msg.text}</div>}
        <div class="hk-actions">
          <button
            class="hk-btn"
            disabled={list.length >= HOTKEY_MAX}
            onClick={() => { const r = addRow(list, voc); say(r.message, r.error); if (!r.error) apply(r.list); }}
          >
            + Novo atalho
          </button>
          <span class="hk-count">{list.length}/{HOTKEY_MAX}</span>
          <button class="hk-btn subtle" onClick={() => { apply(defaultHotkeys(voc)); say("Atalhos voltaram ao padrão (1–0)."); }} data-tip="Volta ao padrão" data-tip-sub="Magias da vocação nas teclas 1–0">Padrão</button>
        </div>
      </div>
    </div>
  );
}
