import { e2eMode } from "../e2e.ts";
import { CloseCode, ErrorCode, Room, ServerError, type Client, type Deferred, type RoomException, type RoomMethodName } from "@colyseus/core";
import {
  C2S, CLOSE_KICKED, CYCLE_START_MS, WEEKLY_EVENTS, WaterGrid, type ChallengeActionMsg, type FishMsg, type TradeMsg, wrapCycle, CLOSE_REPLACED, CLOSE_TRAINING, S2C, SKILLS, TICK_MS, baseStats,
  type ArenaActionMsg, type AttackMsg, type CastMsg, type ChatSendMsg, type DiscardItemMsg, type ItemInstance, type DropItemMsg, type FeedMsg, type FightModeMsg, type JoinOptions,
  type MoveItemMsg, type MoveMsg, type NoticeMsg, type PartyActionMsg, type NpcInteractMsg, type NpcTradeMsg, type PickupItemMsg, type QuickPotionMsg, type SetOutfitMsg, type SetTitleMsg, type TurnMsg,
  type TrainingResultMsg, type TrainOfflineMsg, type TrainOpenMsg, type UseItemMsg, type WalkToMsg,
  type QuestActionMsg, findObjects,
  PARTY_SHARE_RANGE,
} from "@lemonquest/shared";
import { PlayerState, WorldState } from "../state.ts";
import { loadMap, type LoadedMap } from "../world/map.ts";
import { MovementSystem } from "../systems/movement.ts";
import { ExplorationSystem } from "../systems/exploration.ts";
import { PortalSystem } from "../systems/portals.ts";
import { MonsterManager, parseSafeZones, parseSpawns } from "../systems/monsters.ts";
import { CombatSystem, attackProfile, playerArmor } from "../systems/combat.ts";
import { RegenSystem } from "../systems/regen.ts";
import { handleChat, clearChatState, type ChatHooks } from "../systems/chat.ts";
import { SocialSystem } from "../systems/social.ts";
import { statusLines } from "../systems/status.ts";
import { TradeSystem } from "../systems/trade.ts";
import { EventSystem } from "../systems/events.ts";
import { rollWeek } from "../systems/weekly.ts";
import { ChallengeSystem } from "../systems/challenges.ts";
import { FishingSystem } from "../systems/fishing.ts";
import { FoodSystem } from "../systems/food.ts";
import { ConditionSystem } from "../systems/conditions.ts";
import { SkillSystem } from "../systems/skills.ts";
import { TrainingSystem, parseStatues } from "../systems/training.ts";
import { SummonSystem } from "../systems/summons.ts";
import { SpellSystem } from "../systems/spells.ts";
import { InventorySystem } from "../systems/inventory.ts";
import { LootSystem } from "../systems/loot.ts";
import { GroundSystem } from "../systems/ground.ts";
import { NpcSystem, parseNpcs } from "../systems/npcs.ts";
import { ArenaSystem, parseArenas } from "../systems/arena.ts";
import { QuestSystem, type ZoneRect } from "../systems/quests.ts";
import { killCredit, type Monster } from "../systems/monsters.ts";
import { FightModeSystem, stanceDealt, stanceTaken } from "../systems/fightmode.ts";
import { handleDevCommand, isDevAdmin } from "../systems/devcommands.ts";
import { HELP_COMMANDS, handleAdminCommand, helpLines, muteRemaining } from "../systems/admin.ts";
import { grantUnlock } from "../systems/achievements.ts";
import { applySetOutfit, loadOutfit } from "../systems/outfit.ts";
import { AchievementSystem, setActiveAchievements } from "../systems/achievements.ts";
import { PartySystem } from "../systems/party.ts";
import { ErrorLog, runSafe, runSteps } from "../systems/safe.ts";
import { claimOnline, consumeToken, createResetCode, releaseOnline, type AuthData } from "../persistence/auth.ts";
import { getCharacterByName, getKv, nameKey, loadGroundRows, replaceGroundRows, saveCharacter, setKv, transaction } from "../persistence/db.ts";
import { PerSecond } from "../persistence/ratelimit.ts";
import type { CharacterRecord } from "../persistence/types.ts";
import { isValidStart, reachableFrom } from "../world/tiles.ts";

export const AUTOSAVE_MS = 15_000;
/** Intervalo de sincronização do relógio do mundo (ciclo dia/noite). */
export const WORLD_TIME_SYNC_MS = 5_000;
/**
 * Segundos que um jogador que caiu (Wi-Fi) continua no mundo esperando a reconexão automática do SDK.
 * Só no modo E2E dá para encurtar (LEMONQUEST_RECONNECT_S): personagens de testes anteriores somem logo em vez de
 * ficarem 20 s no mundo competindo pelos monstros do teste seguinte. Em produção é sempre 20.
 */
export const RECONNECT_S = e2eMode() && Number(process.env.LEMONQUEST_RECONNECT_S) > 0 ? Number(process.env.LEMONQUEST_RECONNECT_S) : 20;
/** Fechamento da sessão antiga quando o mesmo personagem entra em outro lugar: CLOSE_REPLACED (shared). */
export const REPLACED_REASON = "Sua conta entrou em outro lugar";
/** Motivo padrão do /kick sem motivo (vai no frame de fechamento). */
export const KICK_DEFAULT_REASON = "Expulso por um administrador";
/** Limite global por cliente (Colyseus 0.18: excedeu → desconecta o cliente com WITH_ERROR). */
export const MAX_MESSAGES_PER_SECOND = 60;
/** Limites por tipo de mensagem (excesso descartado em silêncio). */
export const MESSAGE_LIMITS: Partial<Record<string, number>> = {
  [C2S.WalkTo]: 5, [C2S.NpcInteract]: 5, [C2S.Arena]: 5, [C2S.Cast]: 10, [C2S.MoveItem]: 20, [C2S.TrainOpen]: 5, [C2S.TrainOffline]: 2, [C2S.SetOutfit]: 2, [C2S.SetTitle]: 2, [C2S.AchievementsRequest]: 2, [C2S.Party]: 5, [C2S.Quest]: 10, [C2S.Trade]: 10, [C2S.Fish]: 3, [C2S.Challenge]: 5,
  // Chat inclui comandos (/convidar...) e palavras mágicas, que não passam pelo limite de fala do chat.ts.
  [C2S.Chat]: 6,
};
/** Intervalo mínimo entre gravações "jogador + chão" depois de largar/pegar item (ver saveTransfers). */
export const TRANSFER_SAVE_MS = 1000;
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
  private ground!: GroundSystem;
  private npcs!: NpcSystem;
  private fight!: FightModeSystem;
  private arena!: ArenaSystem;
  private training!: TrainingSystem;
  private quests!: QuestSystem;
  private ach!: AchievementSystem;
  private party!: PartySystem;
  private social!: SocialSystem;
  private trade!: TradeSystem;
  private events!: EventSystem;
  private fishing!: FishingSystem;
  private weeklyAt = 0;
  private challenges!: ChallengeSystem;
  private perf = { n: 0, sum: 0, max: 0, since: Date.now() };
  /** Últimos ~30 s de ticks (para o /status) e contadores desde o boot. */
  private readonly tickRing = new Float32Array(600);
  private tickRingN = 0;
  private readonly bootAt = Date.now();
  private peakOnline = 0;
  private joins = 0;
  private records = new Map<string, CharacterRecord>(); // sessionId -> registro
  /** sessionId -> nome (dono do "online"), gravado logo no início do onJoin. */
  private names = new Map<string, string>();
  /** Reconexões pendentes (onDrop), para cancelar se o personagem entrar de novo por outro lugar. */
  private reconnecting = new Map<string, Deferred<Client>>();
  /**
   * Saiu de propósito (room.leave) logo depois de lutar: o personagem fica no mundo RECONNECT_S segundos, como numa queda
   * de conexão (pode morrer). Sem isso um cliente modificado escapava da morte saindo no último instante.
   */
  private lingering = new Map<string, { clear(): void; tick?(dt: number): void }>();
  private throttle = new PerSecond();
  readonly errors = new ErrorLog();
  private reachable!: Uint8Array;
  /** Ganchos do chat (magias, comandos de admin/dev, mute) — públicos para os testes. */
  chatHooks: ChatHooks = {};
  private steps: ReadonlyArray<readonly [string, () => void]> = [];
  private tickNow = 0;
  private shuttingDown = false;
  /** Jogadores que largaram/pegaram item do chão neste tick (ver saveTransfers). */
  private readonly transferred = new Set<string>();
  private lastTransferSave = 0;
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

    this.party = new PartySystem({ getPlayer, players: () => this.state.players.values(), send });
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
      eat: (p, f, now) => {
        const ok = this.food.eat(p, f, now);
        if (ok) this.ach?.event(p.id, "eat");
        return ok;
      },
      onGold: (p, n) => this.ach?.event(p.id, "gold", { n }),
      onStatsChanged: (p) => this.conditions.refreshPlayer(p.id),
      openChest: (p) => this.quests.openChest(p),
    });
    this.food = new FoodSystem({
      heal: (p, n) => this.combat.healPlayer(p, p.id, n),
      restoreMana: (p, n) => this.combat.restoreMana(p, n),
    });
    this.npcs = new NpcSystem({
      npcs: parseNpcs(this.map.tiled), inventory: this.inventory,
      players: () => this.state.players.values(), getPlayer, send, broadcast,
      blocked: (p, npcId) => (this.arena && !this.arena.canUseShop(p, npcId) ? "A loja do Coliseu só atende nas pausas entre as ondas." : null),
    });
    this.movement.setExtraBlocker((x, y) => this.monsters.isMonsterAt(x, y) || this.npcs.isNpcAt(x, y));
    // Itens no chão (persistidos no SQLite: sobrevivem a reinícios; o que expirou nesse meio-tempo some).
    this.ground = new GroundSystem({
      store: {
        load: () => loadGroundRows().flatMap((r) => {
          try {
            return [{ x: r.x, y: r.y, item: JSON.parse(r.item) as ItemInstance, expiresAt: r.expiresAt, owner: r.owner ?? undefined, ownerUntil: r.ownerUntil ?? undefined }];
          } catch { return []; }
        }),
        save: (rows) => replaceGroundRows(rows.map((r) => ({
          x: r.x, y: r.y, item: JSON.stringify(r.item), expiresAt: r.expiresAt, owner: r.owner ?? null, ownerUntil: r.ownerUntil ?? null,
        }))),
      },
      inventory: this.inventory, collection: this.state.groundItems, send,
      onDropped: (p) => { this.transferred.add(p.id); this.ach?.event(p.id, "drop"); },
      onPickedUp: (p) => { this.transferred.add(p.id); this.ach?.event(p.id, "pickup"); },
      canHold: (x, y) => this.map.grid.isWalkable(x, y) && !this.npcs.isNpcAt(x, y) && !this.portals.isPortalTile(x, y),
      seeThrough: (x, y) => this.map.grid.isWalkable(x, y),
    });
    console.log(`[world] itens no chão restaurados: ${this.ground.restore()}`);
    this.quests = new QuestSystem({
      inventory: this.inventory, getPlayer, send, broadcast,
      gainXp: (p, n) => this.combat.gainXp(p, n, p.x, p.y),
      npcOpen: (id) => this.npcs.openFor(id),
      zones: parseZones(this.map.tiled),
      placeLoot: (p, it) => this.ground.placeLoot(p, it),
      onUnlock: (id, unlockId) => this.onUnlock(id, unlockId),
      onComplete: (id, _q, bounty) => { if (!bounty) this.ach?.event(id, "quest"); },
    });
    this.loot = new LootSystem({ inventory: this.inventory, getPlayer, send, broadcast, ground: this.ground, lootMult: () => this.events?.lootMult() ?? 1 });
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
      // Investida não para em NPC nem em portal (cair num portal teleportava o cavaleiro sem querer).
      isBlocked: (x, y) => this.npcs.isNpcAt(x, y) || this.portals.isPortalTile(x, y),
      isAlly: (a, b) => this.party.sameParty(a.id, b.id),
    });
    this.training = new TrainingSystem({
      statues: parseStatues(this.map.tiled), skills: this.skills,
      inCombat: (id, now) => this.combat.inCombat(id, now), send,
      isFree: (x, y, selfId) => this.isFreeTile(x, y, selfId),
    });
    this.fight = new FightModeSystem({
      movement: this.movement, monsters: this.monsters,
      attackRange: (p) => this.combat.attackOf(p).range,
    });
    this.combat.hooks = {
      xpMult: () => this.events?.xpMult() ?? 1,
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
        this.ach?.event(p.id, "death");
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
      onMonsterKilled: (m) => {
        this.quests.onKill(m.def.id, this.questCredit(m));
        for (const pid of this.partyKillCredit(m)) this.ach?.event(pid, "party_kill");
        this.combat.later(() => this.loot.onKill(m));
      },
      onKillCredit: (pid, m) => {
        this.ach?.event(pid, "kill", { defId: m.def.id, boss: !!m.def.boss });
      },
      interceptDeath: (p) => this.arena.interceptDeath(p),
      xpShares: (m, shares, now) => this.party.shareXp(shares, m.s.x, m.s.y, now),
      onActivity: (id, now) => this.party.markActive(id, now),
    };
    this.arena = new ArenaSystem({
      layout: parseArenas(this.map.tiled),
      master: () => this.npcs.spot("arena_master"),
      fallbackExit: this.map.spawn,
      monsters: this.monsters, combat: this.combat,
      players: () => this.state.players.values(), getPlayer,
      teleport: (p, x, y) => this.movement.teleport(p, x, y),
      isFree: (x, y, self) => this.isFreeTile(x, y, self),
      addGold: (p, n) => this.inventory.addGold(p, n),
      loadServerBest: () => Number(getKv("arena.serverBest") ?? 0),
      saveServerBest: (n) => setKv("arena.serverBest", String(n)),
      getBest: (id) => this.records.get(id)?.data.arenaBest ?? 0,
      setBest: (id, n) => { const rec = this.records.get(id); if (rec) rec.data.arenaBest = n; },
      onWaveCleared: (p, wave) => { this.ach?.event(p.id, "arena", { wave }); this.quests.onArenaWave(p.id, wave); },
      onEnter: (p) => this.npcs.close(p.id),
      onExit: (p) => {
        this.npcs.close(p.id);
        this.summons.despawnOwner(p.id);
        this.conditions.clear(p.id);
      },
      closeNpc: (id) => this.npcs.close(id, "arena_shop_"),
      partyMates: (id) => this.party.membersOf(id).filter((m) => m !== id),
      isPartyLeader: (id) => this.party.partyFor(id)?.leaderId === id,
      send, broadcast,
    });
    this.ach = new AchievementSystem({
      record: (id) => this.records.get(id), getPlayer, players: () => this.state.players.values(), send, broadcast,
      explorePct: (id) => this.exploration.percent(id, this.reachable),
      equippedCount: (id) => this.inventory.equippedCount(id),
    });
    setActiveAchievements(this.ach);
    this.monsters.spawnAll();
    console.log(`[lemonquest] ${this.monsters.size} monstros em ${parseSpawns(this.map.tiled).length} spawns, ${this.npcs.list.length} NPCs`);

    // Alcançabilidade a partir do spawn (inclui portais) — valida a posição salva no onJoin.
    this.reachable = reachableFrom(this.map.grid, this.map.spawn, (x, y) => this.portals.destination(x, y));
    let nReach = 0;
    for (const v of this.reachable) nReach += v;
    console.log(`[lemonquest] ${nReach} tiles alcançáveis a partir do spawn`);

    // Comandos com "/": de ADMIN (LEMONQUEST_ADMINS, também em produção) e de DEV (só com LEMONQUEST_DEV_COMMANDS=1,
    // fora de produção). Quem não pode → "Comando desconhecido." (chat.ts).
    const help = (p: PlayerState, text: string) => {
      if (!(HELP_COMMANDS as readonly string[]).includes(text.trim().split(/\s+/)[0]!.toLowerCase())) return false;
      for (const line of helpLines(p.name)) send(p.id, S2C.Notice, { text: line, kind: "info", log: true } satisfies NoticeMsg);
      return true;
    };
    const water = WaterGrid.fromTiled(this.map.tiled);
    this.fishing = new FishingSystem({
      getPlayer, send, broadcast, isWater: (x, y) => water.isWater(x, y), inventory: this.inventory,
      caught: (id) => this.records.get(id)?.data.ach?.stats?.fish ?? 0,
      onCatch: (p) => this.ach.event(p.id, "fish"),
      inArena: (id) => this.arena.inMatch(id),
    });
    this.challenges = new ChallengeSystem({
      getPlayer, record: (id) => this.records.get(id), send, inventory: this.inventory,
      gainXp: (p, n) => this.combat.gainXp(p, n, p.x, p.y), save: (id) => this.save(id),
    });
    this.events = new EventSystem({ broadcast, send, onStart: (ev) => { if (ev.boss) this.monsters.callBoss(ev.boss); }, store: { get: () => getKv("event.manual"), set: (v) => setKv("event.manual", v) } });
    this.trade = new TradeSystem({
      getPlayer: (id) => this.state.players.get(id), send, inventory: this.inventory,
      inArena: (id) => this.arena.inMatch(id), save: (id) => this.save(id),
    });
    this.social = new SocialSystem({
      players: () => this.state.players.values(),
      record: (id) => this.records.get(id),
      send, broadcast,
      exists: (name) => [...this.state.players.values()].find((q) => nameKey(q.name) === nameKey(name))?.name ?? getCharacterByName(name)?.name,
      muted: (pl) => muteRemaining(this.records.get(pl.id)),
    });
    const command = (p: PlayerState, text: string) => help(p, text) || this.social.command(p, text) || this.party.command(p, text) || handleAdminCommand(p, text, {
      send, broadcast,
      players: () => this.state.players.values(),
      record: (id) => this.records.get(id),
      findOffline: (name) => getCharacterByName(name),
      saveOffline: (rec) => this.persist(rec),
      kick: (id, reason) => this.kick(id, reason),
      teleportNear: (admin, target) => this.teleportNear(admin, target),
      resetCode: (account, by) => createResetCode(account, by),
      devTp: (pl) => isDevAdmin(pl.name),
      status: () => this.statusLines(),
      events: {
        ids: () => WEEKLY_EVENTS.map((e) => e.id),
        start: (id, min) => { const a = this.events.start(id, min); return a ? `${a.name} iniciado por ${min} min (XP ×${a.xpMult}, loot ×${a.lootMult}).` : null; },
        stop: () => this.events.stop(),
        status: () => this.events.statusLines(),
      },
      grantUnlock: (rec, id, online) => (online ? this.ach.grantTo(online, rec, id, true) : grantUnlock(rec, id)),
    }) || handleDevCommand(p, text, {
      inventory: this.inventory, send,
      teleport: (pl, x, y) => this.movement.teleport(pl, x, y),
      isWalkable: (x, y) => this.map.grid.isWalkable(x, y) && !this.npcs.isNpcAt(x, y),
      setMagicLevel: (pl, n) => this.skills.setLevel(pl, "magic", n),
      quest: (pl, args) => this.quests.devCommand(pl, args),
    });
    const muted = (p: PlayerState) => muteRemaining(this.records.get(p.id));
    this.chatHooks = {
      castWords: (pl, text) => this.spells.castWords(pl, text), command, muted,
      partyChat: (pl, text) => this.party.chat(pl, text),
    };
    this.on<MoveMsg>(C2S.Move, (p, m) => { this.fight.pause(p.id); this.movement.onMove(p, m); });
    this.on<WalkToMsg>(C2S.WalkTo, (p, m) => { this.fight.pause(p.id); this.movement.onWalkTo(p, m); });
    this.on<TurnMsg>(C2S.Turn, (p, m) => this.movement.onTurn(p, m));
    this.on<AttackMsg>(C2S.Attack, (p, m) => this.combat.onAttack(p, m));
    this.on<ChatSendMsg>(C2S.Chat, (p, m, c) =>
      handleChat(this, c, p, m, this.chatHooks));
    this.on<CastMsg>(C2S.Cast, (p, m) => this.spells.onCast(p, m));
    this.on<MoveItemMsg>(C2S.MoveItem, (p, m) => this.inventory.onMoveItem(p, m));
    this.on<UseItemMsg>(C2S.UseItem, (p, m) => this.inventory.onUseItem(p, m));
    this.on<QuickPotionMsg>(C2S.QuickPotion, (p, m) => this.inventory.onQuickPotion(p, m));
    this.on<DiscardItemMsg>(C2S.DiscardItem, (p, m) => this.ground.onDiscard(p, m));
    this.on<DropItemMsg>(C2S.DropItem, (p, m) => this.ground.onDrop(p, m));
    this.on<PickupItemMsg>(C2S.PickupItem, (p, m) => this.ground.onPickup(p, m));
    this.on<NpcInteractMsg>(C2S.NpcInteract, (p, m) => {
      this.npcs.onInteract(p, m);
      if (m?.npcId && this.npcs.openFor(p.id) === m.npcId) this.quests.onTalk(p, m.npcId);
      if (m?.npcId === "arena_master" && this.npcs.openFor(p.id) === "arena_master") this.arena.openLobbies(p);
    });
    this.on<ArenaActionMsg>(C2S.Arena, (p, m) => this.arena.onAction(p, m));
    this.on<NpcTradeMsg>(C2S.NpcTrade, (p, m) => this.npcs.onTrade(p, m));
    this.on<QuestActionMsg>(C2S.Quest, (p, m) => this.quests.onAction(p, m));
    this.on<FightModeMsg>(C2S.FightMode, (p, m) => this.fight.onFightMode(p, m));
    this.on<TrainOpenMsg>(C2S.TrainOpen, (p, m) => this.training.onOpen(p, m));
    this.on<TrainOfflineMsg>(C2S.TrainOffline, (p, m, c) => this.startOfflineTraining(p, m, c));
    this.on<PartyActionMsg>(C2S.Party, (p, m) => this.party.onAction(p, m));
    this.on<TradeMsg>(C2S.Trade, (p, m) => this.trade.onMessage(p, m));
    this.on<FishMsg>(C2S.Fish, (p, m) => this.fishing.onMessage(p, m));
    this.on<ChallengeActionMsg>(C2S.Challenge, (p, m) => this.challenges.onMessage(p, m));
    this.on<SetOutfitMsg>(C2S.SetOutfit, (p, m) => { applySetOutfit(p, this.records.get(p.id), m); });
    this.on<SetTitleMsg>(C2S.SetTitle, (p, m) => { this.ach.onSetTitle(p, m); });
    this.on<unknown>(C2S.AchievementsRequest, (p) => { this.ach.sendState(p.id); });

    const players = () => this.state.players.values();
    this.steps = [
      ["fight", () => this.fight.tick(this.tickNow, players())],
      ["movement", () => this.movement.tick(this.tickNow, players())],
      ["portals", () => { for (const p of players()) this.portals.check(p); }],
      ["exploration", () => { for (const p of players()) this.exploration.onPosition(p.id, p.x, p.y); }],
      ["achievements", () => this.ach.tick(this.tickNow)],
      ["monsters", () => this.monsters.tick(this.tickNow)],
      ["combat", () => this.combat.tick(this.tickNow)],
      ["conditions", () => this.conditions.tick(this.tickNow)],
      ["regen", () => this.regen.tick(this.tickNow, players())],
      ["arena", () => this.arena.tick(this.tickNow)],
      ["food", () => this.food.tick(this.tickNow, players())],
      ["npcs", () => this.npcs.tick(this.tickNow)],
      ["quests", () => this.quests.tick(this.tickNow, players())],
      ["party", () => this.party.sync(this.tickNow)],
      ["trade", () => this.trade.tick()],
      ["fishing", () => this.fishing.tick()],
      ["events", () => this.events.tick(this.tickNow)],
      // Virada da semana com o jogador online: renova a linha de base (no máximo 1×/min).
      ["weekly", () => {
        if (this.tickNow - this.weeklyAt < 60_000) return;
        this.weeklyAt = this.tickNow;
        const now = new Date(this.tickNow);
        for (const rec of this.records.values()) rollWeek(rec, now);
      }],
      ["conditions.sync", () => this.conditions.sync(this.tickNow)],
      ["combat.flush", () => this.combat.flush()],
      ["ground", () => this.ground.tick(this.tickNow)],
      ["inventory.flush", () => this.inventory.flush()],
      ["transfers", () => this.saveTransfers()],
    ];

    this.setSimulationInterval(() => this.tick(), TICK_MS);
    this.clock.setInterval(() => this.saveAll(), AUTOSAVE_MS);
    // Ciclo dia/noite: todos veem a mesma hora (o cliente extrapola entre as atualizações).
    this.cycleOriginMs = Date.now() - CYCLE_START_MS;
    this.updateWorldTime();
    this.clock.setInterval(() => this.updateWorldTime(), WORLD_TIME_SYNC_MS);
  }

  private cycleOriginMs = 0;
  private updateWorldTime() {
    this.state.worldTimeMs = Math.floor(wrapCycle(Date.now() - this.cycleOriginMs));
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
    this.tickRing[this.tickRingN++ % this.tickRing.length] = ms;
    if (now - s.since < PERF_LOG_MS) return;
    if (DEV || s.max > PERF_PROD_MIN_MAX_MS) {
      console.log(`[tick] ${s.n} ticks: média ${(s.sum / s.n).toFixed(3)} ms, máx ${s.max.toFixed(2)} ms — ${this.monsters.size} monstros, ${this.state.players.size} jogadores`);
    }
    this.perf = { n: 0, sum: 0, max: 0, since: now };
  }

  /** Linhas do /status (admin). */
  statusLines(): string[] {
    const n = Math.min(this.tickRingN, this.tickRing.length);
    let sum = 0, max = 0;
    for (let i = 0; i < n; i++) { sum += this.tickRing[i]!; if (this.tickRing[i]! > max) max = this.tickRing[i]!; }
    const mem = process.memoryUsage();
    return statusLines({
      uptimeMs: Date.now() - this.bootAt, online: this.state.players.size, peakOnline: this.peakOnline, joins: this.joins,
      monsters: this.monsters.size, pendingRespawns: this.monsters.pendingRespawns, groundItems: this.ground.size,
      tickAvgMs: n ? sum / n : 0, tickMaxMs: max, tickBudgetMs: TICK_MS,
      rssMb: Math.round(mem.rss / 1048576), heapMb: Math.round(mem.heapUsed / 1048576), errors: this.errors.total,
    });
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
    // Saiu/caiu no meio de uma partida do coliseu: volta na saída do coliseu.
    const start = this.arena.loginPosition(rec.x, rec.y)
      ?? (this.validStart(rec.x, rec.y) ? { x: rec.x!, y: rec.y! } : this.map.spawn);
    p.x = start.x;
    p.y = start.y;
    p.dir = rec.dir;
    const look = loadOutfit(rec);
    p.outfit = look.outfit;
    p.addons = look.addons;
    this.skills.load(p, rec.data.skills);
    // Treino offline pendente: aplica o progresso, cura tudo e coloca o jogador ao lado da estátua.
    const trained = rec.data.offlineTraining ? this.returnFromTraining(p, rec) : null;
    this.fight.load(p, rec.data.stance, rec.data.chase);
    this.food.load(p.id, rec.data, Date.now());
    this.quests.load(p, rec.data.quests);
    rollWeek(rec, new Date());
    this.records.set(sid, rec);
    this.state.players.set(sid, p);
    this.conditions.refreshPlayer(p.id); // velocidade do equipamento
    this.ach.load(p, rec);
    { const st = this.ach.state(sid); if (st) client.send(S2C.Achievements, st); }
    if (trained) this.ach.event(p.id, "offline", { minutes: trained.minutes });
    this.movement.addPlayer(p);
    client.send(S2C.Explored, this.exploration.addPlayer(sid, rec, p.x, p.y));
    const inv = this.inventory.inventoryMsg(p.id);
    if (inv) client.send(S2C.Inventory, inv);
    if (trained) client.send(S2C.TrainingResult, trained);
    if (auth.weakPassword) {
      client.send(S2C.Notice, {
        text: "Sua senha é curta (menos de 6 caracteres). Considere uma senha mais forte.", kind: "warn",
      } satisfies NoticeMsg);
    }
    console.log(`[world] ${rec.name} entrou (${this.state.players.size} online)`);
    this.social.onJoin(p);
    this.events.sendTo(sid);
    this.joins++;
    this.peakOnline = Math.max(this.peakOnline, this.state.players.size);
  }

  /** Aplica e limpa o treino offline do registro (chamado no onJoin, antes de o jogador entrar no mundo). */
  private returnFromTraining(p: PlayerState, rec: CharacterRecord): TrainingResultMsg | null {
    const t = rec.data.offlineTraining;
    delete rec.data.offlineTraining;
    if (!t || !SKILLS.includes(t.skill)) return null;
    const result = this.training.applyOffline(p, t, Date.now());
    p.hp = p.maxHp;
    p.mana = p.maxMana;
    const tile = this.training.returnTile(t.statueId, p.id);
    if (tile) { p.x = tile.x; p.y = tile.y; }
    else if (!this.validStart(p.x, p.y)) { p.x = this.map.spawn.x; p.y = this.map.spawn.y; }
    return result;
  }

  /** C2S.TrainOffline: valida, grava o treino, salva e desconecta com CLOSE_TRAINING. */
  private startOfflineTraining(p: PlayerState, m: TrainOfflineMsg, c: Client) {
    const rec = this.records.get(p.id);
    if (!rec) return;
    const t = this.training.begin(p, m, Date.now());
    if (!t) return;
    rec.data.offlineTraining = t;
    // Salva já (síncrono): se falhar, o jogador continua online e o treino não vale.
    try {
      this.save(p.id);
    } catch (e) {
      delete rec.data.offlineTraining;
      this.errors.report("save (treino offline)", e);
      c.send(S2C.Notice, { text: "Não foi possível salvar. Tente de novo.", kind: "warn" } satisfies NoticeMsg);
      return;
    }
    console.log(`[world] ${p.name} foi treinar ${t.skill} offline`);
    c.leave(CLOSE_TRAINING, "Treinando offline");
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

  /**
   * Membros do grupo de `playerId` (incluindo ele) vivos a até `range` tiles de (x,y); sem grupo, só ele (se perto).
   * Para quests/bounties creditarem abates ao grupo.
   */
  partyMembersNear(playerId: string, x: number, y: number, range: number): PlayerState[] {
    return this.party.partyMembersNear(playerId, x, y, range);
  }

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
    this.lingering.get(oldSid)?.clear();
    this.lingering.delete(oldSid);
    this.cleanupSession(oldSid);
    const pending = this.reconnecting.get(oldSid);
    if (pending) { this.reconnecting.delete(oldSid); pending.reject(new Error("replaced")); }
    if (old) {
      try { old.leave(CLOSE_REPLACED, REPLACED_REASON); } catch (e) { this.errors.report("replaceSession.leave", e); }
    }
  }

  /** /kick: fecha a sessão com CLOSE_KICKED + motivo (sem reconexão automática; onLeave salva e limpa). */
  kick(sessionId: string, reason: string) {
    // Caído esperando reconexão: o kick tem de valer também (senão o SDK reconecta e o jogador segue no mundo).
    const pending = this.reconnecting.get(sessionId);
    if (pending) {
      this.reconnecting.delete(sessionId);
      try { pending.reject(new Error("kicked")); } catch (e) { this.errors.report("kick.reconnect", e); }
    }
    // Ficou no mundo depois de sair em combate: o kick tira já.
    const linger = this.lingering.get(sessionId);
    if (linger) { linger.clear(); this.endLinger(sessionId); return; }
    const c = this.clients.getById(sessionId);
    if (!c) return;
    try { c.leave(CLOSE_KICKED, reason || KICK_DEFAULT_REASON); } catch (e) { this.errors.report("kick.leave", e); }
  }

  /** /tp <nome>: leva o admin para um tile livre ao redor do alvo (raio 1, depois 2). */
  teleportNear(admin: PlayerState, target: PlayerState): boolean {
    for (let r = 1; r <= 2; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = target.x + dx, y = target.y + dy;
          if (!this.isFreeTile(x, y, admin.id)) continue;
          this.movement.teleport(admin, x, y);
          this.clients.getById(admin.id)?.send(S2C.Teleported, { x, y });
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Queda sem consentimento (Wi-Fi, aba suspensa): o jogador fica parado no mundo por RECONNECT_S segundos
   * enquanto o SDK reconecta sozinho. Sem reconexão → o Colyseus chama onLeave (limpeza real).
   */
  onDrop(client: Client, code?: number) {
    const sid = client.sessionId;
    if (this.shuttingDown || !this.records.has(sid) || code === CloseCode.WITH_ERROR || code === CLOSE_REPLACED || code === CLOSE_TRAINING || code === CLOSE_KICKED) return; // → onLeave
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
    this.arena.resend(sid);
    this.quests.resend(sid);
    this.ach.sendState(sid);
    this.party.resend(sid);
    console.log(`[world] ${this.names.get(sid) ?? sid} reconectou`);
  }

  onLeave(client: Client, code?: number) {
    const sid = client.sessionId;
    const name = this.names.get(sid);
    if (code === CloseCode.CONSENTED && this.shouldLinger(sid)) {
      const p = this.state.players.get(sid);
      if (p) this.movement.teleport(p, p.x, p.y); // para de andar (como na queda): não chega à zona de proteção sozinho
      console.log(`[world] ${name ?? sid} saiu em combate; fica no mundo por ${RECONNECT_S} s`);
      this.lingering.set(sid, this.clock.setTimeout(() => this.endLinger(sid), RECONNECT_S * 1000));
      return;
    }
    this.cleanupSession(sid);
    if (name) console.log(`[world] ${name} saiu (código ${code}; ${this.state.players.size} online)`);
  }

  /** Fica no mundo ao sair? Só vivo, em combate recente e fora de partida do Coliseu (lá sair já é desistir sem penalidade). */
  private shouldLinger(sid: string): boolean {
    const p = this.state.players.get(sid);
    return !this.shuttingDown && !!p && p.hp > 0 && this.combat.inCombat(sid, Date.now()) && !this.arena.inMatch(sid);
  }

  /** Fim da permanência após sair em combate (ou cancelamento: relogin/kick). */
  private endLinger(sid: string) {
    if (!this.lingering.delete(sid)) return;
    const name = this.names.get(sid);
    this.cleanupSession(sid);
    if (name) console.log(`[world] ${name} saiu (após o combate; ${this.state.players.size} online)`);
  }

  /** Salva e remove a sessão de todos os sistemas. Limpeza e liberação do nome SEMPRE rodam, mesmo se salvar falhar. */
  cleanupSession(sid: string) {
    try {
      // Coliseu antes de salvar: quem estava numa partida volta para a saída (e é salvo lá), sem penalidade.
      runSafe("saída/arena", () => this.arena.removePlayer(sid), this.errors);
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
        ["ground", () => this.ground.removePlayer(sid)],
        ["npcs", () => this.npcs.removePlayer(sid)],
        ["quests", () => this.quests.removePlayer(sid)],
        ["fight", () => this.fight.removePlayer(sid)],
        ["chat", () => clearChatState(sid)],
        ["achievements", () => this.ach.removePlayer(sid)],
        ["trade", () => this.trade.removePlayer(sid)],
        ["fishing", () => this.fishing.removePlayer(sid)],
        ["party", () => this.party.removePlayer(sid)],
        ["social", () => { const pl = this.state.players.get(sid); if (pl) this.social.onLeave(pl); }],
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
    this.ground.flush();
    console.log(`[world] desligando: ${n} personagem(ns) salvo(s)`);
    super.onBeforeShutdown();
  }

  onDispose() {
    this.saveAll();
    this.ground.flush();
    if (liveWorld === this) { liveWorld = null; setActiveAchievements(null); }
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
    rec.data.outfit = p.outfit;
    rec.data.addons = p.addons;
    const quests = this.quests.serialize(sessionId);
    if (quests) rec.data.quests = quests;
    this.persist(rec);
  }

  /**
   * Quem recebe crédito de missão por um abate: jogadores online que causaram dano (monstros selvagens; nem
   * invocações nem ondas do coliseu) + membros do grupo vivos a até PARTY_SHARE_RANGE tiles do monstro.
   */
  questCredit(m: Monster): string[] {
    if (m.s.ownerId || m.arenaId) return [];
    const out = new Set<string>();
    // Mesma regra da XP/loot (killCredit): quem bateu e foi para longe não conta.
    for (const [id] of killCredit(m, (pid) => this.state.players.get(pid))) {
      out.add(id);
      // Grupo: membros vivos perto do monstro também recebem o crédito.
      for (const mate of this.partyMembersNear(id, m.s.x, m.s.y, PARTY_SHARE_RANGE)) out.add(mate.id);
    }
    return [...out];
  }

  /**
   * Conquista "abate em grupo": quem deu dano + membros vivos do mesmo grupo perto do monstro (o curandeiro conta),
   * desde que pelo menos 2 membros do MESMO grupo tenham participado. Jogadores sem grupo nunca contam.
   */
  partyKillCredit(m: Monster): string[] {
    if (m.s.ownerId) return [];
    const byParty = new Map<object, Set<string>>();
    for (const [id] of killCredit(m, (pid) => this.state.players.get(pid))) {
      const party = this.party.partyFor(id);
      if (!party) continue;
      let set = byParty.get(party);
      if (!set) byParty.set(party, (set = new Set()));
      set.add(id);
      for (const mate of this.partyMembersNear(id, m.s.x, m.s.y, PARTY_SHARE_RANGE)) set.add(mate.id);
    }
    const out: string[] = [];
    for (const set of byParty.values()) if (set.size >= 2) out.push(...set);
    return out;
  }

  /** Desbloqueio vindo de missão (roupa/addon/título): sistema de conquistas. */
  onUnlock(playerId: string, unlockId: string): void { this.ach?.grant(playerId, unlockId); }

  /**
   * Item passou da mochila para o chão (ou o contrário) neste tick: grava os jogadores envolvidos e o chão JUNTOS, numa
   * transação. Sem isso o chão (5 s) e o personagem (15 s) eram gravados em momentos diferentes e uma queda brusca do
   * processo nesse intervalo duplicava ou sumia com o item. No máximo 1×/TRANSFER_SAVE_MS: regravar o chão custa
   * ~1–7 ms (100–2000 itens) e não pode rodar a cada tick com gente arrumando a mochila.
   */
  saveTransfers(): void {
    if (!this.transferred.size || this.tickNow - this.lastTransferSave < TRANSFER_SAVE_MS) return;
    this.lastTransferSave = this.tickNow;
    const ids = [...this.transferred];
    this.transferred.clear();
    transaction(() => {
      for (const id of ids) runSafe("transfer.save", () => this.save(id), this.errors);
      this.ground.flush(this.tickNow);
    });
  }

  /** Salva todos (autosave / desligamento). Um registro com erro não impede os outros. */
  saveAll(): number {
    let n = 0;
    for (const id of [...this.records.keys()]) if (runSafe("autosave", () => this.save(id), this.errors)) n++;
    return n;
  }
}

/** Zonas nomeadas do mapa (objetos "zone"), em tiles inclusivos. */
export function parseZones(map: import("@lemonquest/shared").TiledMap): ZoneRect[] {
  const t = map.tilewidth;
  return findObjects(map, "zone").map((o) => ({
    name: o.name,
    x0: Math.floor(o.x / t), y0: Math.floor(o.y / t),
    x1: Math.floor((o.x + Math.max(1, o.width) - 1) / t), y1: Math.floor((o.y + Math.max(1, o.height) - 1) / t),
  }));
}
