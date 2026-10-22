import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TradeMsg, TradeStateMsg } from "@lemonquest/shared";

// Sem navegador: a sessão real abre o cliente do Colyseus (location/window).
vi.mock("../../session.ts", () => ({ session: { room: null, onRoom: () => {} } }));
import { setItemTransport } from "../items/net.ts";
import { GOLD_SEND_DELAY_MS, applyTradeState, confirmTrade, goldDraftStore, offerItem, tradeStore, typeGold } from "./trade.ts";

const open = (rev: number, gold = 0, items: { uid: string; count: number }[] = []): TradeStateMsg => ({
  phase: "open", partnerId: "b", partner: "Beto", rev,
  mine: { items: items.map((i) => ({ ...i, defId: "sword", rarity: "common", bonuses: [] })), gold, confirmed: false },
  theirs: { items: [], gold: 0, confirmed: false },
});

describe("trade (cliente): ouro digitado e versão do confirm", () => {
  let sent: TradeMsg[];
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    setItemTransport((_t, m) => sent.push(m as TradeMsg));
    applyTradeState({ phase: "closed" });
    applyTradeState(open(3, 10));
  });
  afterEach(() => vi.useRealTimers());

  it("confirmar com ouro digitado (sem sair do campo) manda a oferta antes e confirma a versão seguinte", () => {
    typeGold("40");
    confirmTrade(true);
    expect(sent).toEqual([
      { action: "offer", items: [], gold: 40 },
      { action: "confirm", confirmed: true, rev: 4 },
    ]);
    vi.advanceTimersByTime(GOLD_SEND_DELAY_MS * 2); // o envio atrasado não repete
    expect(sent).toHaveLength(2);
  });

  it("sem rascunho, confirma a versão que está vendo", () => {
    confirmTrade(true);
    expect(sent).toEqual([{ action: "confirm", confirmed: true, rev: 3 }]);
  });

  it("o ouro digitado sai sozinho depois de uma pausa; o estado do servidor limpa o rascunho (valor recusado volta)", () => {
    typeGold("999");
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(GOLD_SEND_DELAY_MS);
    expect(sent).toEqual([{ action: "offer", items: [], gold: 999 }]);
    expect(goldDraftStore.get()).toBe("999");
    applyTradeState(open(4, 10)); // servidor recusou: continua 10
    expect(goldDraftStore.get()).toBeNull();
  });

  it("estado chegando enquanto digita não apaga o rascunho; item ofertado leva o ouro digitado", () => {
    typeGold("25");
    applyTradeState(open(4, 10));
    expect(goldDraftStore.get()).toBe("25");
    offerItem({ uid: "u1", defId: "sword", count: 1, rarity: "common", bonuses: [] });
    expect(sent).toEqual([{ action: "offer", items: [{ uid: "u1", count: 1 }], gold: 25 }]);
    confirmTrade(true);
    expect(sent.at(-1)).toEqual({ action: "confirm", confirmed: true, rev: 5 });
  });

  it("oferta que se perdeu (queda/limite) não deixa o confirm adiantado: o próximo estado realinha a versão", () => {
    typeGold("40");
    vi.advanceTimersByTime(GOLD_SEND_DELAY_MS); // oferta enviada (rev esperada 4)… e perdida no caminho
    expect(sent).toEqual([{ action: "offer", items: [], gold: 40 }]);
    applyTradeState(open(3, 10)); // o servidor nunca viu a oferta: continua na 3 (ex.: reenvio da reconexão)
    expect(goldDraftStore.get()).toBeNull(); // o campo volta ao valor real (10)
    sent = [];
    confirmTrade(true);
    expect(sent).toEqual([{ action: "confirm", confirmed: true, rev: 3 }]);
  });

  it("troca fechada zera a versão enviada e o rascunho", () => {
    typeGold("5");
    confirmTrade(true); // rev 4 enviada
    applyTradeState({ phase: "closed" });
    expect(tradeStore.get().phase).toBe("closed");
    expect(goldDraftStore.get()).toBeNull();
    applyTradeState(open(0));
    sent = [];
    confirmTrade(true);
    expect(sent).toEqual([{ action: "confirm", confirmed: true, rev: 0 }]);
  });
});
