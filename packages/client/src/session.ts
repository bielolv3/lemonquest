import type { Room } from "@colyseus/sdk";
import { JoinOptions, LoginRequest, LoginResponse } from "@tibinha/shared";
import { client, endpoint } from "./net.ts";

/**
 * Ponto de encontro entre a UI (Preact) e o jogo (Phaser).
 * - UI de login chama login() e depois connect().
 * - WorldScene assina onRoom() para começar a renderizar quando a sala existir.
 */
type Listener = (room: Room) => void;

class Session {
  room: Room | null = null;
  myId = "";
  myName = "";
  private listeners = new Set<Listener>();

  async login(req: LoginRequest): Promise<LoginResponse> {
    const res = await fetch(`${endpoint}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    return (await res.json()) as LoginResponse;
  }

  async connect(token: string, name: string): Promise<Room> {
    const opts: JoinOptions = { token };
    const room = await client.joinOrCreate("world", opts);
    this.room = room;
    this.myId = room.sessionId;
    this.myName = name;
    for (const l of this.listeners) l(room);
    return room;
  }

  onRoom(l: Listener): () => void {
    this.listeners.add(l);
    if (this.room) l(this.room);
    return () => this.listeners.delete(l);
  }
}

export const session = new Session();
