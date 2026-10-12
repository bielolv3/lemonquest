// Minimapa com fog of war, mapa-múndi em tela cheia (tecla M) e banner de zona.
import { useEffect, useRef, useState } from "preact/hooks";
import { C2S, type WalkToMsg } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { isTyping } from "../focus.ts";
import { minimapStore as store } from "./store.ts";
import { clockLabel, phaseAt, ambientForZone, darknessOf, PHASE_LABEL } from "@lemonquest/shared";
import { worldClock } from "../../game/daynight.ts";
import { LIGHT_LEVELS, lightLevelStore, useLightLevel } from "../../game/lighting.ts";
import "./minimap.css";

/** Hora do mundo + ícone sol/lua + seletor "Efeitos de luz" (alto/baixo/desligado). */
function DayClock() {
  const [, tick] = useState(0);
  const [open, setOpen] = useState(false);
  const level = useLightLevel();
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 1000); return () => clearInterval(t); }, []);
  const now = worldClock.now();
  const { phase } = phaseAt(now);
  const night = phase === "night" || phase === "dusk";
  return (
    <div class="daynight">
      <button class="daynight-btn" onClick={() => setOpen((o) => !o)} title="Efeitos de luz" data-testid="daynight">
        <span class={`dn-icon ${night ? "moon" : "sun"}`} aria-hidden="true" />
        <span class="dn-label">{PHASE_LABEL[phase]}</span>
        <span class="dn-time">{clockLabel(now)}</span>
      </button>
      {open && (
        <div class="daynight-pop hud-card" role="dialog" aria-label="Efeitos de luz">
          <div class="help-title">Efeitos de luz</div>
          {LIGHT_LEVELS.map((l) => (
            <button key={l.id} class={`dn-opt${level === l.id ? " active" : ""}`} onClick={() => lightLevelStore.set(l.id)} title={l.hint}>{l.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const BG = "#07080c";
const FRAME_MS = 66; // ~15 fps
const ZOOM_MIN = 1;
const ZOOM_MAX = 4;
const ZOOM_KEY = "lemonquest.minimap.zoom";

function loadZoom(): number {
  const z = Number(localStorage.getItem(ZOOM_KEY));
  return z >= ZOOM_MIN && z <= ZOOM_MAX ? Math.round(z) : 3;
}

/** Hook: nome da zona atual (null fora de qualquer zona). */
function useZoneName(): string | null {
  const [name, setName] = useState(store.zoneName);
  useEffect(() => store.subscribeZone(() => setName(store.zoneName)), []);
  return name;
}

interface View { sx: number; sy: number; tiles: number }

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const zoomRef = useRef(loadZoom());
  const viewRef = useRef<View>({ sx: 0, sy: 0, tiles: 1 });
  const [zoom, setZoom] = useState(zoomRef.current);
  const zone = useZoneName();
  const [nightK, setNightK] = useState(0);
  const lvl = useLightLevel();
  useEffect(() => {
    const f = () => setNightK(lvl === "off" ? 0 : darknessOf(ambientForZone(worldClock.now(), store.zoneName)) * 0.5);
    f(); const t = setInterval(f, 2000); return () => clearInterval(t);
  }, [lvl]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const fit = () => {
      const px = Math.max(1, Math.round(canvas.clientWidth * (window.devicePixelRatio || 1)));
      if (canvas.width !== px) { canvas.width = px; canvas.height = px; }
    };
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);
    fit();

    const draw = (t: number) => {
      const S = canvas.width;
      const dpr = window.devicePixelRatio || 1;
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, S, S);
      const me = store.me;
      if (!store.ready || !store.base || !me) return;
      const ppt = zoomRef.current * dpr; // pixels de tela por tile
      const tiles = S / ppt;
      const sx = me.x + 0.5 - tiles / 2;
      const sy = me.y + 0.5 - tiles / 2;
      viewRef.current = { sx, sy, tiles };
      ctx.drawImage(store.base, sx, sy, tiles, tiles, 0, 0, S, S);
      if (store.fog) {
        ctx.imageSmoothingEnabled = true; // suaviza a fronteira da névoa
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(store.fog, sx, sy, tiles, tiles, 0, 0, S, S);
      }
      // Outros jogadores (só em tiles explorados).
      ctx.fillStyle = "#ffd447";
      ctx.strokeStyle = "rgba(0,0,0,.7)";
      ctx.lineWidth = dpr;
      const rOther = Math.max(1.5 * dpr, ppt * 0.45);
      for (const o of store.others.values()) {
        if (!store.mask?.has(o.x, o.y)) continue;
        const x = (o.x + 0.5 - sx) * ppt, y = (o.y + 0.5 - sy) * ppt;
        if (x < 0 || y < 0 || x > S || y > S) continue;
        ctx.beginPath(); ctx.arc(x, y, rOther, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
      // Jogador local: ponto branco com pulso discreto.
      const c = S / 2;
      const pulse = (Math.sin(t / 380) + 1) / 2;
      const r = Math.max(2 * dpr, ppt * 0.55);
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * (1 - pulse)})`;
      ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.arc(c, c, r + (1 + pulse * 3) * dpr, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.strokeStyle = "rgba(0,0,0,.8)";
      ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    };

    const timer = setInterval(() => draw(performance.now()), FRAME_MS);
    draw(performance.now());
    return () => { clearInterval(timer); ro.disconnect(); };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current + (e.deltaY < 0 ? 1 : -1)));
      if (z === zoomRef.current) return;
      zoomRef.current = z;
      localStorage.setItem(ZOOM_KEY, String(z));
      setZoom(z);
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, []);

  const onClick = (e: MouseEvent) => {
    const room = session.room;
    if (!room || !store.ready) return;
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    const v = viewRef.current;
    const x = Math.floor(v.sx + ((e.clientX - rect.left) / rect.width) * v.tiles);
    const y = Math.floor(v.sy + ((e.clientY - rect.top) / rect.height) * v.tiles);
    if (x < 0 || y < 0 || x >= store.width || y >= store.height) return;
    room.send(C2S.WalkTo, { x, y } satisfies WalkToMsg);
  };

  return (
    <div class="minimap">
      <div class="minimap-box panel">
        <canvas ref={canvasRef} class="minimap-canvas" onClick={onClick} title="Clique para andar até lá" />
        <span class="minimap-zoom">{zoom}x</span>
        <div class="minimap-night" style={{ opacity: nightK }} />
      </div>
      <div class="minimap-zone">{zone && <span key={zone} class="minimap-zone-name">{zone}</span>}</div>
      <DayClock />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mapa-múndi (tecla M)
// ---------------------------------------------------------------------------

export function WorldMapOverlay() {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") { setOpen(false); return; }
      if ((e.key === "m" || e.key === "M") && !isTyping()) { e.preventDefault(); setOpen((o) => !o); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let labels = store.visibleZoneLabels();
    let labelsVersion = store.version;

    const draw = () => {
      const t = performance.now();
      if (!store.ready || !store.base) return;
      const dpr = window.devicePixelRatio || 1;
      const availW = window.innerWidth - 48, availH = window.innerHeight - 110;
      // Escala inteira (pixels nítidos) para caber na janela.
      const scale = Math.max(1, Math.floor(Math.min(availW / store.width, availH / store.height) * dpr)) ;
      const W = store.width * scale, H = store.height * scale;
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W; canvas.height = H;
        canvas.style.width = `${W / dpr}px`; canvas.style.height = `${H / dpr}px`;
      }
      if (labelsVersion !== store.version) { labels = store.visibleZoneLabels(); labelsVersion = store.version; }
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(store.base, 0, 0, W, H);
      if (store.fog) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(store.fog, 0, 0, W, H);
      }
      // Rótulos das zonas já visitadas.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${Math.round(14 * dpr)}px "Pixelify Sans", monospace`;
      ctx.lineJoin = "round";
      ctx.lineWidth = 4 * dpr;
      for (const l of labels) {
        const x = l.x * scale, y = l.y * scale;
        ctx.strokeStyle = "rgba(7,8,12,.9)";
        ctx.strokeText(l.name, x, y);
        ctx.fillStyle = "#f3e6b8";
        ctx.fillText(l.name, x, y);
      }
      // Jogador.
      const me = store.me;
      if (me) {
        const x = (me.x + 0.5) * scale, y = (me.y + 0.5) * scale;
        const pulse = (Math.sin(t / 380) + 1) / 2;
        ctx.strokeStyle = `rgba(255,255,255,${0.6 * (1 - pulse)})`;
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(x, y, (5 + pulse * 6) * dpr, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(x, y, 4 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    };
    draw();
    const timer = setInterval(draw, FRAME_MS);
    return () => clearInterval(timer);
  }, [open]);

  if (!open) return null;
  return (
    <div class="worldmap" onClick={() => setOpen(false)}>
      <div class="worldmap-title">Mapa do Mundo</div>
      <canvas ref={canvasRef} class="worldmap-canvas" onClick={(e) => e.stopPropagation()} />
      <div class="worldmap-legend">
        <span class="dot dot-me" /> Você
        <span class="sep">·</span> Áreas escuras ainda não foram exploradas
        <span class="sep">·</span> M ou Esc para fechar
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Banner ao entrar numa zona
// ---------------------------------------------------------------------------

const BANNER_MS = 2400;

export function ZoneBanner() {
  const [banner, setBanner] = useState<{ name: string; id: number } | null>(null);

  useEffect(() => {
    let id = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const name = store.zoneName;
      clearTimeout(timer);
      if (!name) { setBanner(null); return; }
      setBanner({ name, id: ++id });
      timer = setTimeout(() => setBanner(null), BANNER_MS);
    };
    if (store.zoneName) check();
    const off = store.subscribeZone(check);
    return () => { off(); clearTimeout(timer); };
  }, []);

  if (!banner) return null;
  return <div key={banner.id} class="zone-banner">{banner.name}</div>;
}
