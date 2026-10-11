import type { ChatChannel, ChatMessage, CombatEvent, Dir, FightStance, Vocation } from "./types.ts";
import type { ConditionId } from "./data/spells.ts";
import type { SkillId } from "./skills.ts";
import type { EquipSlot, ItemInstance, Rarity, Stats } from "./data/items.ts";

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
  /** Conjurar magia (hotkey 1–6 ou palavras no chat). */
  Cast: "cast",
  /** Mover item entre mochila/equipamento/depot (arrastar e soltar). */
  MoveItem: "moveItem",
  /** Usar item da mochila (poção). */
  UseItem: "useItem",
  /** Usar a primeira poção de vida/mana da mochila (atalhos Q/E). */
  QuickPotion: "quickPotion",
  /** Jogar fora (destrói) um item da mochila. */
  DiscardItem: "discardItem",
  /** Falar com NPC (abre diálogo/loja/depot). */
  NpcInteract: "npcInteract",
  /** Comprar/vender com NPC aberto. */
  NpcTrade: "npcTrade",
  /** Modo de batalha: postura (ofensivo/equilibrado/defensivo) e seguir o alvo. */
  FightMode: "fightMode",
} as const;

export interface FightModeMsg { stance: FightStance; chase: boolean }

export type ItemLocation =
  | { where: "backpack"; index: number }
  | { where: "equip"; slot: EquipSlot }
  | { where: "depot"; index: number };
export interface MoveItemMsg { from: ItemLocation; to: ItemLocation; count?: number }
export interface UseItemMsg { index: number }
export interface QuickPotionMsg { kind: "hp" | "mana" }
export interface DiscardItemMsg { index: number }
export interface NpcInteractMsg { npcId: string }
export type NpcTradeMsg =
  | { npcId: string; action: "buy"; itemId: string; count: number }
  | { npcId: string; action: "sell"; index: number; count: number };

export interface CastMsg { spellId: string; targetId?: string | null }

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
  /** Resultado da tentativa de conjurar (só para quem conjurou). */
  CastResult: "castResult",
  /** Uma magia foi conjurada (para todos verem o efeito). */
  SpellCast: "spellCast",
  /** Lista completa de condições ativas do jogador (enviada a ele quando muda). */
  Conditions: "conditions",
  /** Uma skill subiu de nível. */
  SkillUp: "skillUp",
  /** Estado completo do inventário do jogador (só para ele), enviado ao entrar e a cada mudança. */
  Inventory: "inventory",
  /** Depot aberto (conteúdo), enviado ao interagir com o NPC do depot e a cada mudança enquanto aberto. */
  Depot: "depot",
  /** Diálogo/loja de NPC aberto. */
  NpcOpen: "npcOpen",
  /** Loot que você recebeu de um abate (para animação de drop). */
  Loot: "loot",
  /** Feed global (drops raros, conquistas, bosses). */
  Feed: "feed",
  /** Fala ambiente de NPC (balão sobre a cabeça). */
  NpcSay: "npcSay",
  /** Você foi teletransportado (portal). x,y = novo tile. */
  Teleported: "teleported",
} as const;

export interface TeleportedMsg { x: number; y: number }

export type ChatRecvMsg = ChatMessage;
export type CastFailReason = "cooldown" | "mana" | "level" | "vocation" | "target" | "range" | "pz" | "unknown" | "dead";
export interface CastResultMsg {
  spellId: string;
  ok: boolean;
  reason?: CastFailReason;
  /** ms até poder usar de novo esta magia (sucesso = cooldown cheio). */
  cooldownMs?: number;
  /** ms do cooldown global. */
  globalMs?: number;
}
export interface SpellCastMsg {
  spellId: string;
  casterId: string;
  targetId?: string;
  /** Centro do efeito (tile). */
  x: number;
  y: number;
  dir: Dir;
  /** Tiles afetados (pares x,y achatados) para áreas/ondas. */
  tiles?: number[];
}
export interface ConditionsMsg { list: { id: ConditionId; remainingMs?: number; value?: number; /** 'fed': value = vida/tique, value2 = mana/tique. */ value2?: number }[] }
export interface SkillUpMsg { skill: SkillId; level: number }
export interface InventoryMsg {
  equipment: Partial<Record<EquipSlot, ItemInstance>>;
  backpack: (ItemInstance | null)[];   // tamanho BACKPACK_SIZE
  gold: number;
  /** Totais efetivos (equipamento + bônus) para o HUD. */
  stats: Stats;
  cap: { used: number; max: number };
}
export interface DepotMsg { items: (ItemInstance | null)[] }  // tamanho DEPOT_SIZE
export interface NpcOpenMsg {
  npcId: string;
  name: string;
  greeting: string;
  shop?: { sells: { itemId: string; price: number }[]; buys?: string[]; sellRatio: number };
  depot?: boolean;
}
export interface LootMsg { x: number; y: number; monsterName: string; items: ItemInstance[]; gold: number; lostFull?: number }
export interface FeedMsg { text: string; kind: "drop" | "level" | "boss" | "death" | "info"; rarity?: Rarity }
export interface NpcSayMsg { npcId: string; text: string }
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
