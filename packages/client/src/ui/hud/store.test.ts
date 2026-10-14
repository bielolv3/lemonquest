import { describe, expect, it } from "vitest";
import { createStore, selectStore } from "./store.ts";

interface Snap { id: string; x: number; level: number }

/** Igual a world.ts: um Map novo por publicação; só quem teve patch ganha objeto novo. */
function patch(m: ReadonlyMap<string, Snap>, id: string, p: Partial<Snap>): ReadonlyMap<string, Snap> {
  const next = new Map(m);
  next.set(id, { ...m.get(id)!, ...p });
  return next;
}

describe("selectStore", () => {
  const initial = (): ReadonlyMap<string, Snap> => new Map([
    ["me", { id: "me", x: 1, level: 5 }],
    ["other", { id: "other", x: 9, level: 3 }],
  ]);

  it("não avisa quando outro jogador muda (o store de origem avisa)", () => {
    const players = createStore(initial());
    const me = selectStore(players, (m) => m.get("me") ?? null);
    let src = 0, mine = 0;
    players.subscribe(() => src++);
    me.subscribe(() => mine++);
    for (let i = 0; i < 10; i++) players.set((m) => patch(m, "other", { x: i }));
    expect(src).toBe(10);
    expect(mine).toBe(0);
  });

  it("avisa com o novo valor quando o selecionado muda; get() sempre atual", () => {
    const players = createStore(initial());
    const me = selectStore(players, (m) => m.get("me") ?? null);
    const seen: (Snap | null)[] = [];
    me.subscribe((v) => seen.push(v));
    players.set((m) => patch(m, "me", { x: 2 }));
    expect(seen.map((s) => s?.x)).toEqual([2]);
    expect(me.get()?.x).toBe(2);
    players.set(new Map());
    expect(seen.at(-1)).toBeNull();
  });

  it("encadeado: só o nível (passos do próprio jogador não avisam)", () => {
    const players = createStore(initial());
    const me = selectStore(players, (m) => m.get("me") ?? null);
    const level = selectStore(me, (s) => s?.level ?? null);
    let n = 0;
    level.subscribe(() => n++);
    players.set((m) => patch(m, "me", { x: 3 }));
    players.set((m) => patch(m, "me", { x: 4 }));
    expect(n).toBe(0);
    players.set((m) => patch(m, "me", { level: 6 }));
    expect(n).toBe(1);
  });

  it("equals customizado e desinscrição", () => {
    const s = createStore({ a: 1, b: 1 });
    const sel = selectStore(s, (v) => ({ a: v.a }), (x, y) => x.a === y.a);
    let n = 0;
    const off = sel.subscribe(() => n++);
    s.set({ a: 1, b: 2 });
    expect(n).toBe(0);
    s.set({ a: 2, b: 2 });
    expect(n).toBe(1);
    off();
    s.set({ a: 3, b: 2 });
    expect(n).toBe(1);
  });
});
