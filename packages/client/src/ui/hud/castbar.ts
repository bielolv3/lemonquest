// Barra de ações = magias da vocação. Preenche os slots, envia C2S.Cast, aplica cooldown otimista e reconcilia
// com S2C.CastResult (falhas: tremida no slot + toast + piscada na barra de mana).
import {
  C2S, GLOBAL_SPELL_COOLDOWN_MS, S2C, spellMana, spellsFor,
  type CastFailReason, type CastMsg, type CastResultMsg, type SpellDef,
} from "@lemonquest/shared";
import { cssColor, PAL } from "../../game/spellPalette.ts";
import { sfx } from "../../game/sfx.ts";
import { session } from "../../session.ts";
import { pushToast } from "../toasts.ts";
import {
  ACTION_SLOTS, cooldownStore, onSlotActivate, setCooldownAt, setSlotAction, shakeSlot, type Cooldown,
} from "./actionbar.ts";
import { spellIcon } from "./spellIcons.ts";
import { createStore } from "./store.ts";
import { getTarget } from "./target.ts";
import { playersStore, selectMe } from "./world.ts";

/** Incrementa quando falta mana (a barra de MP pisca). */
export const manaFlashStore = createStore(0);

export const FAIL_TEXT: Record<CastFailReason, string> = {
  mana: "Sem mana",
  cooldown: "Em recarga",
  target: "Sem alvo",
  range: "Fora de alcance",
  pz: "Não pode atacar aqui",
  level: "Level insuficiente",
  vocation: "Sua vocação não pode usar esta magia",
  dead: "Você está morto",
  unknown: "Não foi possível conjurar",
};

let slotSpells: (SpellDef | null)[] = Array(ACTION_SLOTS).fill(null);
interface Pending { prev: (Cooldown | null)[]; set: (Cooldown | null)[] }
const pending = new Map<string, Pending>();

/** Transporte do cast (o harness ?fxtest troca por um servidor falso). */
let transport: (m: CastMsg) => void = (m) => { session.room?.send(C2S.Cast, m); };
export function setCastTransport(fn: (m: CastMsg) => void): void { transport = fn; }

export const spellInSlot = (slot: number): SpellDef | null => slotSpells[slot] ?? null;

function fillSlots(vocation: string) {
  const list = spellsFor(vocation as never).slice(0, ACTION_SLOTS);
  slotSpells = Array.from({ length: ACTION_SLOTS }, (_, i) => list[i] ?? null);
  slotSpells.forEach((s, i) => {
    setSlotAction(i, s ? {
      label: s.name, mana: s.mana, spellId: s.id, words: s.words, desc: s.description, level: s.level,
      cooldownMs: s.cooldownMs, fx: s.fx, color: cssColor(PAL[s.fx]?.main ?? 0xffffff),
      icon: spellIcon(s.fx, s.target),
    } : null);
  });
}

function fail(slot: number, reason: CastFailReason) {
  shakeSlot(slot);
  pushToast({ text: FAIL_TEXT[reason] ?? FAIL_TEXT.unknown, kind: "warn" }, 700);
  if (reason === "mana") manaFlashStore.set((n) => n + 1);
  sfx.play("fail", { volume: 0.5 });
}

function activate(slot: number) {
  const spell = slotSpells[slot];
  if (!spell) return;
  const me = selectMe(playersStore.get());
  const now = performance.now();
  if (me && me.level < spell.level) return fail(slot, "level");
  const cd = cooldownStore.get()[slot];
  if (cd && cd.end > now + 30) return fail(slot, "cooldown");
  if (me && me.mana < spellMana(spell, me.level)) return fail(slot, "mana");

  // Cooldown otimista: o do próprio slot + o global nos demais.
  const prev = cooldownStore.get().slice();
  const set: (Cooldown | null)[] = Array(ACTION_SLOTS).fill(null);
  const own: Cooldown = { start: now, end: now + Math.max(spell.cooldownMs, spell.global === false ? 0 : GLOBAL_SPELL_COOLDOWN_MS) };
  setCooldownAt(slot, own); set[slot] = own;
  if (spell.global !== false) {
    slotSpells.forEach((s, i) => {
      if (i === slot || !s || s.global === false) return;
      const c = prev[i];
      if (c && c.end > now + GLOBAL_SPELL_COOLDOWN_MS) return;
      const g: Cooldown = { start: now, end: now + GLOBAL_SPELL_COOLDOWN_MS };
      setCooldownAt(i, g); set[i] = g;
    });
  }
  pending.set(spell.id, { prev, set });
  transport({ spellId: spell.id, targetId: getTarget()?.id ?? null });
}

/** Reconcilia com o resultado autoritativo do servidor. */
export function handleCastResult(r: CastResultMsg): void {
  const slot = slotSpells.findIndex((s) => s?.id === r.spellId);
  const p = pending.get(r.spellId);
  pending.delete(r.spellId);
  const now = performance.now();
  if (r.ok) {
    const spell = slotSpells[slot];
    if (slot >= 0) setCooldownAt(slot, { start: now, end: now + (r.cooldownMs ?? spell?.cooldownMs ?? 0) });
    const g = r.globalMs ?? GLOBAL_SPELL_COOLDOWN_MS;
    slotSpells.forEach((s, i) => {
      if (i === slot || !s || s.global === false) return;
      const c = cooldownStore.get()[i];
      if (!c || c.end < now + g) setCooldownAt(i, { start: now, end: now + g });
    });
    return;
  }
  if (p) {
    p.set.forEach((mine, i) => { if (mine && cooldownStore.get()[i] === mine) setCooldownAt(i, p.prev[i]); });
  }
  if (slot >= 0 && r.reason === "cooldown" && r.cooldownMs) setCooldownAt(slot, { start: now, end: now + r.cooldownMs });
  fail(Math.max(slot, 0), r.reason ?? "unknown");
}

/** Liga a barra de ações às magias e ao servidor. Retorna o desligador. */
export function startCastBar(): () => void {
  let voc = "";
  const offStore = playersStore.subscribe((m) => {
    const me = selectMe(m);
    if (me && me.vocation !== voc) { voc = me.vocation; fillSlots(voc); }
  });
  const first = selectMe(playersStore.get());
  if (first) { voc = first.vocation; fillSlots(voc); }
  const offAct = onSlotActivate(activate);
  const offRoom = session.onRoom((room) => {
    room.onMessage(S2C.CastResult, (m: CastResultMsg) => handleCastResult(m));
  });
  return () => { offStore(); offAct(); offRoom(); };
}
