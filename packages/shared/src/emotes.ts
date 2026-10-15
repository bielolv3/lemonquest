// Emotes (/e nome): ícone curto sobre a cabeça. O servidor só valida o id e repassa; o cliente desenha.

export interface EmoteDef {
  id: string;
  /** Texto desenhado sobre a cabeça (símbolo ou palavra curta). */
  glyph: string;
  color: string;
  label: string;
  /** Outros nomes aceitos no comando. */
  aliases: string[];
}

export const EMOTES: readonly EmoteDef[] = [
  { id: "coracao", glyph: "♥", color: "#ff6b8a", label: "Coração", aliases: ["heart", "amor"] },
  { id: "rir", glyph: "haha!", color: "#ffe066", label: "Rir", aliases: ["laugh", "kkk", "haha"] },
  { id: "musica", glyph: "♪ ♫", color: "#8fe6d6", label: "Música", aliases: ["music", "dancar", "dançar"] },
  { id: "duvida", glyph: "?", color: "#b8c4ff", label: "Dúvida", aliases: ["question", "hm"] },
  { id: "alerta", glyph: "!", color: "#ff8a5c", label: "Alerta", aliases: ["alert", "cuidado"] },
  { id: "sono", glyph: "Zzz", color: "#9aa6c8", label: "Sono", aliases: ["sleep", "zzz"] },
  { id: "parabens", glyph: "★ ★ ★", color: "#ffd447", label: "Parabéns", aliases: ["cheer", "gg", "parabéns"] },
  { id: "oi", glyph: "Oi!", color: "#9dff8a", label: "Oi", aliases: ["wave", "ola", "olá"] },
];

const byName = new Map<string, EmoteDef>();
for (const e of EMOTES) for (const n of [e.id, ...e.aliases]) byName.set(n.normalize("NFC").toLowerCase(), e);

/** Emote pelo nome digitado (id ou apelido, sem diferenciar maiúsculas). */
export const emoteByName = (name: string): EmoteDef | undefined => byName.get(name.normalize("NFC").trim().toLowerCase());
