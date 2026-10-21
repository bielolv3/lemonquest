// Itens no chão (estilo Tibia): largar da mochila/equipamento num tile (≤ 3 tiles, linha livre) ou no próprio,
// mover de um tile para outro (arrastar no mundo), pegar de volta (alcance 1, qualquer jogador), sumir com o tempo
// (10/20 min) e receber loot protegido por 60 s: o que não coube na mochila (só quem matou) e o loot de grupo (qualquer
// membro do grupo de quem matou). Estado sincronizado: state.groundItems (sem bônus); a instância completa
// fica aqui. Persistência (`store`, opcional): grava a lista inteira (com debounce) quando algo muda e no desligamento;
// no boot, `restore()` recarrega descartando o que já expirou (o relógio do decay é o de parede: o tempo com o
// servidor desligado também conta).
import {
  RARITY_LABEL, S2C, lineOfSight,
  type DiscardItemMsg, type DropFrom, type DropItemMsg, type ItemInstance, type MoveGroundItemMsg, type NoticeMsg, type PickupItemMsg,
  type Rarity,
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
  /** Grupo (party id) com prioridade até ownerUntil: qualquer membro pega. Só em memória (grupos não sobrevivem ao reinício). */
  ownerParty?: string;
  ownerUntil?: number;
}

/** Prioridade de quem pode pegar/mover um item protegido: nome (minúsculo) e/ou grupo, por `ms`. */
export interface GroundOwner { name?: string; party?: string; ms: number }

/** Coleção sincronizada (MapSchema no jogo, Map nos testes). */
export interface GroundCollection {
  set(k: string, v: GroundItemState): unknown;
  delete(k: string): unknown;
  get(k: string): GroundItemState | undefined;
}

export interface GroundRecord { x: number; y: number; item: ItemInstance; expiresAt: number; owner?: string; ownerUntil?: number }
/** Armazenamento dos itens do chão (o jogo usa o SQLite; os testes, um array). */
export interface GroundStore {
  load(): GroundRecord[];
  save(rows: GroundRecord[]): void;
}
/** Intervalo mínimo entre gravações. */
export const SAVE_DEBOUNCE_MS = 5000;

export interface GroundOptions {
  store?: GroundStore;
  inventory: InventorySystem;
  collection: GroundCollection;
  /** Tile onde um item pode ficar (andável, sem NPC/portal...). */
  canHold: (x: number, y: number) => boolean;
  /** A linha de visão passa por este tile? (grade de colisão). */
  seeThrough: (x: number, y: number) => boolean;
  send: (sessionId: string, type: string, msg: unknown) => void;
  now?: () => number;
  log?: (msg: string) => void;
  /** Conquistas: o jogador largou / pegou um item. */
  onDropped?: (p: PlayerState) => void;
  onPickedUp?: (p: PlayerState) => void;
  /** Grupo (party id) atual do jogador, para o loot de grupo. Ausente = sem grupos. */
  partyIdOf?: (p: PlayerState) => string | undefined;
}

export const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));
const isInt = (n: unknown): n is number => Number.isInteger(n);
const tileKey = (x: number, y: number) => `${x},${y}`;
const ownerKey = (p: PlayerState) => p.name.toLowerCase();
/** Ainda protegido (dono por nome ou por grupo dentro do prazo)? */
const isProtected = (e: GroundEntry, now: number) => !!(e.owner || e.ownerParty) && (e.ownerUntil ?? 0) > now;

/** Linha livre para arremessar (mesma regra da linha de visão de combate/magias: `lineOfSight` do shared). */
export const lineClear = lineOfSight;

export class GroundSystem {
  private readonly entries = new Map<string, GroundEntry>(); // ordem de inserção = mais antigo primeiro
  private readonly tiles = new Map<string, string[]>();       // tile → ids (último = topo)
  private readonly limiter: PerSecond;
  private readonly now: () => number;
  private readonly log: (msg: string) => void;
  private nextSweep = 0;
  private seq = 0;
  private dirty = false;
  private lastSave = 0;

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
    if (!this.mayTake(e, p)) return this.warn(p, GROUND_MSG.notYours);
    const to = msg.to && typeof msg.to === "object" ? msg.to : undefined;
    const n = e.item.count;
    const left = this.o.inventory.placePickup(p, e.item, to);
    if (left >= n) return this.warn(p, GROUND_MSG.full);
    if (left > 0) {
      // Parte coube: o resto continua no chão (uid novo para não repetir o que entrou na mochila).
      e.item = { ...e.item, uid: newUid(), count: left, bonuses: e.item.bonuses.map((b) => ({ ...b })) };
      e.state.count = left;
      this.dirty = true;
      this.warn(p, GROUND_MSG.full);
    } else {
      this.remove(e.state.id);
    }
    this.o.onPickedUp?.(p);
    if (LOG_RARITIES.includes(e.item.rarity)) this.log(`[ground] ${p.name} pegou ${e.item.defId} (${e.item.rarity}) em ${e.state.x},${e.state.y}`);
  }

  // --- API ----------------------------------------------------------------------------

  /**
   * Coloca um item no chão em (x,y). `owner` = só esse jogador/grupo pega por `ms`. Empilha em cima de uma pilha
   * igual sem dono. Retorna o id (ou undefined se o tile está cheio/inválido).
   */
  place(item: ItemInstance, x: number, y: number, owner?: GroundOwner): string | undefined {
    if (!this.o.canHold(x, y) || item.count < 1) return undefined;
    const now = this.now();
    const ids = this.at(x, y);
    const d = this.o.inventory.defs(item.defId);
    if (!d) return undefined;
    // Empilha no topo se for o mesmo item empilhável (e nenhum dos dois tiver dono).
    const topId = ids[ids.length - 1];
    const top = topId ? this.entries.get(topId) : undefined;
    if (top && !owner && !isProtected(top, now) && d.stackable
      && top.item.defId === item.defId && top.item.rarity === item.rarity && top.item.count + item.count <= maxStackOf(d)) {
      top.item.count += item.count;
      top.state.count = top.item.count;
      top.expiresAt = now + DECAY_MS[item.rarity];
      this.dirty = true;
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
    if (owner) {
      if (owner.name) e.owner = owner.name.toLowerCase();
      if (owner.party) e.ownerParty = owner.party;
      e.ownerUntil = now + owner.ms;
    }
    this.entries.set(s.id, e);
    const k = tileKey(x, y);
    const list = this.tiles.get(k);
    if (list) list.push(s.id); else this.tiles.set(k, [s.id]);
    this.o.collection.set(s.id, s);
    this.dirty = true;
    return s.id;
  }

  /** Loot que não coube: no tile de quem matou (ou vizinho), protegido por LOOT_PROTECT_MS. */
  placeLoot(p: PlayerState, item: ItemInstance): boolean {
    return !!this.placeNear(item, p.x, p.y, { name: p.name, ms: LOOT_PROTECT_MS });
  }

  /** Coloca em (x,y) ou no tile livre mais perto (até 2 de distância). Retorna o id (undefined = não coube). */
  placeNear(item: ItemInstance, x: number, y: number, owner?: GroundOwner): string | undefined {
    for (let r = 0; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const id = this.place(item, x + dx, y + dy, owner);
        if (id) return id;
      }
    }
    return undefined;
  }

  /** Pode pegar/mover? Sem proteção (ou vencida): qualquer um. Protegido: o dono pelo nome ou alguém do grupo dono. */
  mayTake(e: GroundEntry, p: PlayerState, now = this.now()): boolean {
    if (!isProtected(e, now)) return true;
    if (e.owner && e.owner === ownerKey(p)) return true;
    return !!e.ownerParty && this.o.partyIdOf?.(p) === e.ownerParty;
  }

  /**
   * C2S.MoveGroundItem: arrasta um item do chão para outro tile. O item tem de estar a até DROP_RANGE do jogador com
   * linha livre, e o destino segue a regra de largar (alcance, linha livre, tile que segura item). Protegido de outro
   * não mexe. O tempo até sumir não reinicia (mover não deixa o item eterno).
   */
  onMoveGround(p: PlayerState, msg: MoveGroundItemMsg): void {
    if (!msg || typeof msg !== "object" || typeof msg.groundId !== "string" || p.hp <= 0) return;
    if (!isInt(msg.x) || !isInt(msg.y)) return;
    if (msg.count !== undefined && msg.count !== null && (!isInt(msg.count) || msg.count < 1)) return;
    if (!this.limiter.allow(`${p.id}:drop`, GROUND_RATE)) return;
    const e = this.entries.get(msg.groundId);
    if (!e) return;
    const { x: sx, y: sy } = e.state;
    if (cheb(p.x, p.y, sx, sy) > DROP_RANGE || !lineClear(p.x, p.y, sx, sy, this.o.seeThrough)) return;
    if (!this.mayTake(e, p)) return this.warn(p, GROUND_MSG.notYours);
    if (msg.x === sx && msg.y === sy) return;
    if (cheb(p.x, p.y, msg.x, msg.y) > DROP_RANGE || !this.o.canHold(msg.x, msg.y) || !lineClear(p.x, p.y, msg.x, msg.y, this.o.seeThrough)) return;
    const n = Math.min(msg.count ?? e.item.count, e.item.count);
    if (!this.fits(msg.x, msg.y, e.item.defId, e.item.rarity, n)) return this.warn(p, GROUND_MSG.tileFull);
    const now = this.now();
    const owner: GroundOwner | undefined = isProtected(e, now)
      ? { name: e.owner, party: e.ownerParty, ms: (e.ownerUntil ?? now) - now } : undefined;
    const whole = n >= e.item.count;
    const moving: ItemInstance = whole ? e.item : { ...e.item, uid: newUid(), count: n, bonuses: e.item.bonuses.map((b) => ({ ...b })) };
    const expiresAt = e.expiresAt;
    if (whole) this.remove(e.state.id);
    const id = this.place(moving, msg.x, msg.y, owner);
    if (!id) {
      // Não deveria acontecer (checado acima): devolve ao tile de origem.
      if (whole) { const back = this.place(moving, sx, sy, owner); const b = back ? this.entries.get(back) : undefined; if (b) b.expiresAt = expiresAt; }
      return this.warn(p, GROUND_MSG.tileFull);
    }
    if (!whole) { e.item.count -= n; e.state.count = e.item.count; }
    const placed = this.entries.get(id);
    if (placed && placed.item === moving) placed.expiresAt = expiresAt;
    this.dirty = true;
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
    this.dirty = true;
  }

  /** Some com o que passou do tempo (varre 1×/s). */
  tick(now = this.now()): void {
    if (now < this.nextSweep) return;
    this.nextSweep = now + SWEEP_MS;
    for (const [id, e] of this.entries) if (e.expiresAt <= now) this.remove(id);
    if (this.dirty && now - this.lastSave >= SAVE_DEBOUNCE_MS) this.flush(now);
  }

  /** Grava o chão agora, se mudou desde a última gravação (debounce na varredura / desligamento). */
  flush(now = this.now()): void {
    const store = this.o.store;
    if (!store || !this.dirty) return;
    this.dirty = false;
    this.lastSave = now;
    try {
      store.save([...this.entries.values()].map((e) => ({
        x: e.state.x, y: e.state.y, item: e.item, expiresAt: e.expiresAt, owner: e.owner, ownerUntil: e.ownerUntil,
      })));
    } catch (err) {
      this.dirty = true; // tenta de novo na próxima varredura
      this.log(`[ground] falha ao gravar: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Recarrega do `store` (boot): descarta expirados, definições desconhecidas e tiles inválidos. Retorna quantos voltaram. */
  restore(now = this.now()): number {
    const store = this.o.store;
    if (!store) return 0;
    let rows: GroundRecord[];
    try { rows = store.load(); } catch (err) {
      this.log(`[ground] falha ao carregar: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
    let n = 0;
    for (const r of rows) {
      if (r.expiresAt <= now || !this.o.inventory.defs(r.item.defId) || !this.o.canHold(r.x, r.y)) continue;
      if (this.at(r.x, r.y).length >= MAX_PER_TILE || this.entries.size >= MAX_GROUND_ITEMS) continue;
      const s = new GroundItemState();
      s.id = `g${(++this.seq).toString(36)}`;
      s.defId = r.item.defId;
      s.count = r.item.count;
      s.rarity = r.item.rarity;
      s.x = r.x;
      s.y = r.y;
      const e: GroundEntry = { state: s, item: r.item, expiresAt: r.expiresAt };
      if (r.owner && (r.ownerUntil ?? 0) > now) { e.owner = r.owner; e.ownerUntil = r.ownerUntil; }
      this.entries.set(s.id, e);
      const k = tileKey(r.x, r.y);
      const list = this.tiles.get(k);
      if (list) list.push(s.id); else this.tiles.set(k, [s.id]);
      this.o.collection.set(s.id, s);
      n++;
    }
    this.dirty = n !== rows.length; // descartou algo: regrava a lista limpa
    return n;
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
    this.o.onDropped?.(p);
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
    return !!top && !!d?.stackable && !isProtected(top, now)
      && top.item.defId === defId && top.item.rarity === rarity && top.item.count + n <= maxStackOf(d);
  }

  private warn(p: PlayerState, text: string): void {
    this.o.send(p.id, S2C.Notice, { text, kind: "warn" } satisfies NoticeMsg);
  }
}
