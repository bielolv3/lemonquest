// Barra lateral direita (minimapa, personagem, equipamento, batalha, mochila) + trilho de botões.
import { useEffect } from "preact/hooks";
import { Minimap } from "../minimap/Minimap.tsx";
import { Backpack } from "./Backpack.tsx";
import { BattleList } from "./BattleList.tsx";
import { EquipmentPanel } from "./EquipmentPanel.tsx";
import { HelpPopover } from "./HelpPopover.tsx";
import { mutedStore } from "../../game/sfx.ts";
import { PixelIcon } from "./icons.tsx";
import { setHudInsets } from "./layout.ts";
import { StatBar } from "./StatBar.tsx";
import { Portrait, StatusPanel } from "./StatusPanel.tsx";
import { useStore } from "./store.ts";
import { helpOpen, NARROW_PX, sidebarOpen, SIDEBAR_GAP, SIDEBAR_W, skillsOpen, toggle } from "./uiState.ts";
import { playersStore, selectMe } from "./world.ts";

export function Sidebar() {
  const open = useStore(sidebarOpen);
  const skills = useStore(skillsOpen);
  const help = useStore(helpOpen);
  const muted = useStore(mutedStore);

  useEffect(() => {
    setHudInsets({ right: open ? SIDEBAR_W + SIDEBAR_GAP : 0 });
  }, [open]);

  // Ao estreitar a janela abaixo do limite, recolhe (uma vez por cruzamento).
  useEffect(() => {
    let wasNarrow = window.innerWidth < NARROW_PX;
    const onResize = () => {
      const narrow = window.innerWidth < NARROW_PX;
      if (narrow && !wasNarrow) sidebarOpen.set(false);
      wasNarrow = narrow;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div class={`hud-side${open ? " open" : ""}`}>
      <nav class="hud-rail" aria-label="Painéis">
        <button
          class="rail-btn"
          onClick={() => toggle(sidebarOpen)}
          data-tip={open ? "Recolher painel" : "Abrir painel"}
          aria-expanded={open}
        >
          <span class={`rail-chevron${open ? "" : " flip"}`} aria-hidden="true" />
        </button>
        <span class="rail-sep" />
        <button class={`rail-btn${skills ? " active" : ""}`} onClick={() => toggle(skillsOpen)} data-tip="Habilidades" data-tip-sub="Tecla K">
          <PixelIcon name="chart" size={14} />
        </button>
        <button class="rail-btn" onClick={openWorldMap} data-tip="Mapa do mundo" data-tip-sub="Tecla M">
          <PixelIcon name="map" size={14} />
        </button>
        <button class={`rail-btn${help ? " active" : ""}`} onClick={() => toggle(helpOpen)} data-tip="Atalhos" data-tip-sub="Tecla ?">
          <span class="rail-q">?</span>
        </button>
        <button class={`rail-btn${muted ? "" : " active"}`} onClick={() => mutedStore.set((m) => !m)} data-tip={muted ? "Som desligado" : "Som ligado"} data-tip-sub="Clique para alternar">
          <span class="rail-q">{muted ? "×" : "♪"}</span>
        </button>
        {help && <HelpPopover />}
      </nav>
      {!open && <CompactVitals />}
      <aside class="hud-panel" aria-hidden={!open} inert={!open}>
        <div class="hud-card minimap-card">
          <div class="minimap-slot"><Minimap /></div>
        </div>
        <StatusPanel />
        <EquipmentPanel />
        <BattleList />
        <Backpack />
      </aside>
    </div>
  );
}

/** O mapa-múndi (ui/minimap) alterna com a tecla M num listener de window; reutilizamos o mesmo caminho. */
function openWorldMap() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "m", code: "KeyM" }));
}

/** Mini HP/mana quando o painel está recolhido. */
function CompactVitals() {
  const me = selectMe(useStore(playersStore));
  if (!me) return null;
  return (
    <div class="hud-card compact-vitals" onClick={() => sidebarOpen.set(true)} data-tip="Abrir painel">
      <Portrait me={me} size={40} />
      <div class="compact-bars">
        <StatBar kind="hp" value={me.hp} max={me.maxHp} text={`${me.hp}`} />
        <StatBar kind="mana" value={me.mana} max={me.maxMana} text={`${me.mana}`} />
      </div>
    </div>
  );
}
