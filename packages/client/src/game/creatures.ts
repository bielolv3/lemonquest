// Visual das criaturas: converte MonsterDef.sprite (shared) em CharacterSheet/CharacterLook do cliente.
import { MONSTERS, type CreatureSprite, type Facing, type MonsterDef } from "@tibinha/shared";
import { gridSheet, type CharacterLook, type CharacterSheet } from "./sprites.ts";

const sheets = new Map<string, CharacterSheet>();

function sheetFor(sp: CreatureSprite): CharacterSheet {
  const key = `mon:${sp.url}`;
  let s = sheets.get(key);
  if (s) return s;
  if (sp.layout === "custom" && sp.walk) {
    const idle = {} as Record<Facing, number>;
    for (const f of ["down", "up", "left", "right"] as Facing[]) idle[f] = sp.walk[f][0] ?? 0;
    s = { key, url: sp.url, frameWidth: sp.frameWidth, frameHeight: sp.frameHeight, walk: sp.walk, idle, stepsPerCycle: 2 };
  } else {
    s = gridSheet(key, sp.url, sp.frameWidth, sp.frameHeight);
  }
  sheets.set(key, s);
  return s;
}

export interface CreatureVisual {
  look: CharacterLook;
  scale: number;
  name: string;
  level: number;
  boss: boolean;
  known: boolean;
}

const cache = new Map<string, CreatureVisual>();
const FALLBACK_TINT = 0xff77ff;

/** Visual de um defId; ids desconhecidos usam o primeiro monstro com tint magenta (nunca quebra). */
export function creatureVisual(defId: string): CreatureVisual {
  let v = cache.get(defId);
  if (v) return v;
  const def: MonsterDef | undefined = MONSTERS[defId];
  if (def) {
    v = {
      look: { sheet: sheetFor(def.sprite), tint: def.sprite.tint ?? 0xffffff },
      scale: def.sprite.scale ?? 1,
      name: def.name, level: def.level, boss: !!def.boss, known: true,
    };
  } else {
    const first = Object.values(MONSTERS)[0];
    v = {
      look: { sheet: sheetFor(first.sprite), tint: FALLBACK_TINT },
      scale: 1, name: defId || "???", level: 1, boss: false, known: false,
    };
  }
  cache.set(defId, v);
  return v;
}

/** Todos os sheets de criaturas do catálogo atual (para preload + animações). */
export function allCreatureSheets(): CharacterSheet[] {
  for (const def of Object.values(MONSTERS)) sheetFor(def.sprite);
  return [...sheets.values()];
}

/** Cor do nome conforme a diferença de level entre a criatura e o jogador local. */
export function levelColor(monsterLevel: number, myLevel: number, boss: boolean): string {
  if (boss) return "#ff9a3c";
  const d = monsterLevel - myLevel;
  if (d <= -5) return "#9aa0ad";
  if (d <= 2) return "#ffffff";
  if (d <= 6) return "#ffe066";
  return "#ff6b5e";
}
