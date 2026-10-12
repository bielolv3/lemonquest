// Itens no chão (estilo Tibia): largar da mochila/equipamento num tile (≤ 3 tiles, linha livre) ou no próprio,
// pegar de volta (alcance 1, qualquer jogador), sumir com o tempo (10/20 min) e receber o loot que não coube
// (protegido para quem matou por 60 s). Estado sincronizado: state.groundItems (sem bônus); a instância completa
// fica aqui. SÓ EM MEMÓRIA: reiniciar o servidor apaga o que estiver no chão.
import {
  RARITY_LABEL, S2C,
  type DiscardItemMsg, type DropFrom, type DropItemMsg, type ItemInstance, type NoticeMsg, type PickupItemMsg, type Rarity,
} from "@lemonquest/shared";
import { GroundItemState, type PlayerState } from "../state.ts";
import { PerSecond } from "../persistence/ratelimit.ts";
import { GOLD_ID, maxStackOf, newUid, type InventorySystem } from "./inventory.ts";

/** Distância máxima (Chebyshev) para largar num tile que não seja o próprio. */
export const DROP_RANGE = 3;
/** Distância máxima (Chebyshev) para pegar. */
export const PICKUP_RANGE = 1;
export const MAX_PER_TILE = 15;
export const MAX_GROUND_ITEMS = 2000;
/** Tempo no chão até sumir. */
export const DECAY_MS: Record<Rarity, number> = {
  common: 10 * 60_000, uncommon: 10 * 60_000, rare: 20 * 60_000, epic: 20 * 60_000, legendary: 20 * 60_000,
};
/** Loot que não coube: só quem matou pode pegar durante este tempo. */
export const LOOT_PROTECT_MS = 60_000;
/** Mensagens por segundo (largar + pegar, cada um). Excesso descartado em silêncio. */
export const GROUND_RATE = 10;
const SWEEP_MS = 1000;
const LOG_RARITIES: Rarity[] = ["epic", "legendary"];

export const GROUND_MSG = {
  tileFull: "Não cabe mais nada aqui.",
  full: "Mochila cheia.",
  notYours: "Esse item ainda não é seu.",
} as const;

export interface GroundEntry {
  state: GroundItemState;
  item: ItemInstance;
  expiresAt: number;
  /** Nome (minúsculo) de quem tem prioridade até ownerUntil. */
  owner?: string;
  ownerUntil?: number;
}

/** Coleção sincronizada (MapSchema no jogo, Map nos testes). */
export interface GroundCollection {
  set(k: string, v: GroundItemState): unknown;
  delete(k: string): unknown;
  get(k: string): GroundItemState | undefined;
}

export interface GroundOptions {
  inventory: InventorySystem;
  collection: GroundCollection;
  /** Tile onde um item pode ficar (andável, sem NPC/portal...). */
  canHold: (x: number, y: number) => boolean;
  /** A linha de visão passa por este tile? (grade de colisão). */
  seeThrough: (x: number, y: number) => boolean;
  send: (sessionId: string, type: string, msg: unknown) => void;
  now?: () => number;
  log?: (msg: string) => void;
}

export const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const isInt = (n: unknown): n is number => Number.isInteger(n);
const tileKey = (x: number, y: number) => `${x},${y}`;
const ownerKey = (p: PlayerState) => p.name.toLowerCase();

/** Bresenham: true se todos os tiles ENTRE a e b (exclusive) deixam passar. */
export function lineClear(ax: number, ay: number, bx: number, by: number, pass: (x: number, y: number) => boolean): boolean {
  let x = ax, y = ay;
  const dx = Math.abs(bx - ax), dy = -Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1, sy = ay < by ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x === bx && y === by) return true;
    if ((x !== ax || y !== ay) && !pass(x, y)) return false;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

export class GroundSystem {
  private readonly entries = new Map<string, GroundEntry>(); // ordem de inserção = mais antigo primeiro
  private readonly tiles = new Map<string, string[]>();       // tile → ids (último = topo)
  private readonly limiter: PerSecond;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;
  private nextSweep = 0;
  private seq = 0;

  constructor(private readonly o: GroundOptions) {
    this.now = o.now ?? Date.now;
    this.log = o.log ?? ((m) => console.log(m));
    this.limiter = new PerSecond(this.now);
  }

  get size(): number { return this.entries.size; }
  get(id: string): GroundEntry | undefined { return this.entries.get(id); }
  /** Ids no tile (último = topo). */
  at(x: number, y: number): readonly string[] { return this.tiles.get(tileKey(x, y)) ?? []; }
  all(): IterableIterator<GroundEntry> { return this.entries.values(); }

  // --- mensagens ----------------------------------------------------------------------

  /** C2S.DropItem */
  onDrop(p: PlayerState, msg: DropItemMsg): void {
    if (!msg || typeof msg !== "object" || p.hp <= 0) return;
    if (!this.limiter.allow(`${p.id}:drop`, GROUND_RATE)) return;
    if (msg.count !== undefined && msg.count !== null && (!isInt(msg.count) || msg.count < 1)) return;
    this.dropFrom(p, msg.from, isInt(msg.x) ? msg.x : p.x, isInt(msg.y) ? msg.y : p.y, msg.count ?? undefined);
  }

  /** C2S.DiscardItem (compatibilidade): larga a pilha inteira da mochila no próprio tile. */
  onDiscard(p: PlayerState, msg: DiscardItemMsg): void {
    if (!msg || typeof msg !== "object" || p.hp <= 0) return;
    if (!this.limiter.allow(`${p.id}:drop`, GROUND_RATE)) return;
    this.dropFrom(p, { where: "backpack", index: msg.index }, p.x, p.y);
  }

  /** C2S.PickupItem */
  onPickup(p: PlayerState, msg: PickupItemMsg): void {
    if (!msg || typeof msg !== "object" || typeof msg.groundId !== "string" || p.hp <= 0) return;
    if (!this.limiter.allow(`${p.id}:pickup`, GROUND_RATE)) return;
    const e = this.entries.get(msg.groundId);
    if (!e) return; // já pegaram / sumiu: silencioso
    if (cheb(p.x, p.y, e.state.x, e.state.y) > PICKUP_RANGE) return;
    const now = this.now();
    if (e.owner && (e.ownerUntil ?? 0) > now && e.owner !== ownerKey(p)) return this.warn(p, GROUND_MSG.notYours);
    const to = msg.to && typeof msg.to === "object" ? msg.to : undefined;
    const n = e.item.count;
    const left = this.o.inventory.placePickup(p, e.item, to);
    if (left >= n) return this.warn(p, GROUND_MSG.full);
    if (left > 0) {
      // Parte coube: o resto continua no chão (uid novo para não repetir o que entrou na mochila).
      e.item = { ...e.item, uid: newUid(), count: left, bonuses: e.item.bonuses.map((b) => ({ ...b })) };
      e.state.count = left;
      this.warn(p, GROUND_MSG.full);
    } else {
      this.remove(e.state.id);
    }
    if (LOG_RARITIES.includes(e.item.rarity)) this.log(`[ground] ${p.name} pegou ${e.item.defId} (${e.item.rarity}) em ${e.state.x},${e.state.y}`);
  }

  // --- API ----------------------------------------------------------------------------

  /**
   * Coloca um item no chão em (x,y). `owner` = só esse jogador pega até `ownerMs`. Empilha em cima de uma pilha
   * igual sem dono. Retorna o id (ou undefined se o tile está cheio/inválido).
   */
  place(item: ItemInstance, x: number, y: number, owner?: { name: string; ms: number }): string | undefined {
    if (!this.o.canHold(x, y) || item.count < 1) return undefined;
    const now = this.now();
    const ids = this.at(x, y);
    const d = this.o.inventory.defs(item.defId);
    if (!d) return undefined;
    // Empilha no topo se for o mesmo item empilhável (e nenhum dos dois tiver dono).
    const topId = ids[ids.length - 1];
    const top = topId ? this.entries.get(topId) : undefined;
    if (top && !owner && !(top.owner && (top.ownerUntil ?? 0) > now) && d.stackable
      && top.item.defId === item.defId && top.item.rarity === item.rarity && top.item.count + item.count <= maxStackOf(d)) {
      top.item.count += item.count;
      top.state.count = top.item.count;
      top.expiresAt = now + DECAY_MS[item.rarity];
      return top.state.id;
    }
    if (ids.length >= MAX_PER_TILE) return undefined;
    while (this.entries.size >= MAX_GROUND_ITEMS) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.remove(oldest);
    }
    const s = new GroundItemState();
    s.id = `g${(++this.seq).toString(36)}`;
    s.defId = item.defId;
    s.count = item.count;
    s.rarity = item.rarity;
    s.x = x;
    s.y = y;
    const e: GroundEntry = { state: s, item, expiresAt: now + (DECAY_MS[item.rarity] ?? DECAY_MS.common) };
    if (owner) { e.owner = owner.name.toLowerCase(); e.ownerUntil = now + owner.ms; }
    this.entries.set(s.id, e);
    const k = tileKey(x, y);
    const list = this.tiles.get(k);
    if (list) list.push(s.id); else this.tiles.set(k, [s.id]);
    this.o.collection.set(s.id, s);
    return s.id;
  }

  /** Loot que não coube: no tile de quem matou (ou vizinho), protegido por LOOT_PROTECT_MS. */
  placeLoot(p: PlayerState, item: ItemInstance): boolean {
    const owner = { name: p.name, ms: LOOT_PROTECT_MS };
    if (this.place(item, p.x, p.y, owner)) return true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if ((dx || dy) && this.place(item, p.x + dx, p.y + dy, owner)) return true;
    }
    return false;
  }

  remove(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    this.entries.delete(id);
    const k = tileKey(e.state.x, e.state.y);
    const list = this.tiles.get(k);
    if (list) {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
      if (!list.length) this.tiles.delete(k);
    }
    this.o.collection.delete(id);
  }

  /** Some com o que passou do tempo (varre 1×/s). */
  tick(now = this.now()): void {
    if (now < this.nextSweep) return;
    this.nextSweep = now + SWEEP_MS;
    for (const [id, e] of this.entries) if (e.expiresAt <= now) this.remove(id);
  }

  removePlayer(id: string): void { this.limiter.clearPrefix(`${id}:`); }

  // --- internos -----------------------------------------------------------------------

  /** Tile onde o item cai: o pedido se válido (alcance, linha livre, pode ficar), senão o do jogador. */
  dropTile(p: PlayerState, x: number, y: number): { x: number; y: number } {
    if (cheb(p.x, p.y, x, y) <= DROP_RANGE && this.o.canHold(x, y) && lineClear(p.x, p.y, x, y, this.o.seeThrough)) return { x, y };
    return { x: p.x, y: p.y };
  }

  private dropFrom(p: PlayerState, from: DropFrom, x: number, y: number, count?: number): void {
    if (!from || typeof from !== "object" || (from.where !== "backpack" && from.where !== "equip")) return;
    const it = this.o.inventory.peekAt(p.id, from);
    if (!it || it.defId === GOLD_ID) return;
    const n = count === undefined ? it.count : count;
    if (n > it.count) return;
    const t = this.dropTile(p, x, y);
    if (!this.o.canHold(t.x, t.y)) return this.warn(p, GROUND_MSG.tileFull);
    if (!this.fits(t.x, t.y, it.defId, it.rarity, n)) return this.warn(p, GROUND_MSG.tileFull);
    const taken = this.o.inventory.takeForDrop(p, from, n);
    if (!taken) return;
    const id = this.place(taken, t.x, t.y);
    if (!id) {
      // Não deveria acontecer (checado acima): devolve para não perder nada.
      this.o.inventory.placePickup(p, taken);
      return this.warn(p, GROUND_MSG.tileFull);
    }
    if (LOG_RARITIES.includes(taken.rarity)) {
      const name = this.o.inventory.defs(taken.defId)?.name ?? taken.defId;
      this.log(`[ground] ${p.name} largou ${name} (${RARITY_LABEL[taken.rarity]}) em ${t.x},${t.y}`);
    }
  }

  /** Cabe no tile? (empilha no topo ou há vaga). */
  private fits(x: number, y: number, defId: string, rarity: Rarity, n: number): boolean {
    const ids = this.at(x, y);
    if (ids.length < MAX_PER_TILE) return true;
    const top = this.entries.get(ids[ids.length - 1]!);
    const d = this.o.inventory.defs(defId);
    const now = this.now();
    return !!top && !!d?.stackable && !(top.owner && (top.ownerUntil ?? 0) > now)
      && top.item.defId === defId && top.item.rarity === rarity && top.item.count + n <= maxStackOf(d);
  }

  private warn(p: PlayerState, text: string): void {
    this.o.send(p.id, S2C.Notice, { text, kind: "warn" } satisfies NoticeMsg);
  }
}
