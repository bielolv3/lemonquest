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
