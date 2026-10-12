/// <reference types="node" />
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ADDON_FRAME, ADDON_OFFSET_X, ADDON_OFFSET_Y, DEFAULT_OUTFIT, OUTFITS, OUTFIT_LIST, activeAddons, resolveOutfit } from "./outfits.ts";
import { VOCATIONS } from "../types.ts";
import { computeAnchors, readSheet } from "../../../../tools/addons/anchors.mjs";

const root = fileURLToPath(new URL("../../../../", import.meta.url));
const asset = (rel: string) => root + "assets/" + rel;

describe("OUTFITS", () => {
  it("12–14 roupas, ids únicos, chaves = ids", () => {
    expect(OUTFIT_LIST.length).toBeGreaterThanOrEqual(12);
    expect(OUTFIT_LIST.length).toBeLessThanOrEqual(14);
    expect(new Set(OUTFIT_LIST.map((o) => o.id)).size).toBe(OUTFIT_LIST.length);
    for (const [k, o] of Object.entries(OUTFITS)) expect(o.id).toBe(k);
    const addonIds = OUTFIT_LIST.flatMap((o) => o.addons.map((a) => a.id));
    expect(new Set(addonIds).size).toBe(addonIds.length);
  });

  it("sheets base existem e são 64x112; sheets base diferentes entre si", () => {
    for (const o of OUTFIT_LIST) {
      expect(existsSync(asset(o.sheet)), o.sheet).toBe(true);
      const png = readSheet(asset(o.sheet));
      expect([png.width, png.height], o.id).toEqual([64, 112]);
    }
    expect(new Set(OUTFIT_LIST.map((o) => o.sheet)).size).toBe(OUTFIT_LIST.length);
  });

  it("2 addons por roupa, com nome e overlays existentes no layout 4x7 de frames 32x32", () => {
    for (const o of OUTFIT_LIST) {
      expect(o.addons).toHaveLength(2);
      for (const a of o.addons) {
        expect(a.name.length, a.id).toBeGreaterThan(2);
        for (const s of [a.sheet, a.backSheet].filter(Boolean) as string[]) {
          expect(existsSync(asset(s)), s).toBe(true);
          const png = readSheet(asset(s));
          expect([png.width, png.height], s).toEqual([4 * ADDON_FRAME, 7 * ADDON_FRAME]);
        }
        expect(a.extraTop).toBeGreaterThanOrEqual(0);
        expect(a.extraTop).toBeLessThanOrEqual(ADDON_OFFSET_Y);
      }
    }
  });

  it("retratos existem (Faceset do pack ou gerado) com 38x38", () => {
    for (const o of OUTFIT_LIST) {
      const face = o.faceset ?? o.sheet.replace(/SpriteSheet\.png$/, "Faceset.png");
      expect(existsSync(asset(face)), face).toBe(true);
      const png = readSheet(asset(face));
      expect([png.width, png.height], face).toEqual([38, 38]);
    }
  });

  it("toda vocação tem roupa padrão existente (Mago = sheet gerada com barba longa)", () => {
    for (const v of VOCATIONS) expect(OUTFITS[DEFAULT_OUTFIT[v]], v).toBeDefined();
    expect(OUTFITS[DEFAULT_OUTFIT.knight].sheet).toContain("/Knight/");
    expect(OUTFITS[DEFAULT_OUTFIT.paladin].sheet).toContain("/Hunter/");
    expect(OUTFITS[DEFAULT_OUTFIT.sorcerer].sheet).toBe("addons/base_mago.png");
    expect(OUTFITS[DEFAULT_OUTFIT.druid].sheet).toContain("/Shaman/");
    expect(resolveOutfit(undefined, "druid").id).toBe(DEFAULT_OUTFIT.druid);
    expect(resolveOutfit("pirata", "druid").id).toBe("pirata");
    expect(activeAddons(OUTFITS.mago, 2).map((a) => a.id)).toEqual(["mago_cajado"]);
    expect(activeAddons(OUTFITS.mago, 3)).toHaveLength(2);
  });
});

describe("âncoras dos addons", () => {
  it("cabeça detectada dentro do frame em todos os frames de caminhada (todas as roupas)", () => {
    for (const o of OUTFIT_LIST) {
      const png = readSheet(asset(o.sheet));
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
        const a = computeAnchors(png, col, row);
        const at = `${o.id} ${col},${row}`;
        expect(a.top, at).toBeGreaterThanOrEqual(0);
        expect(a.top, at).toBeLessThan(5);
        expect(a.bottom, at).toBeGreaterThanOrEqual(14);
        expect(a.neck, at).toBeGreaterThan(a.top + 5);
        expect(a.headL, at).toBeLessThan(a.headR);
        expect(a.c2 / 2, at).toBeGreaterThan(4);
        expect(a.c2 / 2, at).toBeLessThan(11);
      }
    }
  });

  it("chapéus cobrem o topo da cabeça em todo frame (sem chapéu flutuando nem cabelo vazando)", () => {
    const op = (png: { width: number; data: Uint8Array }, x: number, y: number) => png.data[(y * png.width + x) * 4 + 3] >= 128;
    for (const [outfit, addon] of [["mago", 0], ["cidadao", 0], ["cacador", 0], ["pirata", 0], ["barbaro", 0]] as const) {
      const o = OUTFITS[outfit];
      const base = readSheet(asset(o.sheet));
      const hat = readSheet(asset(o.addons[addon].sheet));
      for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
        const a = computeAnchors(base, col, row);
        for (let y = a.top; y <= a.top + 1; y++) for (let x = 0; x < 16; x++) {
          if (!op(base, col * 16 + x, row * 16 + y)) continue;
          expect(op(hat, col * ADDON_FRAME + ADDON_OFFSET_X + x, row * ADDON_FRAME + ADDON_OFFSET_Y + y), `${outfit} ${col},${row} (${x},${y})`).toBe(true);
        }
        // o chapéu encosta na cabeça: tem pixel opaco na linha do topo da base
        let touches = false;
        for (let x = 0; x < 16; x++) if (op(hat, col * ADDON_FRAME + ADDON_OFFSET_X + x, row * ADDON_FRAME + ADDON_OFFSET_Y + a.top)) touches = true;
        expect(touches, `${outfit} ${col},${row}`).toBe(true);
      }
    }
  });
});
