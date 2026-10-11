import { Room, Client } from "colyseus";
import { C2S, S2C, TICK_MS, baseStats, type AttackMsg, type CastMsg, type ChatSendMsg, type JoinOptions, type MoveMsg, type TurnMsg, type WalkToMsg } from "@tibinha/shared";
import { PlayerState, WorldState } from "../state.ts";
import { loadMap, type LoadedMap } from "../world/map.ts";
import { MovementSystem } from "../systems/movement.ts";
import { ExplorationSystem } from "../systems/exploration.ts";
import { PortalSystem } from "../systems/portals.ts";
import { MonsterManager, parseSafeZones, parseSpawns } from "../systems/monsters.ts";
import { CombatSystem } from "../systems/combat.ts";
import { RegenSystem } from "../systems/regen.ts";
import { handleChat, clearChatState } from "../systems/chat.ts";
import { ConditionSystem } from "../systems/conditions.ts";
import { SkillSystem } from "../systems/skills.ts";
import { SummonSystem } from "../systems/summons.ts";
import { SpellSystem } from "../systems/spells.ts";
import { consumeToken, setOnline } from "../persistence/auth.ts";
import { saveCharacter } from "../persistence/db.ts";
import type { CharacterRecord } from "../persistence/types.ts";

const AUTOSAVE_MS = 30_000;
/** Log de desempenho do tick (só em dev). */
const PERF_LOG_MS = 60_000;
const DEV = process.env.NODE_ENV !== "production";

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
  private perf = { n: 0, sum: 0, max: 0, since: Date.now() };
  private records = new Map<string, CharacterRecord>(); // sessionId -> registro

  onCreate() {
    this.map = loadMap("world");
    this.exploration = new ExplorationSystem(this.map.tiled.width, this.map.tiled.height);
    this.movement = new MovementSystem(this.map.grid, { spawn: this.map.spawn, groundSpeed: this.map.groundSpeed });
    this.portals = new PortalSystem(this.map.tiled, this.movement, (id, msg) => this.clients.getById(id)?.send(S2C.Teleported, msg));

    this.monsters = new MonsterManager({
      grid: this.map.grid,
      groundSpeed: this.map.groundSpeed,
      spawns: parseSpawns(this.map.tiled),
      safeZones: parseSafeZones(this.map.tiled),
      isPortalTile: (x, y) => this.portals.isPortalTile(x, y),
      collection: this.state.monsters,
      players: () => this.state.players.values(),
      getPlayer: (id) => this.state.players.get(id),
      notice: (text, kind) => this.broadcast(S2C.Notice, { text, kind }),
    });
    this.movement.setExtraBlocker((x, y) => this.monsters.isMonsterAt(x, y));
    this.combat = new CombatSystem({
      monsters: this.monsters,
      players: () => this.state.players.values(),
      getPlayer: (id) => this.state.players.get(id),
      teleport: (p, x, y) => this.movement.teleport(p, x, y),
      spawn: this.map.spawn,
      send: (id, type, msg) => this.clients.getById(id)?.send(type, msg),
      broadcast: (type, msg) => this.broadcast(type, msg),
    });
    this.regen = new RegenSystem({
      inCombat: (id, now) => this.combat.inCombat(id, now),
      inPz: (x, y) => this.monsters.inPz(x, y),
    });
    const send = (id: string, type: string, msg: unknown) => this.clients.getById(id)?.send(type, msg);
    this.skills = new SkillSystem(send);
    this.conditions = new ConditionSystem({
      monsters: this.monsters, combat: this.combat, send,
      getPlayer: (id) => this.state.players.get(id), players: () => this.state.players.values(),
    });
    this.summons = new SummonSystem({ monsters: this.monsters, combat: this.combat, getPlayer: (id) => this.state.players.get(id) });
    this.spells = new SpellSystem({
      grid: this.map.grid, monsters: this.monsters, combat: this.combat, conditions: this.conditions,
      summons: this.summons, skills: this.skills,
      players: () => this.state.players.values(), getPlayer: (id) => this.state.players.get(id),
      teleport: (p, x, y) => this.movement.teleport(p, x, y),
      send, broadcast: (type, msg) => this.broadcast(type, msg),
    });
    this.combat.hooks = {
      damageTakenPct: (id) => this.conditions.damageTakenPct(id),
      manaShield: (id) => this.conditions.manaShield(id),
      onAutoAttack: (p) => {
        if (p.vocation === "knight") this.skills.addTries(p, "melee", 1);
        else if (p.vocation === "paladin") this.skills.addTries(p, "distance", 1);
      },
      onMeleeHit: (p) => { if (p.vocation === "knight" || p.vocation === "paladin") this.skills.addTries(p, "shield", 1); },
      onPlayerDied: (p) => { this.conditions.clear(p.id); this.summons.despawnOwner(p.id); },
    };
    this.monsters.spawnAll();
    console.log(`[tibinha] ${this.monsters.size} monstros em ${parseSpawns(this.map.tiled).length} spawns`);

    this.onMessage(C2S.Move, (c, m: MoveMsg) => this.withPlayer(c, (p) => this.movement.onMove(p, m)));
    this.onMessage(C2S.WalkTo, (c, m: WalkToMsg) => this.withPlayer(c, (p) => this.movement.onWalkTo(p, m)));
    this.onMessage(C2S.Turn, (c, m: TurnMsg) => this.withPlayer(c, (p) => this.movement.onTurn(p, m)));
    this.onMessage(C2S.Attack, (c, m: AttackMsg) => this.withPlayer(c, (p) => this.combat.onAttack(p, m)));
    this.onMessage(C2S.Chat, (c, m: ChatSendMsg) => this.withPlayer(c, (p) =>
      handleChat(this, c, p, m, { castWords: (pl, text) => this.spells.castWords(pl, text) })));
    this.onMessage(C2S.Cast, (c, m: CastMsg) => this.withPlayer(c, (p) => this.spells.onCast(p, m)));

    this.setSimulationInterval(() => this.tick(), TICK_MS);
    this.clock.setInterval(() => this.saveAll(), AUTOSAVE_MS);
  }

  private tick() {
    const t0 = performance.now();
    const now = Date.now();
    this.movement.tick(now, this.state.players.values());
    for (const p of this.state.players.values()) this.portals.check(p);
    for (const p of this.state.players.values()) this.exploration.onPosition(p.id, p.x, p.y);
    this.monsters.tick(now);
    this.combat.tick(now);
    this.conditions.tick(now);
    this.regen.tick(now, this.state.players.values());
    this.conditions.sync(now);
    this.combat.flush();
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
    p.hp = Math.min(rec.data.hp ?? stats.maxHp, stats.maxHp);
    p.mana = Math.min(rec.data.mana ?? stats.maxMana, stats.maxMana);
    const start = rec.x != null && rec.y != null && this.map.grid.isWalkable(rec.x, rec.y)
      ? { x: rec.x, y: rec.y }
      : this.map.spawn;
    p.x = start.x;
    p.y = start.y;
    p.dir = rec.dir;
    this.skills.load(p, rec.data.skills);
    this.records.set(client.sessionId, rec);
    this.state.players.set(client.sessionId, p);
    this.movement.addPlayer(p);
    client.send(S2C.Explored, this.exploration.addPlayer(client.sessionId, rec, p.x, p.y));
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
    saveCharacter(rec);
  }

  private saveAll() {
    for (const id of this.records.keys()) this.save(id);
  }
}
