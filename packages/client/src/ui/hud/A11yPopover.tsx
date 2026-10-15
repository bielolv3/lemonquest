// Acessibilidade: tamanho do texto, alto contraste e animações reduzidas. Abre pelo botão "Aa" do trilho.
import { useEffect, useRef } from "preact/hooks";
import { a11yStore } from "../a11y/a11y.ts";
import { TEXT_LABELS, type TextSize } from "../a11y/a11yLogic.ts";
import { useStore } from "./store.ts";
import { a11yOpen } from "./uiState.ts";

export function A11yPopover() {
  const el = useRef<HTMLDivElement>(null);
  const s = useStore(a11yStore);

  // Clique fora fecha (o botão do trilho alterna sozinho).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (el.current?.contains(t) || (t as HTMLElement).closest?.(".hud-rail")) return;
      a11yOpen.set(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const release = (e: Event) => (e.currentTarget as HTMLElement).blur();
  return (
    <div class="hud-card help-pop sound-pop" ref={el} role="dialog" aria-label="Acessibilidade">
      <div class="help-title">Acessibilidade</div>
      <label class="sound-row">
        <span>Texto</span>
        <input
          type="range" min={0} max={2} step={1} value={s.text} aria-label="Tamanho do texto"
          onInput={(e) => a11yStore.set({ ...a11yStore.get(), text: Number((e.currentTarget as HTMLInputElement).value) as TextSize })}
          onChange={release} onPointerUp={release}
        />
        <b>{TEXT_LABELS[s.text]}</b>
      </label>
      <label class="sound-row">
        <input type="checkbox" checked={s.contrast} onChange={(e) => { a11yStore.set({ ...a11yStore.get(), contrast: (e.currentTarget as HTMLInputElement).checked }); release(e); }} />
        <span>Alto contraste</span>
      </label>
      <label class="sound-row">
        <input type="checkbox" checked={s.motion} onChange={(e) => { a11yStore.set({ ...a11yStore.get(), motion: (e.currentTarget as HTMLInputElement).checked }); release(e); }} />
        <span>Reduzir animações</span>
      </label>
      <div class="auto-potion-note">O texto maior vale para chat, avisos, NPCs, missões e janelas de leitura.</div>
    </div>
  );
}
