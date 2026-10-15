// Bônus por dias seguidos: o primeiro login de cada "dia de jogo" (troca às 6h de Brasília, como as recompensas diárias)
// dá um prêmio pequeno; entrar em dias seguidos sobe a sequência (ciclo de 7 dias); faltar um dia volta ao dia 1.
import { S2C, type ChallengeReward, type NoticeMsg } from "@lemonquest/shared";
import type { CharacterRecord } from "../persistence/types.ts";
import type { PlayerState } from "../state.ts";
import { bountyDay } from "./bounties.ts";
import { makeItem, type InventorySystem } from "./inventory.ts";

/** Prêmio de cada dia do ciclo (dia 7 é o maior). */
export const LOGIN_REWARDS: readonly ChallengeReward[] = [
  { gold: 50 },
  { items: [{ itemId: "health_potion", count: 3 }] },
  { gold: 100 },
  { items: [{ itemId: "mana_potion", count: 3 }] },
  { gold: 200 },
  { items: [{ itemId: "health_potion", count: 5 }, { itemId: "meat", count: 3 }] },
  { gold: 500, items: [{ itemId: "health_potion_medium", count: 3 }] },
];

export interface LoginState { day: string; streak: number }

export const rewardForStreak = (streak: number): ChallengeReward => LOGIN_REWARDS[(Math.max(1, streak) - 1) % LOGIN_REWARDS.length]!;

/** Dia de jogo anterior a `day` ("2026-10-15" → "2026-10-14"). */
export function previousDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

/** Próximo estado ao entrar em `today`; `fresh` = é o primeiro login deste dia (dá o prêmio). */
export function nextLoginState(prev: LoginState | undefined, today: string): { state: LoginState; fresh: boolean } {
  if (prev?.day === today) return { state: prev, fresh: false };
  const streak = prev && prev.day === previousDay(today) ? prev.streak + 1 : 1;
  return { state: { day: today, streak }, fresh: true };
}

export interface LoginBonusHost {
  send(id: string, type: string, msg: unknown): void;
  inventory: Pick<InventorySystem, "roomFor" | "addItem" | "addGold">;
  now?(): number;
}

/**
 * Chamado ao entrar no mundo (depois do inventário carregado). Atualiza a sequência e entrega o prêmio do dia.
 * Sem espaço na mochila para algum item, ele é pulado (o ouro sempre entra) e o aviso diz isso.
 */
export function grantLoginBonus(host: LoginBonusHost, p: PlayerState, rec: Pick<CharacterRecord, "data">): { streak: number; fresh: boolean } {
  const today = bountyDay(host.now?.() ?? Date.now());
  const { state, fresh } = nextLoginState(rec.data.login, today);
  rec.data.login = state;
  if (!fresh) return { streak: state.streak, fresh };
  const r = rewardForStreak(state.streak);
  if (r.gold) host.inventory.addGold(p, r.gold);
  const skipped: string[] = [];
  for (const i of r.items ?? []) {
    if (host.inventory.roomFor(p.id, i.itemId) >= i.count) host.inventory.addItem(p, makeItem(i.itemId, i.count));
    else skipped.push(i.itemId);
  }
  const day = ((state.streak - 1) % LOGIN_REWARDS.length) + 1;
  const text = `Bônus de login — dia ${day} de ${LOGIN_REWARDS.length} (sequência: ${state.streak}). Volte amanhã para o próximo!` +
    (skipped.length ? " Faltou espaço na mochila para parte do prêmio." : "");
  host.send(p.id, S2C.Notice, { text, kind: skipped.length ? "warn" : "good", log: true } satisfies NoticeMsg);
  return { streak: state.streak, fresh };
}
