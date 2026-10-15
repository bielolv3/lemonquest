// Eventos com bônus (shared/data/events.ts): agenda semanal + disparo manual de admin (/evento).
// Anuncia início e fim, avisa quem entra e expõe os multiplicadores de XP e de loot.
import { S2C, eventDef, nextScheduled, scheduledEvent, toActive, type ActiveEvent, type AnnounceMsg, type EventMsg, type FeedMsg } from "@lemonquest/shared";

export interface EventHost {
  broadcast(type: string, msg: unknown): void;
  send(id: string, type: string, msg: unknown): void;
  now?(): number;
  /** Guarda o evento manual (JSON) para sobreviver a reinício; ausente = só memória. */
  store?: { get(): string | undefined; set(value: string): void };
}

const CHECK_MS = 1000;

export class EventSystem {
  private current: ActiveEvent | null = null;
  /** Disparado por admin: vale no lugar da agenda até `until` (ou /evento parar). */
  private manual: ActiveEvent | null = null;
  private nextCheck = 0;
  /** Janelas agendadas que terminam até aqui foram encerradas por um admin e não valem. */
  private suppressedUntil = 0;

  constructor(private readonly o: EventHost) {
    this.manual = this.load();
  }

  private load(): ActiveEvent | null {
    try {
      const raw = this.o.store?.get();
      const v = raw ? (JSON.parse(raw) as Partial<ActiveEvent>) : null;
      const def = v && typeof v.id === "string" ? eventDef(v.id) : undefined;
      if (!def || typeof v?.until !== "number" || v.until <= this.now()) return null;
      return toActive(def, v.until);
    } catch {
      return null;
    }
  }

  private persist() { this.o.store?.set(JSON.stringify(this.manual)); }

  private now() { return this.o.now?.() ?? Date.now(); }

  /** Reavalia (no máximo 1×/s): começou, terminou ou trocou de evento → anuncia. */
  tick(now = this.now()): void {
    if (now < this.nextCheck) return;
    this.nextCheck = now + CHECK_MS;
    if (this.manual && this.manual.until <= now) { this.manual = null; this.persist(); }
    let sched = scheduledEvent(new Date(now));
    if (sched && sched.until <= this.suppressedUntil) sched = null;
    const want = this.manual ?? sched;
    if (want?.id === this.current?.id && want?.until === this.current?.until) return;
    const prev = this.current;
    this.current = want;
    if (prev && (!want || want.id !== prev.id)) this.o.broadcast(S2C.Feed, { text: `Evento encerrado: ${prev.name}.`, kind: "info" } satisfies FeedMsg);
    if (want && want.id !== prev?.id) {
      this.o.broadcast(S2C.Announce, { text: `Evento: ${want.name}! ${want.desc} (até ${hhmm(want.until)})`, from: "Evento" } satisfies AnnounceMsg);
      this.o.broadcast(S2C.Feed, { text: `★ ${want.name}: ${want.desc}`, kind: "info" } satisfies FeedMsg);
    }
    this.o.broadcast(S2C.Event, { active: want } satisfies EventMsg);
  }

  /** Dispara `id` por `minutes` agora (admin). null = evento desconhecido. */
  start(id: string, minutes: number, now = this.now()): ActiveEvent | null {
    const def = eventDef(id);
    if (!def || !(minutes >= 1)) return null;
    this.manual = toActive(def, now + Math.floor(minutes) * 60_000);
    this.persist();
    this.nextCheck = 0;
    this.tick(now);
    return this.manual;
  }

  /** Encerra o evento em andamento (manual ou agendado; a janela agendada atual não volta). true = havia algo. */
  stop(now = this.now()): boolean {
    if (!this.current) return false;
    this.suppressedUntil = Math.max(this.suppressedUntil, this.current.until);
    this.manual = null;
    this.persist();
    this.nextCheck = 0;
    this.tick(now);
    return true;
  }

  get active(): ActiveEvent | null { return this.current; }
  xpMult(): number { return this.current?.xpMult ?? 1; }
  lootMult(): number { return this.current?.lootMult ?? 1; }

  /** Quem entra no mundo recebe o evento em andamento. */
  sendTo(id: string): void {
    if (this.current) this.o.send(id, S2C.Event, { active: this.current } satisfies EventMsg);
  }

  /** Texto do /evento. */
  statusLines(now = this.now()): string[] {
    const lines: string[] = [];
    if (this.current) lines.push(`Em andamento: ${this.current.name} (${this.current.desc}) até ${hhmm(this.current.until)}.`);
    else lines.push("Nenhum evento em andamento.");
    const n = nextScheduled(new Date(now));
    if (n) lines.push(`Próximo agendado: ${n.def.name} — ${new Date(n.at).toLocaleString("pt-BR", { weekday: "long", hour: "2-digit", minute: "2-digit" })}.`);
    return lines;
  }
}

function hhmm(ms: number): string {
  return new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
