// Battle list: entrada genérica + fontes externas (M2 publica monstros aqui).
import { createStore, type Unsubscribe } from "./store.ts";
import type { PlayerSnap } from "./world.ts";

export const BATTLE_RANGE = 10;

export interface BattleEntry {
  id: string;
  name: string;
  /** 0..100 */
  hpPct: number;
  kind: "player" | "monster";
  /** Distância em tiles (Chebyshev) até o jogador local. */
  distance: number;
  /** Cor de destaque opcional (ex.: vocação). */
  color?: string;
}

/** Posição genérica de algo no mapa, para quem publica entradas a partir do estado. */
export interface Positioned { id: string; name: string; x: number; y: number; hp: number; maxHp: number }

export const chebyshev = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export const hpPct = (hp: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, Math.round((hp / max) * 100))) : 0);

/** Fontes extras (ex.: "monsters") → entradas já calculadas. */
const sources = createStore<Record<string, BattleEntry[]>>({});
export const battleSourcesStore = sources;

/**
 * Publica/atualiza as entradas de uma fonte (ex.: setBattleEntries("monsters", lista)).
 * Use toBattleEntries() para filtrar por alcance e calcular distância.
 */
export function setBattleEntries(source: string, entries: BattleEntry[]): void {
  sources.set((s) => ({ ...s, [source]: entries }));
}
export function clearBattleEntries(source: string): void {
  sources.set((s) => { const n = { ...s }; delete n[source]; return n; });
}
export const subscribeBattleSources = (fn: () => void): Unsubscribe => sources.subscribe(fn);

/** Converte uma lista de coisas posicionadas em entradas dentro do alcance de (x,y). */
export function toBattleEntries(items: Iterable<Positioned>, kind: BattleEntry["kind"], me: { x: number; y: number }, range = BATTLE_RANGE): BattleEntry[] {
  const out: BattleEntry[] = [];
  for (const it of items) {
    const d = chebyshev(it.x, it.y, me.x, me.y);
    if (d <= range) out.push({ id: it.id, name: it.name, hpPct: hpPct(it.hp, it.maxHp), kind, distance: d });
  }
  return out;
}

/** Monta a lista final: jogadores próximos (exceto eu) + fontes extras, ordenada por distância. */
export function buildBattleList(players: ReadonlyMap<string, PlayerSnap>, myId: string, extra: Record<string, BattleEntry[]>, range = BATTLE_RANGE): BattleEntry[] {
  const me = players.get(myId);
  if (!me) return [];
  const others = [...players.values()].filter((p) => p.id !== myId);
  const list = toBattleEntries(others, "player", me, range);
  for (const src of Object.values(extra)) list.push(...src.filter((e) => e.distance <= range));
  return list.sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name));
}
