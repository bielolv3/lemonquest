import type { ChatChannel, ChatMessage, CombatEvent, Dir, FightStance, Vocation } from "./types.ts";
import type { ConditionId } from "./data/spells.ts";
import type { SkillId } from "./skills.ts";
import type { PartyShareReason } from "./party.ts";
export type { SkillId };
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
  /** Conjurar magia (hotkey 1–8 ou palavras no chat). */
  Cast: "cast",
  /** Mover item entre mochila/equipamento/depot (arrastar e soltar). */
  MoveItem: "moveItem",
  /** Usar item da mochila (poção). */
  UseItem: "useItem",
  /** Usar a primeira poção de vida/mana da mochila (atalhos Q/E). */
  QuickPotion: "quickPotion",
  /** Compatibilidade: larga o item da mochila no próprio tile (= DropItem no tile do jogador). */
  DiscardItem: "discardItem",
  /** Largar item (mochila/equipamento) no chão: tile alvo (≤ 3 tiles, linha livre) ou o próprio tile. */
  DropItem: "dropItem",
  /** Pegar item do chão (alcance 1) para a mochila (ou um slot específico). */
  PickupItem: "pickupItem",
  /** Falar com NPC (abre diálogo/loja/depot). */
  NpcInteract: "npcInteract",
  /** Comprar/vender com NPC aberto. */
  NpcTrade: "npcTrade",
  /** Viajar com o cocheiro aberto (TravelMsg). */
  Travel: "travel",
  /** Modo de batalha: postura (ofensivo/equilibrado/defensivo) e seguir o alvo. */
  FightMode: "fightMode",
  /** Seguir outro jogador (botão direito → Seguir, como no Tibia); targetId null/"" para de seguir. */
  Follow: "follow",
  /** Pedir a escolha de skill de uma estátua de treino adjacente (o servidor responde S2C.TrainingOpen). */
  TrainOpen: "trainOpen",
  /** Começar treino offline numa estátua de treino adjacente (o servidor salva e desconecta com CLOSE_TRAINING). */
  TrainOffline: "trainOffline",
  /** Coliseu: ações de lobby (no NPC do coliseu) e de partida. */
  Arena: "arena",
  /** Trocar roupa/addons (janela de roupas). */
  SetOutfit: "setOutfit",
  /** Missões e recompensas diárias: aceitar/entregar/abandonar/rastrear (QuestActionMsg). */
  Quest: "quest",
  /** Escolher o título ativo (conquistas). */
  SetTitle: "setTitle",
  /** Pedir o estado das conquistas (ao abrir a janela). */
  AchievementsRequest: "achievementsRequest",
  /** Grupo (party): convidar/aceitar/recusar/sair/expulsar/passar liderança/desfazer. */
  Party: "party",
  /** Troca entre jogadores (convite, oferta, confirmação, cancelar). */
  Trade: "trade",
  /** Desafios da semana: listar ou resgatar. */
  Challenge: "challenge",
  /** Lançar a linha de pesca num tile de água. */
  Fish: "fish",
} as const;

/** Ações de missão. accept/turnIn exigem a janela do NPC que dá a missão aberta (e perto). */
export type QuestActionMsg =
  | { action: "accept"; questId: string }
  | { action: "turnIn"; questId: string }
  | { action: "abandon"; questId: string }
  | { action: "track"; questId: string; on: boolean }
  /** Quadro de Recompensas (index 0..BOUNTIES_PER_DAY-1). */
  | { action: "bountyAccept"; index: number }
  | { action: "bountyTurnIn"; index: number };

export type PartyActionMsg =
  | { action: "invite"; targetId: string }
  | { action: "accept"; fromId: string }
  | { action: "decline"; fromId: string }
  | { action: "leave" }
  | { action: "kick"; targetId: string }
  | { action: "lead"; targetId: string }
  | { action: "disband" };

export interface SetOutfitMsg { outfit: string; addons: number }

export interface TrainOpenMsg { statueId: string }
export interface TrainOfflineMsg { skill: SkillId }
export type ArenaActionMsg =
  | { action: "list" }                        // pede S2C.ArenaLobbies
  | { action: "create"; withParty?: boolean } // cria um lobby (você é o líder); withParty = traz o seu grupo (party) junto
  | { action: "join"; lobbyId: string }
  | { action: "leave" }                       // sai do lobby OU desiste da partida (volta à vila)
  | { action: "start" }                       // só o líder: inicia (precisa estar perto do NPC do coliseu)
  | { action: "ready" };                      // durante a pausa: "pronto" (todos prontos = próxima onda já)

export interface FightModeMsg { stance: FightStance; chase: boolean; /** Ataque automático: escolhe sozinho o monstro mais próximo. */ auto?: boolean }
export interface FollowMsg { targetId: string | null }

export type ItemLocation =
  | { where: "backpack"; index: number }
  | { where: "equip"; slot: EquipSlot }
  | { where: "depot"; index: number };
export interface MoveItemMsg { from: ItemLocation; to: ItemLocation; count?: number }
export interface UseItemMsg { index: number }
export interface QuickPotionMsg { kind: "hp" | "mana" }
export interface DiscardItemMsg { index: number }
/** De onde sai o item largado no chão (depot não). */
export type DropFrom = { where: "backpack"; index: number } | { where: "equip"; slot: EquipSlot };
export interface DropItemMsg { from: DropFrom; x: number; y: number; count?: number }
export type PickupTo = { where: "backpack"; index: number } | { where: "equip"; slot: EquipSlot };
export interface PickupItemMsg { groundId: string; to?: PickupTo }
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
  /** Emote de um jogador (ícone sobre a cabeça). */
  Emote: "emote",
  /** Abrir a escolha de skill da estátua de treino offline. */
  TrainingOpen: "trainingOpen",
  /** Resumo do treino offline ao entrar no jogo. */
  TrainingResult: "trainingResult",
  /** Lista de lobbies do coliseu (enviada ao abrir o NPC do coliseu e a cada mudança enquanto aberto). */
  ArenaLobbies: "arenaLobbies",
  /** Estado da SUA partida/lobby de coliseu (null = fora). */
  ArenaState: "arenaState",
  /** Fim da partida: resumo para cada participante. */
  ArenaResult: "arenaResult",
  /** Você foi teletransportado (portal). x,y = novo tile. */
  Teleported: "teleported",
  /** Anúncio de um administrador (faixa grande no centro da tela, para todos). */
  Announce: "announce",
  /** Estado das missões/recompensas diárias do jogador (QuestsMsg, shared/data/quests.ts): ao entrar e a cada mudança. */
  Quests: "quests",
  /** Missão (ou recompensa diária) concluída: toast com o resumo da recompensa. */
  QuestComplete: "questComplete",
  /** Conquista desbloqueada (toast). */
  AchievementUnlocked: "achievementUnlocked",
  /** Estado completo das conquistas (ao entrar e a cada mudança). */
  Achievements: "achievements",
  /** Estado do SEU grupo (party), enviado ao mudar (null = sem grupo). */
  Party: "party",
  /** Estado da troca (convite recebido, janela aberta ou fechada). */
  Trade: "trade",
  /** Desafios da semana (progresso e resgates). */
  Challenges: "challenges",
  /** Alguém lançou a linha: boia no tile de água durante `ms`. */
  FishCast: "fishCast",
  /** Evento com bônus em andamento (ou null quando termina). */
  Event: "event",
  /** Convite para um grupo (toast com Aceitar/Recusar). */
  PartyInvite: "partyInvite",
} as const;

export interface QuestCompleteMsg {
  /** Nome da missão (ou "Recompensa: Mate 20 Lobos"). */
  name: string;
  xp: number;
  gold: number;
  items: { itemId: string; count: number }[];
  bounty?: boolean;
}

export interface PartyMemberInfo {
  id: string;
  name: string;
  vocation: Vocation;
  level: number;
  /** Atacou/curou nos últimos PARTY_ACTIVE_MS (conta para dividir a XP). */
  active: boolean;
}
export interface PartyStateMsg {
  party: null | {
    id: string;
    leaderId: string;
    members: PartyMemberInfo[];
    /** XP compartilhada: ativa (verde) ou inativa (vermelho) com o motivo. */
    share: { active: boolean; reason?: PartyShareReason; minLevel?: number };
  };
}
export interface PartyInviteMsg { fromId: string; fromName: string; /** ms até expirar. */ expiresInMs: number }

export interface AnnounceMsg { text: string; from: string }

export interface TeleportedMsg { x: number; y: number }

export type ChatRecvMsg = ChatMessage;
export type CastFailReason = "cooldown" | "mana" | "level" | "vocation" | "target" | "range" | "pz" | "unknown" | "dead"
  /** Parede entre o conjurador e o alvo (linha de visão). */
  | "no_los";
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
  /** Cocheiro: destinos e preço para este jogador (0 = grátis). */
  travel?: { id: string; label: string; price: number }[];
}
export interface TravelMsg { npcId: string; dest: string }
export interface LootMsg {
  x: number; y: number; monsterName: string; items: ItemInstance[]; gold: number;
  /** Itens perdidos (mochila cheia e sem espaço no chão). */
  lostFull?: number;
  /** Itens que não couberam e caíram no chão (no seu tile, só você pega por 60 s). */
  fellToGround?: number;
}
export interface FeedMsg { text: string; kind: "drop" | "level" | "boss" | "death" | "info"; rarity?: Rarity }
export interface NpcSayMsg { npcId: string; text: string }
export interface EmoteMsg { id: string; emote: string }
export interface FishMsg { x: number; y: number }
/** `ms` = 0 cancela a boia. */
export interface FishCastMsg { id: string; x: number; y: number; ms: number }
export interface EventMsg { active: import("./data/events.ts").ActiveEvent | null }
export interface TrainingOpenMsg { statueId: string }
export interface TrainingResultMsg { skill: SkillId; minutes: number; levelsGained: number; newLevel: number; pct: number }
export interface ArenaLobbySummary { id: string; leader: string; members: string[]; max: number; avgLevel: number }
export interface ArenaLobbiesMsg { lobbies: ArenaLobbySummary[]; freeArenas: number; queue: number }
export type ArenaPhase = "lobby" | "queued" | "countdown" | "fight" | "pause" | "ended";
export interface ArenaStateMsg {
  state: null | {
    lobbyId: string;
    arenaId?: number;              // 1..ARENA_COUNT quando em partida
    phase: ArenaPhase;
    wave: number;                  // onda atual (1..); 0 antes de começar
    /** Fim da contagem/pausa (ms epoch do servidor), se houver. */
    phaseEndsAt?: number;
    /** Relógio do servidor no envio (o cliente corrige a diferença de relógio para a contagem). */
    serverNow?: number;
    monstersLeft?: number;
    /** level: para a janela mostrar quem está fora da faixa de XP (abaixo de 2/3 do maior). */
    members: { name: string; alive: boolean; ready?: boolean; level?: number }[];
    leader: string;
    /** Recompensa acumulada até agora (cada participante). */
    earned: { xp: number; gold: number };
  };
}
export interface ArenaResultMsg { wavesCleared: number; xp: number; gold: number; best: number; reason: "wiped" | "gave_up" | "completed" }
export interface CombatMsg { events: CombatEvent[] }
export interface XpGainMsg { amount: number; x: number; y: number }
export interface LevelUpMsg { level: number; maxHp: number; maxMana: number }
export interface DiedMsg { lostXp: number; killerName: string }
export interface CreatureDiedMsg { id: string; x: number; y: number; defId: string }
export interface ExploredMsg { width: number; height: number; bits: string /* base64 */ }
export interface NoticeMsg {
  text: string;
  kind?: "info" | "warn" | "good";
  /** Também registra no chat (linha de sistema, copiável) — respostas de comandos de admin. */
  log?: boolean;
}

/**
 * Fluxo de contas (uma conta → vários personagens):
 *   1. POST /api/login     {account, password, create?}  → AccountSession (lista de personagens)
 *      create=true cria a conta (erro "account_taken" se já existe); sem create, conta inexistente → "no_account".
 *   2. POST /api/characters {session, name, vocation}     → AccountSession atualizada (cria personagem)
 *   3. POST /api/play       {session, name}               → PlayResponse (token de uso único p/ joinOrCreate)
 *   POST /api/logout {session} encerra a sessão da conta.
 * O nome da CONTA é privado (não aparece no jogo); o nome do PERSONAGEM é o que os outros veem.
 */
export interface LoginRequest { account: string; password: string; create?: boolean }
export interface CharacterSummary {
  name: string;
  vocation: Vocation;
  level: number;
  /** Roupa atual (retrato na lista de personagens). */
  outfit?: string;
  addons?: number;
  /** Treinando offline agora (ao entrar, recebe o progresso). */
  training?: { skill: SkillId; sinceMs: number };
  online?: boolean;
}
export const MAX_CHARACTERS_PER_ACCOUNT = 5;
export type AuthError =
  | "invalid_request" | "invalid_account" | "invalid_name" | "wrong_password" | "no_account" | "account_taken"
  | "weak_password" | "too_many_attempts" | "name_taken" | "too_many_characters" | "invalid_session" | "no_character"
  | "already_online" | "invalid_code" | "character_online" | "character_training";
export type AuthFail = {
  ok: false;
  error: AuthError;
  /** too_many_attempts: segundos até poder tentar de novo. */
  retryAfterSec?: number;
  /** Texto pronto (pt-BR) para erros que o cliente não conheça. */
  message?: string;
};
/** Sessão da conta (curta, em memória no servidor; expira em 30 min sem uso). */
export type AccountSession = { ok: true; session: string; account: string; characters: CharacterSummary[] } | AuthFail;
export interface CreateCharacterRequest { session: string; name: string; vocation: Vocation }
export interface PlayRequest { session: string; name: string }
export type PlayResponse = { ok: true; token: string; name: string; vocation: Vocation } | AuthFail;
/**
 * Recuperação de senha: um admin gera um código (/resetsenha <conta> no jogo, ou `npm run admin -- reset-password <conta>`).
 * POST /api/reset-password {account, code, password} → AccountSession (já entra na conta). Código de uso único, 24 h.
 */
export interface ResetPasswordRequest { account: string; code: string; password: string }
/** POST /api/characters/delete — exclui um personagem da conta (exige a senha; recusa se online/treinando). */
export interface DeleteCharacterRequest { session: string; name: string; password: string }
/** @deprecated mantido só para compatibilidade de tipos antigos. */
export type LoginResponse = AccountSession;

/** Códigos de fechamento próprios (o Colyseus reserva 4000–4010). */
export const CLOSE_REPLACED = 4100;   // a conta entrou em outro lugar
export const CLOSE_TRAINING = 4101;   // saiu para treinar offline
export const CLOSE_KICKED = 4102;     // expulso por um administrador (reason = motivo)

/** Opções do joinOrCreate("world", ...) */
export interface JoinOptions { token: string }
