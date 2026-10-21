import { describe, expect, it } from "vitest";
import { QUEST_CHESTS } from "@lemonquest/shared";
import { chestClass, chestLookLines } from "./chestInfo.ts";
import { lookCreature, lookNpc, lookPlayer, lookQuestObject } from "./lookInfo.ts";

describe("classe dos baús de quest", () => {
  it("baús de arma da escolha mostram a vocação; anel/amuleto/ouro mostram Todas", () => {
    expect(chestClass("hero_sword").label).toBe("Cavaleiro");
    expect(chestClass("hero_bow").label).toBe("Paladino");
    expect(chestClass("frost_ring").label).toBe("Todas");
    expect(chestClass("anni_bear").label).toBe("Todas");
    for (const id of Object.keys(QUEST_CHESTS)) expect(chestClass(id).label.length, id).toBeGreaterThan(0);
  });

  it("olhar um baú: quest, level, itens com a classe e ouro", () => {
    const c = chestLookLines("volcano_summit");
    expect(c.lines[0]).toMatch(/O Cume do Vulcão · requer level 80/);
    expect(c.lines.some((l) => /ouro/.test(l))).toBe(true);
    expect(lookQuestObject("chest", "hero_sword").lines.at(-1)).toBe("Classe: Cavaleiro");
    expect(lookQuestObject("lever", "annihilator").lines[0]).toMatch(/4 aventureiros de level 100/);
  });
});

describe("olhar criaturas, jogadores e NPCs", () => {
  it("criatura: level, dificuldade, vida, ataque, habilidades e XP", () => {
    const c = lookCreature({ defId: "dragon", name: "Dragão", level: 70, boss: false, hp: 1000, maxHp: 2000 }, 60);
    expect(c.title).toBe("Dragão");
    expect(c.lines).toEqual(expect.arrayContaining([
      "Level 70 · perigosa", "Vida 1.000/2.000 (50%)", expect.stringMatching(/^Ataque: /), "Habilidades: Sopro de Fogo", "XP: 3.500",
    ]));
    expect(lookCreature({ defId: "demodras", name: "Demodras", level: 80, boss: true, hp: 1, maxHp: 1 }, 80).title).toBe("☠ Demodras");
  });

  it("jogador: level e vocação, título, caveira, grupo; você", () => {
    const p = lookPlayer({ name: "Ana", level: 42, vocation: "druid", title: "gladiador", skull: "white" }, { me: false, party: true });
    expect(p.lines).toEqual(["Level 42 · Druida", "Título: o Gladiador", "Caveira branca", "Do seu grupo"]);
    expect(lookPlayer({ name: "Eu", level: 1, vocation: "knight" }, { me: true, party: false }).title).toBe("Eu (você)");
  });

  it("NPC: nome e papel; desconhecido não mostra nada", () => {
    expect(lookNpc("nao_existe")).toBeNull();
  });
});
