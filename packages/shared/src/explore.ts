/** Raio (Chebyshev, em tiles) revelado ao redor do jogador no minimapa. */
export const EXPLORE_RADIUS = 8;

/** Bitset de tiles explorados. Mesma lógica no servidor (autoridade/persistência) e no cliente (revelação imediata). */
export class ExploredMask {
  readonly bits: Uint8Array;

  constructor(readonly width: number, readonly height: number, bits?: Uint8Array) {
    const len = Math.ceil((width * height) / 8);
    this.bits = bits && bits.length === len ? bits : new Uint8Array(len);
  }

  has(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    const i = y * this.width + x;
    return (this.bits[i >> 3] & (1 << (i & 7))) !== 0;
  }

  /** Revela um quadrado de raio r (cantos arredondados). Retorna quantos tiles novos foram revelados. */
  reveal(cx: number, cy: number, r = EXPLORE_RADIUS): number {
    let added = 0;
    for (let y = Math.max(0, cy - r); y <= Math.min(this.height - 1, cy + r); y++) {
      for (let x = Math.max(0, cx - r); x <= Math.min(this.width - 1, cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy > r * r + r) continue;
        const i = y * this.width + x;
        const m = 1 << (i & 7);
        if ((this.bits[i >> 3] & m) === 0) { this.bits[i >> 3] |= m; added++; }
      }
    }
    return added;
  }

  toBase64(): string {
    let s = "";
    for (let i = 0; i < this.bits.length; i++) s += String.fromCharCode(this.bits[i]);
    return btoa(s);
  }

  static fromBase64(width: number, height: number, b64: string | undefined): ExploredMask {
    if (!b64) return new ExploredMask(width, height);
    try {
      const s = atob(b64);
      const bits = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) bits[i] = s.charCodeAt(i);
      return new ExploredMask(width, height, bits);
    } catch {
      return new ExploredMask(width, height);
    }
  }
}
