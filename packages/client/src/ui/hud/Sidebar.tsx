// Barra lateral direita (minimapa, personagem, equipamento, batalha, mochila) + trilho de botões.
import type { ComponentChild } from "preact";
import { useEffect, useRef } from "preact/hooks";
import { Minimap } from "../minimap/Minimap.tsx";
import { Backpack } from "./Backpack.tsx";
import { BattleList } from "./BattleList.tsx";
import { EquipmentPanel } from "./EquipmentPanel.tsx";
import { HelpPopover } from "./HelpPopover.tsx";
import { mutedStore } from "../../game/sfx.ts";
import { PixelIcon } from "./icons.tsx";
import { setHudInsets } from "./layout.ts";
import { panelOrderStore, panelPinsStore, type PanelId } from "./panels.ts";
import { usePanelDrag } from "./reorder.ts";
import { PinButton } from "./Section.tsx";
import { StatBar } from "./StatBar.tsx";
import { Portrait, StatusPanel } from "./StatusPanel.tsx";
import { useStore } from "./store.ts";
import { outfitOpen, toggleOutfit } from "../outfit/outfit.ts";
import { helpOpen, NARROW_PX, sidebarOpen, SIDEBAR_GAP, SIDEBAR_W, skillsOpen, toggle } from "./uiState.ts";
import { playersStore, selectMe } from "./world.ts";

export function Sidebar() {
  const open = useStore(sidebarOpen);
  const skills = useStore(skillsOpen);
  const help = useStore(helpOpen);
  const muted = useStore(mutedStore);
  const outfit = useStore(outfitOpen);

  const order = useStore(panelOrderStore);
  const pins = useStore(panelPinsStore);
  const anyPinned = order.some((id) => pins[id]);
  const pinnedOnly = !open && anyPinned;
  const showVitals = !open && !pins.status;

  // Recolhida com painéis fixados, a coluna fica à esquerda do trilho: a câmera deve descontá-la também.
  useEffect(() => {
    setHudInsets({ right: open ? SIDEBAR_W + SIDEBAR_GAP : pinnedOnly ? PINNED_RIGHT + SIDEBAR_W + SIDEBAR_GAP : 0 });
  }, [open, pinnedOnly]);

  const asideRef = useRef<HTMLElement>(null);
  const phRef = useRef<HTMLDivElement>(null);
  usePanelDrag(asideRef, phRef);

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
        <button class={`rail-btn${outfit ? " active" : ""}`} onClick={toggleOutfit} data-tip="Roupas" data-tip-sub="Tecla O">
          <PixelIcon name="shirt" size={14} />
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
      {showVitals && <CompactVitals />}
      <aside
        ref={asideRef}
        class={`hud-panel${pinnedOnly ? " pinned-only" : ""}${showVitals ? " with-vitals" : ""}`}
        aria-hidden={!open && !pinnedOnly}
        inert={!open && !pinnedOnly}
      >
        {order.map((id) => PANELS[id])}
        <div class="panel-ph" ref={phRef} aria-hidden="true" />
      </aside>
    </div>
  );
}

/** Direita da coluna de fixados com a barra recolhida: margem (8) + trilho (34) + folga (6). */
const PINNED_RIGHT = 48;

function MinimapCard() {
  const pinned = useStore(panelPinsStore).minimap;
  return (
    <div class={`hud-card minimap-card${pinned ? " is-pinned" : ""}`} data-panel-id="minimap">
      <div class="minimap-handle" data-drag-handle>
        <span class="drag-grip h" aria-hidden="true" />
        <PinButton id="minimap" />
      </div>
      <div class="minimap-slot"><Minimap /></div>
    </div>
  );
}

const PANELS: Record<PanelId, ComponentChild> = {
  minimap: <MinimapCard key="minimap" />,
  status: <StatusPanel key="status" />,
  equipment: <EquipmentPanel key="equipment" />,
  battle: <BattleList key="battle" />,
  backpack: <Backpack key="backpack" />,
};

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
