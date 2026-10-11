// Seção dobrável da barra lateral (estado lembrado em localStorage).
import type { ComponentChildren } from "preact";
import { persistedJson, useStore } from "./store.ts";

export type SectionId = "status" | "equipment" | "battle" | "backpack";

const smallScreen = typeof window !== "undefined" && window.innerHeight < 860;
export const sectionsStore = persistedJson<Record<SectionId, boolean>>("sections", {
  status: true,
  equipment: true,
  battle: true,
  backpack: !smallScreen,
});

interface Props {
  id: SectionId;
  title: string;
  /** Conteúdo à direita do título (contadores etc.). */
  aside?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
}

export function Section({ id, title, aside, class: cls, children }: Props) {
  const open = useStore(sectionsStore)[id];
  const toggle = () => sectionsStore.set((s) => ({ ...s, [id]: !s[id] }));
  return (
    <section class={`hud-card hud-section${open ? " open" : ""}${cls ? ` ${cls}` : ""}`}>
      <button class="hud-section-head" onClick={toggle} aria-expanded={open}>
        <span class="hud-caret" aria-hidden="true" />
        <span class="hud-section-title">{title}</span>
        {aside != null && <span class="hud-section-aside">{aside}</span>}
      </button>
      <div class="hud-section-body">
        <div class="hud-section-inner"><div class="hud-section-pad">{children}</div></div>
      </div>
    </section>
  );
}
