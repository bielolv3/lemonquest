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
  /** `rev` = a versão das ofertas que o jogador está vendo (TradeStateMsg.rev); confirmar exige a versão atual. */
  | { action: "confirm"; confirmed: boolean; rev?: number }
  | { action: "cancel" };

export interface TradeSideView { items: ItemInstance[]; gold: number; confirmed: boolean }

/** Servidor → cliente */
export type TradeStateMsg =
  | { phase: "closed" }
  | { phase: "invite"; fromId: string; from: string }
  /** `rev` sobe a cada oferta (de qualquer lado): o confirm só vale para a versão que o jogador viu. */
  | { phase: "open"; partnerId: string; partner: string; rev: number; mine: TradeSideView; theirs: TradeSideView };
