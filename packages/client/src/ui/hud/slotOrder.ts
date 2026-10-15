// Ordem das magias na barra de ações (editável por arrastar e soltar). Puro: sem DOM nem stores, para poder testar.

/**
 * Monta os `n` slots: magias salvas voltam ao lugar em que o jogador as deixou; magias novas (ainda sem lugar salvo)
 * ocupam os primeiros slots vazios, na ordem padrão; magias salvas que a vocação não tem mais somem.
 */
export function arrange(spellIds: readonly string[], saved: readonly (string | null)[] | null | undefined, n: number): (string | null)[] {
  const have = new Set(spellIds);
  const out: (string | null)[] = Array(n).fill(null);
  const placed = new Set<string>();
  (saved ?? []).slice(0, n).forEach((id, i) => {
    if (id && have.has(id) && !placed.has(id)) { out[i] = id; placed.add(id); }
  });
  for (const id of spellIds) {
    if (placed.has(id)) continue;
    const free = out.indexOf(null);
    if (free < 0) break; // mais magias do que slots
    out[free] = id;
    placed.add(id);
  }
  return out;
}

/** Troca dois slots (qualquer um pode estar vazio). Índices inválidos ou iguais devolvem a mesma ordem. */
export function swapped<T>(order: readonly T[], a: number, b: number): T[] {
  const out = order.slice();
  if (a === b || a < 0 || b < 0 || a >= out.length || b >= out.length) return out;
  [out[a], out[b]] = [out[b]!, out[a]!];
  return out;
}

/** Lê a ordem salva (JSON de strings/null) com tolerância a lixo. */
export function parseOrder(raw: string | null): (string | null)[] | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    return v.map((x) => (typeof x === "string" ? x : null));
  } catch {
    return null;
  }
}
