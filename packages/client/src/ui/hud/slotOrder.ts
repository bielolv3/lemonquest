// Ordem antiga da barra de ações (gravada no navegador antes dos atalhos irem para o servidor). Só é lida uma vez,
// para migrar a barra do personagem para os atalhos (ui/hotkeys/hotkeys.ts).

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
