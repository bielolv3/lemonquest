// NPCs (M4): objetos "npc" do mapa (propriedade npcId). Falar (NPC_RANGE) abre diálogo/loja/depot; sair do
// alcance fecha (NpcOpen com npcId ""). Loja: compra (ouro, espaço, empilha) e venda (só tipos em `buys`).
// Ambientação: a cada 20–40 s cada NPC com idleLines fala (S2C.NpcSay) se houver jogador a até 15 tiles.
import {
  NPC_BUY_RATIO, NPC_RANGE, S2C, findObjects, npcBuyPrice, npcDef, objectTile,
  type NoticeMsg, type NpcDef, type NpcInteractMsg, type NpcOpenMsg, type NpcSayMsg, type NpcTradeMsg, type TiledMap,
} from "@tibinha/shared";
import type { PlayerState } from "../state.ts";
import { maxStackOf, makeItem, type InventorySystem } from "./inventory.ts";
import { cheb } from "./monsters.ts";

export const NPC_SAY_MIN_MS = 20_000;
export const NPC_SAY_MAX_MS = 40_000;
export const NPC_SAY_DIST = 15;
export const MAX_TRADE_COUNT = 100;

export interface NpcSpot { id: string; x: number; y: number }

/** Objetos "npc" do mapa → (npcId, tile). */
export function parseNpcs(map: TiledMap): NpcSpot[] {
  return findObjects(map, "npc").map((o) => {
    const id = String(o.properties?.find((p) => p.name === "npcId")?.value ?? o.name ?? "");
    return { id, ...objectTile(o, map.tilewidth) };
  }).filter((n) => n.id);
}

export interface NpcOptions {
  npcs: NpcSpot[];
  inventory: InventorySystem;
  players: () => Iterable<PlayerState>;
  getPlayer: (id: string) => PlayerState | undefined;
  send: (sessionId: string, type: string, msg: unknown) => void;
  broadcast: (type: string, msg: unknown) => void;
  defs?: (id: string) => NpcDef | undefined;
  now?: () => number;
  rng?: () => number;
}

export const CLOSED: NpcOpenMsg = { npcId: "", name: "", greeting: "" };

export class NpcSystem {
  private readonly spots = new Map<string, NpcSpot>();
  private readonly tiles = new Set<number>();
  private readonly open = new Map<string, string>(); // sessionId → npcId
  private readonly nextSayAt = new Map<string, number>();
  private readonly defs: (id: string) => NpcDef | undefined;
  private readonly now: () => number;
  private readonly rng: () => number;

  constructor(private readonly o: NpcOptions) {
    this.defs = o.defs ?? npcDef;
    this.now = o.now ?? Date.now;
    this.rng = o.rng ?? Math.random;
    for (const n of o.npcs) {
      this.spots.set(n.id, n);
      this.tiles.add(n.y * 65536 + n.x);
    }
  }

  get list(): NpcSpot[] { return [...this.spots.values()]; }

  /** Há um NPC neste tile (bloqueia o movimento). */
  isNpcAt(x: number, y: number): boolean { return this.tiles.has(y * 65536 + x); }

  openFor(id: string): string { return this.open.get(id) ?? ""; }

  private inRange(p: PlayerState, npcId: string): boolean {
    const s = this.spots.get(npcId);
    return !!s && cheb(p.x, p.y, s.x, s.y) <= NPC_RANGE;
  }

  /** Depot aberto e perto do NPC do depot. */
  depotOpen(id: string): boolean {
    const npcId = this.open.get(id);
    const p = this.o.getPlayer(id);
    return !!npcId && !!p && !!this.defs(npcId)?.depot && this.inRange(p, npcId);
  }

  removePlayer(id: string): void { this.open.delete(id); }

  /** Monta o NpcOpen (preços da loja). */
  openMsg(d: NpcDef): NpcOpenMsg {
    const msg: NpcOpenMsg = { npcId: d.id, name: d.name, greeting: d.greeting };
    if (d.shop) {
      const sells = d.shop.sells
        .map((e) => ({ itemId: e.itemId, price: e.price ?? this.o.inventory.defs(e.itemId)?.value ?? -1 }))
        .filter((e) => e.price >= 0);
      msg.shop = { sells, sellRatio: NPC_BUY_RATIO };
      if (d.shop.buys) msg.shop.buys = [...d.shop.buys];
    }
    if (d.depot) msg.depot = true;
    return msg;
  }

  /** C2S.NpcInteract */
  onInteract(p: PlayerState, msg: NpcInteractMsg): void {
    if (!msg || typeof msg.npcId !== "string" || p.hp <= 0) return;
    const d = this.defs(msg.npcId);
    if (!d || !this.spots.has(d.id)) return;
    if (!this.inRange(p, d.id)) return this.notice(p, "Chegue mais perto para falar.", "warn");
    this.open.set(p.id, d.id);
    this.o.send(p.id, S2C.NpcOpen, this.openMsg(d));
    if (d.depot) this.o.inventory.sendDepot(p.id);
  }

  /** C2S.NpcTrade */
  onTrade(p: PlayerState, msg: NpcTradeMsg): void {
    if (!msg || typeof msg !== "object" || typeof msg.npcId !== "string" || p.hp <= 0) return;
    if (this.open.get(p.id) !== msg.npcId || !this.inRange(p, msg.npcId)) return;
    const d = this.defs(msg.npcId);
    if (!d?.shop) return;
    const count = msg.count;
    if (!Number.isInteger(count) || count < 1 || count > MAX_TRADE_COUNT) return;
    const inv = this.o.inventory;
    if (msg.action === "buy") {
      if (typeof msg.itemId !== "string") return;
      const entry = d.shop.sells.find((e) => e.itemId === msg.itemId);
      const item = entry ? inv.defs(entry.itemId) : undefined;
      if (!entry || !item) return;
      const total = (entry.price ?? item.value) * count;
      if (inv.gold(p.id) < total) return this.notice(p, "Ouro insuficiente.", "warn");
      if (inv.roomFor(p.id, item.id) < count) return this.notice(p, "Mochila cheia.", "warn");
      inv.spendGold(p, total);
      if (item.stackable) {
        for (let left = count; left > 0;) { const n = Math.min(left, maxStackOf(item)); inv.addItem(p, makeItem(item.id, n)); left -= n; }
      } else {
        for (let i = 0; i < count; i++) inv.addItem(p, makeItem(item.id, 1));
      }
      this.notice(p, `Você comprou ${count}x ${item.name} por ${total} de ouro.`, "good");
    } else if (msg.action === "sell") {
      const it = inv.get(p.id)?.backpack[msg.index];
      if (!Number.isInteger(msg.index) || !it) return;
      const item = inv.defs(it.defId);
      if (!item) return;
      if (!d.shop.buys || !d.shop.buys.includes(item.kind as never)) return this.notice(p, "Não compro isso.", "warn");
      if (count > it.count) return;
      const price = npcBuyPrice(item.value, it.rarity) * count;
      if (!inv.takeFromBackpack(p, msg.index, count)) return;
      inv.addGold(p, price);
      this.notice(p, `Você vendeu ${count}x ${item.name} por ${price} de ouro.`, "good");
    }
  }

  /** Fecha diálogos fora de alcance e solta falas ambiente. */
  tick(now: number): void {
    for (const [pid, npcId] of this.open) {
      const p = this.o.getPlayer(pid);
      if (!p) { this.open.delete(pid); continue; }
      if (this.inRange(p, npcId) && p.hp > 0) continue;
      this.open.delete(pid);
      this.o.send(pid, S2C.NpcOpen, CLOSED);
    }
    for (const s of this.spots.values()) {
      const lines = this.defs(s.id)?.idleLines;
      if (!lines?.length) continue;
      const due = this.nextSayAt.get(s.id);
      if (due === undefined || now >= due) this.nextSayAt.set(s.id, now + NPC_SAY_MIN_MS + this.rng() * (NPC_SAY_MAX_MS - NPC_SAY_MIN_MS));
      if (due === undefined || now < due) continue;
      let near = false;
      for (const p of this.o.players()) if (cheb(p.x, p.y, s.x, s.y) <= NPC_SAY_DIST) { near = true; break; }
      if (!near) continue;
      const text = lines[Math.floor(this.rng() * lines.length)]!;
      this.o.broadcast(S2C.NpcSay, { npcId: s.id, text } satisfies NpcSayMsg);
    }
  }

  private notice(p: PlayerState, text: string, kind: NoticeMsg["kind"]): void {
    this.o.send(p.id, S2C.Notice, { text, kind } satisfies NoticeMsg);
  }
}
