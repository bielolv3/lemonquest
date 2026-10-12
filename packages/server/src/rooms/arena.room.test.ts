import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { S2C } from "@lemonquest/shared";
import { WorldRoom } from "./WorldRoom.ts";
import { createAccountWithCharacter, getCharacterByName, initDb, saveCharacter } from "../persistence/db.ts";
import { resetAuthState, type AuthData } from "../persistence/auth.ts";

// Fumaça com a sala e o MAPA REAL: Mestre do Coliseu → lobby solo → arena 1 → onda 1; posição salva na arena → saída.
const rooms: any[] = [];
function makeRoom(): any {
  const r = new WorldRoom() as any;
  r["__init"]();
  r.onCreate({});
  rooms.push(r);
  return r;
}
const auth = (name: string): AuthData => ({ name, key: name.toLowerCase(), weakPassword: false });
function join(r: any, sid: string, name: string) {
  const c = { sessionId: sid, send: vi.fn(), leave: vi.fn() } as any;
  r.clients.push(c);
  r.onJoin(c, {}, auth(name));
  return { c, p: r.state.players.get(sid) };
}
let now = 1_000_000;
const advance = (r: any, ms: number) => { const end = now + ms; while (now < end) { now += 50; vi.setSystemTime(now); r.tick(); } };

beforeEach(() => {
  initDb(":memory:");
  resetAuthState();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  while (rooms.length) { const r = rooms.pop(); r.clock.clear(); clearInterval(r._simulationInterval); r.onDispose(); }
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("coliseu na sala real", () => {
  it("NPC do coliseu → lobby solo → arena → onda 1; desistir volta para a saída", () => {
    const r = makeRoom();
    const master = r.npcs.spot("arena_master");
    expect(master).toBeTruthy();
    const rec = createAccountWithCharacter("Leo", "h", "s", "knight");
    rec.x = master.x + 1; rec.y = master.y + 2;
    saveCharacter(rec);
    const { c, p } = join(r, "s1", "Leo");
    expect(Math.max(Math.abs(p.x - master.x), Math.abs(p.y - master.y))).toBeLessThanOrEqual(3);
    r.npcs.onInteract(p, { npcId: "arena_master" });
    r.arena.openLobbies(p);
    expect(c.send.mock.calls.some(([t]: [string]) => t === S2C.ArenaLobbies)).toBe(true);
    r.arena.onAction(p, { action: "create" });
    r.arena.onAction(p, { action: "start" });
    advance(r, 5200);
    const a1 = r.arena.arenas[0];
    expect(p.x).toBeGreaterThanOrEqual(a1.rect.x0);
    expect(p.y).toBeGreaterThanOrEqual(a1.rect.y0);
    advance(r, 3000 + 1500);
    const ms = [...r.monsters.all()].filter((m: any) => m.arenaId === 1);
    expect(ms.length).toBe(3);
    expect(r.monsters.inPz(p.x, p.y)).toBe(false);
    r.arena.onAction(p, { action: "leave" });
    expect(r.arena.arenaAt(p.x, p.y)).toBeUndefined();
    expect([...r.monsters.all()].filter((m: any) => m.arenaId).length).toBe(0);
  });

  it("posição salva dentro de uma arena → nasce na saída do coliseu", () => {
    const r = makeRoom();
    const a = r.arena.arenas[2];
    const rec = createAccountWithCharacter("Ana", "h", "s", "druid");
    rec.x = a.entry.x; rec.y = a.entry.y;
    saveCharacter(rec);
    const { p } = join(r, "s2", "Ana");
    expect(r.arena.arenaAt(p.x, p.y)).toBeUndefined();
    const exit = r.arena["o"].layout.exit;
    expect(Math.max(Math.abs(p.x - exit.x), Math.abs(p.y - exit.y))).toBeLessThanOrEqual(0);
    expect(getCharacterByName("Ana")).toBeTruthy();
  });
});
