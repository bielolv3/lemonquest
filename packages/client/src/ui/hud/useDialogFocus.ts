// Foco das janelas (UX-09): ao abrir, o foco vai para o botão de fechar (ou o primeiro controle) — leitor de tela e
// teclado entram na janela em vez de ficarem no jogo; ao fechar, volta para o jogo (#game), salvo se o jogador já
// clicou em outro lugar (chat, outra janela). O Enter continua abrindo o chat: o listener do chat cancela o keydown
// antes de o botão focado "clicar" (ver useNoButtonFocus em Hud.tsx).
import { useEffect } from "preact/hooks";

/** Botões de fechar das janelas (classes diferentes por histórico), depois qualquer controle. */
const CLOSE = ".win-close, .trade-x, .news-x, .ch-x";
const FOCUSABLE = "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/** Devolve o foco ao jogo: tira do controle atual e põe no contêiner do canvas (tabindex -1, sem contorno — styles.css). */
export function focusGame(): void {
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) active.blur();
  const game = document.getElementById("game");
  if (!game) return;
  if (!game.hasAttribute("tabindex")) game.tabIndex = -1;
  game.focus({ preventScroll: true });
}

/**
 * `ref`: raiz da janela. `open`: false enquanto a janela está fechada (componentes que só montam abertos passam só o ref).
 * Roda depois do render: a janela já está no DOM quando o foco é movido.
 */
export function useDialogFocus(ref: { current: HTMLElement | null }, open = true): void {
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(CLOSE) ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el;
    if (target === el && !el.hasAttribute("tabindex")) el.tabIndex = -1;
    target.focus({ preventScroll: true });
    return () => {
      // Ao fechar, o botão focado some do DOM e o foco cai no body: devolve ao jogo. Foco já em outro lugar fica lá.
      const active = document.activeElement;
      if (!active || active === document.body || el.contains(active)) focusGame();
    };
  }, [open]);
}
