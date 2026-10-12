// HUD da partida do coliseu (topo, centro): contagem 3-2-1, "Onda 7 · 5 monstros", pausa com "Pronto", faixa de onda e
// cartão de resultado.
import { useEffect, useState } from "preact/hooks";
import { ARENA_MAX_WAVE } from "@lemonquest/shared";
import { session } from "../../session.ts";
import { useStore } from "../hud/store.ts";
import { arenaAction, arenaBannerStore, arenaResultStore, arenaStateStore, phaseRemaining } from "./arena.ts";
import { useTicker } from "./useTicker.ts";
import "./arena.css";

const fmt = (n: number) => n.toLocaleString("pt-BR");

export function ArenaHud() {
  return (
    <>
      <MatchBar />
      <WaveBanner />
      <ResultCard />
    </>
  );
}

function MatchBar() {
  const st = useStore(arenaStateStore);
  const phase = st?.s.phase;
  useTicker(phase === "countdown" || phase === "pause" || phase === "queued" ? 200 : 0);
  if (!st) return null;
  const s = st.s;
  const left = phaseRemaining(st);
  const secs = Math.ceil(left / 1000);
  // Contagem dentro da arena: números grandes.
  if (s.phase === "countdown" && s.arenaId && s.wave === 0 && left > 0 && secs <= 3) {
    return <div class="arena-count" key={secs}>{secs}</div>;
  }
  if (!s.arenaId) {
    if (s.phase === "countdown") return <div class="arena-bar">Entrando no Coliseu em <b>{secs}</b> s</div>;
    return (
      <div class="arena-bar small">
        Coliseu · {s.phase === "queued" ? "na fila, aguardando uma arena" : `grupo ${s.members.length}/4 — fique perto do Mestre`}
      </div>
    );
  }
  if (s.phase === "countdown") return <div class="arena-bar">Prepare-se… <b>{secs}</b></div>;
  if (s.phase === "fight") {
    const boss = s.wave % 5 === 0;
    return (
      <div class={`arena-bar${boss ? " boss" : ""}`}>
        <span>Onda <b>{s.wave}</b>/{ARENA_MAX_WAVE}</span>
        <span class="sep">·</span>
        <span>{s.monstersLeft ?? 0} {s.monstersLeft === 1 ? "monstro" : "monstros"}</span>
        <button class="arena-mini" onClick={() => { if (confirm("Desistir do Coliseu? Você fica com o que já ganhou.")) arenaAction({ action: "leave" }); }} data-tip="Desistir">⚑</button>
      </div>
    );
  }
  if (s.phase === "pause") {
    const me = s.members.find((m) => m.name === session.myName);
    return (
      <div class="arena-bar pause">
        <div class="arena-pause-row">
          <span>Pausa · <b>{secs}</b> s</span>
          <button class={`arena-btn primary${me?.ready ? " done" : ""}`} disabled={!me?.alive || me?.ready} onClick={() => arenaAction({ action: "ready" })}>
            {me?.ready ? "Pronto ✓" : "Pronto"}
          </button>
        </div>
        <div class="arena-pause-members">
          {s.members.map((m) => (
            <span key={m.name} class={m.alive ? "" : "out"}>{m.ready ? "✓" : m.alive ? "…" : "✗"} {m.name}</span>
          ))}
        </div>
        <div class="arena-pause-hint">Próxima: onda {s.wave + 1}{(s.wave + 1) % 5 === 0 ? " (chefe!)" : ""} · Vendedor do Coliseu aberto · ganho: {fmt(s.earned.xp)} XP, {fmt(s.earned.gold)} ouro</div>
      </div>
    );
  }
  return null;
}

function WaveBanner() {
  const b = useStore(arenaBannerStore);
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!b) return;
    setShow(true);
    const t = window.setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(t);
  }, [b?.nonce]);
  if (!b || !show) return null;
  return (
    <div class={`arena-banner${b.boss ? " boss" : ""}`} key={b.nonce}>
      {b.boss ? `Onda ${b.wave} — Chefe!` : `Onda ${b.wave}!`}
    </div>
  );
}

const REASON: Record<string, string> = {
  wiped: "Você caiu na arena",
  gave_up: "Você saiu do Coliseu",
  completed: "Coliseu conquistado!",
};

function ResultCard() {
  const r = useStore(arenaResultStore);
  if (!r) return null;
  return (
    <div class="hud-card arena-result" role="dialog" aria-label="Resultado do Coliseu">
      <div class="arena-result-title">{REASON[r.reason] ?? "Fim da partida"}</div>
      <div class="arena-result-waves">{r.wavesCleared} {r.wavesCleared === 1 ? "onda vencida" : "ondas vencidas"}</div>
      <div class="arena-result-grid">
        <span>XP</span><b>+{fmt(r.xp)}</b>
        <span>Ouro</span><b class="gold">+{fmt(r.gold)}</b>
        <span>Recorde</span><b>{r.best}{r.best === r.wavesCleared && r.wavesCleared > 0 ? " ★" : ""}</b>
      </div>
      {r.reason === "wiped" && <div class="arena-result-hint">Sem penalidade: a recompensa das ondas vencidas é sua.</div>}
      <button class="arena-btn primary" onClick={() => arenaResultStore.set(null)}>Fechar</button>
    </div>
  );
}
