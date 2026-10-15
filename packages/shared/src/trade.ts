// Troca entre jogadores: ofertas por uid (índices da mochila mudam), os dois confirmam e o servidor troca de uma vez.
import type { ItemInstance } from "./data/items.ts";

export const TRADE_MAX_ITEMS = 8;
/** Distância máxima (Chebyshev, em tiles) para iniciar e manter a troca. */
export const TRADE_START_RANGE = 3;
export const TRADE_KEEP_RANGE = 8;
/** Convite sem resposta some depois disto. */
export const TRADE_INVITE_MS = 30_000;

export interface TradeOfferItem { uid: string; count: number }

/** Cliente → servidor */
export type TradeMsg =
  | { action: "request"; targetId: string }
  | { action: "accept" }
  | { action: "decline" }
  | { action: "offer"; items: TradeOfferItem[]; gold: number }
  | { action: "confirm"; confirmed: boolean }
  | { action: "cancel" };

export interface TradeSideView { items: ItemInstance[]; gold: number; confirmed: boolean }

/** Servidor → cliente */
export type TradeStateMsg =
  | { phase: "closed" }
  | { phase: "invite"; fromId: string; from: string }
  | { phase: "open"; partnerId: string; partner: string; mine: TradeSideView; theirs: TradeSideView };
