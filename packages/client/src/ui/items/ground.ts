// Itens no chão (lado da UI): largar (mochila/equipamento → tile do mundo) e pegar (chão → mochila/slot).
// A cena (WorldScene) registra como converter a posição do mouse em tile e qual é o tile do jogador.
import { C2S, type DropFrom, type DropItemMsg, type MoveGroundItemMsg, type PickupItemMsg, type PickupTo } from "@lemonquest/shared";
import { send } from "./net.ts";

export interface GroundBridge {
  /** Tile sob o ponto (coordenadas de cliente/DOM), ou null fora do mapa. */
  tileAt: (clientX: number, clientY: number) => { x: number; y: number } | null;
  /** Tile do jogador local (null = sem personagem). */
  myTile: () => { x: number; y: number } | null;
}

let bridge: GroundBridge | null = null;
export const setGroundBridge = (b: GroundBridge | null): void => { bridge = b; };

/** Larga o item em (x,y). O servidor valida (alcance 3, linha livre, andável) e, se não der, larga no seu tile. */
export function dropItem(from: DropFrom, x: number, y: number, count?: number): void {
  const m: DropItemMsg = count != null ? { from, x, y, count } : { from, x, y };
  send(C2S.DropItem, m);
}

/** Larga no tile sob o mouse (ou no próprio tile, se não houver). */
export function dropAtPointer(from: DropFrom, clientX: number, clientY: number, count?: number): void {
  const t = bridge?.tileAt(clientX, clientY) ?? bridge?.myTile();
  if (!t) return;
  dropItem(from, t.x, t.y, count);
}

/** Arrasta um item do chão para o tile sob o mouse. O servidor valida (alcance 3, linha livre, tile que segura item). */
export function moveGroundAtPointer(groundId: string, clientX: number, clientY: number, count?: number): void {
  const t = bridge?.tileAt(clientX, clientY);
  if (!t) return;
  const m: MoveGroundItemMsg = count != null ? { groundId, x: t.x, y: t.y, count } : { groundId, x: t.x, y: t.y };
  send(C2S.MoveGroundItem, m);
}

export function pickupItem(groundId: string, to?: PickupTo): void {
  const m: PickupItemMsg = to ? { groundId, to } : { groundId };
  send(C2S.PickupItem, m);
}
