// Relógio do mundo no cliente: o servidor publica `worldTimeMs` (ver WorldState) a cada poucos segundos e o cliente
// extrapola com o relógio local. Sem servidor (harnesses ?fxtest/?uitest) usa um horário local fixo de dia.
import { CYCLE_MS, CYCLE_START_MS, wrapCycle } from "@lemonquest/shared";

const params = new URLSearchParams(location.search);
const LOCAL = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

/**
 * Atalho de desenvolvimento (só em dev ou em localhost): `?time=day|dusk|night|dawn|HH:MM|0.5` congela o horário
 * do mundo no cliente. HH:MM é a hora do relógio do jogo (06:00 = início do dia); número = fração do ciclo.
 */
export function parseTimeParam(raw: string | null): number | null {
  if (!raw) return null;
  const m = 60_000;
  const named: Record<string, number> = { day: 10 * m, noon: 12 * m, dusk: 26 * m, sunset: 26 * m, night: 32 * m, dawn: 38 * m };
  const key = raw.toLowerCase();
  if (key in named) return named[key];
  const hm = /^(\d{1,2}):(\d{2})$/.exec(raw);
  if (hm) {
    const hours = Number(hm[1]) + Number(hm[2]) / 60;
    return wrapCycle(((((hours - 6) % 24) + 24) % 24) / 24 * CYCLE_MS);
  }
  const f = Number(raw);
  if (Number.isFinite(f) && f >= 0 && f <= 1) return f * CYCLE_MS;
  return null;
}

class WorldClock {
  private base = CYCLE_START_MS;
  private at = performance.now();
  private synced = false;
  /** Horário congelado de desenvolvimento (?time=). */
  readonly frozen: number | null = import.meta.env.DEV || LOCAL ? parseTimeParam(params.get("time")) : null;

  /** Servidor → relógio. Chamado a cada atualização do estado. */
  setServerTime(ms: number) {
    this.base = ms;
    this.at = performance.now();
    this.synced = true;
  }

  get isSynced() { return this.synced; }

  /** Tempo do mundo agora (ms dentro do ciclo, 0..CYCLE_MS). */
  now(): number {
    if (this.frozen !== null) return this.frozen;
    return wrapCycle(this.base + (performance.now() - this.at));
  }
}

export const worldClock = new WorldClock();
