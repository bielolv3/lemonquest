// DONO: agente "movimento". Contrato público usado por WorldRoom — não mudar as assinaturas.
import type { CollisionGrid, MoveMsg, TurnMsg, WalkToMsg } from "@tibinha/shared";
import type { PlayerState } from "../state.ts";

export class MovementSystem {
  constructor(private readonly grid: CollisionGrid) {}

  addPlayer(_p: PlayerState): void {}
  removePlayer(_id: string): void {}
  onMove(_p: PlayerState, _msg: MoveMsg): void {}
  onWalkTo(_p: PlayerState, _msg: WalkToMsg): void {}
  onTurn(_p: PlayerState, _msg: TurnMsg): void {}
  /** Chamado a cada tick (TICK_MS). `now` = Date.now(). */
  tick(_now: number, _players: Iterable<PlayerState>): void {}
}
