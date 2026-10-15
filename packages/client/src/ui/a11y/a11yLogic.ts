// Acessibilidade: configurações e o que viram no <html>. Puro (sem DOM) para poder testar.

/** 0 = normal, 1 = grande (×1,15), 2 = muito grande (×1,3). */
export type TextSize = 0 | 1 | 2;
export interface A11ySettings { text: TextSize; contrast: boolean; motion: boolean }

export const A11Y_DEFAULT: A11ySettings = { text: 0, contrast: false, motion: false };
export const TEXT_LABELS = ["Normal", "Grande", "Muito grande"] as const;

/** Lê o que foi salvo, com tolerância a lixo. */
export function parseA11y(raw: string | null): A11ySettings {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<A11ySettings>) : {};
    const text = v.text === 1 || v.text === 2 ? v.text : 0;
    return { text, contrast: v.contrast === true, motion: v.motion === true };
  } catch {
    return { ...A11Y_DEFAULT };
  }
}

/** Atributos `data-*` do <html> que o CSS (a11y.css) lê. */
export function a11yAttrs(s: A11ySettings): { "data-text": string; "data-contrast": string; "data-motion": string } {
  return { "data-text": String(s.text), "data-contrast": s.contrast ? "high" : "normal", "data-motion": s.motion ? "reduce" : "normal" };
}
