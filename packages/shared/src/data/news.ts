// Novidades mostradas ao jogador (tela "Novidades"): a mais nova primeiro. `id` muda a cada entrada nova; quem já viu o
// id mais recente não vê a tela de novo. Texto para jogador (sem jargão), uma linha por item.

export interface NewsEntry {
  /** Único e estável (usa a data da versão). */
  id: string;
  /** "15 de outubro" etc. */
  date: string;
  title: string;
  items: string[];
}

export const NEWS: readonly NewsEntry[] = [
  {
    id: "2026-10-21e",
    date: "21 de outubro (noite)",
    title: "Loot do grupo no chão",
    items: [
      "Em grupo, o loot dos monstros cai no chão: qualquer um do grupo pode pegar (depois de 1 minuto, qualquer pessoa).",
      "Arraste um item do chão para outro tile para mudá-lo de lugar (Shift numa pilha escolhe quanto).",
    ],
  },
  {
    id: "2026-10-21d",
    date: "21 de outubro (mais tarde)",
    title: "Mochila maior com o level",
    items: [
      "A mochila agora cresce com você: 20 espaços no level 1 e mais 1 a cada 5 levels, até 40.",
      "Quem já tem level alto ganha os espaços na hora, ao entrar.",
      "Barras de rolagem mais discretas em todas as janelas.",
    ],
  },
  {
    id: "2026-10-21c",
    date: "21 de outubro (à noite)",
    title: "Atalhos de magia e magias novas",
    items: [
      "Aperte H (ou ⚙ no fim da barra) para escolher a tecla de cada magia: até 12 atalhos, também com Shift. Fica salvo no seu personagem.",
      "Arrastar uma magia na barra para cima de outra troca as duas de tecla.",
      "16 magias novas do lv 35 ao 90, quatro por vocação: ondas de fogo e gelo, Morte Súbita, tempestades, Chuva de Estrelas...",
      "Cavaleiros ganham a Fúria (utito tempo): +25% de dano por 10 segundos.",
      "Todas as magias da vocação já vêm na barra: 1–0 e, para quem tem 11 ou 12, C e F. Troque como quiser no painel (H).",
    ],
  },
  {
    id: "2026-10-21b",
    date: "21 de outubro (à tarde)",
    title: "Coliseu mais rápido",
    items: [
      "Acabou a espera entre as ondas: venceu uma, a próxima vem 3 segundos depois.",
      "O vendedor do Coliseu abre só depois das ondas de chefe (5, 10, 15...), com tempo para comprar e se curar.",
      "Botão Sair na barra do Coliseu: dá para sair a qualquer momento, ficando com o que já ganhou.",
    ],
  },
  {
    id: "2026-10-21",
    date: "21 de outubro",
    title: "Monstros mais espertos",
    items: [
      "Dragões cospem fogo, ciclopes e behemoths dão pisões, demônios fazem chover fogo e bruxas do gelo deixam você lento.",
      "Golpes fortes avisam antes: o chão pisca na cor do elemento. Saia da área a tempo e não leva o dano!",
      "Alguns chefes chamam ajudantes (que somem quando o chefe cai e não dão XP) e outros se curam quando estão quase mortos.",
      "Estágios de XP: a partir do lv 60 caçar dá 60% da XP, do 80 dá 40% e do 100 dá 30%. Missões continuam dando tudo.",
      "PvP: sair do jogo logo depois de atacar alguém não apaga mais a caveira branca, e o personagem fica no mundo até o bloqueio acabar.",
    ],
  },
  {
    id: "2026-10-20",
    date: "20 de outubro",
    title: "Costa Esmeralda e quests do jeito do Tibia",
    items: [
      "Mapa novo a leste das Terras Selvagens: Ilha Gelada, Selva de Banuta, Vulcão de Goroma e Porto Esperança (zona protegida).",
      "Chega de carroça (Vila ou Fronteira) ou pelas três trilhas novas na borda leste das Terras Selvagens.",
      "Hunts para todo nível: macacos e tarântulas (lv 25+), piratas (lv 30+), bárbaros e bruxas do gelo (lv 50+), heróis (lv 65+) e cães infernais (lv 95+).",
      "Masmorras: Caverna dos Piratas, Templo de Banuta, Caverna do Yeti, Caverna dos Heróis e a Cidadela de Ferumbras.",
      "Quests de baú: cada personagem abre uma vez, e em alguns você escolhe um entre vários prêmios. Portas de quest pedem level ou missão.",
      "A Aniquilação: quatro aventureiros de lv 100 nas placas, alguém puxa a alavanca... e boa sorte com os demônios!",
      "25 missões novas com NPCs, chefes (Barba-Ruiva, Rei Kongra, Yeti, Ferumbras) e títulos novos.",
    ],
  },
  {
    id: "2026-10-17b",
    date: "17 de outubro (à tarde)",
    title: "Terras Selvagens: o mapa dobrou de tamanho",
    items: [
      "Passe pelas trilhas a leste das Ruínas ou do Pântano e chegue às Terras Selvagens, a nova área de fim de jogo (lv 40+).",
      "Hunts clássicas: Fortaleza Orc, Labirinto dos Minotauros, Monte Ciclope, Cemitério dos Olhos, Forte Negro e Vale dos Dragões.",
      "Lá embaixo, o Abismo: behemoths, demônios e o temido Orshabaal. Só com grupo!",
      "Chefes novos: Raposa Chifruda (no Labirinto), Demodras (terça 20h) e Orshabaal (sábado 21h).",
      "Posto da Fronteira: vila protegida no meio das Terras, com loja, depósito e uma batedora que indica as hunts.",
      "Equipamentos novos de lv 50 e 70, como Espada de Fogo, Armadura de Placas Mágica e as famosas Botas da Pressa.",
    ],
  },
  {
    id: "2026-10-17",
    date: "17 de outubro",
    title: "Sete roupas novas",
    items: [
      "Roupas novas: Nórdico, Mendigo, Domador de Feras, Caçador de Demônios, Peregrino, Senhor da Guerra e Monge.",
      "Cada uma tem 2 addons, como no Tibia. Abra a janela de roupas para ver o que libera cada uma.",
      "Conquistas novas para liberar tudo: chefes repetidos, level 75, 80 de corpo a corpo, 60 de escudo, meditação offline e mais.",
    ],
  },
  {
    id: "2026-10-15b",
    date: "15 de outubro (à noite)",
    title: "Desafios, bestiário e chefes na agenda",
    items: [
      "Desafios da semana: abra o diário (L) e clique em Desafios semanais. Três metas que zeram toda segunda, com bônus por cumprir todas.",
      "Ranking semanal: XP, abates, peixes e chefes (zeram na segunda-feira), e uma categoria nova de Pescador.",
      "Bestiário (tecla B): veja vida, dano e o que cada monstro solta. Os que você ainda não derrotou aparecem como ???.",
      "Chefes na agenda: o Lich do Pântano (quarta 20h) e o Rei Goblin (domingo 20h) acordam com bônus de loot.",
      "Bônus de login: entre em dias seguidos para ganhar prêmios, com um maior no 7º dia.",
      "Poção automática (botão ⚗): bebe vida ou mana sozinha abaixo do limite que você escolher.",
      "Acessibilidade (botão Aa): texto maior, alto contraste e animações reduzidas. E esta tela de Novidades fica no botão da ajuda (F1).",
    ],
  },
  {
    id: "2026-10-15",
    date: "15 de outubro",
    title: "Mais coisas para fazer com os amigos",
    items: [
      "O que você fala no chat agora aparece sobre a cabeça do personagem (amarelo no geral, azul no grupo).",
      "Emotes: botão ☺ no chat ou /e coracao, /e rir, /e oi...",
      "Sussurre com /w Nome mensagem e responda com /r. Use /amigo Nome para saber quando um amigo entra.",
      "Troca entre jogadores: botão direito no outro jogador > Trocar itens. Os dois confirmam e pronto.",
      "Pesca: compre a Vara de Pesca com o Velho Caçador Tomé e clique com o botão direito na água. Fique parado!",
      "Eventos com bônus de XP e loot em horários da semana. A etiqueta ★ no topo mostra o que está valendo.",
      "Arraste as magias da barra para mudar a ordem. O novato ganhou uma seta que mostra para onde ir.",
    ],
  },
];

export const LATEST_NEWS_ID: string = NEWS[0]!.id;
