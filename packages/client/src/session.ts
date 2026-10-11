import type { Room } from "@colyseus/sdk";
import { JoinOptions, LoginRequest, LoginResponse } from "@tibinha/shared";
import { client, endpoint } from "./net.ts";

/**
 * Ponto de encontro entre a UI (Preact) e o jogo (Phaser).
 * - UI de login chama login() e depois connect().
 * - WorldScene assina onRoom() para começar a renderizar quando a sala existir.
 */
type Listener = (room: Room) => void;

export type ConnStatus = "idle" | "online" | "reconnecting" | "closed";

/**
 * Códigos de fechamento. 4000-4010 são do Colyseus (CONSENTED, SERVER_SHUTDOWN=4001, WITH_ERROR,
 * FAILED_TO_RECONNECT=4003, MAY_TRY_RECONNECT). 4100 = conta entrou em outro lugar (código próprio
 * sugerido ao servidor; o texto do motivo também é reconhecido).
 */
export const CLOSE_REPLACED = 4100;

/** Texto PT-BR do motivo da desconexão definitiva. */
export function closeMessage(code: number, reason?: string): string {
  const r = (reason ?? "").toLowerCase();
  if (code === CLOSE_REPLACED || /outro lugar|replaced|another (login|session)|duplicate/.test(r)) {
    return "Sua conta entrou em outro lugar.";
  }
  if (code === 4001 && !/reconnect/.test(r)) return "O servidor foi reiniciado ou desligado.";
  if (code === 4101 || /kick|expuls/.test(r)) return "Você foi expulso do servidor.";
  if (code === 4003 || /reconnect/.test(r) || code === 1006 || code === 1001) {
    return "Não foi possível reconectar ao servidor. Ele pode ter sido reiniciado ou a rede caiu.";
  }
  return `A conexão com o servidor foi encerrada (código ${code}).`;
}

class Session {
  room: Room | null = null;
  myId = "";
  myName = "";
  status: ConnStatus = "idle";
  closeInfo: { code: number; reason: string } | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<() => void>();

  private setStatus(s: ConnStatus) {
    if (this.status === s) return;
    this.status = s;
    for (const l of this.statusListeners) l();
  }

  onStatus(l: () => void): () => void {
    this.statusListeners.add(l);
    return () => this.statusListeners.delete(l);
  }

  async login(req: LoginRequest): Promise<LoginResponse> {
    const res = await fetch(`${endpoint}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
    if (res.status === 429) return { ok: false, error: "too_many_attempts" } as unknown as LoginResponse;
    return (await res.json()) as LoginResponse;
  }

  async connect(token: string, name: string): Promise<Room> {
    const opts: JoinOptions = { token };
    const room = await client.joinOrCreate("world", opts);
    this.room = room;
    this.myId = room.sessionId;
    this.myName = name;
    this.closeInfo = null;
    this.setStatus("online");
    // O SDK reconecta sozinho (onDrop -> tentativas -> onReconnect); onLeave = fim definitivo.
    room.onDrop(() => { if (this.room === room && this.status !== "closed") this.setStatus("reconnecting"); });
    room.onReconnect(() => { if (this.room === room && this.status !== "closed") this.setStatus("online"); });
    room.onLeave((code, reason) => {
      if (this.room !== room) return;
      this.closeInfo = { code, reason: reason ?? "" };
      this.setStatus("closed");
    });
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
