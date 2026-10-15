// Poção automática: bebe sozinha a poção de vida/mana abaixo do limite escolhido. Abre pelo botão ⚗ do trilho.
import { useEffect, useRef } from "preact/hooks";
import { AUTO_POTION_MAX, autoPotionStore } from "../items/autoPotion.ts";
import { useStore } from "./store.ts";
import { autoOpen } from "./uiState.ts";

export function AutoPotionPopover() {
  const el = useRef<HTMLDivElement>(null);
  const s = useStore(autoPotionStore);

  // Clique fora fecha (o botão do trilho alterna sozinho).
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (el.current?.contains(t) || (t as HTMLElement).closest?.(".hud-rail")) return;
      autoOpen.set(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Solta o foco depois de mexer: com o controle focado, as setas mudariam o valor em vez de andar.
  const release = (e: Event) => (e.currentTarget as HTMLElement).blur();
  const row = (label: string, key: "hp" | "mana") => (
    <label class="sound-row">
      <span>{label}</span>
      <input
        type="range" min={0} max={AUTO_POTION_MAX} step={5} value={s[key]} aria-label={`Limite de ${label.toLowerCase()}`}
        onInput={(e) => autoPotionStore.set({ ...autoPotionStore.get(), [key]: Number((e.currentTarget as HTMLInputElement).value) })}
        onChange={release} onPointerUp={release}
      />
      <b>{s[key] === 0 ? "Off" : `${s[key]}%`}</b>
    </label>
  );

  return (
    <div class="hud-card help-pop sound-pop" ref={el} role="dialog" aria-label="Poção automática">
      <div class="help-title">Poção automática</div>
      {row("Vida", "hp")}
      {row("Mana", "mana")}
      <div class="auto-potion-note">Bebe a primeira poção da mochila quando o valor cai até o limite. A recarga de 1 s continua valendo.</div>
    </div>
  );
}
