// Som: volume (0–100%, lembrado) e mudo. Abre pelo botão ♪ do trilho.
import { useEffect, useRef } from "preact/hooks";
import { mutedStore, sfx, volumeStore } from "../../game/sfx.ts";
import { useStore } from "./store.ts";
import { soundOpen } from "./uiState.ts";

export function SoundPopover() {
  const el = useRef<HTMLDivElement>(null);
  const muted = useStore(mutedStore);
  const volume = useStore(volumeStore).volume;

  // Clique fora fecha (o próprio botão ♪ alterna sozinho).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (el.current?.contains(t) || (t as HTMLElement).closest?.(".hud-rail")) return;
      soundOpen.set(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Solta o foco depois de mexer: com o controle focado, as setas mudariam o volume em vez de andar.
  const release = (e: Event) => (e.currentTarget as HTMLElement).blur();

  return (
    <div class="hud-card help-pop sound-pop" ref={el} role="dialog" aria-label="Som">
      <div class="help-title">Som</div>
      <label class="sound-row">
        <span>Volume</span>
        <input
          type="range" min={0} max={100} step={5} value={volume} disabled={muted} aria-label="Volume"
          onInput={(e) => volumeStore.set({ volume: Number((e.currentTarget as HTMLInputElement).value) })}
          onChange={(e) => { release(e); sfx.play("xp"); }}
          onPointerUp={release}
        />
        <b>{volume}%</b>
      </label>
      <label class="sound-row">
        <input type="checkbox" checked={muted} onChange={(e) => { mutedStore.set((e.currentTarget as HTMLInputElement).checked); release(e); }} />
        <span>Mudo</span>
      </label>
    </div>
  );
}
