import { CloseCode, ErrorCode, Room, ServerError, type Client, type Deferred, type RoomException, type RoomMethodName } from "colyseus";
import {
  C2S, CLOSE_REPLACED, S2C, TICK_MS, baseStats,
  type AttackMsg, type CastMsg, type ChatSendMsg, type DiscardItemMsg, type FeedMsg, type FightModeMsg, type JoinOptions,
  type MoveItemMsg, type MoveMsg, type NoticeMsg, type NpcInteractMsg, type NpcTradeMsg, type QuickPotionMsg, type TurnMsg,
  type UseItemMsg, type WalkToMsg,
} from "@lemonquest/shared";
import { PlayerState, WorldState } from "../state.ts";
import { loadMap, type LoadedMap } from "../world/map.ts";
import { MovementSystem } from "../systems/movement.ts";
import { ExplorationSystem } from "../systems/exploration.ts";
import { PortalSystem } from "../systems/portals.ts";
import { MonsterManager, parseSafeZones, parseSpawns } from "../systems/monsters.ts";
import { CombatSystem, attackProfile, playerArmor } from "../systems/combat.ts";
import { RegenSystem } from "../systems/regen.ts";
import { handleChat, clearChatState } from "../systems/chat.ts";
import { FoodSystem } from "../systems/food.ts";
import { ConditionSystem } from "../systems/conditions.ts";
import { SkillSystem } from "../systems/skills.ts";
import { SummonSystem } from "../systems/summons.ts";
import { SpellSystem } from "../systems/spells.ts";
import { InventorySystem } from "../systems/inventory.ts";
import { LootSystem } from "../systems/loot.ts";
import { NpcSystem, parseNpcs } from "../systems/npcs.ts";
import { FightModeSystem, stanceDealt, stanceTaken } from "../systems/fightmode.ts";
import { handleDevCommand } from "../systems/devcommands.ts";
import { ErrorLog, runSafe, runSteps } from "../systems/safe.ts";
import { claimOnline, consumeToken, releaseOnline, type AuthData } from "../persistence/auth.ts";
import { getCharacterByName, saveCharacter } from "../persistence/db.ts";
import { PerSecond } from "../persistence/ratelimit.ts";
import type { CharacterRecord } from "../persistence/types.ts";
import { isValidStart, reachableFrom } from "../world/tiles.ts";

export const AUTOSAVE_MS = 15_000;
/** Segundos que um jogador que caiu (Wi-Fi) continua no mundo esperando a reconexão automática do SDK. */
export const RECONNECT_S = 20;
/** Fechamento da sessão antiga quando o mesmo personagem entra em outro lugar: CLOSE_REPLACED (shared). */
export const REPLACED_REASON = "Sua conta entrou em outro lugar";
/** Limite global por cliente (Colyseus 0.18: excedeu → desconecta o cliente com WITH_ERROR). */
export const MAX_MESSAGES_PER_SECOND = 60;
/** Limites por tipo de mensagem (excesso descartado em silêncio). */
export const MESSAGE_LIMITS: Partial<Record<string, number>> = {
  [C2S.WalkTo]: 5, [C2S.NpcInteract]: 5, [C2S.Cast]: 10, [C2S.MoveItem]: 20,
};
const DEV = process.env.NODE_ENV !== "production";
/** Log de desempenho do tick: dev = a cada 60 s; produção = a cada 5 min e só se algum tick passou de 30 ms. */
const PERF_LOG_MS = DEV ? 60_000 : 5 * 60_000;
const PERF_PROD_MIN_MAX_MS = 30;
/** Level a partir do qual o level up entra no feed global. */
const FEED_LEVEL_MIN = 10;

/** A instância única do mundo (criada no boot). Uma segunda instância é recusada no onCreate. */
let liveWorld: WorldRoom | null = null;
export const currentWorld = (): WorldRoom | null => liveWorld;

export class WorldRoom extends Room<{ state: WorldState }> {
  maxClients = 32;
  autoDispose = false;
  maxMessagesPerSecond = MAX_MESSAGES_PER_SECOND;
  state = new WorldState();

  private map!: LoadedMap;
  private movement!: MovementSystem;
  private exploration!: ExplorationSystem;
  private portals!: PortalSystem;
  private monsters!: MonsterManager;
  private combat!: CombatSystem;
  private regen!: RegenSystem;
  private conditions!: ConditionSystem;
  private food!: FoodSystem;
  private skills!: SkillSystem;
  private summons!: SummonSystem;
  private spells!: SpellSystem;
  private inventory!: InventorySystem;
  private loot!: LootSystem;
  private npcs!: NpcSystem;
  private fight!: FightModeSystem;
  private perf = { n: 0, sum: 0, max: 0, since: Date.now() };
  private records = new Map<string, CharacterRecord>(); // sessionId -> registro
  /** sessionId -> nome (dono do "online"), gravado logo no início do onJoin. */
  private names = new Map<string, string>();
  /** Reconexões pendentes (onDrop), para cancelar se o personagem entrar de novo por outro lugar. */
  private reconnecting = new Map<string, Deferred<Client>>();
  private throttle = new PerSecond();
  readonly errors = new ErrorLog();
  private reachable!: Uint8Array;
  private steps: ReadonlyArray<readonly [string, () => void]> = [];
  private tickNow = 0;
  private shuttingDown = false;
  /** Salvamento de um registro (trocável nos testes para simular falha). */
  persist: (rec: CharacterRecord) => void = saveCharacter;

  /**
   * Autenticação ANTES da reserva de vaga/criação de sala: no 0.18 o matchmaker chama o onAuth ESTÁTICO em
   * joinOrCreate/join/create/joinById e entrega o retorno ao onJoin como `auth` (client.auth).
   * Token: options.token (o cliente manda nas opções) ou o header Authorization.
   */
  static async onAuth(token: string, options: JoinOptions | undefined): Promise<AuthData> {
    const t = typeof options?.token === "string" && options.token ? options.token : token;
    try {
      return consumeToken(String(t ?? ""));
    } catch (e) {
      throw new ServerError(ErrorCode.AUTH_FAILED, (e as Error).message);
    }
  }

  onCreate() {
    if (liveWorld && liveWorld !== this) {
      // joinOrCreate só tenta criar com o mundo cheio (sala travada em maxClients): nunca abre um 2º shard.
      throw new ServerError(ErrorCode.MATCHMAKE_UNHANDLED, "O mundo está cheio.");
    }
    liveWorld = this;
    this.map = loadMap("world");
    this.exploration = new ExplorationSystem(this.map.tiled.width, this.map.tiled.height);
    this.movement = new MovementSystem(this.map.grid, { spawn: this.map.spawn, groundSpeed: this.map.groundSpeed });
    this.portals = new PortalSystem(
      this.map.tiled, this.movement, (id, msg) => this.clients.getById(id)?.send(S2C.Teleported, msg), Date.now,
      (x, y, self) => this.isFreeTile(x, y, self.id),
    );
    const send = (id: string, type: string, msg: unknown) => this.clients.getById(id)?.send(type, msg);
    const broadcast = (type: string, msg: unknown) => this.broadcast(type, msg);
    const getPlayer = (id: string) => this.state.players.get(id);

    this.monsters = new MonsterManager({
      grid: this.map.grid,
      groundSpeed: this.map.groundSpeed,
      spawns: parseSpawns(this.map.tiled),
      safeZones: parseSafeZones(this.map.tiled),
      isPortalTile: (x, y) => this.portals.isPortalTile(x, y),
      collection: this.state.monsters,
      players: () => this.state.players.values(),
      getPlayer,
      notice: (text, kind) => this.broadcast(S2C.Notice, { text, kind }),
      errors: this.errors,
    });
    this.combat = new CombatSystem({
      monsters: this.monsters,
      players: () => this.state.players.values(),
      getPlayer,
      teleport: (p, x, y) => this.movement.teleport(p, x, y),
      spawn: this.map.spawn,
      send,
      broadcast,
    });
    this.inventory = new InventorySystem({
      send,
      depotOpen: (id) => this.npcs.depotOpen(id),
      heal: (p, n) => this.combat.healPlayer(p, p.id, n),
      restoreMana: (p, n) => this.combat.restoreMana(p, n),
      eat: (p, f, now) => this.food.eat(p, f, now),
      onStatsChanged: (p) => this.conditions.refreshPlayer(p.id),
    });
    this.food = new FoodSystem({
      heal: (p, n) => this.combat.healPlayer(p, p.id, n),
      restoreMana: (p, n) => this.combat.restoreMana(p, n),
    });
    this.npcs = new NpcSystem({
      npcs: parseNpcs(this.map.tiled), inventory: this.inventory,
      players: () => this.state.players.values(), getPlayer, send, broadcast,
    });
    this.movement.setExtraBlocker((x, y) => this.monsters.isMonsterAt(x, y) || this.npcs.isNpcAt(x, y));
    this.loot = new LootSystem({ inventory: this.inventory, getPlayer, send, broadcast });
    this.regen = new RegenSystem({
      inCombat: (id, now) => this.combat.inCombat(id, now),
      inPz: (x, y) => this.monsters.inPz(x, y),
      bonus: (id) => ({ hp: this.inventory.stat(id, "hpRegen"), mana: this.inventory.stat(id, "manaRegen") }),
    });
    this.skills = new SkillSystem(send);
    this.conditions = new ConditionSystem({
      monsters: this.monsters, combat: this.combat, send,
      getPlayer, players: () => this.state.players.values(),
      speedBonus: (id) => this.inventory.stat(id, "speed"),
      extra: (p, now) => this.food.condition(p.id, now),
    });
    this.summons = new SummonSystem({ monsters: this.monsters, combat: this.combat, getPlayer });
    this.spells = new SpellSystem({
      grid: this.map.grid, monsters: this.monsters, combat: this.combat, conditions: this.conditions,
      summons: this.summons, skills: this.skills,
      players: () => this.state.players.values(), getPlayer,
      teleport: (p, x, y) => this.movement.teleport(p, x, y),
      send, broadcast,
      magicBonus: (p) => this.inventory.stat(p.id, "magic"),
      dealtMult: stanceDealt,
      isBlocked: (x, y) => this.npcs.isNpcAt(x, y),
    });
    this.fight = new FightModeSystem({
      movement: this.movement, monsters: this.monsters,
      attackRange: (p) => this.combat.attackOf(p).range,
    });
    this.combat.hooks = {
      damageTakenPct: (id) => this.conditions.damageTakenPct(id),
      manaShield: (id) => this.conditions.manaShield(id),
      onAutoAttack: (p) => {
        if (p.vocation === "knight") this.skills.addTries(p, "melee", 1);
        else if (p.vocation === "paladin") this.skills.addTries(p, "distance", 1);
      },
      onMeleeHit: (p) => { if (p.vocation === "knight" || p.vocation === "paladin") this.skills.addTries(p, "shield", 1); },
      onPlayerDied: (p, killer) => {
        this.conditions.clear(p.id);
        this.summons.despawnOwner(p.id);
        this.loot.feed(`💀 ${p.name} foi derrotado por ${killer}`, "death");
      },
      armor: (p) => playerArmor(p) + this.inventory.stat(p.id, "armor"),
      attack: (p) => attackProfile(p, this.inventory.weaponDef(p.id), (s) => this.inventory.stat(p.id, s)),
      dealtMult: stanceDealt,
      takenMult: stanceTaken,
      onLevelUp: (p) => {
        this.inventory.applyStats(p, true);
        if (p.level >= FEED_LEVEL_MIN) {
          const text = `⭐ ${p.name} chegou ao level ${p.level}!`;
          this.combat.later(() => this.broadcast(S2C.Feed, { text, kind: "level" } satisfies FeedMsg));
        }
      },
      onMonsterKilled: (m) => this.combat.later(() => this.loot.onKill(m)),
    };
    this.monsters.spawnAll();
    console.log(`[lemonquest] ${this.monsters.size} monstros em ${parseSpawns(this.map.tiled).length} spawns, ${this.npcs.list.length} NPCs`);

    // Alcançabilidade a partir do spawn (inclui portais) — valida a posição salva no onJoin.
    this.reachable = reachableFrom(this.map.grid, this.map.spawn, (x, y) => this.portals.destination(x, y));
    let nReach = 0;
    for (const v of this.reachable) nReach += v;
    console.log(`[lemonquest] ${nReach} tiles alcançáveis a partir do spawn`);

    // Comandos com "/": só admins com LEMONQUEST_DEV_COMMANDS=1 (fora de produção); senão "Comando desconhecido." (chat.ts).
    const command = (p: PlayerState, text: string) => handleDevCommand(p, text, {
      inventory: this.inventory, send,
      teleport: (pl, x, y) => this.movement.teleport(pl, x, y),
      isWalkable: (x, y) => this.map.grid.isWalkable(x, y) && !this.npcs.isNpcAt(x, y),
      setMagicLevel: (pl, n) => this.skills.setLevel(pl, "magic", n),
    });
    this.on<MoveMsg>(C2S.Move, (p, m) => { this.fight.pause(p.id); this.movement.onMove(p, m); });
    this.on<WalkToMsg>(C2S.WalkTo, (p, m) => { this.fight.pause(p.id); this.movement.onWalkTo(p, m); });
    this.on<TurnMsg>(C2S.Turn, (p, m) => this.movement.onTurn(p, m));
    this.on<AttackMsg>(C2S.Attack, (p, m) => this.combat.onAttack(p, m));
    this.on<ChatSendMsg>(C2S.Chat, (p, m, c) =>
      handleChat(this, c, p, m, { castWords: (pl, text) => this.spells.castWords(pl, text), command }));
    this.on<CastMsg>(C2S.Cast, (p, m) => this.spells.onCast(p, m));
    this.on<MoveItemMsg>(C2S.MoveItem, (p, m) => this.inventory.onMoveItem(p, m));
    this.on<UseItemMsg>(C2S.UseItem, (p, m) => this.inventory.onUseItem(p, m));
    this.on<QuickPotionMsg>(C2S.QuickPotion, (p, m) => this.inventory.onQuickPotion(p, m));
    this.on<DiscardItemMsg>(C2S.DiscardItem, (p, m) => this.inventory.onDiscard(p, m));
    this.on<NpcInteractMsg>(C2S.NpcInteract, (p, m) => this.npcs.onInteract(p, m));
    this.on<NpcTradeMsg>(C2S.NpcTrade, (p, m) => this.npcs.onTrade(p, m));
    this.on<FightModeMsg>(C2S.FightMode, (p, m) => this.fight.onFightMode(p, m));

    const players = () => this.state.players.values();
    this.steps = [
      ["fight", () => this.fight.tick(this.tickNow, players())],
      ["movement", () => this.movement.tick(this.tickNow, players())],
      ["portals", () => { for (const p of players()) this.portals.check(p); }],
      ["exploration", () => { for (const p of players()) this.exploration.onPosition(p.id, p.x, p.y); }],
      ["monsters", () => this.monsters.tick(this.tickNow)],
      ["combat", () => this.combat.tick(this.tickNow)],
      ["conditions", () => this.conditions.tick(this.tickNow)],
      ["regen", () => this.regen.tick(this.tickNow, players())],
      ["food", () => this.food.tick(this.tickNow, players())],
      ["npcs", () => this.npcs.tick(this.tickNow)],
      ["conditions.sync", () => this.conditions.sync(this.tickNow)],
      ["combat.flush", () => this.combat.flush()],
      ["inventory.flush", () => this.inventory.flush()],
    ];

    this.setSimulationInterval(() => this.tick(), TICK_MS);
    this.clock.setInterval(() => this.saveAll(), AUTOSAVE_MS);
  }

  /** Passos do tick (testes podem trocar para verificar o isolamento). */
  setSteps(steps: ReadonlyArray<readonly [string, () => void]>) { this.steps = steps; }

  /** Tick da simulação: cada sistema isolado (um que lança não impede os outros; log 1×/10 s por sistema). */
  tick() {
    const t0 = performance.now();
    this.tickNow = Date.now();
    runSteps(this.steps, this.errors);
    this.trackPerf(performance.now() - t0, this.tickNow);
  }

  private trackPerf(ms: number, now: number) {
    const s = this.perf;
    s.n++; s.sum += ms; if (ms > s.max) s.max = ms;
    if (now - s.since < PERF_LOG_MS) return;
    if (DEV || s.max > PERF_PROD_MIN_MAX_MS) {
      console.log(`[tick] ${s.n} ticks: média ${(s.sum / s.n).toFixed(3)} ms, máx ${s.max.toFixed(2)} ms — ${this.monsters.size} monstros, ${this.state.players.size} jogadores`);
    }
    this.perf = { n: 0, sum: 0, max: 0, since: now };
  }

  /** Erros em onMessage/onJoin/onLeave/clock/tick (o Colyseus embrulha tudo com isto): loga e segue. */
  onUncaughtException(err: RoomException, method: RoomMethodName) {
    const cause = (err as Error & { cause?: unknown }).cause ?? err;
    this.errors.report(`room.${method}`, cause);
  }

  onJoin(client: Client, _options: JoinOptions, auth: AuthData) {
    if (!auth?.name) throw new ServerError(ErrorCode.AUTH_FAILED, "sem autenticação");
    const sid = client.sessionId;
    this.names.set(sid, auth.name);
    // Mesmo personagem já no mundo (aba antiga, sessão "presa" após queda): salva e derruba a antiga (estilo Tibia).
    const prev = claimOnline(auth.name, sid);
    if (prev) this.replaceSession(prev);
    const rec = getCharacterByName(auth.name); // lido DEPOIS de salvar a sessão antiga
    if (!rec) throw new ServerError(ErrorCode.AUTH_FAILED, "Personagem não encontrado");

    const p = new PlayerState();
    p.id = sid;
    p.name = rec.name;
    p.vocation = rec.vocation;
    p.level = rec.level;
    p.xp = rec.xp;
    const stats = baseStats(rec.vocation, rec.level);
    p.maxHp = stats.maxHp;
    p.maxMana = stats.maxMana;
    // Inventário antes de limitar vida/mana: o equipamento soma ao máximo.
    this.inventory.load(p, rec.data);
    p.hp = rec.data.hp ?? Number.MAX_SAFE_INTEGER;
    p.mana = rec.data.mana ?? Number.MAX_SAFE_INTEGER;
    this.inventory.applyStats(p);
    const start = this.validStart(rec.x, rec.y) ? { x: rec.x!, y: rec.y! } : this.map.spawn;
    p.x = start.x;
    p.y = start.y;
    p.dir = rec.dir;
    this.skills.load(p, rec.data.skills);
    this.fight.load(p, rec.data.stance, rec.data.chase);
    this.food.load(p.id, rec.data, Date.now());
    this.records.set(sid, rec);
    this.state.players.set(sid, p);
    this.conditions.refreshPlayer(p.id); // velocidade do equipamento
    this.movement.addPlayer(p);
    client.send(S2C.Explored, this.exploration.addPlayer(sid, rec, p.x, p.y));
    const inv = this.inventory.inventoryMsg(p.id);
    if (inv) client.send(S2C.Inventory, inv);
    if (auth.weakPassword) {
      client.send(S2C.Notice, {
        text: "Sua senha é curta (menos de 6 caracteres). Considere uma senha mais forte.", kind: "warn",
      } satisfies NoticeMsg);
    }
    console.log(`[world] ${rec.name} entrou (${this.state.players.size} online)`);
  }

  /** A posição salva serve? (andável, alcançável do spawn, sem portal/NPC/monstro). */
  validStart(x: number | null, y: number | null): boolean {
    return isValidStart(x, y, {
      grid: this.map.grid, reachable: this.reachable,
      isPortal: (tx, ty) => this.portals.isPortalTile(tx, ty),
      isNpc: (tx, ty) => this.npcs.isNpcAt(tx, ty),
      isMonster: (tx, ty) => this.monsters.isMonsterAt(tx, ty),
    });
  }

  get spawnPoint() { return this.map.spawn; }

  /** Tile livre para chegar por portal (andável, sem monstro/NPC/portal/outro jogador). */
  private isFreeTile(x: number, y: number, selfId: string): boolean {
    if (!this.map.grid.isWalkable(x, y) || this.monsters.isMonsterAt(x, y) || this.npcs.isNpcAt(x, y) || this.portals.isPortalTile(x, y)) return false;
    for (const o of this.state.players.values()) if (o.id !== selfId && o.x === x && o.y === y) return false;
    return true;
  }

  /** Derruba a sessão antiga do mesmo personagem: salva + limpa já (síncrono), cancela reconexão pendente, fecha o socket. */
  private replaceSession(oldSid: string) {
    const old = this.clients.getById(oldSid);
    console.log(`[world] ${this.names.get(oldSid) ?? "?"} entrou em outro lugar — derrubando a sessão antiga`);
    this.cleanupSession(oldSid);
    const pending = this.reconnecting.get(oldSid);
    if (pending) { this.reconnecting.delete(oldSid); pending.reject(new Error("replaced")); }
    if (old) {
      try { old.leave(CLOSE_REPLACED, REPLACED_REASON); } catch (e) { this.errors.report("replaceSession.leave", e); }
    }
  }

  /**
   * Queda sem consentimento (Wi-Fi, aba suspensa): o jogador fica parado no mundo por RECONNECT_S segundos
   * enquanto o SDK reconecta sozinho. Sem reconexão → o Colyseus chama onLeave (limpeza real).
   */
  onDrop(client: Client, code?: number) {
    const sid = client.sessionId;
    if (this.shuttingDown || !this.records.has(sid) || code === CloseCode.WITH_ERROR || code === CLOSE_REPLACED) return; // → onLeave
    const p = this.state.players.get(sid);
    if (p) this.movement.teleport(p, p.x, p.y); // para de andar
    console.log(`[world] ${p?.name ?? sid} caiu (código ${code}); aguardando reconexão por ${RECONNECT_S} s`);
    const r = this.allowReconnection(client, RECONNECT_S);
    this.reconnecting.set(sid, r);
    r.then(() => {}, () => {}).finally(() => { if (this.reconnecting.get(sid) === r) this.reconnecting.delete(sid); });
  }

  onReconnect(client: Client) {
    const sid = client.sessionId;
    this.reconnecting.delete(sid);
    // O que foi enviado durante a queda se perdeu: reenvia o estado que não está no schema.
    const explored = this.exploration.message(sid);
    if (explored) client.send(S2C.Explored, explored);
    const inv = this.inventory.inventoryMsg(sid);
    if (inv) client.send(S2C.Inventory, inv);
    this.conditions.refreshPlayer(sid);
    console.log(`[world] ${this.names.get(sid) ?? sid} reconectou`);
  }

  onLeave(client: Client, code?: number) {
    const sid = client.sessionId;
    const name = this.names.get(sid);
    this.cleanupSession(sid);
    if (name) console.log(`[world] ${name} saiu (código ${code}; ${this.state.players.size} online)`);
  }

  /** Salva e remove a sessão de todos os sistemas. Limpeza e liberação do nome SEMPRE rodam, mesmo se salvar falhar. */
  cleanupSession(sid: string) {
    try {
      this.save(sid);
    } catch (e) {
      this.errors.report("save (saída)", e);
    } finally {
      const name = this.names.get(sid);
      if (name) runSafe("releaseOnline", () => releaseOnline(name, sid), this.errors);
      const steps: [string, () => void][] = [
        ["movement", () => this.movement.removePlayer(sid)],
        ["summons", () => this.summons.despawnOwner(sid)],
        ["combat", () => this.combat.removePlayer(sid)],
        ["conditions", () => this.conditions.removePlayer(sid)],
        ["spells", () => this.spells.removePlayer(sid)],
        ["skills", () => this.skills.removePlayer(sid)],
        ["regen", () => this.regen.removePlayer(sid)],
        ["food", () => this.food.removePlayer(sid)],
        ["exploration", () => this.exploration.removePlayer(sid)],
        ["inventory", () => this.inventory.removePlayer(sid)],
        ["npcs", () => this.npcs.removePlayer(sid)],
        ["fight", () => this.fight.removePlayer(sid)],
        ["chat", () => clearChatState(sid)],
      ];
      for (const [k, fn] of steps) runSafe(`saída/${k}`, fn, this.errors);
      this.throttle.clearPrefix(`${sid}:`);
      this.state.players.delete(sid);
      this.records.delete(sid);
      this.names.delete(sid);
    }
  }

  /** Desligamento gracioso (Colyseus chama no gracefullyShutdown): salva todos antes de desconectar. */
  onBeforeShutdown() {
    this.shuttingDown = true;
    const n = this.saveAll();
    console.log(`[world] desligando: ${n} personagem(ns) salvo(s)`);
    super.onBeforeShutdown();
  }

  onDispose() {
    this.saveAll();
    if (liveWorld === this) liveWorld = null;
  }

  /** Registra um handler: só para quem tem personagem; aplica o limite por tipo (excesso descartado). */
  private on<T>(type: string, fn: (p: PlayerState, m: T, c: Client) => void) {
    const limit = MESSAGE_LIMITS[type];
    this.onMessage(type, (c: Client, m: T) => {
      const p = this.state.players.get(c.sessionId);
      if (!p) return;
      if (limit !== undefined && !this.throttle.allow(`${c.sessionId}:${type}`, limit)) return;
      fn(p, m, c);
    });
  }

  private save(sessionId: string) {
    const p = this.state.players.get(sessionId);
    const rec = this.records.get(sessionId);
    if (!p || !rec) return;
    rec.level = p.level;
    rec.xp = p.xp;
    rec.data.hp = p.hp;
    rec.data.mana = p.mana;
    rec.x = p.x;
    rec.y = p.y;
    rec.dir = p.dir;
    rec.data.skills = this.skills.serialize(sessionId) ?? rec.data.skills;
    rec.data.explored = this.exploration.serialize(sessionId) ?? rec.data.explored;
    if (rec.data.explored) rec.data.exploredW = this.exploration.mapWidth;
    Object.assign(rec.data, this.inventory.serialize(sessionId) ?? {});
    const fed = this.food.serialize(sessionId, Date.now());
    if (fed) rec.data.fed = fed; else delete rec.data.fed;
    rec.data.stance = p.stance;
    rec.data.chase = p.chase;
    this.persist(rec);
  }

  /** Salva todos (autosave / desligamento). Um registro com erro não impede os outros. */
  saveAll(): number {
    let n = 0;
    for (const id of [...this.records.keys()]) if (runSafe("autosave", () => this.save(id), this.errors)) n++;
    return n;
  }
}
