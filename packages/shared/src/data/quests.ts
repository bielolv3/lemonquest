import { monsterDef } from "./monsters.ts";

// Missões (quests) encadeadas e recompensas diárias do Quadro de Recompensas. Dados + regras puras (servidor e cliente).
// O servidor (packages/server/src/systems/quests.ts) é a autoridade; o cliente usa estas funções para os marcadores
// "!"/"?" sobre os NPCs, o rastreador e o diário de missões.

/** Tipos de passo. Todos os passos de uma missão correm em paralelo; a missão fica pronta quando todos completam. */
export type QuestStepKind =
  /** Matar `count` monstros `target` (id de MONSTERS). Crédito para todos que causaram dano (e grupo, se houver). */
  | "kill"
  /** Ter `count` itens `target` na mochila ao entregar (o item NÃO é consumido). */
  | "collect"
  /** Entregar `count` itens `target` (consumidos ao entregar ao NPC que deu a missão, ou a `npc` se houver). */
  | "deliver"
  /** Pisar na zona `target` (nome de objeto "zone" do mapa) ou na área `area`. */
  | "explore"
  /** Falar com o NPC `target`. */
  | "talk"
  /** Derrotar o chefe `target` (como "kill", mas com destaque). */
  | "boss"
  /** Vencer a onda `count` no Coliseu (`target` ignorado). */
  | "arena";

export interface QuestStep {
  kind: QuestStepKind;
  target: string;
  count: number;
  /** "deliver": NPC que recebe (padrão: quem deu a missão). */
  npc?: string;
  /** "explore": retângulo em tiles (alternativa ao nome da zona). */
  area?: { x: number; y: number; w: number; h: number };
  /** Texto curto do passo no rastreador (PT-BR), ex.: "Ratos". */
  label: string;
}

export interface QuestReward {
  xp: number;
  gold: number;
  items?: { itemId: string; count: number }[];
  /** Desbloqueio (roupa/addon/título) — id livre; o sistema de conquistas decide o que fazer com ele. */
  unlock?: string;
}

export interface QuestDef {
  id: string;
  name: string;
  /** NPC que dá e recebe a missão. */
  giver: string;
  minLevel: number;
  /** Missões que precisam estar concluídas. */
  requires?: string[];
  /** Resumo (diário de missões). */
  summary: string;
  steps: QuestStep[];
  dialog: { offer: string; accept: string; progress: string; complete: string };
  rewards: QuestReward;
}

const q = (d: QuestDef): QuestDef => d;

/** Catálogo (ordem = ordem de exibição). Floresta 1–10 → Pântano/Cavernas 10–25 → Ruínas/Cripta 25–40. */
export const QUEST_LIST: QuestDef[] = [
  // --- Floresta (1–10) -------------------------------------------------------------------------------
  q({
    id: "rats_barn", name: "Ratos no Celeiro", giver: "guard_captain", minLevel: 1,
    summary: "Os ratos da floresta ao norte estão roubando os grãos da vila. O Capitão Rodrigo quer o problema resolvido.",
    steps: [{ kind: "kill", target: "rat", count: 5, label: "Ratos" }],
    dialog: {
      offer: "Você aí, recruta! Os ratos da floresta ao norte estão invadindo os celeiros. Mate cinco deles e eu te pago bem. Topa?",
      accept: "Ótimo! A floresta fica logo ao norte da praça. Volte quando tiver acabado com eles.",
      progress: "Ainda tem rato roendo meu trigo. Volte quando tiver matado cinco.",
      complete: "Cinco ratos a menos! O padeiro vai dormir tranquilo. Tome, você mereceu.",
    },
    rewards: { xp: 100, gold: 30, items: [{ itemId: "health_potion", count: 5 }] },
  }),
  q({
    id: "slime_salve", name: "Gosma para Unguentos", giver: "herbalist", minLevel: 2,
    summary: "Dona Marta precisa de gosma de slime fresquinha para preparar unguentos.",
    steps: [{ kind: "deliver", target: "slime_goo", count: 5, label: "Gosma" }],
    dialog: {
      offer: "Ah, meu bem, você parece forte! Preciso de cinco porções de gosma das gosmas verdes da floresta para os meus unguentos. Me ajuda?",
      accept: "Que amor! As gosmas ficam espalhadas pela floresta. Traga cinco porções de gosma.",
      progress: "Ainda não tem as cinco porções de gosma? Sem pressa, elas não fogem... muito.",
      complete: "Perfeito, e ainda está morninha! Leve estas poções, feitas com carinho.",
    },
    rewards: { xp: 180, gold: 50, items: [{ itemId: "health_potion", count: 3 }, { itemId: "mana_potion", count: 3 }] },
  }),
  q({
    id: "bee_hunt", name: "Caça às Abelhas", giver: "old_hunter", minLevel: 4,
    summary: "O Velho Caçador Tomé quer ensinar a caçar abelhas sem levar ferroada (muitas).",
    steps: [
      { kind: "kill", target: "bee", count: 6, label: "Abelhas" },
      { kind: "deliver", target: "bee_sting", count: 3, label: "Ferrões" },
    ],
    dialog: {
      offer: "Quer aprender a caçar? Comece pelas abelhas do norte da floresta. Mate seis e me traga três ferrões, que eu uso nas minhas flechas.",
      accept: "Isso! Elas só atacam quem mexe com elas. Então mexa.",
      progress: "Seis abelhas e três ferrões, garoto. Paciência e mira.",
      complete: "Belos ferrões! Você tem futuro. Leve isto para a próxima caçada.",
    },
    rewards: { xp: 350, gold: 100, items: [{ itemId: "honey", count: 5 }, { itemId: "meat", count: 5 }] },
  }),
  q({
    id: "forest_wolves", name: "Os Lobos da Floresta", giver: "guard_captain", minLevel: 6, requires: ["rats_barn"],
    summary: "Lobos atacaram viajantes na estrada. O Capitão quer a matilha reduzida e um relatório do Velho Caçador.",
    steps: [
      { kind: "talk", target: "old_hunter", count: 1, label: "Falar com Tomé" },
      { kind: "kill", target: "wolf", count: 10, label: "Lobos" },
    ],
    dialog: {
      offer: "Os lobos andam ousados demais: dois mercadores foram atacados na estrada. Fale com o Velho Caçador Tomé, ele sabe onde fica a matilha, e mate dez lobos.",
      accept: "Tomé mora na clareira a oeste da floresta. Cuidado: lobo não perdoa novato distraído.",
      progress: "A matilha ainda está lá fora. Dez lobos, e fale com o Tomé.",
      complete: "As estradas estão seguras de novo. A vila te deve uma. Tome, e não gaste tudo em mel.",
    },
    rewards: { xp: 900, gold: 250, items: [{ itemId: "health_potion", count: 10 }] },
  }),
  // --- Pântano e Cavernas (10–25) ---------------------------------------------------------------------
  q({
    id: "swamp_report", name: "Relatório do Pântano", giver: "guard_captain", minLevel: 10, requires: ["forest_wolves"],
    summary: "Algo se mexe no Pântano Turvo, a leste. O Capitão precisa de alguém para explorar e conter as cobras.",
    steps: [
      { kind: "explore", target: "Pântano Turvo", count: 1, label: "Explorar o Pântano Turvo" },
      { kind: "kill", target: "snake", count: 10, label: "Cobras" },
    ],
    dialog: {
      offer: "Patrulheiros sumiram no Pântano Turvo, a leste. Vá até lá, veja o que está acontecendo e mate dez cobras pelo caminho.",
      accept: "Leve antídoto... ah, não temos antídoto. Leve coragem, então.",
      progress: "E o pântano? Ainda preciso do seu relatório e de dez cobras a menos.",
      complete: "Uma névoa roxa e mortos andando? Isso é coisa de lich... Tome sua paga, vou avisar a Sacerdotisa.",
    },
    rewards: { xp: 1500, gold: 500, items: [{ itemId: "ring_vigor", count: 1 }] },
  }),
  q({
    id: "silk_poison", name: "Seda e Veneno", giver: "herbalist", minLevel: 14, requires: ["slime_salve"],
    summary: "Dona Marta quer seda e olhos de aranha para poções mais fortes.",
    steps: [
      { kind: "deliver", target: "spider_silk", count: 5, label: "Seda de Aranha" },
      { kind: "deliver", target: "spider_eye", count: 2, label: "Olhos de Aranha" },
    ],
    dialog: {
      offer: "Minhas poções médias precisam de seda de aranha e olhos de aranha. As aranhas do pântano têm de sobra. Cinco sedas e dois olhos, pode ser?",
      accept: "Cuidado com o veneno, meu bem. E não esmague os olhos!",
      progress: "Cinco sedas e dois olhos de aranha. Inteiros, por favor.",
      complete: "Que maravilha! Com isso faço poções para a vila inteira. Leve algumas.",
    },
    rewards: { xp: 2500, gold: 900, items: [{ itemId: "health_potion_medium", count: 5 }, { itemId: "mana_potion_medium", count: 5 }] },
  }),
  q({
    id: "cave_echoes", name: "Ecos nas Cavernas", giver: "old_hunter", minLevel: 16, requires: ["bee_hunt"],
    summary: "Tomé ouviu ecos estranhos vindos das Cavernas ao sul. Morcegos demais, diz ele.",
    steps: [
      { kind: "explore", target: "Cavernas", count: 1, label: "Explorar as Cavernas" },
      { kind: "kill", target: "bat", count: 12, label: "Morcegos" },
    ],
    dialog: {
      offer: "Nas Cavernas ao sul os morcegos se multiplicaram. Espantam a caça inteira. Entre lá e derrube doze deles.",
      accept: "Leve tocha. E não grite, que eles vêm todos de uma vez.",
      progress: "Doze morcegos. E vá até as Cavernas, não adianta caçar na praça.",
      complete: "Silêncio, finalmente! A caça vai voltar. Este anel me serviu bem por anos; agora é seu.",
    },
    rewards: { xp: 3000, gold: 1200, items: [{ itemId: "ring_mente", count: 1 }] },
  }),
  q({
    id: "swamp_lich", name: "O Lich do Pântano", giver: "priest", minLevel: 22, requires: ["swamp_report"],
    summary: "A Sacerdotisa Liora sente uma presença morta no Pântano Turvo: um lich. Ele guarda a chave da Cripta.",
    steps: [
      { kind: "boss", target: "swamp_lich", count: 1, label: "Lich do Pântano" },
      { kind: "collect", target: "crypt_key", count: 1, label: "Chave da Cripta" },
    ],
    dialog: {
      offer: "O Capitão me contou da névoa roxa. É um lich, viajante, um morto que se recusa a descansar. Derrote-o e traga a chave da Cripta que ele carrega. Não vá sozinho.",
      accept: "Que a luz te proteja. Reúna amigos: ele é mais forte do que parece.",
      progress: "O lich ainda caminha. Sinto sua presença daqui. Derrote-o e traga a Chave da Cripta.",
      complete: "A chave da Cripta... Então é verdade. Guarde-a bem; precisaremos dela. Receba a bênção da luz.",
    },
    rewards: { xp: 8000, gold: 3000, items: [{ itemId: "health_potion_large", count: 5 }, { itemId: "mana_potion_large", count: 5 }], unlock: "quest_lich_bane" },
  }),
  // --- Ruínas e Cripta (25–40) ------------------------------------------------------------------------
  q({
    id: "restless_dead", name: "Os Mortos Inquietos", giver: "priest", minLevel: 25, requires: ["swamp_lich"],
    summary: "Com o lich derrotado, os mortos da Cripta despertaram. Liora pede que você os ponha para descansar.",
    steps: [
      { kind: "explore", target: "Cripta", count: 1, label: "Entrar na Cripta" },
      { kind: "kill", target: "skeleton", count: 15, label: "Esqueletos" },
      { kind: "kill", target: "ghost", count: 8, label: "Fantasmas" },
    ],
    dialog: {
      offer: "A morte do lich acordou a Cripta. Esqueletos e fantasmas vagam sem paz. Entre lá e devolva-os ao descanso: quinze esqueletos e oito fantasmas.",
      accept: "A Cripta fica no extremo sudeste. A luz vai contigo.",
      progress: "Ainda ouço os lamentos da Cripta. Continue, viajante.",
      complete: "O silêncio voltou à Cripta. Este amuleto foi abençoado no altar; que ele te proteja.",
    },
    rewards: { xp: 9000, gold: 5000, items: [{ itemId: "amulet_protecao", count: 1 }] },
  }),
  q({
    id: "ruins_goblins", name: "Goblins nas Ruínas", giver: "guard_captain", minLevel: 25, requires: ["swamp_report"],
    summary: "Goblins ocuparam as Ruínas de Kael, ao norte. O Capitão quer provas de que a ameaça foi contida.",
    steps: [
      { kind: "explore", target: "Ruínas de Kael", count: 1, label: "Explorar as Ruínas de Kael" },
      { kind: "kill", target: "goblin", count: 15, label: "Goblins" },
      { kind: "deliver", target: "goblin_tooth", count: 5, label: "Dentes de Goblin" },
    ],
    dialog: {
      offer: "Goblins tomaram as Ruínas de Kael e estão saqueando as caravanas. Mate quinze e me traga cinco dentes como prova.",
      accept: "As ruínas ficam ao norte, depois da floresta. Goblin foge quando apanha: não deixe escapar.",
      progress: "Quinze goblins e cinco dentes. Sem dente, sem pagamento.",
      complete: "Que coleção nojenta! Perfeito. Mas os goblins falam de um rei... Fique de olho.",
    },
    rewards: { xp: 8000, gold: 4000, items: [{ itemId: "ring_furia", count: 1 }] },
  }),
  q({
    id: "goblin_king", name: "A Coroa do Rei Goblin", giver: "guard_captain", minLevel: 35, requires: ["ruins_goblins"],
    summary: "O Rei Goblin comanda os saqueadores das Ruínas de Kael. Derrote-o e traga sua coroa.",
    steps: [
      { kind: "boss", target: "goblin_king", count: 1, label: "Rei Goblin" },
      { kind: "deliver", target: "goblin_crown", count: 1, label: "Coroa do Rei Goblin" },
    ],
    dialog: {
      offer: "Os goblins têm um rei, e ele está nas profundezas das Ruínas de Kael. Acabe com ele e traga a coroa. Leve os melhores guerreiros que conhecer.",
      accept: "Pela vila de Pedra Clara! Volte vivo, de preferência com a coroa.",
      progress: "O Rei Goblin ainda reina. Quero aquela coroa na minha mesa.",
      complete: "A coroa do Rei Goblin! Os bardos vão cantar seu nome por anos. Aceite isto em nome da vila.",
    },
    rewards: { xp: 20000, gold: 15000, items: [{ itemId: "mithril_bar", count: 2 }], unlock: "quest_goblin_slayer" },
  }),
  // --- Coliseu ------------------------------------------------------------------------------------------
  q({
    id: "arena_glory", name: "Glória no Coliseu", giver: "arena_master", minLevel: 12,
    summary: "O Mestre do Coliseu quer ver do que você é capaz: vença a quinta onda.",
    steps: [{ kind: "arena", target: "", count: 5, label: "Ondas do Coliseu" }],
    dialog: {
      offer: "Sangue novo! Prove seu valor: vença a quinta onda do Coliseu, sozinho ou com seu grupo, e terá meu respeito.",
      accept: "Monte seu grupo e entre na arena. A multidão está esperando!",
      progress: "Ainda não venceu a quinta onda? A areia não mente.",
      complete: "A multidão grita seu nome! Isto é para quem sobrevive à areia.",
    },
    rewards: { xp: 2500, gold: 1500, items: [{ itemId: "health_potion_medium", count: 10 }], unlock: "quest_arena_glory" },
  }),
];

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(QUEST_LIST.map((d) => [d.id, d]));
export const questDef = (id: string): QuestDef | undefined => (Object.hasOwn(QUESTS, id) ? QUESTS[id] : undefined);

/** Máximo de missões rastreadas no canto da tela. */
export const MAX_TRACKED_QUESTS = 3;

// ---------------------------------------------------------------------------
// Estado do jogador (enviado ao cliente em S2C.Quests) e regras puras.
// ---------------------------------------------------------------------------

export interface ActiveQuestView {
  id: string;
  /** Progresso por passo (mesma ordem de `steps`). collect/deliver: 0 (o cliente conta pela mochila). */
  progress: number[];
}

export type BountyStatus = "open" | "active" | "done";
export interface BountyView {
  monster: string;
  count: number;
  progress: number;
  status: BountyStatus;
  xp: number;
  gold: number;
}

export interface QuestsMsg {
  active: ActiveQuestView[];
  done: string[];
  tracked: string[];
  bounties: { day: string; resetsAt: number; list: BountyView[] };
}

/** Uma missão aceita ou concluída (no diário). */
export type QuestStatus = "locked" | "available" | "active" | "ready" | "done";

/** Conta quantas unidades de um item o jogador tem (mochila). */
export type ItemCounter = (itemId: string) => number;

/** Progresso efetivo de um passo (collect/deliver contam a mochila). */
export function stepProgress(step: QuestStep, stored: number, countItem: ItemCounter): number {
  // Entrega a outro NPC: o progresso é gravado quando o item é entregue lá.
  if (step.kind === "deliver" && step.npc) return Math.min(step.count, stored);
  if (step.kind === "collect" || step.kind === "deliver") return Math.min(step.count, countItem(step.target));
  return Math.min(step.count, stored);
}

/** Todos os passos completos? */
export function questReady(def: QuestDef, progress: readonly number[], countItem: ItemCounter): boolean {
  return def.steps.every((s, i) => stepProgress(s, progress[i] ?? 0, countItem) >= s.count);
}

/** Pode aceitar? (nem ativa nem concluída, level e pré-requisitos). */
export function questAvailable(def: QuestDef, level: number, isActive: (id: string) => boolean, isDone: (id: string) => boolean): boolean {
  if (isActive(def.id) || isDone(def.id) || level < def.minLevel) return false;
  return (def.requires ?? []).every(isDone);
}

export function questStatus(def: QuestDef, st: Pick<QuestsMsg, "active" | "done">, level: number, countItem: ItemCounter): QuestStatus {
  if (st.done.includes(def.id)) return "done";
  const a = st.active.find((x) => x.id === def.id);
  if (a) return questReady(def, a.progress, countItem) ? "ready" : "active";
  return questAvailable(def, level, () => false, (id) => st.done.includes(id)) ? "available" : "locked";
}

/** Marcador sobre o NPC: "ready" (? amarelo) > "available" (! amarelo) > "progress" (? cinza) > null. */
export type NpcMarker = "ready" | "available" | "progress" | null;

export function npcMarker(npcId: string, st: QuestsMsg, level: number, countItem: ItemCounter): NpcMarker {
  if (npcId === BOUNTY_NPC) {
    const list = st.bounties.list;
    if (list.some((b) => b.status === "active" && b.progress >= b.count)) return "ready";
    if (list.some((b) => b.status === "open")) return "available";
    if (list.some((b) => b.status === "active")) return "progress";
    return null;
  }
  let best: NpcMarker = null;
  const rank = (m: NpcMarker) => (m === "ready" ? 3 : m === "available" ? 2 : m === "progress" ? 1 : 0);
  const bump = (m: NpcMarker) => { if (rank(m) > rank(best)) best = m; };
  for (const def of QUEST_LIST) {
    const a = st.active.find((x) => x.id === def.id);
    // Passos "falar com"/"entregar a" outro NPC: este NPC chama a atenção.
    if (a) {
      def.steps.forEach((s, i) => {
        const done = stepProgress(s, a.progress[i] ?? 0, countItem) >= s.count;
        if (s.kind === "talk" && s.target === npcId && !done) bump("ready");
        if (s.kind === "deliver" && s.npc === npcId && (a.progress[i] ?? 0) < s.count && countItem(s.target) >= s.count) bump("ready");
      });
    }
    if (def.giver !== npcId) continue;
    const status = questStatus(def, st, level, countItem);
    if (status === "ready") bump("ready");
    else if (status === "available") bump("available");
    else if (status === "active") bump("progress");
  }
  return best;
}

/** Missões que o NPC mostra na aba "Missões" (disponíveis, ativas e prontas; concluídas não). */
export function questsForNpc(npcId: string, st: QuestsMsg, level: number, countItem: ItemCounter): { def: QuestDef; status: QuestStatus }[] {
  return QUEST_LIST.filter((d) => d.giver === npcId)
    .map((def) => ({ def, status: questStatus(def, st, level, countItem) }))
    .filter((e) => e.status === "available" || e.status === "active" || e.status === "ready");
}

// ---------------------------------------------------------------------------
// Recompensas diárias (Quadro de Recompensas)
// ---------------------------------------------------------------------------

export const BOUNTY_NPC = "bounty_board";
export const BOUNTIES_PER_DAY = 3;
export const BOUNTY_CHEST_ID = "bounty_chest";
/** Hora local (America/Sao_Paulo) da troca diária. */
export const BOUNTY_RESET_HOUR = 6;
export const BOUNTY_TZ = "America/Sao_Paulo";

/** Faixas de level → monstros possíveis para as recompensas. */
export const BOUNTY_BANDS: { minLevel: number; monsters: string[] }[] = [
  { minLevel: 1, monsters: ["rat", "slime", "bee", "wolf"] },
  { minLevel: 10, monsters: ["wolf", "snake", "spider", "bat"] },
  { minLevel: 18, monsters: ["spider", "bat", "skeleton", "goblin"] },
  { minLevel: 26, monsters: ["skeleton", "goblin", "ghost", "lizardman"] },
  { minLevel: 34, monsters: ["ghost", "lizardman", "flame_spirit", "goblin"] },
];

export function bountyBand(level: number): number {
  let b = 0;
  for (let i = 0; i < BOUNTY_BANDS.length; i++) if (level >= BOUNTY_BANDS[i]!.minLevel) b = i;
  return b;
}

/** "Mate 20 Lobos" (nome do monstro no plural simples). */
export function bountyTitle(d: { monster: string; count: number }): string {
  const name = monsterDef(d.monster)?.name ?? d.monster;
  return `Mate ${d.count} ${pluralPt(name)}`;
}

/** Plural simples em PT-BR da 1ª palavra ("Lobo" → "Lobos", "Homem-Lagarto" → "Homens-Lagarto", "Espírito de Chama" → "Espíritos de Chama"). */
export function pluralPt(name: string): string {
  const parts = name.split(" ");
  const head = parts[0]!;
  const h = head.includes("-") ? head.split("-") : [head];
  const w = h[0]!;
  const pl = /ão$/.test(w) ? w.replace(/ão$/, "ões") : /m$/.test(w) ? w.replace(/m$/, "ns") : /[rsz]$/.test(w) ? w + "es" : /l$/.test(w) ? w.replace(/l$/, "is") : w + "s";
  h[0] = pl;
  parts[0] = h.join("-");
  return parts.join(" ");
}

