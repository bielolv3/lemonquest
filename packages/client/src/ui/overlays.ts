// Pilha única de sobreposições (janelas, cartões, menus): o Esc fecha sempre a ÚLTIMA aberta, e só ela.
// Antes cada janela registrava o próprio listener de Esc em captura na window: a ordem de fechamento era a de registro
// (não a visual) e uma janela registrada num useEffect ficava um frame sem listener — um Esc logo depois de abrir caía
// na cadeia do HUD e limpava o alvo em vez de fechar a janela (causa do E2E instável do diário).
// A pilha em si é pura (sem DOM) e testável; a parte de DOM (o único listener de Esc e o foco de janelas) fica no fim,
// guardada para rodar só no navegador.
import { isTyping } from "./focus.ts";
import "./overlays.css";

interface Entry {
  id: string;
  close: () => void;
  /** Seletor do elemento da sobreposição: um campo de texto focado DENTRO dele não rouba o Esc (ouro da troca). */
  within?: string;
}

const stack: Entry[] = [];

/** Registra a sobreposição no topo (reabrir = subir). Devolve a função que a tira da pilha. */
export function pushOverlay(id: string, close: () => void, within?: string): () => void {
  removeOverlay(id);
  const entry: Entry = { id, close, within };
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
  };
}

export function removeOverlay(id: string): void {
  for (let i = stack.length - 1; i >= 0; i--) if (stack[i]!.id === id) stack.splice(i, 1);
}

export function hasOverlay(id: string): boolean {
  return stack.some((e) => e.id === id);
}

/** Id da sobreposição mais recente ainda aberta (null = nenhuma). */
export function topOverlay(): string | null {
  return stack.at(-1)?.id ?? null;
}

/** Fecha a última sobreposição aberta. False com a pilha vazia (o Esc segue para seguir/alvo no HUD). */
export function closeTopOverlay(): boolean {
  const top = stack.pop();
  if (!top) return false;
  // Sai da pilha ANTES de fechar: o fechamento normalmente dispara removeOverlay (via store) e não pode fechar duas vezes.
  top.close();
  return true;
}

/** Só para testes: esvazia a pilha. */
export function resetOverlays(): void {
  stack.length = 0;
}

export interface OpenSignal<T> { get(): T; subscribe(fn: (v: T) => void): () => void }

/**
 * Liga um store ao registro na pilha de forma SÍNCRONA (no instante em que o estado "aberto" muda, antes de qualquer
 * render): entra ao abrir, sai ao fechar. Mudanças do valor com a janela já aberta (oferta da troca, novo pedido de
 * treino) não a sobem de posição. Devolve o cancelamento da assinatura.
 */
export function bindOverlay<T>(id: string, store: OpenSignal<T>, isOpen: (v: T) => boolean, close: () => void, within?: string): () => void {
  const sync = (v: T) => {
    if (!isOpen(v)) removeOverlay(id);
    else if (!hasOverlay(id)) pushOverlay(id, close, within);
  };
  sync(store.get());
  return store.subscribe(sync);
}

// ---------------------------------------------------------------------------------------------------------------------
// Parte de DOM: o único listener de Esc e o foco de janelas (clicar numa janela a traz para a frente).
// ---------------------------------------------------------------------------------------------------------------------

/** Janelas que disputam espaço entre si (as de .hud-window e as centralizadas que não usam essa classe). */
const WINDOW_SELECTOR = ".hud-window, .trade-window, .news-window, .challenges-window";
/** = z-index de .hud-window no hud.css. As focadas ficam em 30..30+n: abaixo do menu de contexto (45) e do olhar (60). */
const BASE_Z = 30;
let focusOrder: HTMLElement[] = [];

/** Traz a janela para a frente: ela vai para o fim da ordem de foco e cada janela viva recebe z-index 30 + posição. */
export function raiseWindow(el: HTMLElement): void {
  focusOrder = focusOrder.filter((w) => w !== el && w.isConnected);
  focusOrder.push(el);
  focusOrder.forEach((w, i) => { w.style.zIndex = String(BASE_Z + i); });
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || e.repeat || e.ctrlKey || e.altKey || e.metaKey) return;
    const top = stack.at(-1);
    if (!top) return;
    // Campo de texto focado (chat, quantidade): o Esc é dele — salvo se o campo fica dentro da própria sobreposição do topo.
    if (isTyping() && !(top.within && document.activeElement?.closest(top.within))) return;
    if (closeTopOverlay()) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);

  // Clicar em qualquer parte de uma janela (em captura: antes de o clique virar outra ação) a traz para a frente.
  window.addEventListener("pointerdown", (e) => {
    const win = (e.target as Element | null)?.closest?.(WINDOW_SELECTOR);
    if (win instanceof HTMLElement) raiseWindow(win);
  }, true);

  // Janela recém-aberta nasce na frente: observar o DOM dispensa cada janela de avisar que montou.
  if (document.body) {
    new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          const win = n.matches(WINDOW_SELECTOR) ? n : n.querySelector<HTMLElement>(WINDOW_SELECTOR);
          if (win) raiseWindow(win);
        }
      }
    }).observe(document.body, { childList: true, subtree: true });
  }
}
