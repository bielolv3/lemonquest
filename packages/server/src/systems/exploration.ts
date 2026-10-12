import { ExploredMask, type ExploredMsg } from "@lemonquest/shared";
import type { CharacterRecord } from "../persistence/types.ts";

interface Entry { mask: ExploredMask; x: number; y: number }

/** Máscaras de exploração (fog of war do minimapa) por jogador. Autoridade + persistência. */
export class ExplorationSystem {
  private entries = new Map<string, Entry>();

  constructor(private readonly width: number, private readonly height: number) {}

  /** Cria a máscara a partir do registro, revela ao redor de (x,y) e devolve a mensagem para o cliente. */
  addPlayer(sessionId: string, rec: CharacterRecord, x: number, y: number): ExploredMsg {
    const mask = ExploredMask.fromBase64(this.width, this.height, rec.data.explored, rec.data.exploredW);
    mask.reveal(x, y);
    this.entries.set(sessionId, { mask, x, y });
    return { width: this.width, height: this.height, bits: mask.toBase64() };
  }

  /** Chamar a cada tick (barato): só revela quando o tile mudou. Retorna true se revelou tiles novos. */
  onPosition(sessionId: string, x: number, y: number): boolean {
    const e = this.entries.get(sessionId);
    if (!e || (e.x === x && e.y === y)) return false;
    e.x = x;
    e.y = y;
    return e.mask.reveal(x, y) > 0;
  }

  /** Mensagem com a máscara atual (reenvio após reconexão). */
  message(sessionId: string): ExploredMsg | undefined {
    const e = this.entries.get(sessionId);
    return e ? { width: this.width, height: this.height, bits: e.mask.toBase64() } : undefined;
  }

  /** Largura do mapa (salva junto com a máscara para detectar mudança de largura). */
  get mapWidth(): number { return this.width; }

  serialize(sessionId: string): string | undefined {
    return this.entries.get(sessionId)?.mask.toBase64();
  }

  removePlayer(sessionId: string) {
    this.entries.delete(sessionId);
  }
}
