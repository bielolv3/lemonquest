// Tons de tingimento (cosmético puro): tingem a sprite da roupa (Phaser setTint no mundo, multiply no preview da
// janela). Comprados uma vez por conta (`OutfitTonesMsg`), valem pra qualquer personagem. Sem arte nova.
export interface OutfitTone {
  id: string;
  name: string;
  /** Cor multiplicada sobre a sprite (0xRRGGBB). */
  color: number;
}

/** Preço fixo em ouro, igual pra qualquer tom. */
export const OUTFIT_TONE_PRICE = 8000;

export const OUTFIT_TONES: OutfitTone[] = [
  { id: "crimson", name: "Carmesim", color: 0xd94a4a },
  { id: "azure", name: "Azul-Marinho", color: 0x3a5fd9 },
  { id: "emerald", name: "Esmeralda", color: 0x2fa85a },
  { id: "violet", name: "Violeta", color: 0x8a4ad9 },
  { id: "amber", name: "Âmbar", color: 0xd9943a },
  { id: "slate", name: "Grafite", color: 0x5a6270 },
  { id: "rose", name: "Rosado", color: 0xd96fa0 },
  { id: "gold", name: "Dourado", color: 0xd9b84a },
];

export const toneDef = (id: string | undefined | null): OutfitTone | undefined =>
  id ? OUTFIT_TONES.find((t) => t.id === id) : undefined;

/** Cor efetiva pro Phaser/canvas (ausente ou desconhecido = sem tingimento). */
export const toneColor = (id: string | undefined | null): number => toneDef(id)?.color ?? 0xffffff;
