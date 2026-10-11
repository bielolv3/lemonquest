import { Dir, type Facing } from "@tibinha/shared";

/** 8 direções → 4 lados do spritesheet. Diagonais usam o lado horizontal (como no Tibia). */
export function dirToFacing(d: Dir): Facing {
  switch (d) {
    case Dir.N: return "up";
    case Dir.S: return "down";
    case Dir.NE: case Dir.E: case Dir.SE: return "right";
    default: return "left";
  }
}
