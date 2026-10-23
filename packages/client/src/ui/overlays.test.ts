import { afterEach, describe, expect, it } from "vitest";
import { createStore } from "./hud/store.ts";
import { bindOverlay, closeTopOverlay, hasOverlay, pushOverlay, removeOverlay, resetOverlays, topOverlay } from "./overlays.ts";

describe("pilha de sobreposições", () => {
  afterEach(resetOverlays);

  it("pilha vazia: nada no topo e closeTopOverlay devolve false", () => {
    expect(topOverlay()).toBeNull();
    expect(closeTopOverlay()).toBe(false);
  });

  it("fecha sempre a última aberta, na ordem inversa da abertura", () => {
    const closed: string[] = [];
    pushOverlay("diario", () => closed.push("diario"));
    pushOverlay("desafios", () => closed.push("desafios"));
    pushOverlay("olhar", () => closed.push("olhar"));
    expect(topOverlay()).toBe("olhar");
    expect(closeTopOverlay()).toBe(true);
    expect(closeTopOverlay()).toBe(true);
    expect(closed).toEqual(["olhar", "desafios"]);
    expect(topOverlay()).toBe("diario");
  });

  it("remover no meio (fechada pelo ×) não muda a ordem das outras", () => {
    const closed: string[] = [];
    pushOverlay("a", () => closed.push("a"));
    const offB = pushOverlay("b", () => closed.push("b"));
    pushOverlay("c", () => closed.push("c"));
    offB();
    expect(hasOverlay("b")).toBe(false);
    closeTopOverlay();
    closeTopOverlay();
    expect(closed).toEqual(["c", "a"]);
    expect(closeTopOverlay()).toBe(false);
    offB(); // remover de novo é inofensivo
  });

  it("reabrir uma sobreposição já registrada a sobe para o topo; removeOverlay tira pelo id", () => {
    pushOverlay("a", () => {});
    pushOverlay("b", () => {});
    pushOverlay("a", () => {});
    expect(topOverlay()).toBe("a");
    removeOverlay("a");
    expect(topOverlay()).toBe("b");
    expect(hasOverlay("a")).toBe(false);
  });

  it("fechar pelo topo não fecha duas vezes mesmo que o fechamento remova pelo id", () => {
    let n = 0;
    pushOverlay("x", () => { n++; removeOverlay("x"); });
    expect(closeTopOverlay()).toBe(true);
    expect(n).toBe(1);
    expect(closeTopOverlay()).toBe(false);
  });

  it("bindOverlay: entra ao abrir, sai ao fechar, e mudanças com a janela aberta não a sobem", () => {
    const trade = createStore<{ phase: "closed" | "open"; rev: number }>({ phase: "closed", rev: 0 });
    const help = createStore(false);
    const cancelled: string[] = [];
    bindOverlay("trade", trade, (s) => s.phase === "open", () => { cancelled.push("trade"); trade.set({ phase: "closed", rev: 0 }); }, ".trade-window");
    bindOverlay("help", help, (v) => v, () => help.set(false));
    expect(topOverlay()).toBeNull();
    trade.set({ phase: "open", rev: 1 });
    help.set(true);
    trade.set({ phase: "open", rev: 2 }); // a oferta mudou: a troca continua embaixo da ajuda
    expect(topOverlay()).toBe("help");
    expect(closeTopOverlay()).toBe(true);
    expect(help.get()).toBe(false);
    expect(hasOverlay("help")).toBe(false);
    expect(closeTopOverlay()).toBe(true);
    expect(cancelled).toEqual(["trade"]);
    expect(trade.get().phase).toBe("closed");
    expect(hasOverlay("trade")).toBe(false);
    expect(closeTopOverlay()).toBe(false);
  });

  it("bindOverlay: store já aberto no momento de ligar entra na pilha", () => {
    const s = createStore(true);
    bindOverlay("s", s, (v) => v, () => s.set(false));
    expect(topOverlay()).toBe("s");
    s.set(false);
    expect(topOverlay()).toBeNull();
  });
});
