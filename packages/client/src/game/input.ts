// Teclado → intenção de movimento (8 direções). Usa eventos DOM (sem captura do Phaser) para não
// atrapalhar campos de texto da UI.
import { Dir, dirFromDelta } from "@lemonquest/shared";
import { isTyping } from "../ui/focus.ts";

type Axis = "up" | "down" | "left" | "right";

const AXIS_KEYS: Record<string, Axis> = {
  KeyW: "up", ArrowUp: "up", Numpad8: "up",
  KeyS: "down", ArrowDown: "down", Numpad2: "down",
  KeyA: "left", ArrowLeft: "left", Numpad4: "left",
  KeyD: "right", ArrowRight: "right", Numpad6: "right",
};

const DIAG_KEYS: Record<string, Dir> = {
  Numpad7: Dir.NW, Numpad9: Dir.NE, Numpad1: Dir.SW, Numpad3: Dir.SE,
};

const TURN_KEYS: Record<string, Dir> = {
  ArrowUp: Dir.N, ArrowDown: Dir.S, ArrowLeft: Dir.W, ArrowRight: Dir.E,
};

export interface InputHandlers {
  /** Direção segurada mudou (null = soltou tudo). */
  onDir(dir: Dir | null): void;
  /** Ctrl+seta: virar sem andar. */
  onTurn(dir: Dir): void;
}

export class KeyboardInput {
  /** Teclas pressionadas, em ordem de pressão (a mais recente por último). */
  private down: string[] = [];
  private current: Dir | null = null;

  constructor(private readonly h: InputHandlers) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.releaseAll);
    document.addEventListener("focusin", this.onFocusIn);
  }

  destroy() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.releaseAll);
    document.removeEventListener("focusin", this.onFocusIn);
  }

  /** Esquece a direção atual sem avisar (ex.: clique no mapa cancelou a intenção no servidor). */
  forgetIntent() {
    this.down = [];
    this.current = null;
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (isTyping()) return;
    const code = e.code;
    const isMove = code in AXIS_KEYS || code in DIAG_KEYS;
    if (!isMove) return;
    if (e.ctrlKey || e.metaKey) {
      const t = TURN_KEYS[code];
      if (t !== undefined) {
        e.preventDefault();
        if (!e.repeat) this.h.onTurn(t);
      }
      return;
    }
    e.preventDefault();
    if (e.repeat || this.down.includes(code)) return;
    this.down.push(code);
    this.emit();
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const i = this.down.indexOf(e.code);
    if (i < 0) return;
    this.down.splice(i, 1);
    this.emit();
  };

  private onFocusIn = () => { if (isTyping()) this.releaseAll(); };

  private releaseAll = () => {
    if (this.down.length === 0 && this.current === null) return;
    this.down = [];
    this.emit();
  };

  private compute(): Dir | null {
    // Diagonal do numpad mais recente tem prioridade.
    for (let i = this.down.length - 1; i >= 0; i--) {
      const d = DIAG_KEYS[this.down[i]];
      if (d !== undefined) return d;
    }
    const held = new Set(this.down.map((c) => AXIS_KEYS[c]).filter(Boolean));
    let dx = (held.has("right") ? 1 : 0) - (held.has("left") ? 1 : 0);
    let dy = (held.has("down") ? 1 : 0) - (held.has("up") ? 1 : 0);
    // Opostos se anulam; nesse caso vale o eixo da tecla mais recente.
    if (dx === 0 && dy === 0 && held.size) {
      const last = AXIS_KEYS[this.down[this.down.length - 1]];
      if (last === "up") dy = -1; else if (last === "down") dy = 1;
      else if (last === "left") dx = -1; else if (last === "right") dx = 1;
    }
    return dirFromDelta(dx, dy);
  }

  private emit() {
    const d = this.compute();
    if (d === this.current) return;
    this.current = d;
    this.h.onDir(d);
  }
}
