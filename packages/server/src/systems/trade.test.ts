import { beforeEach, describe, expect, it, vi } from "vitest";
import { BACKPACK_SIZE, S2C, TRADE_INVITE_MS, TRADE_KEEP_RANGE, TRADE_START_RANGE, type TradeStateMsg } from "@lemonquest/shared";
import { makeItem } from "./inventory.ts";
import { invWorld } from "./m4kit.ts";
import { TradeSystem } from "./trade.ts";

function setup(over: { inArena?: (id: string) => boolean } = {}) {
  vi.spyOn(console, "log").mockImplementation(() => {});
  const w = invWorld();
  const a = w.mk("a"), b = w.mk("b");
  a.name = "Ana"; b.name = "Beto";
  const players = new Map([[a.id, a], [b.id, b]]);
  const out: { to: string; type: string; msg: any }[] = [];
  const saved: string[] = [];
  let t = 1_000_000;
  const trade = new TradeSystem({
    getPlayer: (id) => players.get(id), send: (to, type, msg) => out.push({ to, type, msg: structuredClone(msg) }),
    inventory: w.inv, inArena: over.inArena ?? (() => false), save: (id) => saved.push(id), now: () => t,
  });
  const states = (to: string) => out.filter((o) => o.to === to && o.type === S2C.Trade).map((o) => o.msg as TradeStateMsg);
  const last = (to: string) => states(to).at(-1);
  const notices = (to: string) => out.filter((o) => o.to === to && o.type === S2C.Notice).map((o) => o.msg.text as string);
  const open = () => { trade.onMessage(a, { action: "request", targetId: "b" }); trade.onMessage(b, { action: "accept" }); };
  return { w, a, b, trade, out, states, last, notices, saved, open, players, advance: (ms: number) => { t += ms; } };
}

describe("trade: convite", () => {
  it("convida, o outro aceita e a janela abre para os dois", () => {
    const s = setup();
    s.trade.onMessage(s.a, { action: "request", targetId: "b" });
    expect(s.last("b")).toEqual({ phase: "invite", fromId: "a", from: "Ana" });
    s.trade.onMessage(s.b, { action: "accept" });
    expect(s.last("a")).toMatchObject({ phase: "open", partner: "Beto" });
    expect(s.last("b")).toMatchObject({ phase: "open", partner: "Ana" });
    expect(s.trade.sessionOf("a")).toEqual({ partner: "b" });
  });

  it("recusar avisa quem convidou; convite expira; longe, a si mesmo e ocupado são recusados", () => {
    const s = setup();
    s.trade.onMessage(s.a, { action: "request", targetId: "b" });
    s.trade.onMessage(s.b, { action: "decline" });
    expect(s.last("b")).toEqual({ phase: "closed" });
    expect(s.notices("a").at(-1)).toContain("recusou");
    s.trade.onMessage(s.a, { action: "request", targetId: "b" });
    s.advance(TRADE_INVITE_MS);
    s.trade.tick();
    expect(s.notices("a").at(-1)).toContain("expirou");
    s.trade.onMessage(s.a, { action: "request", targetId: "a" });
    expect(s.notices("a").at(-1)).toContain("não encontrado");
    s.b.x = s.a.x + TRADE_START_RANGE + 1;
    s.trade.onMessage(s.a, { action: "request", targetId: "b" });
    expect(s.notices("a").at(-1)).toContain("mais perto");
    s.b.x = s.a.x;
    s.trade.onMessage(s.a, { action: "request", targetId: "b" });
    s.trade.onMessage(s.a, { action: "request", targetId: "b" }); // já tem convite pendente
    expect(s.notices("a").at(-1)).toContain("em andamento");
  });

  it("não troca no Coliseu nem morto", () => {
    const s = setup({ inArena: (id) => id === "b" });
    s.trade.onMessage(s.a, { action: "request", targetId: "b" });
    expect(s.notices("a").at(-1)).toContain("Coliseu");
    const s2 = setup();
    s2.b.hp = 0;
    s2.trade.onMessage(s2.a, { action: "request", targetId: "b" });
    expect(s2.notices("a").at(-1)).toContain("Agora não");
  });
});

describe("trade: oferta e troca", () => {
  let s: ReturnType<typeof setup>;
  const bpOf = (id: string) => s.w.inv.get(id)!.backpack;
  beforeEach(() => {
    s = setup();
    s.w.inv.addItem(s.a, makeItem("sword"));
    s.w.inv.addItem(s.b, makeItem("hp_pot", 10));
    s.w.inv.addGold(s.a, 100);
    s.open();
  });

  it("os dois ofertam, os dois confirmam e a troca acontece de uma vez (itens e ouro)", () => {
    const sword = bpOf("a")[0]!, pots = bpOf("b")[0]!;
    s.trade.onMessage(s.a, { action: "offer", items: [{ uid: sword.uid, count: 1 }], gold: 40 });
    s.trade.onMessage(s.b, { action: "offer", items: [{ uid: pots.uid, count: 4 }], gold: 0 });
    // A oferta de cada um aparece para o outro.
    expect(s.last("b")).toMatchObject({ phase: "open", theirs: { gold: 40, items: [expect.objectContaining({ defId: "sword" })] } });
    s.trade.onMessage(s.a, { action: "confirm", confirmed: true });
    expect(s.last("b")).toMatchObject({ theirs: { confirmed: true }, mine: { confirmed: false } });
    expect(bpOf("a").some((i) => i?.defId === "hp_pot")).toBe(false); // ainda não trocou
    s.trade.onMessage(s.b, { action: "confirm", confirmed: true });
    expect(s.last("a")).toEqual({ phase: "closed" });
    expect(bpOf("a").find((i) => i?.defId === "hp_pot")!.count).toBe(4);
    expect(bpOf("a").some((i) => i?.defId === "sword")).toBe(false);
    expect(bpOf("b").find((i) => i?.defId === "hp_pot")!.count).toBe(6); // ficou com a parte que não ofertou
    expect(bpOf("b").some((i) => i?.defId === "sword")).toBe(true);
    expect(s.w.inv.gold("a")).toBe(60);
    expect(s.w.inv.gold("b")).toBe(40);
    expect(s.saved.sort()).toEqual(["a", "b"]);
    expect(s.notices("a").at(-1)).toContain("Troca concluída");
  });

  it("qualquer mudança na oferta zera as confirmações", () => {
    const sword = bpOf("a")[0]!;
    s.trade.onMessage(s.a, { action: "offer", items: [{ uid: sword.uid, count: 1 }], gold: 0 });
    s.trade.onMessage(s.a, { action: "confirm", confirmed: true });
    s.trade.onMessage(s.b, { action: "offer", items: [], gold: 0 });
    expect(s.last("a")).toMatchObject({ mine: { confirmed: false }, theirs: { confirmed: false } });
    s.trade.onMessage(s.b, { action: "confirm", confirmed: true });
    expect(s.last("a")).toMatchObject({ phase: "open" }); // só um confirmou: nada acontece
  });

  it("mochila cheia: nada muda, a janela continua aberta e avisa", () => {
    for (let i = 0; i < BACKPACK_SIZE; i++) s.w.inv.addItem(s.b, makeItem("vest")); // enche a mochila de B
    const sword = bpOf("a")[0]!;
    s.trade.onMessage(s.a, { action: "offer", items: [{ uid: sword.uid, count: 1 }], gold: 0 });
    const before = JSON.stringify(bpOf("b"));
    s.trade.onMessage(s.a, { action: "confirm", confirmed: true });
    s.trade.onMessage(s.b, { action: "confirm", confirmed: true });
    expect(s.last("a")).toMatchObject({ phase: "open", mine: { confirmed: false } });
    expect(s.notices("b").at(-1)).toContain("mochila");
    expect(JSON.stringify(bpOf("b"))).toBe(before);
    expect(bpOf("a")[0]?.defId).toBe("sword");
    expect(s.saved).toEqual([]);
  });

  it("mochila cheia só de um lado, mas liberada pela própria oferta, vale", () => {
    // B cheia, mas oferece uma peça: o espaço que ela libera recebe o item de A.
    for (let i = 0; i < BACKPACK_SIZE - 1; i++) s.w.inv.addItem(s.b, makeItem("vest"));
    const vest = bpOf("b").find((i) => i?.defId === "vest")!;
    const sword = bpOf("a")[0]!;
    s.trade.onMessage(s.a, { action: "offer", items: [{ uid: sword.uid, count: 1 }], gold: 0 });
    s.trade.onMessage(s.b, { action: "offer", items: [{ uid: vest.uid, count: 1 }], gold: 0 });
    s.trade.onMessage(s.a, { action: "confirm", confirmed: true });
    s.trade.onMessage(s.b, { action: "confirm", confirmed: true });
    expect(s.last("a")).toEqual({ phase: "closed" });
    expect(bpOf("b").some((i) => i?.defId === "sword")).toBe(true);
  });

  it("recusa oferta inválida: uid alheio, contagem demais, repetido, ouro demais, itens demais", () => {
    const sword = bpOf("a")[0]!, pots = bpOf("b")[0]!;
    const bad = [
      { items: [{ uid: pots.uid, count: 1 }], gold: 0 }, // item do outro
      { items: [{ uid: sword.uid, count: 2 }], gold: 0 }, // mais do que tem
      { items: [{ uid: sword.uid, count: 1 }, { uid: sword.uid, count: 1 }], gold: 0 },
      { items: [], gold: 101 }, // ouro demais
      { items: [], gold: -5 },
      { items: [], gold: 1.5 },
      { items: Array.from({ length: 9 }, () => ({ uid: sword.uid, count: 1 })), gold: 0 },
    ];
    for (const o of bad) s.trade.onMessage(s.a, { action: "offer", ...o });
    expect(s.notices("a").filter((n) => n.includes("inválida") || n.includes("ouro")).length).toBe(bad.length);
    expect(s.last("a")).toMatchObject({ mine: { items: [], gold: 0 } });
  });

  it("item que sai da mochila depois de ofertado: a troca não é feita e a oferta vira vazia", () => {
    const sword = bpOf("a")[0]!;
    s.trade.onMessage(s.a, { action: "offer", items: [{ uid: sword.uid, count: 1 }], gold: 0 });
    s.w.inv.takeFromBackpack(s.a, 0, 1); // largou/vendeu depois de ofertar
    s.trade.onMessage(s.a, { action: "confirm", confirmed: true });
    s.trade.onMessage(s.b, { action: "confirm", confirmed: true });
    expect(s.notices("a").at(-1)).toContain("mudou");
    expect(s.last("a")).toMatchObject({ phase: "open", mine: { items: [] } });
  });
});

describe("trade: cancelamento", () => {
  it("cancelar, sair do jogo, morrer, se afastar e entrar no Coliseu fecham a troca para os dois", () => {
    for (const kill of [
      (s: ReturnType<typeof setup>) => s.trade.onMessage(s.a, { action: "cancel" }),
      (s: ReturnType<typeof setup>) => s.trade.removePlayer("a"),
      (s: ReturnType<typeof setup>) => { s.b.hp = 0; s.trade.tick(); },
      (s: ReturnType<typeof setup>) => { s.b.x = s.a.x + TRADE_KEEP_RANGE + 1; s.trade.tick(); },
    ]) {
      const s = setup();
      s.open();
      kill(s);
      expect(s.trade.sessionOf("a")).toBeUndefined();
      expect(s.last("a")).toEqual({ phase: "closed" });
      expect(s.last("b")).toEqual({ phase: "closed" });
    }
    let inArena = false;
    const s = setup({ inArena: () => inArena });
    s.open();
    inArena = true;
    s.trade.tick();
    expect(s.trade.sessionOf("b")).toBeUndefined();
  });

  it("mensagem malformada é ignorada", () => {
    const s = setup();
    s.trade.onMessage(s.a, null as any);
    s.trade.onMessage(s.a, { action: "explodir" } as any);
    s.trade.onMessage(s.a, { action: "offer", items: "x", gold: 0 } as any);
    expect(s.out).toEqual([]);
  });
});
