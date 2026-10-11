// Overlays de combate: banner de level-up e tela de morte.
import { useEffect, useState } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { deathStore, hideDeath, levelBannerStore } from "./combatUi.ts";
import "./combat.css";

const BANNER_MS = 2000;
const DEATH_KEY_DELAY_MS = 1500;

export function CombatOverlays() {
  return (
    <>
      <LevelBannerView />
      <DeathOverlay />
    </>
  );
}

function LevelBannerView() {
  const b = useStore(levelBannerStore);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!b) return;
    setShown(true);
    const t = setTimeout(() => setShown(false), b.spells.length ? BANNER_MS + 1400 : BANNER_MS);
    return () => clearTimeout(t);
  }, [b]);
  if (!b || !shown) return null;
  return (
    <div class={`level-banner${b.spells.length ? " long" : ""}`} key={b.n} aria-live="polite">
      <div class="level-banner-glow" />
      <div class="level-banner-text">Level {b.level}!</div>
      <div class="level-banner-sub">Você ficou mais forte</div>
      {b.spells.map((s, i) => (
        <div key={s} class="level-banner-spell" style={{ animationDelay: `${500 + i * 250}ms` }}>Nova magia: <b>{s}</b></div>
      ))}
    </div>
  );
}

function DeathOverlay() {
  const d = useStore(deathStore);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!d) return;
    setReady(false);
    const t = setTimeout(() => setReady(true), DEATH_KEY_DELAY_MS);
    return () => clearTimeout(t);
  }, [d]);
  useEffect(() => {
    if (!d || !ready) return;
    const onKey = (e: KeyboardEvent) => {
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      e.stopPropagation();
      hideDeath();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [d, ready]);
  if (!d) return null;
  return (
    <div class="death-overlay" role="alertdialog" aria-label="Você morreu">
      <div class="death-card">
        <div class="death-title">Você morreu</div>
        <div class="death-sub">
          Derrotado por <b>{d.killerName || "algo misterioso"}</b>
          {d.lostXp > 0 && <> · <span class="death-xp">−{d.lostXp} XP</span></>}
        </div>
        <button class={`death-btn${ready ? " ready" : ""}`} onClick={hideDeath}>Voltar</button>
        <div class="death-hint">{ready ? "Pressione qualquer tecla" : " "}</div>
      </div>
    </div>
  );
}
