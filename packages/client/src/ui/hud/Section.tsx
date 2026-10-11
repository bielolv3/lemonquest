// Seção dobrável da barra lateral (estado lembrado em localStorage). O cabeçalho é a alça de arrastar (ver Sidebar/reorder.ts)
// e leva o botão de fixar (pin) — fixados continuam visíveis com a barra recolhida.
import type { ComponentChildren } from "preact";
import { PixelIcon } from "./icons.tsx";
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
  class?: string;
  children: ComponentChildren;
}

export function Section({ id, title, aside, controls, class: cls, children }: Props) {
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
        <div class="hud-section-inner"><div class="hud-section-pad">{children}</div></div>
      </div>
    </section>
  );
}
