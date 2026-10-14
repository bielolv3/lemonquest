// Resolução dos textos do mundo (nomes, números de dano, balões): DPR arredondado para cima. Muda quando a janela vai
// para um monitor com outra escala — sem atualizar, os textos ficavam borrados até recarregar a página.
import type Phaser from "phaser";

export const textRes = (): number => Math.max(1, Math.ceil(window.devicePixelRatio || 1));

/**
 * Chama `fn(res)` quando a resolução dos textos muda: media query de `resolution` (troca de monitor) e, por garantia,
 * `resize` (alguns navegadores só avisam por ele). Só dispara se o valor mudou. Devolve o desligador.
 */
export function onTextResChange(fn: (res: number) => void): () => void {
  let last = textRes();
  let mql: MediaQueryList | null = null;
  const check = () => {
    const r = textRes();
    if (r !== last) { last = r; fn(r); }
  };
  const arm = () => {
    mql?.removeEventListener("change", onChange);
    mql = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    mql.addEventListener("change", onChange);
  };
  const onChange = () => { arm(); check(); };
  arm();
  window.addEventListener("resize", check);
  return () => { mql?.removeEventListener("change", onChange); window.removeEventListener("resize", check); };
}

/** Todos os textos da cena (inclusive dentro de containers). */
export function sceneTexts(scene: Phaser.Scene): Phaser.GameObjects.Text[] {
  const out: Phaser.GameObjects.Text[] = [];
  const walk = (list: Phaser.GameObjects.GameObject[]) => {
    for (const o of list) {
      if (o.type === "Text") out.push(o as Phaser.GameObjects.Text);
      const kids = (o as Phaser.GameObjects.Container).list;
      if (Array.isArray(kids)) walk(kids);
    }
  };
  walk(scene.children.list);
  return out;
}

/** Aplica a resolução a todos os textos da cena. */
export function applyTextRes(scene: Phaser.Scene, res: number): void {
  for (const t of sceneTexts(scene)) if (t.style.resolution !== res) t.setResolution(res);
}
