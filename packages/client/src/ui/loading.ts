// Tela de carregamento (overlay #boot do index.html) + loja de progresso REAL.
// Fontes de progresso: fontes web, loader do Phaser (mapa, tilesets, sprites) e montagem do mapa (create).
// Fases: "boot" (página -> mapa renderizado) e "enter" (personagem escolhido -> câmera sobre o jogador).
import { useEffect, useState } from "preact/hooks";

type Phase = "boot" | "enter" | "off";
type Part = "fonts" | "files" | "create";

/** Peso de cada fonte de progresso na barra (soma 1). */
const WEIGHT: Record<Part, number> = { fonts: 0.05, files: 0.8, create: 0.15 };
const MIN_VISIBLE_MS = 700; // evita um "piscar" quando tudo vem do cache
const FADE_MS = 500;
const STALL_MS = 2500; // sem progresso por isto -> brilho indeterminado
const LOGIN_SAFETY_MS = 15_000; // o login aparece de qualquer jeito (mapa segue carregando por trás)
const ENTER_SAFETY_MS = 10_000;

const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let el: HTMLElement | null = null;
let fillEl: HTMLElement | null = null;
let statusEl: HTMLElement | null = null;

let phase: Phase = "boot";
let phaseStart = performance.now();
const parts: Record<Part, number> = { fonts: 0, files: 0, create: 0 };
let mapReadyFlag = false; // mapa criado e 1º frame renderizado
let loginGate = false; // o Login pode aparecer
let displayed = 0;
let lastTarget = 0;
let lastChange = performance.now();
let failed = false;
let enterDone = false;
let raf = 0;
let hideTimer = 0;
let lastFrame = 0;

const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };

function setLoginGate() { if (!loginGate) { loginGate = true; emit(); } }

function target(): number {
  if (phase === "enter") {
    if (enterDone) return 1;
    const t = (performance.now() - phaseStart) / 1000;
    return 0.9 * (1 - Math.exp(-t / 1.6)); // sobe devagar e nunca "chega" sozinho
  }
  return Math.min(1, parts.fonts * WEIGHT.fonts + parts.files * WEIGHT.files + parts.create * WEIGHT.create);
}

function setLabel(text: string) { if (statusEl && statusEl.textContent !== text) statusEl.textContent = text; }

function paint() {
  if (fillEl) fillEl.style.width = `${(displayed * 100).toFixed(2)}%`;
}

function tick(now: number) {
  raf = 0;
  if (phase === "off" || failed) return;
  const dt = Math.min(0.1, (now - (lastFrame || now)) / 1000);
  lastFrame = now;

  const t = Math.max(lastTarget, target()); // a meta nunca recua (total do loader cresce quando entram os tilesets)
  if (t > lastTarget + 0.0005) { lastTarget = t; lastChange = now; }
  // Suaviza o movimento; nunca anda para trás.
  const next = reduceMotion() ? t : displayed + (t - displayed) * (1 - Math.exp(-dt * 7));
  displayed = Math.max(displayed, Math.min(t, next));
  paint();
  el?.classList.toggle("stalled", now - lastChange > STALL_MS && t < 1);

  const elapsed = now - phaseStart;
  const complete = phase === "boot" ? mapReadyFlag : enterDone;
  if (complete && displayed >= 0.995 && elapsed >= MIN_VISIBLE_MS) { finish(); return; }
  if (phase === "boot" && elapsed > LOGIN_SAFETY_MS) { setLoginGate(); finish(); return; }
  if (phase === "enter" && elapsed > ENTER_SAFETY_MS) { finish(); return; }
  schedule();
}

function schedule() { if (!raf) raf = requestAnimationFrame(tick); }

function finish() {
  if (phase === "boot") setLoginGate();
  phase = "off";
  displayed = 1; paint();
  el?.classList.remove("stalled");
  el?.classList.add("hide");
  clearTimeout(hideTimer);
  hideTimer = window.setTimeout(() => { if (phase === "off" && el) el.hidden = true; }, FADE_MS + 60);
}

function start(p: "enter", label: string) {
  if (!el) return;
  clearTimeout(hideTimer);
  phase = p; phaseStart = performance.now();
  enterDone = false; displayed = 0; lastTarget = 0; lastChange = phaseStart; lastFrame = 0;
  setLabel(label);
  paint();
  el.hidden = false;
  el.classList.remove("failed", "stalled");
  void el.offsetWidth; // reflow: reinicia a transição de opacidade
  el.classList.remove("hide");
  schedule();
}

export const loading = {
  /** Liga o overlay do index.html. Chamar uma vez, o mais cedo possível. */
  init() {
    el = document.getElementById("boot");
    if (!el) { phase = "off"; setLoginGate(); return; }
    fillEl = el.querySelector(".boot-fill");
    statusEl = el.querySelector(".boot-status");
    if (el.classList.contains("failed")) failed = true;
    setLabel("Carregando fontes…");
    // Fonte pixel (Google Fonts, não bloqueante): conta no progresso mas nunca trava por mais de 4 s.
    const fonts = document.fonts;
    if (fonts?.load) {
      const done = () => { parts.fonts = 1; };
      Promise.race([
        Promise.all([fonts.load('600 16px "Pixelify Sans"'), fonts.ready]),
        new Promise((r) => setTimeout(r, 4000)),
      ]).then(done, done);
    } else parts.fonts = 1;
    schedule();
  },

  /** Progresso de uma fonte (0..1). */
  report(part: Part, fraction: number, label?: string) {
    parts[part] = Math.max(parts[part], Math.min(1, fraction));
    if (label && phase === "boot" && !mapReadyFlag) setLabel(label);
    schedule();
  },

  /** Mapa criado e primeiro frame renderizado: some o overlay e o Login aparece. */
  mapReady() {
    parts.create = 1; parts.files = 1; parts.fonts = 1;
    mapReadyFlag = true;
    if (phase === "boot") setLabel("Pronto!");
    schedule();
  },

  /** Falha de rede/arquivo: mensagem amigável com "Tentar de novo". */
  fail() {
    if (phase === "off" && mapReadyFlag) return; // erro tardio (ex.: som) não derruba um jogo já aberto
    failed = true;
    el?.classList.remove("hide");
    if (el) el.hidden = false;
    el?.classList.add("failed");
    setLoginGate(); // sem mapa não há por que segurar o login: o overlay de erro cobre a tela
  },

  /** Personagem escolhido: "Entrando no mundo…" até a sala chegar e a câmera estar no jogador. */
  enterWorld() { start("enter", "Entrando no mundo…"); },
  /** Falha ao entrar (senha/rede/personagem online): devolve a tela ao login. */
  cancelEnter() { if (phase === "enter") finish(); },
  /** Jogador criado e câmera posicionada. */
  worldReady() { if (phase === "enter") { enterDone = true; setLabel("Pronto!"); schedule(); } },

  subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
  get loginReady() { return loginGate; },
};

/** true quando o Login pode ser mostrado (mapa pronto ou 15 s de segurança). */
export function useLoginReady(): boolean {
  const [ready, setReady] = useState(loading.loginReady);
  useEffect(() => { setReady(loading.loginReady); return loading.subscribe(() => setReady(loading.loginReady)); }, []);
  return ready;
}
