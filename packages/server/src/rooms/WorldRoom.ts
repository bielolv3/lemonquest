import { Room, Client } from "colyseus";
import {
  C2S, S2C, TICK_MS, baseStats,
  type AttackMsg, type CastMsg, type ChatSendMsg, type DiscardItemMsg, type FeedMsg, type FightModeMsg, type JoinOptions,
  type MoveItemMsg, type MoveMsg, type NpcInteractMsg, type NpcTradeMsg, type QuickPotionMsg, type TurnMsg, type UseItemMsg,
  type WalkToMsg,
} from "@tibinha/shared";
import { PlayerState, WorldState } from "../state.ts";
import { loadMap, type LoadedMap } from "../world/map.ts";
import { MovementSystem } from "../systems/movement.ts";
import { ExplorationSystem } from "../systems/exploration.ts";
import { PortalSystem } from "../systems/portals.ts";
import { MonsterManager, parseSafeZones, parseSpawns } from "../systems/monsters.ts";
import { CombatSystem, attackProfile, playerArmor } from "../systems/combat.ts";
import { RegenSystem } from "../systems/regen.ts";
import { handleChat, clearChatState } from "../systems/chat.ts";
import { ConditionSystem } from "../systems/conditions.ts";
import { SkillSystem } from "../systems/skills.ts";
import { SummonSystem } from "../systems/summons.ts";
import { SpellSystem } from "../systems/spells.ts";
import { InventorySystem } from "../systems/inventory.ts";
import { LootSystem } from "../systems/loot.ts";
import { NpcSystem, parseNpcs } from "../systems/npcs.ts";
import { FightModeSystem, stanceDealt, stanceTaken } from "../systems/fightmode.ts";
import { devCommandsEnabled, handleDevCommand } from "../systems/devcommands.ts";
import { consumeToken, setOnline } from "../persistence/auth.ts";
import { saveCharacter } from "../persistence/db.ts";
import type { CharacterRecord } from "../persistence/types.ts";

const AUTOSAVE_MS = 30_000;
/** Log de desempenho do tick (só em dev). */
const PERF_LOG_MS = 60_000;
const DEV = process.env.NODE_ENV !== "production";
/** Level a partir do qual o level up entra no feed global. */
const FEED_LEVEL_MIN = 10;

export class WorldRoom extends Room<{ state: WorldState }> {
  maxClients = 32;
  autoDispose = false;
  state = new WorldState();

  private map!: LoadedMap;
  private movement!: MovementSystem;
  private exploration!: ExplorationSystem;
  private portals!: PortalSystem;
  private monsters!: MonsterManager;
  private combat!: CombatSystem;
  private regen!: RegenSystem;
  private conditions!: ConditionSystem;
  private skills!: SkillSystem;
  private summons!: SummonSystem;
  private spells!: SpellSystem;
  private inventory!: InventorySystem;
  private loot!: LootSystem;
  private npcs!: NpcSystem;
  private fight!: FightModeSystem;
  private perf = { n: 0, sum: 0, max: 0, since: Date.now() };
  private records = new Map<string, CharacterRecord>(); // sessionId -> registro

  onCreate() {
    this.map = loadMap("world");
    this.exploration = new ExplorationSystem(this.map.tiled.width, this.map.tiled.height);
    this.movement = new MovementSystem(this.map.grid, { spawn: this.map.spawn, groundSpeed: this.map.groundSpeed });
    this.portals = new PortalSystem(this.map.tiled, this.movement, (id, msg) => this.clients.getById(id)?.send(S2C.Teleported, msg));
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
      onStatsChanged: (p) => this.conditions.refreshPlayer(p.id),
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
    console.log(`[tibinha] ${this.monsters.size} monstros em ${parseSpawns(this.map.tiled).length} spawns, ${this.npcs.list.length} NPCs`);

    this.onMessage(C2S.Move, (c, m: MoveMsg) => this.withPlayer(c, (p) => { this.fight.pause(p.id); this.movement.onMove(p, m); }));
    this.onMessage(C2S.WalkTo, (c, m: WalkToMsg) => this.withPlayer(c, (p) => { this.fight.pause(p.id); this.movement.onWalkTo(p, m); }));
    this.onMessage(C2S.Turn, (c, m: TurnMsg) => this.withPlayer(c, (p) => this.movement.onTurn(p, m)));
    this.onMessage(C2S.Attack, (c, m: AttackMsg) => this.withPlayer(c, (p) => this.combat.onAttack(p, m)));
    const command = devCommandsEnabled()
      ? (p: PlayerState, text: string) => handleDevCommand(p, text, {
        inventory: this.inventory, send,
        teleport: (pl, x, y) => this.movement.teleport(pl, x, y),
        isWalkable: (x, y) => this.map.grid.isWalkable(x, y) && !this.npcs.isNpcAt(x, y),
        setMagicLevel: (pl, n) => this.skills.setLevel(pl, "magic", n),
      })
      : undefined;
    this.onMessage(C2S.Chat, (c, m: ChatSendMsg) => this.withPlayer(c, (p) =>
      handleChat(this, c, p, m, { castWords: (pl, text) => this.spells.castWords(pl, text), command })));
    this.onMessage(C2S.Cast, (c, m: CastMsg) => this.withPlayer(c, (p) => this.spells.onCast(p, m)));
    this.onMessage(C2S.MoveItem, (c, m: MoveItemMsg) => this.withPlayer(c, (p) => this.inventory.onMoveItem(p, m)));
    this.onMessage(C2S.UseItem, (c, m: UseItemMsg) => this.withPlayer(c, (p) => this.inventory.onUseItem(p, m)));
    this.onMessage(C2S.QuickPotion, (c, m: QuickPotionMsg) => this.withPlayer(c, (p) => this.inventory.onQuickPotion(p, m)));
    this.onMessage(C2S.DiscardItem, (c, m: DiscardItemMsg) => this.withPlayer(c, (p) => this.inventory.onDiscard(p, m)));
    this.onMessage(C2S.NpcInteract, (c, m: NpcInteractMsg) => this.withPlayer(c, (p) => this.npcs.onInteract(p, m)));
    this.onMessage(C2S.NpcTrade, (c, m: NpcTradeMsg) => this.withPlayer(c, (p) => this.npcs.onTrade(p, m)));
    this.onMessage(C2S.FightMode, (c, m: FightModeMsg) => this.withPlayer(c, (p) => this.fight.onFightMode(p, m)));

    this.setSimulationInterval(() => this.tick(), TICK_MS);
    this.clock.setInterval(() => this.saveAll(), AUTOSAVE_MS);
  }

  private tick() {
    const t0 = performance.now();
    const now = Date.now();
    this.fight.tick(now, this.state.players.values());
    this.movement.tick(now, this.state.players.values());
    for (const p of this.state.players.values()) this.portals.check(p);
    for (const p of this.state.players.values()) this.exploration.onPosition(p.id, p.x, p.y);
    this.monsters.tick(now);
    this.combat.tick(now);
    this.conditions.tick(now);
    this.regen.tick(now, this.state.players.values());
    this.npcs.tick(now);
    this.conditions.sync(now);
    this.combat.flush();
    this.inventory.flush();
    if (DEV) this.trackPerf(performance.now() - t0, now);
  }

  private trackPerf(ms: number, now: number) {
    const s = this.perf;
    s.n++; s.sum += ms; if (ms > s.max) s.max = ms;
    if (now - s.since < PERF_LOG_MS) return;
    console.log(`[tick] ${s.n} ticks: média ${(s.sum / s.n).toFixed(3)} ms, máx ${s.max.toFixed(2)} ms — ${this.monsters.size} monstros, ${this.state.players.size} jogadores`);
    this.perf = { n: 0, sum: 0, max: 0, since: now };
  }

  onAuth(_client: Client, options: JoinOptions) {
    return consumeToken(String(options?.token ?? ""));
  }

  onJoin(client: Client, _options: JoinOptions, rec: CharacterRecord) {
    const p = new PlayerState();
    p.id = client.sessionId;
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
    const start = rec.x != null && rec.y != null && this.map.grid.isWalkable(rec.x, rec.y) && !this.npcs.isNpcAt(rec.x, rec.y)
      ? { x: rec.x, y: rec.y }
      : this.map.spawn;
    p.x = start.x;
    p.y = start.y;
    p.dir = rec.dir;
    this.skills.load(p, rec.data.skills);
    this.fight.load(p, rec.data.stance, rec.data.chase);
    this.records.set(client.sessionId, rec);
    this.state.players.set(client.sessionId, p);
    this.conditions.refreshPlayer(p.id); // velocidade do equipamento
    this.movement.addPlayer(p);
    client.send(S2C.Explored, this.exploration.addPlayer(client.sessionId, rec, p.x, p.y));
    const inv = this.inventory.inventoryMsg(p.id);
    if (inv) client.send(S2C.Inventory, inv);
    setOnline(rec.name, true);
  }

  onLeave(client: Client) {
    this.save(client.sessionId);
    const rec = this.records.get(client.sessionId);
    if (rec) setOnline(rec.name, false);
    this.movement.removePlayer(client.sessionId);
    this.summons.despawnOwner(client.sessionId);
    this.combat.removePlayer(client.sessionId);
    this.conditions.removePlayer(client.sessionId);
    this.spells.removePlayer(client.sessionId);
    this.skills.removePlayer(client.sessionId);
    this.regen.removePlayer(client.sessionId);
    this.exploration.removePlayer(client.sessionId);
    this.inventory.removePlayer(client.sessionId);
    this.npcs.removePlayer(client.sessionId);
    this.fight.removePlayer(client.sessionId);
    clearChatState(client.sessionId);
    this.state.players.delete(client.sessionId);
    this.records.delete(client.sessionId);
  }

  onDispose() {
    this.saveAll();
  }

  private withPlayer(client: Client, fn: (p: PlayerState) => void) {
    const p = this.state.players.get(client.sessionId);
    if (p) fn(p);
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
    Object.assign(rec.data, this.inventory.serialize(sessionId) ?? {});
    rec.data.stance = p.stance;
    rec.data.chase = p.chase;
    saveCharacter(rec);
  }

  private saveAll() {
    for (const id of this.records.keys()) this.save(id);
  }
}
