// Monstros: spawns (com respawn estilo Tibia), índice de ocupação O(1), passos e zonas proibidas.
// A IA (decisões) fica em ai.ts; o dano/morte em combat.ts (via `attackHook`).
import {
  DIAGONAL_COST, DIR_DELTA, TICK_MS, Dir, applySpeedPct, canStepTerrain, findObjects, isDiagonal, monsterDef, objectTile,
  type CollisionGrid, type GroundSpeedGrid, type MonsterDef, type TiledMap,
} from "@lemonquest/shared";
import { MonsterState, type PlayerState } from "../state.ts";
import { updateMonster } from "./ai.ts";
import type { Point } from "./pathfinding.ts";
import { ErrorLog } from "./safe.ts";

export interface SpawnPoint {
  defId: string;
  x: number;
  y: number;
  count: number;
  radius: number;
}

/** Retângulo de tiles (inclusivo). */
export interface TileRect { x0: number; y0: number; x1: number; y1: number }

/** Zonas (objetos `zone`) que são zona de proteção (PZ): monstros não entram; ninguém ataca nem é atacado lá. */
export const PZ_ZONE_NAMES = ["Vila de Pedra Clara"];

/** Raio (Chebyshev) sem jogadores exigido para um respawn ("fora da tela", como no Tibia). */
export const RESPAWN_PLAYER_DIST = 7;
export const RESPAWN_RETRY_MS = 5000;
/** Monstros ociosos sem jogador a esta distância dormem (não pensam nem andam). */
export const SLEEP_DIST = 16;

export type AiMode = "idle" | "chase" | "flee" | "return";

/** Estado de servidor de um monstro vivo (o que vai para a rede está em `s`). */
export interface Monster {
  s: MonsterState;
  def: MonsterDef;
  spawn: SpawnPoint;
  mode: AiMode;
  sleeping: boolean;
  stepEndsAt: number;
  nextThinkAt: number;
  nextWanderAt: number;
  nextAttackAt: number;
  path: Point[] | null;
  pathAt: number;
  pathGoal: Point;
  /** Desde quando está sem alvo válido em chase/flee (0 = tem alvo). */
  lostSince: number;
  /** Quando começou a voltar ao spawn. */
  returnSince: number;
  /** Último jogador que o feriu (passivos revidam). */
  lastAttackerId: string;
  /** Dano total por jogador (divisão de XP). */
  damageBy: Map<string, number>;
  /** Velocidade em % (condições haste/slow; 0 = enraizado). Ausente = 100. */
  speedPct?: number;
  /** Provocação (taunt): forçado a atacar `tauntBy` até `tauntUntil`. */
  tauntBy?: string;
  tauntUntil?: number;
}

/** Criatura que pode ser alvo de monstro: jogador ou invocação de jogador. */
export type CreatureState = PlayerState | MonsterState;
export const isMonsterState = (c: CreatureState): c is MonsterState => "defId" in c;

/** O que precisamos do MapSchema (um Map comum serve nos testes). */
export interface MonsterCollection {
  set(key: string, value: MonsterState): unknown;
  delete(key: string): unknown;
}

export interface MonsterManagerOptions {
  grid: CollisionGrid;
  groundSpeed?: GroundSpeedGrid;
  spawns: SpawnPoint[];
  safeZones?: TileRect[];
  portals?: Point[];
  /** Predicado de portal (PortalSystem.isPortalTile). Avaliado UMA vez por tile na construção → máscara O(1). */
  isPortalTile?: (x: number, y: number) => boolean;
  collection: MonsterCollection;
  players: () => Iterable<PlayerState>;
  getPlayer: (id: string) => PlayerState | undefined;
  now?: () => number;
  rng?: () => number;
  defs?: (id: string) => MonsterDef | undefined;
  /** Aviso global (anúncio de boss). */
  notice?: (text: string, kind: "info" | "warn" | "good") => void;
  log?: (msg: string) => void;
  /** Log de erros (IA que lança): padrão ErrorLog com 1 linha/10 s. */
  errors?: ErrorLog;
}

// --- leitura do mapa ---------------------------------------------------------

const prop = (o: { properties?: { name: string; value: unknown }[] }, name: string) =>
  o.properties?.find((p) => p.name === name)?.value;

export function parseSpawns(map: TiledMap): SpawnPoint[] {
  return findObjects(map, "monster_spawn").map((o) => {
    const t = objectTile(o, map.tilewidth);
    return {
      defId: String(prop(o, "monster") ?? o.name ?? ""),
      x: t.x,
      y: t.y,
      count: Math.max(1, Math.floor(Number(prop(o, "count") ?? 1)) || 1),
      radius: Math.max(0, Math.floor(Number(prop(o, "radius") ?? 3)) || 0),
    };
  });
}

/** Zonas PZ: objetos `zone` com nome em PZ_ZONE_NAMES ou propriedade `pz` = true. */
export function parseSafeZones(map: TiledMap): TileRect[] {
  const t = map.tilewidth;
  return findObjects(map, "zone")
    .filter((o) => PZ_ZONE_NAMES.includes(o.name) || prop(o, "pz") === true)
    .map((o) => ({
      x0: Math.floor(o.x / t),
      y0: Math.floor(o.y / t),
      x1: Math.floor((o.x + Math.max(1, o.width) - 1) / t),
      y1: Math.floor((o.y + Math.max(1, o.height) - 1) / t),
    }));
}

export function parsePortalTiles(map: TiledMap): Point[] {
  return findObjects(map, "portal").map((o) => objectTile(o, map.tilewidth));
}

// --- gerenciador ---------------------------------------------------------------

const MASK_PZ = 1, MASK_PORTAL = 2;

export const cheb = (ax: number, ay: number, bx: number, by: number) => Math.max(Math.abs(ax - bx), Math.abs(ay - by));

export class MonsterManager {
  readonly grid: CollisionGrid;
  readonly rng: () => number;
  readonly now: () => number;
  /** Chamado pela IA quando um monstro ataca (combat.ts instala). */
  attackHook: (m: Monster, target: CreatureState, now: number) => void = () => {};
  /** IA das invocações (summons.ts instala). Sem hook, invocações ficam paradas. */
  summonAi: ((m: Monster, w: MonsterManager, now: number) => void) | null = null;
  /** Invocação morreu/sumiu (summons.ts limpa o registro do dono). */
  onSummonRemoved: ((m: Monster) => void) | null = null;

  private readonly W: number;
  private readonly mask: Uint8Array;
  private readonly occ = new Map<number, Monster>();
  private readonly list = new Map<string, Monster>();
  private readonly respawns: { spawn: SpawnPoint; at: number }[] = [];
  private readonly warned = new Set<string>();
  private nextId = 1;
  private readonly errors: ErrorLog;
  /** Jogadores do tick atual (≤ 32; varrer é mais barato que indexar). */
  playerList: PlayerState[] = [];

  constructor(private readonly o: MonsterManagerOptions) {
    this.grid = o.grid;
    this.W = o.grid.width;
    this.rng = o.rng ?? Math.random;
    this.now = o.now ?? Date.now;
    this.errors = o.errors ?? new ErrorLog();
    this.mask = new Uint8Array(o.grid.width * o.grid.height);
    for (const r of o.safeZones ?? []) {
      for (let y = Math.max(0, r.y0); y <= Math.min(o.grid.height - 1, r.y1); y++)
        for (let x = Math.max(0, r.x0); x <= Math.min(o.grid.width - 1, r.x1); x++) this.mask[y * this.W + x] |= MASK_PZ;
    }
    for (const p of o.portals ?? []) if (this.inBounds(p.x, p.y)) this.mask[p.y * this.W + p.x] |= MASK_PORTAL;
    if (o.isPortalTile) {
      for (let y = 0; y < o.grid.height; y++)
        for (let x = 0; x < o.grid.width; x++) if (o.isPortalTile(x, y)) this.mask[y * this.W + x] |= MASK_PORTAL;
    }
  }

  get size() { return this.list.size; }
  get(id: string): Monster | undefined { return this.list.get(id); }
  all(): IterableIterator<Monster> { return this.list.values(); }
  getPlayer(id: string): PlayerState | undefined { return id ? this.o.getPlayer(id) : undefined; }

  private inBounds(x: number, y: number) { return x >= 0 && y >= 0 && x < this.W && y < this.grid.height; }

  /** Zona de proteção (jogadores não atacam nem são atacados; monstros não entram). */
  inPz(x: number, y: number): boolean { return this.inBounds(x, y) && (this.mask[y * this.W + x] & MASK_PZ) !== 0; }
  /** Tile proibido para monstros (PZ ou portal). */
  isForbidden(x: number, y: number): boolean { return this.inBounds(x, y) && this.mask[y * this.W + x] !== 0; }
  monsterAt(x: number, y: number): Monster | undefined { return this.occ.get(y * this.W + x); }
  isMonsterAt(x: number, y: number): boolean { return this.occ.has(y * this.W + x); }

  playerAt(x: number, y: number): PlayerState | undefined {
    for (const p of this.playerList) if (p.x === x && p.y === y) return p;
    return undefined;
  }

  /** Tile ocupado/proibido para um monstro entrar (o terreno é checado à parte). */
  blockedForMonster(x: number, y: number): boolean {
    return this.isForbidden(x, y) || this.isMonsterAt(x, y) || this.playerAt(x, y) !== undefined;
  }

  nearestPlayerDist(x: number, y: number): number {
    let best = Infinity;
    for (const p of this.playerList) { const d = cheb(x, y, p.x, p.y); if (d < best) best = d; }
    return best;
  }

  /** Alvo atacável por um monstro selvagem: jogador online, vivo e fora da PZ, ou invocação de jogador viva. */
  validTarget(id: string): CreatureState | undefined {
    if (!id) return undefined;
    const p = this.getPlayer(id);
    if (p) return p.hp > 0 && !this.inPz(p.x, p.y) ? p : undefined;
    const m = this.list.get(id);
    return m && m.s.ownerId && m.s.hp > 0 ? m.s : undefined;
  }

  /** Monstro selvagem (não invocado) vivo com esse id. */
  wild(id: string): Monster | undefined {
    const m = id ? this.list.get(id) : undefined;
    return m && !m.s.ownerId && m.s.hp > 0 ? m : undefined;
  }

  /** Cria uma invocação (sem respawn) em (x,y). O tile deve estar livre. */
  spawnSummon(def: MonsterDef, x: number, y: number, ownerId: string, now = this.now()): Monster {
    const s = new MonsterState();
    s.id = `m${this.nextId++}`;
    s.defId = def.id;
    s.x = x;
    s.y = y;
    s.dir = Dir.S;
    s.hp = def.hp;
    s.maxHp = def.hp;
    s.ownerId = ownerId;
    const sp: SpawnPoint = { defId: def.id, x, y, count: 1, radius: 0 };
    const m: Monster = {
      s, def, spawn: sp, mode: "idle", sleeping: false,
      stepEndsAt: 0, nextThinkAt: now, nextWanderAt: now, nextAttackAt: now, path: null, pathAt: 0,
      pathGoal: { x: -1, y: -1 }, lostSince: 0, returnSince: 0, lastAttackerId: "", damageBy: new Map(),
    };
    this.list.set(s.id, m);
    this.occ.set(y * this.W + x, m);
    this.o.collection.set(s.id, s);
    return m;
  }

  /** Cria todos os monstros dos spawns (chamar no onCreate). */
  spawnAll(now = this.now()): void {
    this.playerList = [...this.o.players()];
    for (const sp of this.o.spawns) {
      const def = this.def(sp.defId);
      if (!def) continue;
      for (let i = 0; i < sp.count; i++) if (!this.spawnOne(sp, def, now)) this.respawns.push({ spawn: sp, at: now + RESPAWN_RETRY_MS });
    }
  }

  private def(id: string): MonsterDef | undefined {
    const d = (this.o.defs ?? monsterDef)(id);
    if (!d && !this.warned.has(id)) {
      this.warned.add(id);
      (this.o.log ?? console.warn)(`[monsters] monstro desconhecido "${id}" no mapa — spawn ignorado`);
    }
    return d;
  }

  /** Tile livre aleatório no raio do spawn; `awayFromPlayers` exige nenhum jogador a RESPAWN_PLAYER_DIST. */
  findSpawnTile(sp: SpawnPoint, awayFromPlayers: boolean): Point | null {
    const r = sp.radius;
    const ok = (x: number, y: number) =>
      this.grid.isWalkable(x, y) && !this.blockedForMonster(x, y) &&
      (!awayFromPlayers || this.nearestPlayerDist(x, y) > RESPAWN_PLAYER_DIST);
    for (let i = 0; i < 40; i++) {
      const x = sp.x + Math.floor(this.rng() * (2 * r + 1)) - r;
      const y = sp.y + Math.floor(this.rng() * (2 * r + 1)) - r;
      if (ok(x, y)) return { x, y };
    }
    // Varredura completa (raio pequeno ou área quase cheia).
    for (let y = sp.y - r; y <= sp.y + r; y++) for (let x = sp.x - r; x <= sp.x + r; x++) if (ok(x, y)) return { x, y };
    return null;
  }

  private spawnOne(sp: SpawnPoint, def: MonsterDef, now: number): Monster | null {
    const t = this.findSpawnTile(sp, true);
    if (!t) return null;
    const s = new MonsterState();
    s.id = `m${this.nextId++}`;
    s.defId = def.id;
    s.x = t.x;
    s.y = t.y;
    s.dir = Dir.S;
    s.hp = def.hp;
    s.maxHp = def.hp;
    const m: Monster = {
      s, def, spawn: sp, mode: "idle", sleeping: false,
      stepEndsAt: 0, nextThinkAt: now + Math.floor(this.rng() * 250), nextWanderAt: now + 2000 + this.rng() * 3000,
      nextAttackAt: 0, path: null, pathAt: 0, pathGoal: { x: -1, y: -1 }, lostSince: 0, returnSince: 0,
      lastAttackerId: "", damageBy: new Map(),
    };
    this.list.set(s.id, m);
    this.occ.set(t.y * this.W + t.x, m);
    this.o.collection.set(s.id, s);
    if (def.boss) this.o.notice?.(`${def.name} apareceu!`, "warn");
    return m;
  }

  /** Remove o monstro (morte) e agenda o respawn. */
  kill(m: Monster, now = this.now()): void {
    if (!this.list.delete(m.s.id)) return;
    const key = m.s.y * this.W + m.s.x;
    if (this.occ.get(key) === m) this.occ.delete(key);
    this.o.collection.delete(m.s.id);
    if (m.s.ownerId) {
      // Invocação: sem respawn; ninguém mais a persegue.
      this.clearTargetsOf(m.s.id);
      this.onSummonRemoved?.(m);
      return;
    }
    this.respawns.push({ spawn: m.spawn, at: now + m.def.respawnMs });
  }

  /** Teleporta o monstro (volta forçada ao spawn quando preso). */
  place(m: Monster, x: number, y: number): void {
    const old = m.s.y * this.W + m.s.x;
    if (this.occ.get(old) === m) this.occ.delete(old);
    m.s.x = x;
    m.s.y = y;
    m.s.stepMs = 0;
    this.occ.set(y * this.W + x, m);
  }

  /** Tenta um passo (mesmas regras dos jogadores + zonas proibidas). */
  tryStep(m: Monster, dir: Dir, now: number): boolean {
    const s = m.s;
    const { dx, dy } = DIR_DELTA[dir];
    const tx = s.x + dx, ty = s.y + dy;
    const pct = m.speedPct ?? 100;
    if (pct <= 0) return false; // enraizado
    if (!canStepTerrain(this.grid, s.x, s.y, dx, dy) || this.blockedForMonster(tx, ty)) return false;
    const speed = this.o.groundSpeed?.speedAt(s.x, s.y) ?? 100;
    const dur = applySpeedPct(Math.round(((isDiagonal(dir) ? m.def.stepMs * DIAGONAL_COST : m.def.stepMs) * speed) / 100), pct);
    const startAt = now - m.stepEndsAt <= TICK_MS ? m.stepEndsAt : now;
    m.stepEndsAt = startAt + dur;
    this.occ.delete(s.y * this.W + s.x);
    this.occ.set(ty * this.W + tx, m);
    s.x = tx;
    s.y = ty;
    s.dir = dir;
    s.stepMs = dur;
    return true;
  }

  /**
   * Um jogador (ou invocação) feriu o monstro: registra dano e faz revidar (inclusive passivos e quem estava voltando).
   * `creditId` = quem recebe o crédito de XP (o dono, no caso de invocação; "" = ninguém).
   */
  onDamaged(m: Monster, attackerId: string, amount: number, now: number, creditId = attackerId): void {
    if (amount > 0 && creditId) m.damageBy.set(creditId, (m.damageBy.get(creditId) ?? 0) + amount);
    m.lastAttackerId = attackerId;
    m.sleeping = false;
    if (m.mode === "idle" || m.mode === "return" || ((m.mode === "chase" || m.mode === "flee") && !this.validTarget(m.s.targetId))) {
      if (this.validTarget(attackerId)) {
        m.mode = "chase";
        m.s.targetId = attackerId;
        m.lostSince = 0;
        m.path = null;
        m.nextThinkAt = Math.min(m.nextThinkAt, now);
      }
    }
  }

  /** Jogador saiu/morreu: ninguém mais o persegue. */
  clearTargetsOf(playerId: string): void {
    for (const m of this.list.values()) {
      if (m.s.targetId === playerId) { m.s.targetId = ""; m.path = null; }
      if (m.lastAttackerId === playerId) m.lastAttackerId = "";
    }
  }

  tick(now: number): void {
    this.playerList = [...this.o.players()];
    this.processRespawns(now);
    for (const m of this.list.values()) {
      try {
        if (m.s.ownerId) this.summonAi?.(m, this, now);
        else updateMonster(m, this, now);
      } catch (e) {
        // Monstro com estado corrompido: remove (o respawn normal recria) em vez de derrubar o tick.
        this.errors.report(`monstro ${m.s.defId}`, e);
        try { this.clearTargetsOf(m.s.id); this.kill(m, now); } catch (e2) { this.errors.report("monstro/despawn", e2); }
      }
    }
  }

  private processRespawns(now: number) {
    for (let i = this.respawns.length - 1; i >= 0; i--) {
      const r = this.respawns[i];
      if (now < r.at) continue;
      const def = this.def(r.spawn.defId);
      if (!def) { this.respawns.splice(i, 1); continue; }
      if (this.spawnOne(r.spawn, def, now)) this.respawns.splice(i, 1);
      else r.at = now + RESPAWN_RETRY_MS;
    }
  }

  get pendingRespawns(): number { return this.respawns.length; }
}
