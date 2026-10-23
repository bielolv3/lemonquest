// Rolagem do chat: só puxa para o fim quando o leitor já estava no fim. Quem subiu para ler o histórico fica
// onde está e vê uma pílula "↓ N novas". Lógica pura (sem DOM) para ter teste unitário.

/** Até esta distância do fim (px) o leitor conta como "no fim" (uma linha de 18 px já é "subiu"). */
export const STICK_PX = 8;

/** O leitor está colado no fim da lista? */
export function isAtBottom(scrollTop: number, clientHeight: number, scrollHeight: number, slack = STICK_PX): boolean {
  return scrollHeight - scrollTop - clientHeight <= slack;
}

/** Quantas linhas de `next` (na aba visível) não existiam em `prev` — as chaves são únicas por linha. */
export function addedLines<T extends { key: string | number }>(prev: readonly T[], next: readonly T[], visible: (l: T) => boolean): number {
  const known = new Set(prev.map((l) => l.key));
  let n = 0;
  for (const l of next) if (!known.has(l.key) && visible(l)) n++;
  return n;
}

export interface ScrollDecision { scroll: boolean; unseen: number }

/**
 * Chegaram `added` linhas. No fim (ou chat recolhido, que ao abrir deve mostrar o mais novo): rola e zera o
 * contador. Lendo o histórico: fica parado e acumula as não lidas na pílula.
 */
export function decideScroll(atBottom: boolean, unseenBefore: number, added: number): ScrollDecision {
  if (atBottom) return { scroll: true, unseen: 0 };
  return { scroll: false, unseen: unseenBefore + added };
}

export const unseenText = (n: number): string => `↓ ${n} ${n === 1 ? "nova" : "novas"}`;
