// DONO: agente "movimento" (base) + agente "combate" (criaturas, alvo, FX).
import Phaser from "phaser";
import { Callbacks, type Room } from "@colyseus/sdk";
import {
  C2S, S2C, TILE_SIZE,
  spellDef, spellsFor, type AttackMsg, type CombatEvent, type CombatMsg, type ConditionsMsg, type SkillUpMsg, type SpellCastMsg, type SpellDef, type CreatureDiedMsg, type DiedMsg, type Dir, type LevelUpMsg,
  type MonsterView, type MoveMsg, type PlayerView, type TurnMsg, type WalkToMsg, type XpGainMsg,
} from "@tibinha/shared";
import { session } from "../session.ts";
import { Actor, createCharacterAnims, type ActorDeps } from "../game/actor.ts";
import { CombatFx, KIND_COLOR } from "../game/combatFx.ts";
import { allCreatureSheets, creatureVisual, levelColor, sheetTrim } from "../game/creatures.ts";
import { FXTEST, startFxTest } from "../game/fxtest.ts";
import { KeyboardInput } from "../game/input.ts";
import { PixelCamera } from "../game/pixelCamera.ts";
import { Predictor } from "../game/predictor.ts";
import { sfx } from "../game/sfx.ts";
import { SpellEffects } from "../game/spellFx.ts";
import { ALL_SHEETS, lookFor } from "../game/sprites.ts";
import { TEX, createFxTextures } from "../game/textures.ts";
import { buildWorldMap, preloadWorldMap, type WorldMap } from "../game/worldMap.ts";
import { showDeath, showLevelBanner } from "../ui/combat/combatUi.ts";
import { setConditions } from "../ui/hud/conditions.ts";
import { SKILL_LABELS } from "../ui/hud/SkillsWindow.tsx";
import { pushToast } from "../ui/toasts.ts";
import { BATTLE_RANGE, chebyshev, hpPct, setBattleEntries, clearBattleEntries, type BattleEntry } from "../ui/hud/battle.ts";
import { getTarget, setTarget, subscribeTarget, toggleTarget, type Target } from "../ui/hud/target.ts";

/** Último estado autoritativo conhecido de cada jogador/criatura (para detectar mudanças e checar ocupação). */
interface Known { x: number; y: number; dir: number; stepMs: number }
interface CreatureInfo { defId: string; name: string; level: number; boss: boolean; hp: number; maxHp: number }

const DEPTH_ABOVE = 1_000_000;
const DEPTH_FX_TOP = 2_000_000;

/** Terrenos (propriedade `terrain` do tileset) que soltam poeira / respingos ao pisar. Grama/pedra: nada. */
const DUSTY = new Set(["road", "dirt", "sand"]);
const SPLASHY = new Set(["mud", "swamp"]);

/** Criaturas mais longe que isto (tiles) do jogador ficam escondidas (não destruídas). */
const CULL_TILES = 25;
const PROJECTILE_MS = 180;
const BATTLE_PUBLISH_MS = 200;

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
  private creatures = new Map<string, Actor>();
  private creatureKnown = new Map<string, Known>();
  private creatureInfo = new Map<string, CreatureInfo>();
  private dying = new Set<string>();
  /** Última posição de criaturas já removidas (para números de dano que chegam depois). */
  private gone = new Map<string, { x: number; y: number; at: number }>();
  private predictor!: Predictor;
  private input_!: KeyboardInput;
  private moveSeq = 0;
  private myLevel = 1;
  private myMaxHp = 1;

  private fx!: CombatFx;
  private spells!: SpellEffects;
  private myVocation = "";
  private unlockedUpTo = 0;
  private hover!: Phaser.GameObjects.Image;
  private targetMark!: Phaser.GameObjects.Image;
  private targetFill!: Phaser.GameObjects.Image;
  private curTarget = "";
  private targetSentAt = -1e9;
  private battleAcc = 0;
  private battleSig = "";
  private goneAcc = 0;
  private dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  private splash!: Phaser.GameObjects.Particles.ParticleEmitter;
  private disposers: (() => void)[] = [];

  constructor() { super("world"); }

  preload() {
    preloadWorldMap(this);
    for (const s of [...ALL_SHEETS, ...allCreatureSheets()]) {
      this.load.spritesheet(s.key, `${import.meta.env.BASE_URL}${s.url}`, { frameWidth: s.frameWidth, frameHeight: s.frameHeight });
    }
    CombatFx.preload(this);
  }

  create() {
    createFxTextures(this);
    createCharacterAnims(this, [...ALL_SHEETS, ...allCreatureSheets()]);
    CombatFx.createAnims(this);
    // Fonte pixel dos números flutuantes (a CSS é carregada pelo styles.css; garante antes do 1º uso).
    void document.fonts?.load('600 16px "Pixelify Sans"');
    this.input.mouse?.disableContextMenu();

    // Duas "camadas" de render: mundo (câmera principal, com zoom) e UI (nomes nítidos, zoom 1).
    this.worldLayer = this.add.layer().setDepth(0);
    this.uiLayer = this.add.layer().setDepth(1);
    this.world = buildWorldMap(this);
    this.world.below.forEach((l, i) => this.worldLayer.add(l.setDepth(i - 100))); // abaixo de hover/alvo (5, 6) e atores (>=26)
    this.world.above.forEach((l, i) => this.worldLayer.add(l.setDepth(DEPTH_ABOVE + i)));

    const main = this.cameras.main;
    this.uiCam = this.cameras.add(0, 0, this.scale.width, this.scale.height, false, "ui");
    this.uiLayer.cameraFilter |= main.id;
    this.worldLayer.cameraFilter |= this.uiCam.id;

    this.pcam = new PixelCamera(main, this.world.widthPx, this.world.heightPx);
    this.pcam.jumpTo((this.world.spawn.x + 0.5) * TILE_SIZE, (this.world.spawn.y + 0.5) * TILE_SIZE);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.onResize, this);

    this.createFx();
    this.fx = new CombatFx(this, this.worldLayer, this.uiLayer, this.pcam);
    this.fx.onImpact = (ev) => this.applyHit(ev as CombatEvent);
    this.spells = new SpellEffects(this, this.worldLayer, this.fx, this.pcam, {
      actor: (id) => this.findActor(id),
      myId: () => this.myId,
      shake: (ms, i) => this.cameras.main.shake(ms, i),
    });
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
    this.disposers.push(subscribeTarget((t) => this.onStoreTarget(t)));

    this.disposers.push(session.onRoom((room) => this.bindRoom(room)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());

    if (FXTEST) startFxTest(this, this.world.spawn, (x, y) => this.world.grid.isWalkable(x, y));
  }

  // --- rede -----------------------------------------------------------------

  private bindRoom(room: Room) {
    if (this.room === room) return;
    this.unbindRoom();
    this.room = room;
    this.myId = room.sessionId;
    // Estado do servidor não tem tipos no cliente: espelha PlayerView/MonsterView (shared/types.ts).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const $ = Callbacks.get(room as any) as any;
    const offAdd = $.onAdd("players", (p: PlayerView, id: string) => {
      this.addPlayer(id, p);
      const offChange = $.onChange(p, () => this.onPlayerChange(id, p));
      this.disposers.push(offChange);
    });
    const offRemove = $.onRemove("players", (_p: PlayerView, id: string) => this.removePlayer(id));
    this.disposers.push(offAdd, offRemove);

    try {
      const mAdd = $.onAdd("monsters", (m: MonsterView, id: string) => {
        this.addMonster(id, m);
        this.disposers.push($.onChange(m, () => this.onMonsterChange(id, m)));
      });
      const mRemove = $.onRemove("monsters", (_m: MonsterView, id: string) => this.removeMonster(id));
      this.disposers.push(mAdd, mRemove);
    } catch (e) {
      console.warn("[combate] state.monsters indisponível", e);
    }

    const msg = <T>(type: string, fn: (m: T) => void) => {
      const off = room.onMessage(type, fn) as unknown;
      if (typeof off === "function") this.disposers.push(off as () => void);
    };
    msg<CombatMsg>(S2C.Combat, (m) => this.onCombat(m.events));
    msg<XpGainMsg>(S2C.XpGain, (m) => this.onXpGain(m.amount));
    msg<LevelUpMsg>(S2C.LevelUp, (m) => this.onLevelUp(m.level));
    msg<SpellCastMsg>(S2C.SpellCast, (m) => this.onSpellCast(m));
    msg<ConditionsMsg>(S2C.Conditions, (m) => this.onConditions(m));
    msg<SkillUpMsg>(S2C.SkillUp, (m) => this.onSkillUp(m));
    msg<DiedMsg>(S2C.Died, (m) => this.onDied(m.killerName, m.lostXp));
    msg<CreatureDiedMsg>(S2C.CreatureDied, (m) => this.onCreatureDied(m));
    room.onLeave(() => { if (this.room === room) this.unbindRoom(); });
  }

  private unbindRoom() {
    for (const a of this.actors.values()) a.destroy();
    for (const a of this.creatures.values()) a.destroy();
    this.actors.clear();
    this.known.clear();
    this.creatures.clear();
    this.creatureKnown.clear();
    this.creatureInfo.clear();
    this.dying.clear();
    this.gone.clear();
    this.battleSig = "";
    clearBattleEntries("monsters");
    this.room = null;
  }

  private actorDeps(): ActorDeps {
    return { scene: this, worldLayer: this.worldLayer, uiLayer: this.uiLayer, snap: this.pcam.snap, onStepStart: (x, y) => this.footstep(x, y) };
  }

  addPlayer(id: string, p: PlayerView) {
    if (this.actors.has(id)) return;
    const isMe = id === this.myId;
    const actor = new Actor(this.actorDeps(), lookFor(p.vocation), p.name, isMe, p.x, p.y, p.dir);
    actor.setHp(p.hp, p.maxHp, true);
    this.actors.set(id, actor);
    this.known.set(id, { x: p.x, y: p.y, dir: p.dir, stepMs: p.stepMs });
    if (isMe) {
      this.predictor.level = p.level;
      this.predictor.speedPct = p.speedPct ?? 100;
      this.predictor.reset(p.x, p.y, p.dir);
      this.pcam.jumpTo((p.x + 0.5) * TILE_SIZE, (p.y + 0.5) * TILE_SIZE);
      this.setMyStats(p.level, p.maxHp);
      this.myVocation = p.vocation;
      this.unlockedUpTo = p.level;
      if (p.targetId) this.onServerTarget(p.targetId);
    }
  }

  private removePlayer(id: string) {
    this.actors.get(id)?.destroy();
    this.actors.delete(id);
    this.known.delete(id);
  }

  onPlayerChange(id: string, p: PlayerView) {
    const actor = this.actors.get(id);
    const k = this.known.get(id);
    if (!actor || !k) return;
    actor.setHp(p.hp, p.maxHp);
    const moved = p.x !== k.x || p.y !== k.y;
    const turned = p.dir !== k.dir;
    k.x = p.x; k.y = p.y; k.dir = p.dir; k.stepMs = p.stepMs;

    if (id === this.myId) {
      this.predictor.level = p.level;
      this.predictor.speedPct = p.speedPct ?? 100;
      this.setMyStats(p.level, p.maxHp);
      this.onServerTarget(p.targetId ?? "");
      if (!moved) return; // direção local é a da predição
      const r = this.predictor.onServerPos(p.x, p.y, p.stepMs, performance.now());
      if (r.kind === "external") this.moveVisual(id, actor, p.x, p.y, r.ms, p.dir);
      else if (r.kind === "diverged") actor.correctTo(p.x, p.y);
      return;
    }

    if (moved) this.moveVisual(id, actor, p.x, p.y, p.stepMs, p.dir);
    else if (turned) actor.face(p.dir);
  }

  /** Último SpellCast "charge" por conjurador (para transformar o salto do servidor em deslize). */
  private chargeAt = new Map<string, number>();
  private recentCharge(id: string) { return performance.now() - (this.chargeAt.get(id) ?? -1e9) < 500; }

  /** Movimento visual: saltos de 2+ tiles junto de uma investida viram um deslize de ~120 ms. */
  private moveVisual(id: string, actor: Actor, x: number, y: number, ms: number, dir: Dir) {
    const far = Math.max(Math.abs(x - actor.tileX), Math.abs(y - actor.tileY)) >= 2;
    if (!far) { actor.stepTo(x, y, ms, dir); return; }
    const apply = () => {
      if (this.recentCharge(id)) actor.dashTo(x, y, 120, dir);
      else actor.stepTo(x, y, ms, dir);
    };
    if (this.recentCharge(id)) apply(); else setTimeout(apply, 40);
  }

  private setMyStats(level: number, maxHp: number) {
    this.myMaxHp = maxHp;
    if (level !== this.myLevel) {
      this.myLevel = level;
      this.recolorCreatures();
    }
  }

  // --- criaturas ------------------------------------------------------------

  addMonster(id: string, m: MonsterView) {
    if (this.creatures.has(id)) return;
    const v = creatureVisual(m.defId);
    const actor = new Actor(
      this.actorDeps(), v.look, (v.boss ? "☠ " : "") + v.name, false, m.x, m.y, m.dir,
      { scale: v.scale, fontSize: v.boss ? 12 : 10, nameColor: levelColor(v.level, this.myLevel, v.boss), trim: sheetTrim(this, v.look.sheet) },
    );
    actor.setHp(m.hp, m.maxHp, true);
    this.creatures.set(id, actor);
    this.creatureKnown.set(id, { x: m.x, y: m.y, dir: m.dir, stepMs: m.stepMs });
    this.creatureInfo.set(id, { defId: m.defId, name: v.name, level: v.level, boss: v.boss, hp: m.hp, maxHp: m.maxHp });
  }

  onMonsterChange(id: string, m: MonsterView) {
    const actor = this.creatures.get(id);
    const k = this.creatureKnown.get(id);
    const info = this.creatureInfo.get(id);
    if (!actor || !k) return;
    if (info) { info.hp = m.hp; info.maxHp = m.maxHp; }
    actor.setHp(m.hp, m.maxHp);
    const moved = m.x !== k.x || m.y !== k.y;
    const turned = m.dir !== k.dir;
    k.x = m.x; k.y = m.y; k.dir = m.dir; k.stepMs = m.stepMs;
    if (moved) actor.stepTo(m.x, m.y, m.stepMs, m.dir);
    else if (turned) actor.face(m.dir);
  }

  removeMonster(id: string) {
    const a = this.creatures.get(id);
    if (a) this.gone.set(id, { x: a.bodyX, y: a.bodyY, at: performance.now() });
    a?.destroy();
    this.creatures.delete(id);
    this.creatureKnown.delete(id);
    this.creatureInfo.delete(id);
    this.dying.delete(id);
    if (this.curTarget === id) { this.curTarget = ""; setTarget(null); }
  }

  private recolorCreatures() {
    for (const [id, a] of this.creatures) {
      const i = this.creatureInfo.get(id);
      if (i) a.setName(a.label.text, levelColor(i.level, this.myLevel, i.boss));
    }
  }

  private findActor(id: string): Actor | undefined {
    return this.creatures.get(id) ?? this.actors.get(id);
  }

  private isOccupiedByOther(x: number, y: number): boolean {
    for (const [id, k] of this.known) if (id !== this.myId && k.x === x && k.y === y) return true;
    // Monstros bloqueiam o movimento (posição autoritativa).
    for (const k of this.creatureKnown.values()) if (k.x === x && k.y === y) return true;
    return false;
  }

  // --- alvo -----------------------------------------------------------------

  /** Store (clique / battle list / Esc) → servidor. */
  private onStoreTarget(t: Target | null) {
    const id = t?.id ?? "";
    if (id === this.curTarget) return;
    this.curTarget = id;
    this.targetSentAt = performance.now();
    this.room?.send(C2S.Attack, { targetId: t ? id : null } satisfies AttackMsg);
  }

  /** Servidor → store (ex.: alvo morreu e o servidor zerou o targetId). */
  private onServerTarget(id: string) {
    if (id === this.curTarget) return;
    // Patch atrasado (o servidor ainda não processou o nosso "attack"): ignora.
    if (this.room && performance.now() - this.targetSentAt < 500) return;
    this.curTarget = id;
    if (!id) setTarget(null);
    else setTarget({ id, kind: this.creatures.has(id) ? "monster" : "player" });
  }

  private creatureAtPointer(ptr: Phaser.Input.Pointer): string | null {
    const wp = this.cameras.main.getWorldPoint(ptr.x, ptr.y);
    let best: string | null = null, bestY = -Infinity;
    for (const [id, a] of this.creatures) {
      if (a.culled || a.ghosted) continue;
      const h = this.creatureHeight(a);
      const halfW = Math.max(TILE_SIZE / 2, (h * a.scale) / 2 * 0.6);
      const bottom = a.ry + TILE_SIZE, top = bottom - Math.max(TILE_SIZE, h * a.scale * 0.8);
      if (Math.abs(wp.x - a.bodyX) <= halfW && wp.y >= top && wp.y <= bottom && a.ry > bestY) { best = id; bestY = a.ry; }
    }
    return best;
  }

  private creatureHeight(a: Actor) { return a.sprite.frame.realHeight; }

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
      if (!this.room && !FXTEST) return;
      const left = ptr.leftButtonDown(), right = ptr.rightButtonDown();
      if (!left && !right) return;
      // Clique (esquerdo ou direito) numa criatura = atacar / soltar o alvo.
      const cid = this.creatureAtPointer(ptr);
      if (cid) { toggleTarget({ id: cid, kind: "monster" }); return; }
      if (!left || !this.room) return;
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

  update(time: number, delta: number) {
    const dt = Math.min(delta, 100);
    this.stepLocal();
    this.checkStalePrediction();

    for (const a of this.actors.values()) a.update(dt);

    const me = this.actors.get(this.myId);
    if (me) this.pcam.follow(me.rx + TILE_SIZE / 2, me.ry + TILE_SIZE / 2, dt);

    // Criaturas: culling por distância ao jogador; só as visíveis fazem trabalho de render.
    const mtx = me ? me.rx / TILE_SIZE : 0, mty = me ? me.ry / TILE_SIZE : 0;
    for (const a of this.creatures.values()) {
      a.update(dt);
      a.setCulled(!!me && Math.max(Math.abs(a.rx / TILE_SIZE - mtx), Math.abs(a.ry / TILE_SIZE - mty)) > CULL_TILES);
    }

    // Nomes + barras na câmera de UI (zoom 1), presos ao pixel de tela.
    const zoom = this.pcam.zoom;
    for (const a of this.actors.values()) a.placeUi(this.pcam.toScreenX(a.headX), this.pcam.toScreenY(a.headY), zoom, dt);
    for (const a of this.creatures.values()) a.placeUi(this.pcam.toScreenX(a.headX), this.pcam.toScreenY(a.headY), zoom, dt);

    this.fx.update(dt);
    this.spells.update(dt, time);
    this.updateHover();
    this.updateTargetMark(time);

    this.battleAcc += dt;
    if (this.battleAcc >= BATTLE_PUBLISH_MS) { this.battleAcc = 0; this.publishBattle(); }
    this.goneAcc += dt;
    if (this.goneAcc > 2000) {
      this.goneAcc = 0;
      const now = performance.now();
      for (const [id, g] of this.gone) if (now - g.at > 2500) this.gone.delete(id);
      if (this.dying.size > 200) this.dying.clear();
    }
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

  /** Criaturas a até 10 tiles → battle list (só republica se mudou). */
  private publishBattle() {
    const me = this.actors.get(this.myId);
    if (!me) return;
    const list: BattleEntry[] = [];
    let sig = "";
    for (const [id, i] of this.creatureInfo) {
      const k = this.creatureKnown.get(id);
      if (!k || this.dying.has(id)) continue;
      const d = chebyshev(k.x, k.y, me.tileX, me.tileY);
      if (d > BATTLE_RANGE) continue;
      const pct = hpPct(i.hp, i.maxHp);
      list.push({ id, name: i.name, hpPct: pct, kind: "monster", distance: d, color: levelColor(i.level, this.myLevel, i.boss) });
      sig += `${id}:${pct}:${d};`;
    }
    if (sig === this.battleSig) return;
    this.battleSig = sig;
    list.sort((a, b) => a.distance - b.distance);
    setBattleEntries("monsters", list);
  }

  // --- combate ----------------------------------------------------------------

  onCombat(events: CombatEvent[]) {
    for (const ev of events) {
      const src = this.findActor(ev.sourceId), tgt = this.findActor(ev.targetId);
      if (ev.ranged && src && tgt && ev.sourceId !== ev.targetId) {
        this.fx.projectile(ev.kind, src.bodyX, src.bodyY - 2, tgt.bodyX, tgt.bodyY, PROJECTILE_MS, ev);
        sfx.play(ev.kind === "fire" ? "fire" : "shoot", { volume: 0.7 });
      } else {
        this.applyHit(ev);
      }
    }
  }

  /** Efeito visual/sonoro de um acontecimento de combate (no impacto, para projéteis). */
  private applyHit(ev: CombatEvent) {
    const tgt = this.findActor(ev.targetId);
    const src = this.findActor(ev.sourceId);
    let wx: number, wy: number;
    if (tgt) { wx = tgt.bodyX; wy = tgt.bodyY; }
    else {
      const g = this.gone.get(ev.targetId);
      if (!g) return;
      wx = g.x; wy = g.y;
    }
    const toMe = ev.targetId === this.myId;
    const fromMe = ev.sourceId === this.myId;
    const textY = wy - 4;

    if (ev.miss) {
      this.fx.floatText(wx, textY, "errou", 0xb5b9c6, { size: 11, life: 650, rise: 8 });
      this.fx.puff(wx, wy + 2);
      sfx.play("miss", { volume: 0.6 });
      return;
    }
    if (ev.kind === "mana") {
      // Escudo de Mana: o dano saiu da mana (número azul negativo).
      this.fx.floatText(wx, textY, `-${ev.amount}`, KIND_COLOR.mana, { size: 14 });
      return;
    }
    if (ev.kind === "heal") {
      this.fx.floatText(wx, textY, `+${ev.amount}`, KIND_COLOR[ev.kind], { size: ev.crit ? 20 : 15 });
      this.fx.hit(ev.kind, wx, wy, false, 0);
      if (toMe || fromMe) sfx.play("heal", { volume: 0.8 });
      return;
    }

    const color = ev.kind === "physical" && toMe ? 0xff6b5e : KIND_COLOR[ev.kind];
    this.fx.floatText(wx, textY, ev.crit ? `${ev.amount}!` : `${ev.amount}`, color, { crit: !!ev.crit });

    let ang = 0;
    if (tgt) {
      tgt.flash(80);
      if (src && src !== tgt) {
        const dx = tgt.bodyX - src.bodyX, dy = tgt.bodyY - src.bodyY;
        tgt.nudge(dx, dy, 2);
        ang = Math.atan2(dy, dx);
      }
      if (ev.crit) tgt.hitStop(50);
    }
    this.fx.hit(ev.kind, wx, wy, !!ev.ranged, ang);

    if (toMe && (ev.crit || ev.amount > this.myMaxHp * 0.2)) this.cameras.main.shake(140, 0.004);
    sfx.play(ev.crit ? "crit" : toMe ? "hurt" : "hit", { volume: ev.crit ? 1 : 0.85 });
  }

  onXpGain(amount: number) {
    const me = this.actors.get(this.myId);
    if (!me) return;
    this.fx.floatText(me.bodyX, me.headY + 2, `+${amount} XP`, 0xffd447, { size: 14, life: 1200, rise: 16, dx: 0 });
    sfx.play("xp", { volume: 0.7 });
  }

  onLevelUp(level: number) {
    const me = this.actors.get(this.myId);
    if (me) this.fx.levelUp(me.root, me.bodyX, me.ry + TILE_SIZE - 2);
    const from = this.unlockedUpTo;
    this.unlockedUpTo = Math.max(from, level);
    const fresh = this.myVocation
      ? spellsFor(this.myVocation as never).filter((s) => s.level > from && s.level <= level).map((s) => s.name)
      : [];
    showLevelBanner(level, fresh);
    sfx.play("levelup", { volume: 1 });
  }

  // --- magias, condições e skills ----------------------------------------------

  onSpellCast(m: SpellCastMsg, override?: SpellDef) {
    if ((override ?? spellDef(m.spellId))?.fx === "charge") this.chargeAt.set(m.casterId, performance.now());
    this.spells.cast(m, override);
  }

  onConditions(m: ConditionsMsg) {
    const now = Date.now();
    setConditions(m.list.map((c) => ({ id: c.id, until: c.remainingMs != null && c.remainingMs > 0 ? now + c.remainingMs : undefined })));
    this.spells.setSelfConditions(m.list.map((c) => c.id));
  }

  onSkillUp(m: SkillUpMsg) {
    pushToast({ text: `Você avançou para ${SKILL_LABELS[m.skill] ?? m.skill} ${m.level}`, kind: "good" });
    this.spells.sparkle(this.myId);
    sfx.play("skillup", { volume: 0.8 });
  }

  onDied(killerName: string, lostXp: number) {
    showDeath({ killerName, lostXp });
    sfx.play("died", { volume: 0.9 });
  }

  onCreatureDied(m: CreatureDiedMsg) {
    if (this.dying.has(m.id)) return;
    this.dying.add(m.id);
    if (this.curTarget === m.id) { this.curTarget = ""; setTarget(null); }
    const a = this.creatures.get(m.id);
    if (a) {
      const f = a.frameInfo;
      const depth = a.root.depth;
      const fx = Math.round(a.rx) + TILE_SIZE / 2, fy = Math.round(a.ry) + TILE_SIZE + f.dy;
      a.ghost();
      this.fx.corpse(f.key, f.frame, f.tint, fx, fy, a.scale, depth);
    } else {
      const v = creatureVisual(m.defId);
      const dy = (v.look.sheet.frameHeight - sheetTrim(this, v.look.sheet).bottom) * v.scale;
      this.fx.corpse(v.look.sheet.key, v.look.sheet.idle.down, v.look.tint, m.x * TILE_SIZE + TILE_SIZE / 2, (m.y + 1) * TILE_SIZE + dy, v.scale, 10 + (m.y + 1) * TILE_SIZE);
    }
    sfx.play("death", { volume: 0.8 });
  }

  // --- efeitos --------------------------------------------------------------

  private createFx() {
    this.hover = this.add.image(0, 0, TEX.hover).setOrigin(0, 0).setAlpha(0.18).setVisible(false);
    this.worldLayer.add(this.hover.setDepth(5));
    this.targetMark = this.add.image(0, 0, TEX.hover).setOrigin(0, 0).setTint(0xff3b30).setVisible(false);
    this.worldLayer.add(this.targetMark.setDepth(6));
    this.targetFill = this.add.image(0, 0, TEX.px).setOrigin(0, 0).setTint(0xff3b30).setDisplaySize(TILE_SIZE, TILE_SIZE).setVisible(false);
    this.worldLayer.add(this.targetFill.setDepth(5.5));

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
    const cid = this.creatureAtPointer(ptr);
    const c = cid ? this.creatures.get(cid) : undefined;
    if (c) {
      // Sobre uma criatura: quadrado branco no tile dela.
      this.hover.setPosition(this.pcam.snap(c.rx), this.pcam.snap(c.ry)).setAlpha(0.7).setVisible(true);
      return;
    }
    const t = this.pointerTile(ptr);
    if (!t) { this.hover.setVisible(false); return; }
    this.hover.setPosition(t.x * TILE_SIZE, t.y * TILE_SIZE).setAlpha(0.18).setVisible(true);
  }

  /** Quadrado vermelho de 1px (pulsando) no tile do alvo. */
  private updateTargetMark(time: number) {
    const t = getTarget();
    const a = t ? this.findActor(t.id) : undefined;
    if (!a || a.ghosted || a.culled) { this.targetMark.setVisible(false); this.targetFill.setVisible(false); return; }
    const pulse = 0.5 + 0.5 * Math.sin(time / 120);
    this.targetFill.setPosition(this.pcam.snap(a.rx), this.pcam.snap(a.ry)).setAlpha(0.1 + 0.1 * pulse).setVisible(true);
    this.targetMark
      .setPosition(this.pcam.snap(a.rx), this.pcam.snap(a.ry))
      .setAlpha(0.8 + 0.2 * pulse)
      .setVisible(true);
  }

  private onResize(size: Phaser.Structs.Size) {
    this.cameras.main.setSize(size.width, size.height);
    this.uiCam.setSize(size.width, size.height);
    this.pcam.fit();
    const me = this.actors.get(this.myId);
    if (me) this.pcam.jumpTo(me.rx + TILE_SIZE / 2, me.ry + TILE_SIZE / 2);
  }

  /** Para o harness ?fxtest: define quem é o jogador local. */
  setLocalId(id: string) { this.myId = id; session.myId = id; }

  private teardown() {
    for (const d of this.disposers) d();
    this.disposers = [];
    this.input_?.destroy();
    this.fx?.destroy();
    this.spells?.destroy();
    this.scale.off(Phaser.Scale.Events.RESIZE, this.onResize, this);
    this.unbindRoom();
  }
}
