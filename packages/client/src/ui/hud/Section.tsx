// Seção dobrável da barra lateral (estado lembrado em localStorage). O cabeçalho é a alça de arrastar (ver Sidebar/reorder.ts)
// e leva o botão de fixar (pin) — fixados continuam visíveis com a barra recolhida.
import type { ComponentChildren } from "preact";
import { useRef } from "preact/hooks";
import { itemTipStore } from "../items/tipStore.ts";
import { PixelIcon } from "./icons.tsx";
import { panelSizesStore, resetPanelRows, rowsFromDrag, rowsToPx, setPanelRows, type SizableId } from "./panelSize.ts";
import { panelPinsStore, togglePin, type PanelId } from "./panels.ts";
import { persistedJson, useStore } from "./store.ts";

export type SectionId = "status" | "equipment" | "battle" | "backpack";

const smallScreen = typeof window !== "undefined" && window.innerHeight < 860;
export const sectionsStore = persistedJson<Record<SectionId, boolean>>("sections", {
  status: true,
  equipment: true,
  battle: true,
  backpack: !smallScreen,
});

export const PIN_TIP = "Fixar (fica visível com a barra recolhida)";

/** Botão de fixar painel (cabeçalho dos cards e do minimapa). */
export function PinButton({ id }: { id: PanelId }) {
  const pinned = useStore(panelPinsStore)[id];
  return (
    <button
      class={`pin-btn${pinned ? " on" : ""}`}
      onClick={() => togglePin(id)}
      data-tip={pinned ? "Desafixar" : PIN_TIP}
      aria-pressed={pinned}
      aria-label="Fixar painel"
    >
      <PixelIcon name="pin" size={12} />
    </button>
  );
}

interface Props {
  id: SectionId;
  title: string;
  /** Conteúdo à direita do título (contadores etc.). */
  aside?: ComponentChildren;
  /** Controles junto ao cabeçalho (não dobram a seção ao clicar). */
  controls?: ComponentChildren;
  /** Corpo de altura fixa (em linhas), com rolagem e alça de redimensionar (Batalha/Mochila). */
  size?: SizableId;
  class?: string;
  children: ComponentChildren;
}

export function Section({ id, title, aside, controls, size, class: cls, children }: Props) {
  const open = useStore(sectionsStore)[id];
  const pinned = useStore(panelPinsStore)[id];
  const toggle = () => sectionsStore.set((s) => ({ ...s, [id]: !s[id] }));
  return (
    <section class={`hud-card hud-section${open ? " open" : ""}${pinned ? " is-pinned" : ""}${cls ? ` ${cls}` : ""}`} data-panel-id={id}>
      <div class="hud-section-headrow" data-drag-handle>
        <span class="drag-grip" aria-hidden="true" />
        <button class="hud-section-head" onClick={toggle} aria-expanded={open}>
          <span class="hud-caret" aria-hidden="true" />
          <span class="hud-section-title">{title}</span>
          {aside != null && <span class="hud-section-aside">{aside}</span>}
        </button>
        {controls != null && <div class="hud-section-controls">{controls}</div>}
        <PinButton id={id} />
      </div>
      <div class="hud-section-body">
        <div class="hud-section-inner">
          <div class="hud-section-pad">
            {size ? <SizedBody id={size}>{children}</SizedBody> : children}
          </div>
        </div>
      </div>
      {size && open && <SizeGrip id={size} />}
    </section>
  );
}

/** Corpo com altura fixa (rows * linha) e rolagem interna (a roda do mouse rola a lista). */
function SizedBody({ id, children }: { id: SizableId; children: ComponentChildren }) {
  const rows = useStore(panelSizesStore)[id];
  return (
    <div class={`sized-body sized-${id}`} style={{ height: `${rowsToPx(id, rows)}px`, "--view-h": `${rowsToPx(id, rows)}px` } as any} data-sized-body onScroll={hideTips}>
      {children}
    </div>
  );
}

/** A rolagem move o conteúdo sob um tooltip já aberto: esconde-o. */
function hideTips() { itemTipStore.set(null); }

/** Alça na borda inferior: arrastar muda a altura em linhas inteiras; duplo clique volta ao padrão. */
function SizeGrip({ id }: { id: SizableId }) {
  const drag = useRef<{ y: number; rows: number } | null>(null);
  const onDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, rows: panelSizesStore.get()[id] };
    document.documentElement.classList.add("panel-resizing");
  };
  const onMove = (e: PointerEvent) => {
    const d = drag.current;
    if (d) setPanelRows(id, rowsFromDrag(id, d.rows, e.clientY - d.y));
  };
  const end = () => { drag.current = null; document.documentElement.classList.remove("panel-resizing"); };
  return (
    <div
      class="size-grip"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDblClick={() => resetPanelRows(id)}
      data-tip="Arraste para redimensionar"
      data-tip-sub="Duplo clique: tamanho padrão"
      role="separator"
      aria-orientation="horizontal"
      aria-label="Redimensionar painel"
    ><span class="size-grip-dots" aria-hidden="true" /></div>
  );
}
