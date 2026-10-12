// Estátuas de treino offline (objetos "training_statue" do mapa): só acerto de clique; o desenho vem do próprio mapa.
import { TILE_SIZE, findTrainingStatues, statueDistance, type TiledMap, type TrainingStatue } from "@lemonquest/shared";

/** Para interagir é preciso estar ao lado (o servidor exige Chebyshev 1). */
export const STATUE_RANGE = 1;

export class StatueIndex {
  readonly list: TrainingStatue[];

  constructor(tiled: TiledMap) {
    this.list = findTrainingStatues(tiled);
  }

  tileOf(id: string): { x: number; y: number } | null {
    const s = this.list.find((q) => q.id === id);
    return s ? { x: s.x, y: s.y } : null;
  }

  /** Distância (Chebyshev) à pegada da estátua; Infinity se desconhecida. */
  distance(id: string, x: number, y: number): number {
    const s = this.list.find((q) => q.id === id);
    return s ? statueDistance(s, x, y) : Infinity;
  }

  /** Estátua sob um ponto do mundo (px): o tile dela + o tile de cima (estátuas são altas). */
  atPoint(wx: number, wy: number): string | null {
    for (const s of this.list) {
      const x = s.x * TILE_SIZE, y = s.y * TILE_SIZE;
      // pegada 2x2 (x..x+1, y-1..y) + um tile acima (estátuas são altas)
      if (wx >= x && wx < x + 2 * TILE_SIZE && wy >= y - 3 * TILE_SIZE && wy < y + TILE_SIZE) return s.id;
    }
    return null;
  }
}
