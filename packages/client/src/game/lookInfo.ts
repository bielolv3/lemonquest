// Conteúdo do "olhar" (puro: recebe os dados, devolve título/cor/linhas). A cena decide o que está sob o mouse.
import { SKULL_LABEL, TITLES, monsterDef, npcDef, questLeverDef } from "@lemonquest/shared";
import { DAMAGE_LABEL, VOCATION_LABEL } from "../ui/items/itemInfo.ts";
import { chestLookLines } from "./chestInfo.ts";
import { levelColor, levelDifficulty } from "./creatures.ts";

export interface LookContent { title: string; color?: string; lines: string[] }

const pct = (hp: number, max: number) => `${Math.max(0, Math.round((hp / Math.max(1, max)) * 100))}%`;

export function lookCreature(c: { defId: string; name: string; level: number; boss: boolean; hp: number; maxHp: number }, myLevel: number): LookContent {
  const def = monsterDef(c.defId);
  const lines = [
    `Level ${c.level} · ${levelDifficulty(c.level, myLevel, c.boss)}`,
    `Vida ${c.hp.toLocaleString("pt-BR")}/${c.maxHp.toLocaleString("pt-BR")} (${pct(c.hp, c.maxHp)})`,
  ];
  if (def) {
    lines.push(`Ataque: ${def.attackRange > 1 ? `à distância (${def.attackRange} sqm)` : "corpo a corpo"}, ${DAMAGE_LABEL[def.damageKind]}`);
    if (def.abilities?.length) lines.push(`Habilidades: ${def.abilities.map((a) => a.name).join(", ")}`);
    lines.push(`XP: ${def.xp.toLocaleString("pt-BR")}`);
  }
  return { title: `${c.boss ? "☠ " : ""}${c.name}`, color: levelColor(c.level, myLevel, c.boss), lines };
}

export function lookPlayer(p: { name: string; level: number; vocation: string; title?: string; skull?: string }, o: { me: boolean; party: boolean }): LookContent {
  const lines = [`Level ${p.level} · ${VOCATION_LABEL[p.vocation as keyof typeof VOCATION_LABEL] ?? p.vocation}`];
  if (p.title && TITLES[p.title]) lines.push(`Título: ${TITLES[p.title]}`);
  if (p.skull === "white" || p.skull === "red") lines.push(SKULL_LABEL[p.skull]);
  if (o.party) lines.push("Do seu grupo");
  return { title: o.me ? `${p.name} (você)` : p.name, color: "#9fdcab", lines };
}

export function lookNpc(id: string): LookContent | null {
  const d = npcDef(id);
  if (!d) return null;
  const roles = [d.shop ? "loja" : "", d.depot ? "depósito" : "", d.travel?.length ? "viagens" : ""].filter(Boolean);
  return { title: d.name, color: "#ffe066", lines: [roles.length ? `NPC · ${roles.join(", ")}` : "NPC", "Clique para conversar."] };
}

export function lookQuestObject(kind: "chest" | "lever", id: string): LookContent {
  if (kind === "chest") return chestLookLines(id);
  const l = questLeverDef(id);
  return {
    title: l ? `Alavanca: ${l.name}` : "Alavanca",
    lines: l ? [`Precisa de ${l.players} aventureiros de level ${l.minLevel}+ nas placas.`] : [],
  };
}
