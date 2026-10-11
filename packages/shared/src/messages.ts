import type { ChatChannel, ChatMessage, CombatEvent, Dir, Vocation } from "./types.ts";

/** Cliente → servidor */
export const C2S = {
  /** Intenção de movimento contínuo: dir = direção segurada, null = soltou. seq cresce a cada envio. */
  Move: "move",
  /** Clique no mapa: servidor calcula A* e anda até lá. Qualquer "move" cancela. */
  WalkTo: "walkTo",
  /** Virar sem andar (Ctrl+seta). */
  Turn: "turn",
  Chat: "chat",
  /** Selecionar/limpar alvo de ataque automático (estilo Tibia). */
  Attack: "attack",
} as const;

export interface AttackMsg { targetId: string | null }
export interface MoveMsg { dir: Dir | null; seq: number }
export interface WalkToMsg { x: number; y: number }
export interface TurnMsg { dir: Dir }
export interface ChatSendMsg { text: string; channel: ChatChannel }

/** Servidor → cliente */
export const S2C = {
  Chat: "chat",
  /** Texto curto exibido como toast. */
  Notice: "notice",
  /** Máscara de exploração completa (enviada ao entrar). O cliente revela localmente ao andar. */
  Explored: "explored",
  /** Lote de eventos de combate do tick (enviado a todos na sala). */
  Combat: "combat",
  /** Você ganhou XP (para o texto flutuante "+25 XP"). */
  XpGain: "xpGain",
  /** Você subiu de level. */
  LevelUp: "levelUp",
  /** Você morreu (o servidor já te levou ao templo). */
  Died: "died",
  /** Uma criatura morreu (para animação de morte; a remoção do estado vem em seguida). */
  CreatureDied: "creatureDied",
  /** Você foi teletransportado (portal). x,y = novo tile. */
  Teleported: "teleported",
} as const;

export interface TeleportedMsg { x: number; y: number }

export type ChatRecvMsg = ChatMessage;
export interface CombatMsg { events: CombatEvent[] }
export interface XpGainMsg { amount: number; x: number; y: number }
export interface LevelUpMsg { level: number; maxHp: number; maxMana: number }
export interface DiedMsg { lostXp: number; killerName: string }
export interface CreatureDiedMsg { id: string; x: number; y: number; defId: string }
export interface ExploredMsg { width: number; height: number; bits: string /* base64 */ }
export interface NoticeMsg { text: string; kind?: "info" | "warn" | "good" }

/** HTTP: POST /api/login — cria a conta no primeiro login (vocation obrigatório nesse caso). */
export interface LoginRequest { name: string; password: string; vocation?: Vocation }
export type LoginResponse =
  | { ok: true; token: string; name: string; vocation: Vocation; isNew: boolean }
  | { ok: false; error: "invalid_name" | "wrong_password" | "need_vocation" | "already_online" | "invalid_request" };

/** Opções do joinOrCreate("world", ...) */
export interface JoinOptions { token: string }
