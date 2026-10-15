// Quando mostrar a tela de novidades sozinha. Puro (sem DOM) para poder testar.

export interface NewsState { seen: string | null; level: number; xp: number }

/**
 * Mostra sozinha só para quem já joga (personagem novo já tem o cartão de primeiros passos) e ainda não viu o id mais
 * recente. Quem nunca viu nenhuma novidade, mas já tem progresso, vê a mais recente uma vez.
 */
export function shouldAutoShowNews(s: NewsState, latestId: string): boolean {
  if (s.level <= 1 && s.xp <= 0) return false;
  return s.seen !== latestId;
}
