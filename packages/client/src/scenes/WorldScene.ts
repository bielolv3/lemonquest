// DONO: agente "movimento".
import Phaser from "phaser";
import { Callbacks, type Room } from "@colyseus/sdk";
import { C2S, TILE_SIZE, type Dir, type MoveMsg, type PlayerView, type TurnMsg, type WalkToMsg } from "@tibinha/shared";
import { session } from "../session.ts";
import { Actor, createCharacterAnims } from "../game/actor.ts";
import { KeyboardInput } from "../game/input.ts";
import { PixelCamera } from "../game/pixelCamera.ts";
import { Predictor } from "../game/predictor.ts";
import { ALL_SHEETS, lookFor } from "../game/sprites.ts";
import { TEX, createFxTextures } from "../game/textures.ts";
import { buildWorldMap, preloadWorldMap, type WorldMap } from "../game/worldMap.ts";

/** Último estado autoritativo conhecido de cada jogador (para detectar mudanças e checar ocupação). */
interface Known { x: number; y: number; dir: number; stepMs: number }

const DEPTH_ABOVE = 1_000_000;
const DEPTH_FX_TOP = 2_000_000;

/** Terrenos (propriedade `terrain` do tileset) que soltam poeira / respingos ao pisar. Grama/pedra: nada. */
const DUSTY = new Set(["road", "dirt", "sand"]);
const SPLASHY = new Set(["mud", "swamp"]);

export class WorldScene extends Phaser.Scene {
  private world!: WorldMap;
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private pcam!: PixelCamera;

  private room: Room | null = null;
  private myId = "";
  private actors = new Map<string, Actor>();
  private known = new Map<string, Known>();
  private predictor!: Predictor;
  private input_!: KeyboardInput;
  private moveSeq = 0;

  private hover!: Phaser.GameObjects.Image;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splash!: Phaser.GameObjects.Particles.ParticleEmitter;
  private disposers: (() => void)[] = [];

  constructor() { super("world"); }

  preload() {
    preloadWorldMap(this);
    for (const s of ALL_SHEETS) {
      this.load.spritesheet(s.key, `${import.meta.env.BASE_URL}${s.url}`, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
  }

  create() {
    createFxTextures(this);
    createCharacterAnims(this, ALL_SHEETS);

    // Duas "camadas" de render: mundo (câmera principal, com zoom) e UI (nomes nítidos, zoom 1).
    this.worldLayer = this.add.layer().setDepth(0);
    this.uiLayer = this.add.layer().setDepth(1);
    this.world = buildWorldMap(this);
    this.world.below.forEach((l, i) => this.worldLayer.add(l.setDepth(i)));
    this.world.above.forEach((l, i) => this.worldLayer.add(l.setDepth(DEPTH_ABOVE + i)));

    const main = this.cameras.main;
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, "ui");
    this.uiLayer.cameraFilter |= main.id;
    this.worldLayer.cameraFilter |= this.uiCam.id;

    this.pcam = new PixelCamera(main, this.world.widthPx, this.world.heightPx);
    this.pcam.jumpTo((this.world.spawn.x + 0.5) * TILE_SIZE, (this.world.spawn.y + 0.5) * TILE_SIZE);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.createFx();
    this.predictor = new Predictor({
      grid: this.world.grid,
      spawn: this.world.spawn,
      groundSpeed: this.world.groundSpeed,
      isOccupied: (x, y) => this.isOccupiedByOther(x, y),
    });
    this.input_ = new KeyboardInput({
      onDir: (d) => this.onInputDir(d),
      onTurn: (d) => this.onInputTurn(d),
    });
    this.setupPointer();

    this.disposers.push(session.onRoom((room) => this.bindRoom(room)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  // --- rede -----------------------------------------------------------------

  private bindRoom(room: Room) {
    if (this.room === room) return;
    this.unbindRoom();
    this.room = room;
    this.myId = room.sessionId;
    // Estado do servidor não tem tipos no cliente: espelha PlayerView (shared/types.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = Callbacks.get(room as any) as any;
    const offAdd = $.onAdd("players", (p: PlayerView, id: string) => {
      this.addPlayer(id, p);
      const offChange = $.onChange(p, () => this.onPlayerChange(id, p));
      this.disposers.push(offChange);
    });
    const offRemove = $.onRemove("players", (_p: PlayerView, id: string) => this.removePlayer(id));
    this.disposers.push(offAdd, offRemove);
    room.onLeave(() => { if (this.room === room) this.unbindRoom(); });
  }

  private unbindRoom() {
    for (const a of this.actors.values()) a.destroy();
    this.actors.clear();
    this.known.clear();
    this.room = null;
  }

  private addPlayer(id: string, p: PlayerView) {
    if (this.actors.has(id)) return;
    const isMe = id === this.myId;
    const actor = new Actor(
      { scene: this, worldLayer: this.worldLayer, uiLayer: this.uiLayer, snap: this.pcam.snap, onStepStart: (x, y) => this.footstep(x, y) },
      lookFor(p.vocation), p.name, isMe, p.x, p.y, p.dir,
    );
    this.actors.set(id, actor);
    this.known.set(id, { x: p.x, y: p.y, dir: p.dir, stepMs: p.stepMs });
    if (isMe) {
      this.predictor.level = p.level;
      this.predictor.reset(p.x, p.y, p.dir);
      this.pcam.jumpTo((p.x + 0.5) * TILE_SIZE, (p.y + 0.5) * TILE_SIZE);
    }
  }

  private removePlayer(id: string) {
    this.actors.get(id)?.destroy();
    this.actors.delete(id);
    this.known.delete(id);
  }

  private onPlayerChange(id: string, p: PlayerView) {
    const actor = this.actors.get(id);
    const k = this.known.get(id);
    if (!actor || !k) return;
    const moved = p.x !== k.x || p.y !== k.y;
    const turned = p.dir !== k.dir;
    k.x = p.x; k.y = p.y; k.dir = p.dir; k.stepMs = p.stepMs;

    if (id === this.myId) {
      this.predictor.level = p.level;
      if (!moved) return; // direção local é a da predição
      const r = this.predictor.onServerPos(p.x, p.y, p.stepMs, performance.now());
      if (r.kind === "external") actor.stepTo(p.x, p.y, r.ms, p.dir);
      else if (r.kind === "diverged") actor.correctTo(p.x, p.y);
      return;
    }

    if (moved) actor.stepTo(p.x, p.y, p.stepMs, p.dir);
    else if (turned) actor.face(p.dir);
  }

  private isOccupiedByOther(x: number, y: number): boolean {
    for (const [id, k] of this.known) if (id !== this.myId && k.x === x && k.y === y) return true;
    return false;
  }

  // --- entrada --------------------------------------------------------------

  private onInputDir(d: Dir | null) {
    if (!this.room) return;
    // Mesma ordem do servidor: primeiro recupera um passo que já era devido com a intenção antiga.
    this.stepLocal();
    if (d === null) this.predictor.release();
    else this.predictor.press(d);
    this.room.send(C2S.Move, { dir: d, seq: ++this.moveSeq } satisfies MoveMsg);
    this.stepLocal(); // sem esperar o próximo frame: zero atraso percebido
  }

  private onInputTurn(d: Dir) {
    if (!this.room) return;
    this.room.send(C2S.Turn, { dir: d } satisfies TurnMsg);
    const now = performance.now();
    if (this.predictor.isFree(now)) {
      this.predictor.dir = d;
      this.actors.get(this.myId)?.face(d);
    }
  }

  private setupPointer() {
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (ptr: Phaser.Input.Pointer) => {
      if (!this.room || !ptr.leftButtonDown()) return;
      const t = this.pointerTile(ptr);
      if (!t) return;
      this.room.send(C2S.WalkTo, { x: t.x, y: t.y } satisfies WalkToMsg);
      // O servidor zera a intenção de teclado ao receber walkTo; espelhamos aqui.
      this.predictor.clearIntent();
      this.input_.forgetIntent();
      this.showMarker(t.x, t.y);
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => this.hover.setVisible(false));
  }

  private pointerTile(ptr: Phaser.Input.Pointer): { x: number; y: number } | null {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    const x = Math.floor(wp.x / TILE_SIZE), y = Math.floor(wp.y / TILE_SIZE);
    if (x < 0 || y < 0 || x >= this.world.grid.width || y >= this.world.grid.height) return null;
    return { x, y };
  }

  // --- frame ----------------------------------------------------------------

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 100);
    this.stepLocal();
    this.checkStalePrediction();

    for (const a of this.actors.values()) a.update(dt);

    const me = this.actors.get(this.myId);
    if (me) this.pcam.follow(me.rx + TILE_SIZE / 2, me.ry + TILE_SIZE / 2, dt);

    // Nomes na câmera de UI (zoom 1), presos ao pixel de tela.
    for (const a of this.actors.values()) {
      a.label.setPosition(Math.round(this.pcam.toScreenX(a.headX)), Math.round(this.pcam.toScreenY(a.headY)));
    }
    this.updateHover();
  }

  /** Avança a predição local (pode iniciar um passo). */
  private stepLocal() {
    const me = this.actors.get(this.myId);
    if (!me || !this.room) return;
    const ev = this.predictor.update(performance.now());
    if (!ev) return;
    if (ev.kind === "step") me.stepTo(ev.x, ev.y, ev.ms, ev.dir);
    else me.face(ev.dir);
  }

  private checkStalePrediction() {
    const me = this.actors.get(this.myId);
    const k = this.known.get(this.myId);
    if (!me || !k) return;
    if (this.predictor.checkStale(k.x, k.y, performance.now())) me.correctTo(k.x, k.y);
  }

  // --- efeitos --------------------------------------------------------------

  private createFx() {
    this.hover = this.add.image(0, 0, TEX.hover).setOrigin(0, 0).setAlpha(0.18).setVisible(false);
    this.worldLayer.add(this.hover.setDepth(5));

    this.dust = this.add.particles(0, 0, TEX.px, {
      emitting: false,
      lifespan: { min: 220, max: 380 },
      speedX: { min: -10, max: 10 },
      speedY: { min: -9, max: -2 },
      alpha: { start: 0.55, end: 0 },
      tint: [0xd8cdb4, 0xbfb397, 0xeee6d0],
      gravityY: 12,
      quantity: 1,
    });
    this.worldLayer.add(this.dust.setDepth(DEPTH_ABOVE - 1));

    // Respingo escuro de lama: gotas sobem e caem rápido, bem perto do pé.
    this.splash = this.add.particles(0, 0, TEX.px, {
      emitting: false,
      lifespan: { min: 180, max: 300 },
      speedX: { min: -14, max: 14 },
      speedY: { min: -22, max: -10 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x3b2f22, 0x4a3b2a, 0x2f3a28],
      gravityY: 90,
      quantity: 1,
    });
    this.worldLayer.add(this.splash.setDepth(DEPTH_ABOVE - 1));
  }

  /** Partícula de passo conforme o terreno do tile de origem (px = canto do tile). */
  private footstep(px: number, py: number) {
    const terrain = this.world.groundSpeed.terrainAt(Math.round(px / TILE_SIZE), Math.round(py / TILE_SIZE));
    if (!terrain) return;
    const x = px + TILE_SIZE / 2, y = py + TILE_SIZE - 1;
    if (DUSTY.has(terrain)) this.dust.explode(3, x, y);
    else if (SPLASHY.has(terrain)) this.splash.explode(terrain === "mud" ? 4 : 2, x, y);
  }

  private showMarker(x: number, y: number) {
    const m = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, TEX.marker).setAlpha(0.9).setTint(0xfff2a8);
    this.worldLayer.add(m.setDepth(DEPTH_FX_TOP));
    this.tweens.add({ targets: m, alpha: 0, scale: 0.6, duration: 650, ease: "Quad.easeIn", onComplete: () => m.destroy() });
  }

  private updateHover() {
    const ptr = this.input.activePointer;
    if (!ptr || !this.input.isOver) { this.hover.setVisible(false); return; }
    const t = this.pointerTile(ptr);
    if (!t) { this.hover.setVisible(false); return; }
    this.hover.setPosition(t.x * TILE_SIZE, t.y * TILE_SIZE).setVisible(true);
  }

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    this.uiCam.setSize(size.width, size.height);
    this.pcam.fit();
    const me = this.actors.get(this.myId);
    if (me) this.pcam.jumpTo(me.rx + TILE_SIZE / 2, me.ry + TILE_SIZE / 2);
  }

  private teardown() {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.input_?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.unbindRoom();
  }
}
