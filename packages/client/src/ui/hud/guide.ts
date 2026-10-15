// Guia do novato: de olho na primeira missão, diz para onde ir. Puro (sem Phaser/Preact) para poder testar.
import { NPCS, questDef, questStatus, type ItemCounter, type QuestsMsg } from "@lemonquest/shared";

/** Primeira missão: o guia some quando ela acaba ou o personagem passa deste level. */
export const GUIDE_QUEST = "rats_barn";
export const GUIDE_MAX_LEVEL = 3;
/** Centro do spawn dos ratos (floresta ao norte da vila). */
export const GUIDE_FOREST = { x: 70, y: 62 };

export type GuideTarget =
  | { kind: "npc"; id: string; label: string }
  | { kind: "tile"; x: number; y: number; label: string };

export function guideTarget(level: number, quests: Pick<QuestsMsg, "active" | "done"> | null, count: ItemCounter): GuideTarget | null {
  if (!quests || level > GUIDE_MAX_LEVEL) return null;
  const def = questDef(GUIDE_QUEST);
  if (!def) return null;
  const giver = NPCS[def.giver];
  switch (questStatus(def, quests, level, count)) {
    case "available": return { kind: "npc", id: def.giver, label: `${giver?.name ?? def.giver} — pegue a missão` };
    case "active": return { kind: "tile", ...GUIDE_FOREST, label: "Ratos — floresta ao norte" };
    case "ready": return { kind: "npc", id: def.giver, label: `${giver?.name ?? def.giver} — entregue a missão` };
    default: return null;
  }
}
