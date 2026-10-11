// Arrastar para reordenar os cards da barra lateral (pelo cabeçalho: [data-drag-handle]).
// O DOM não é reordenado durante o arraste: o card segue o ponteiro (transform), os vizinhos deslizam abrindo o vão
// (transition) e um marcador tracejado mostra o destino. Ao soltar o card assenta no vão e só então a ordem é gravada.
import { useEffect } from "preact/hooks";
import { applyVisibleOrder, dropIndex, moveItem, panelOrderStore, type PanelId } from "./panels.ts";

const THRESHOLD = 4; // px até começar a arrastar (cliques normais seguem funcionando)
const EDGE = 30; // faixa de auto-scroll nas bordas
const SETTLE_MS = 170;

interface Item { el: HTMLElement; id: PanelId; top: number; height: number }

export function usePanelDrag(asideRef: { current: HTMLElement | null }, placeholderRef: { current: HTMLElement | null }): void {
  useEffect(() => {
    const root = asideRef.current;
    if (!root) return;
    const aside: HTMLElement = root;
    let pending: { id: PanelId; el: HTMLElement; x: number; y: number; pointerId: number } | null = null;
    let drag: {
      items: Item[]; from: number; gap: number; startY: number; startScroll: number; target: number; pointerY: number;
      contentH: number; raf: number; done: boolean;
    } | null = null;

    const contentTop = (el: HTMLElement) => el.getBoundingClientRect().top - aside.getBoundingClientRect().top + aside.scrollTop;

    function onDown(e: PointerEvent) {
      if (e.button !== 0 || drag) return;
      const t = e.target as HTMLElement | null;
      const handle = t?.closest<HTMLElement>("[data-drag-handle]");
      const el = handle?.closest<HTMLElement>("[data-panel-id]");
      if (!handle || !el || !aside.contains(el)) return;
      pending = { id: el.dataset.panelId as PanelId, el, x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    }

    function begin(e: PointerEvent) {
      if (!pending) return;
      const cards = [...aside.querySelectorAll<HTMLElement>(":scope > [data-panel-id]")].filter((c) => c.getBoundingClientRect().height > 0);
      const items: Item[] = cards.map((el) => ({ el, id: el.dataset.panelId as PanelId, top: contentTop(el), height: el.getBoundingClientRect().height }));
      const from = items.findIndex((i) => i.el === pending!.el);
      if (from < 0) { pending = null; return; }
      const gap = items.length > 1 ? Math.max(0, items[1].top - (items[0].top + items[0].height)) : 6;
      drag = {
        items, from, gap, startY: pending.y, startScroll: aside.scrollTop, target: from, pointerY: e.clientY,
        contentH: aside.scrollHeight, raf: 0, done: false,
      };
      pending = null;
      aside.classList.add("reordering");
      document.documentElement.classList.add("panel-dragging");
      items[from].el.classList.add("dragging");
      // Engole o clique que o navegador dispara ao soltar sobre o botão do cabeçalho.
      const swallow = (ev: Event) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener("click", swallow, true), 250);
      layout();
      const loop = () => {
        if (!drag || drag.done) return;
        const r = aside.getBoundingClientRect();
        const y = drag.pointerY;
        const speed = y < r.top + EDGE ? -Math.min(14, (r.top + EDGE - y) / 2) : y > r.bottom - EDGE ? Math.min(14, (y - (r.bottom - EDGE)) / 2) : 0;
        if (speed) { aside.scrollTop += speed; layout(); }
        drag.raf = requestAnimationFrame(loop);
      };
      drag.raf = requestAnimationFrame(loop);
    }

    /** Posições finais (topo de cada card) se o arrastado fosse para `target`. */
    function finalTops(d: NonNullable<typeof drag>, target: number): Map<HTMLElement, number> {
      const order = moveItem(d.items, d.items[d.from], target);
      const out = new Map<HTMLElement, number>();
      let y = d.items[0].top;
      for (const it of order) { out.set(it.el, y); y += it.height + d.gap; }
      return out;
    }

    function layout() {
      const d = drag;
      if (!d) return;
      const me = d.items[d.from];
      const first = d.items[0].top;
      const last = d.items[d.items.length - 1];
      const rawDy = d.pointerY - d.startY + (aside.scrollTop - d.startScroll);
      const dy = Math.max(first - me.top, Math.min(last.top + last.height - (me.top + me.height), rawDy));
      d.target = dropIndex(d.items, d.from, me.top + me.height / 2 + dy);
      const tops = finalTops(d, d.target);
      me.el.style.transform = `translateY(${dy}px)`;
      for (const it of d.items) {
        if (it === me) continue;
        it.el.style.transform = `translateY(${(tops.get(it.el)! - it.top).toFixed(1)}px)`;
      }
      const ph = placeholderRef.current;
      if (ph) {
        ph.style.display = "block";
        ph.style.top = `${tops.get(me.el)}px`;
        ph.style.height = `${me.height}px`;
      }
    }

    function finish(commit: boolean) {
      const d = drag;
      if (!d || d.done) return;
      d.done = true;
      cancelAnimationFrame(d.raf);
      const me = d.items[d.from];
      const target = commit ? d.target : d.from;
      const tops = finalTops(d, target);
      me.el.classList.add("settling");
      me.el.style.transform = `translateY(${tops.get(me.el)! - me.top}px)`;
      for (const it of d.items) if (it !== me) it.el.style.transform = `translateY(${(tops.get(it.el)! - it.top).toFixed(1)}px)`;
      window.setTimeout(() => {
        if (commit && target !== d.from) {
          const visible = moveItem(d.items.map((i) => i.id), me.id, target);
          panelOrderStore.set((order) => applyVisibleOrder(order, visible));
        }
        // O Preact re-renderiza na microtask; limpa os transforms só depois, sem transição.
        requestAnimationFrame(() => {
          for (const it of d.items) { it.el.style.transform = ""; it.el.classList.remove("dragging", "settling"); }
          aside.classList.remove("reordering");
          document.documentElement.classList.remove("panel-dragging");
          const ph = placeholderRef.current;
          if (ph) ph.style.display = "none";
          if (drag === d) drag = null;
        });
      }, SETTLE_MS);
    }

    function onMove(e: PointerEvent) {
      if (pending && e.pointerId === pending.pointerId) {
        if (Math.hypot(e.clientX - pending.x, e.clientY - pending.y) > THRESHOLD) begin(e);
      }
      if (drag && !drag.done) {
        e.preventDefault();
        drag.pointerY = e.clientY;
        layout();
      }
    }
    function onUp() {
      pending = null;
      if (drag && !drag.done) finish(true);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape" || !drag || drag.done) return;
      e.stopPropagation();
      e.preventDefault();
      finish(false);
    }

    aside.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey, true);
    return () => {
      aside.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey, true);
      if (drag) { cancelAnimationFrame(drag.raf); document.documentElement.classList.remove("panel-dragging"); }
    };
  }, [asideRef, placeholderRef]);
}
