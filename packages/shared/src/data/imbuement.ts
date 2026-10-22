// Encantamento (simplificado): 1 efeito ativo por personagem (não por arma), permanente até trocar por outro.
// Comprado com ouro + material (Dona Marta). Só vale no PvE (ataque automático contra monstro selvagem).
export const IMBUEMENT_EFFECTS = ["lifesteal", "manasteal", "thorns", "pierce", "haste"] as const;
export type ImbuementEffect = (typeof IMBUEMENT_EFFECTS)[number];

export interface ImbuementDef {
  effect: ImbuementEffect;
  name: string;
  desc: string;
  /** Fração (0..1) do efeito. */
  value: number;
  goldPrice: number;
  materialId: string;
  materialCount: number;
}

export const IMBUEMENTS: Record<ImbuementEffect, ImbuementDef> = {
  lifesteal: {
    effect: "lifesteal", name: "Dreno de Vida", desc: "5% do dano causado volta como vida.",
    value: 0.05, goldPrice: 5000, materialId: "wolf_fang", materialCount: 5,
  },
  manasteal: {
    effect: "manasteal", name: "Dreno de Mana", desc: "4% do dano causado volta como mana.",
    value: 0.04, goldPrice: 5000, materialId: "spider_eye", materialCount: 5,
  },
  thorns: {
    effect: "thorns", name: "Espinhos", desc: "8% do dano recebido volta pro monstro.",
    value: 0.08, goldPrice: 5000, materialId: "wolf_pelt", materialCount: 5,
  },
  pierce: {
    effect: "pierce", name: "Perfurante", desc: "Ignora 15% da armadura do monstro.",
    value: 0.15, goldPrice: 5000, materialId: "iron_bar", materialCount: 5,
  },
  haste: {
    effect: "haste", name: "Veloz", desc: "8% mais rápido no ataque automático.",
    value: 0.08, goldPrice: 5000, materialId: "bee_sting", materialCount: 5,
  },
};

export function imbuementDef(id: string | undefined | null): ImbuementDef | undefined {
  return id && Object.hasOwn(IMBUEMENTS, id) ? IMBUEMENTS[id as ImbuementEffect] : undefined;
}
