// Comandos de desenvolvimento no chat (somente quando NODE_ENV !== "production"). Resposta só para quem digitou (Notice).
//   /level N · /item <id> [count] [rarity] · /gold N · /heal · /tp x y · /ml N
import { RARITIES, S2C, isEquipable, xpForLevel, type NoticeMsg, type Rarity, type TeleportedMsg } from "@tibinha/shared";
import type { PlayerState } from "../state.ts";
import type { InventorySystem } from "./inventory.ts";
import { createItem } from "./loot.ts";
import { makeItem } from "./inventory.ts";

export const MAX_DEV_LEVEL = 300;

export const devCommandsEnabled = (): boolean => process.env.NODE_ENV !== "production";

export interface DevContext {
  inventory: InventorySystem;
  send: (sessionId: string, type: string, msg: unknown) => void;
  /** Teleporte (MovementSystem.teleport). */
  teleport: (p: PlayerState, x: number, y: number) => void;
  isWalkable: (x: number, y: number) => boolean;
  setMagicLevel: (p: PlayerState, level: number) => void;
  rng?: () => number;
}

const COMMANDS = ["/level", "/item", "/gold", "/heal", "/tp", "/ml"];

/** Trata um comando de dev. Retorna true se o texto era um comando (não vai para o chat). */
export function handleDevCommand(p: PlayerState, text: string, ctx: DevContext): boolean {
  if (!devCommandsEnabled()) return false;
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0]?.toLowerCase() ?? "";
  if (!COMMANDS.includes(cmd)) return false;
  const reply = (t: string, kind: NoticeMsg["kind"] = "info") => ctx.send(p.id, S2C.Notice, { text: t, kind } satisfies NoticeMsg);
  const int = (s: string | undefined) => (s !== undefined && /^-?\d+$/.test(s) ? Number(s) : NaN);
  const inv = ctx.inventory;

  switch (cmd) {
    case "/level": {
      const n = int(parts[1]);
      if (!(n >= 1 && n <= MAX_DEV_LEVEL)) { reply("Uso: /level N (1–300)", "warn"); break; }
      p.level = n;
      p.xp = xpForLevel(n);
      inv.applyStats(p, true);
      reply(`Level ${n}.`, "good");
      break;
    }
    case "/item": {
      const id = parts[1] ?? "";
      const d = inv.defs(id);
      if (!d) { reply(`Item desconhecido: ${id || "?"}`, "warn"); break; }
      const count = parts[2] === undefined ? 1 : int(parts[2]);
      if (!(count >= 1 && count <= 1_000_000)) { reply("Uso: /item <id> [count] [rarity]", "warn"); break; }
      const rarity = parts[3] as Rarity | undefined;
      if (rarity !== undefined && !RARITIES.includes(rarity)) { reply(`Raridade inválida (${RARITIES.join("/")})`, "warn"); break; }
      let lost = 0;
      if (isEquipable(d)) {
        for (let i = 0; i < Math.min(count, 50); i++) lost += inv.addItem(p, createItem(d, 1, ctx.rng ?? Math.random, { rarity: rarity ?? "common" }));
      } else {
        lost = inv.addItem(p, makeItem(d.id, count));
      }
      reply(lost ? `${d.name}: ${lost} não coube(ram) na mochila.` : `Recebeu ${count}x ${d.name}.`, lost ? "warn" : "good");
      break;
    }
    case "/gold": {
      const n = int(parts[1]);
      if (!(n >= 1)) { reply("Uso: /gold N", "warn"); break; }
      inv.addGold(p, n);
      reply(`+${n} de ouro.`, "good");
      break;
    }
    case "/heal":
      p.hp = p.maxHp;
      p.mana = p.maxMana;
      reply("Vida e mana cheias.", "good");
      break;
    case "/tp": {
      const x = int(parts[1]), y = int(parts[2]);
      if (!Number.isInteger(x) || !Number.isInteger(y) || !ctx.isWalkable(x, y)) { reply("Uso: /tp x y (tile andável)", "warn"); break; }
      ctx.teleport(p, x, y);
      ctx.send(p.id, S2C.Teleported, { x, y } satisfies TeleportedMsg);
      reply(`Teleportado para ${x},${y}.`, "good");
      break;
    }
    case "/ml": {
      const n = int(parts[1]);
      if (!(n >= 0 && n <= 200)) { reply("Uso: /ml N (0–200)", "warn"); break; }
      ctx.setMagicLevel(p, n);
      reply(`Magic level ${n}.`, "good");
      break;
    }
  }
  return true;
}
