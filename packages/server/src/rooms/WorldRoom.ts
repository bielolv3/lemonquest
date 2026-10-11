import { Room, Client } from "colyseus";
import { C2S, S2C, TICK_MS, baseStats, type ChatSendMsg, type JoinOptions, type MoveMsg, type TurnMsg, type WalkToMsg } from "@tibinha/shared";
import { PlayerState, WorldState } from "../state.ts";
import { loadMap, type LoadedMap } from "../world/map.ts";
import { MovementSystem } from "../systems/movement.ts";
import { ExplorationSystem } from "../systems/exploration.ts";
import { handleChat, clearChatState } from "../systems/chat.ts";
import { consumeToken, setOnline } from "../persistence/auth.ts";
import { saveCharacter } from "../persistence/db.ts";
import type { CharacterRecord } from "../persistence/types.ts";

const AUTOSAVE_MS = 30_000;

export class WorldRoom extends Room<{ state: WorldState }> {
  maxClients = 32;
  autoDispose = false;
  state = new WorldState();

  private map!: LoadedMap;
  private movement!: MovementSystem;
  private exploration!: ExplorationSystem;
  private records = new Map<string, CharacterRecord>(); // sessionId -> registro

  onCreate() {
    this.map = loadMap("world");
    this.exploration = new ExplorationSystem(this.map.tiled.width, this.map.tiled.height);
    this.movement = new MovementSystem(this.map.grid, { spawn: this.map.spawn, groundSpeed: this.map.groundSpeed });

    this.onMessage(C2S.Move, (c, m: MoveMsg) => this.withPlayer(c, (p) => this.movement.onMove(p, m)));
    this.onMessage(C2S.WalkTo, (c, m: WalkToMsg) => this.withPlayer(c, (p) => this.movement.onWalkTo(p, m)));
    this.onMessage(C2S.Turn, (c, m: TurnMsg) => this.withPlayer(c, (p) => this.movement.onTurn(p, m)));
    this.onMessage(C2S.Chat, (c, m: ChatSendMsg) => this.withPlayer(c, (p) => handleChat(this, c, p, m)));

    this.setSimulationInterval(() => {
      this.movement.tick(Date.now(), this.state.players.values());
      for (const p of this.state.players.values()) this.exploration.onPosition(p.id, p.x, p.y);
    }, TICK_MS);
    this.clock.setInterval(() => this.saveAll(), AUTOSAVE_MS);
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
    rec.data.explored = this.exploration.serialize(sessionId) ?? rec.data.explored;
    saveCharacter(rec);
  }

  private saveAll() {
    for (const id of this.records.keys()) this.save(id);
  }
}
