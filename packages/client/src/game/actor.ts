// Personagem renderizado: sprite + sombra + nome, com interpolação de passos encadeados.
import Phaser from "phaser";
import { BASE_STEP_MS, TILE_SIZE, type Dir, type Facing } from "@tibinha/shared";
import { dirToFacing } from "./facing.ts";
import { walkAnimKey, type CharacterLook } from "./sprites.ts";
import { TEX } from "./textures.ts";

interface Segment {
  fx: number; fy: number; // px (canto superior esquerdo do tile)
  tx: number; ty: number;
  dur: number;
  t: number;
  walk: boolean;
  started: boolean;
  facing?: Facing;
}

/** Saltos maiores que isto (em tiles) são teleporte/respawn: sem animação. */
const SNAP_TILES = 2;
/** Tempo parado antes de voltar ao frame "idle" (evita piscar entre passos encadeados). */
const IDLE_GRACE_MS = 70;

export interface ActorDeps {
  scene: Phaser.Scene;
  worldLayer: Phaser.GameObjects.Layer;
  uiLayer: Phaser.GameObjects.Layer;
  /** Arredonda uma coordenada de mundo para o pixel de tela (1/zoom). */
  snap: (v: number) => number;
  /** Início de um passo andando, com o canto do tile de origem (px) e a duração do passo. */
  onStepStart?: (px: number, py: number, ms: number) => void;
}

export class Actor {
  /** Tile autoritativo/alvo final da fila. */
  tileX: number;
  tileY: number;
  /** Posição renderizada (px, canto superior esquerdo do tile). */
  rx: number;
  ry: number;
  facing: Facing;

  readonly root: Phaser.GameObjects.Container;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly label: Phaser.GameObjects.Text;
  private readonly shadow: Phaser.GameObjects.Image;
  private queue: Segment[] = [];
  private idleFor = 0;
  private stepMs = BASE_STEP_MS;

  constructor(private readonly deps: ActorDeps, private readonly look: CharacterLook, name: string, isMe: boolean, x: number, y: number, dir: Dir) {
    const { scene } = deps;
    this.tileX = x; this.tileY = y;
    this.rx = x * TILE_SIZE; this.ry = y * TILE_SIZE;
    this.facing = dirToFacing(dir);

    this.shadow = scene.add.image(0, 0, TEX.shadow).setOrigin(0.5, 0.5).setAlpha(0.35);
    this.sprite = scene.add.sprite(0, 0, look.sheet.key, look.sheet.idle[this.facing]).setOrigin(0.5, 1);
    if (look.tint !== 0xffffff) this.sprite.setTint(look.tint);
    this.root = scene.add.container(0, 0, [this.shadow, this.sprite]);
    this.shadow.setPosition(0, -1);
    deps.worldLayer.add(this.root);

    this.label = scene.add.text(0, 0, name, {
      fontFamily: "Verdana, Tahoma, system-ui, sans-serif",
      fontSize: "11px",
      fontStyle: "bold",
      color: isMe ? "#ffe066" : "#ffffff",
      stroke: "#101018",
      strokeThickness: 3,
      resolution: Math.max(1, Math.ceil(window.devicePixelRatio || 1)),
    }).setOrigin(0.5, 1);
    deps.uiLayer.add(this.label);
    this.syncDisplay();
  }

  /** Último tile da fila (para onde o ator está indo). */
  private get endPx() {
    const last = this.queue[this.queue.length - 1];
    return last ? { x: last.tx, y: last.ty } : { x: this.rx, y: this.ry };
  }

  get isMoving() { return this.queue.length > 0; }

  /** Novo passo vindo do servidor/predição: encadeia depois do que já está na fila. */
  stepTo(x: number, y: number, ms: number, dir: Dir) {
    const far = Math.max(Math.abs(x - this.tileX), Math.abs(y - this.tileY)) > SNAP_TILES;
    this.tileX = x; this.tileY = y;
    if (far) return this.snapTo(x, y, dir);
    const from = this.endPx;
    this.queue.push({
      fx: from.x, fy: from.y, tx: x * TILE_SIZE, ty: y * TILE_SIZE,
      dur: Math.max(1, ms), t: 0, walk: true, started: false, facing: dirToFacing(dir),
    });
  }

  /** Correção curta (reconciliação): descarta a fila e desliza até o tile. */
  correctTo(x: number, y: number, ms = 100) {
    this.tileX = x; this.tileY = y;
    if (Math.max(Math.abs(this.rx / TILE_SIZE - x), Math.abs(this.ry / TILE_SIZE - y)) > SNAP_TILES) {
      return this.snapTo(x, y);
    }
    this.queue = [{ fx: this.rx, fy: this.ry, tx: x * TILE_SIZE, ty: y * TILE_SIZE, dur: ms, t: 0, walk: false, started: true }];
  }

  snapTo(x: number, y: number, dir?: Dir) {
    this.tileX = x; this.tileY = y;
    this.queue = [];
    this.rx = x * TILE_SIZE; this.ry = y * TILE_SIZE;
    if (dir !== undefined) this.facing = dirToFacing(dir);
    this.idleFor = IDLE_GRACE_MS;
    this.showIdle();
    this.syncDisplay();
  }

  face(dir: Dir) {
    this.facing = dirToFacing(dir);
    if (!this.isMoving) this.showIdle();
  }

  update(dtMs: number) {
    // Atraso acumulado (rede/jitter): acelera um pouco para não ficar para trás.
    const rate = this.queue.length > 1 ? 1 + 0.35 * (this.queue.length - 1) : 1;
    let budget = dtMs * rate;
    while (budget > 0 && this.queue.length) {
      const s = this.queue[0];
      if (!s.started) {
        s.started = true;
        if (s.walk) {
          this.facing = s.facing ?? this.facingOf(s);
          // Ritmo das pernas segue a duração DESTE passo (lama = passos lentos, estrada = rápidos).
          this.stepMs = s.dur;
          this.deps.onStepStart?.(s.fx, s.fy, s.dur);
        }
      }
      const need = s.dur - s.t;
      if (budget >= need) {
        s.t = s.dur; budget -= need;
        this.rx = s.tx; this.ry = s.ty;
        this.queue.shift();
      } else {
        s.t += budget; budget = 0;
        const k = s.t / s.dur;
        this.rx = s.fx + (s.tx - s.fx) * k;
        this.ry = s.fy + (s.ty - s.fy) * k;
      }
    }

    const head = this.queue[0];
    if (head?.walk) {
      this.idleFor = 0;
      this.playWalk();
    } else if (!head) {
      this.idleFor += dtMs;
      if (this.idleFor >= IDLE_GRACE_MS) this.showIdle();
    }
    this.syncDisplay();
  }

  /** Recalcula profundidade/posições. Os rótulos são posicionados pela cena (câmera de UI). */
  private syncDisplay() {
    const { snap } = this.deps;
    const px = snap(this.rx) + TILE_SIZE / 2;
    const py = snap(this.ry) + TILE_SIZE;
    this.root.setPosition(px, py);
    this.root.setDepth(10 + this.ry + TILE_SIZE);
  }

  /** Ponto (mundo) acima da cabeça, para o nome. */
  get headX() { return this.deps.snap(this.rx) + TILE_SIZE / 2; }
  get headY() { return this.deps.snap(this.ry) - 1; }

  private facingOf(s: Segment): Facing {
    const dx = Math.sign(s.tx - s.fx), dy = Math.sign(s.ty - s.fy);
    if (dx > 0) return "right";
    if (dx < 0) return "left";
    if (dy < 0) return "up";
    if (dy > 0) return "down";
    return this.facing;
  }

  private playWalk() {
    const key = walkAnimKey(this.look.sheet, this.facing);
    const anims = this.sprite.anims;
    if (anims.currentAnim?.key !== key || !anims.isPlaying) anims.play(key, true);
    anims.timeScale = BASE_STEP_MS / this.stepMs;
  }

  private showIdle() {
    if (this.sprite.anims.isPlaying) this.sprite.anims.stop();
    this.sprite.setFrame(this.look.sheet.idle[this.facing]);
  }

  destroy() {
    this.root.destroy();
    this.label.destroy();
  }
}

/** Registra as animações de caminhada de todos os sheets (uma vez por cena). */
export function createCharacterAnims(scene: Phaser.Scene, sheets: CharacterLook["sheet"][]) {
  for (const sheet of sheets) {
    for (const f of ["down", "up", "left", "right"] as Facing[]) {
      const key = walkAnimKey(sheet, f);
      if (scene.anims.exists(key)) continue;
      const frames = sheet.walk[f];
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(sheet.key, { frames }),
        frameRate: (frames.length * 1000) / (sheet.stepsPerCycle * BASE_STEP_MS),
        repeat: -1,
      });
    }
  }
}
