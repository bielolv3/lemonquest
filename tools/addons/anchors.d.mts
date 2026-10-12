// Tipos de tools/addons/anchors.mjs (usado pelos testes em TS).
export const FRAME: number;
export interface SheetImage { width: number; height: number; data: Uint8Array }
export interface FrameAnchors {
  top: number; bottom: number; neck: number;
  ext: ([number, number] | null)[];
  headL: number; headR: number; bodyL: number; bodyR: number; maxL: number; maxR: number; c2: number;
}
export function readSheet(path: string): SheetImage;
export function computeAnchors(png: SheetImage, col: number, row: number): FrameAnchors;
