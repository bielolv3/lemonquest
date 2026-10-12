// Isolamento de falhas: um bug num sistema/monstro não derruba o tick (nem o processo). Log limitado por chave.

export class ErrorLog {
  private readonly last = new Map<string, { at: number; suppressed: number }>();

  constructor(
    private readonly intervalMs = 10_000,
    private readonly now: () => number = Date.now,
    private readonly out: (...args: unknown[]) => void = console.error,
  ) {}

  /** Loga no máximo 1 erro por `intervalMs` por chave (conta os suprimidos). */
  report(key: string, err: unknown): void {
    const now = this.now();
    const e = this.last.get(key);
    if (e && now - e.at < this.intervalMs) { e.suppressed++; return; }
    const extra = e?.suppressed ? ` (+${e.suppressed} suprimidos)` : "";
    this.last.set(key, { at: now, suppressed: 0 });
    this.out(`[erro] ${key}${extra}:`, err);
  }
}

/** Roda `fn`; se lançar, reporta e segue. Retorna false se falhou. */
export function runSafe(key: string, fn: () => void, log: ErrorLog): boolean {
  try {
    fn();
    return true;
  } catch (e) {
    log.report(key, e);
    return false;
  }
}

/** Roda uma lista de passos isolados (o tick do mundo). */
export function runSteps(steps: ReadonlyArray<readonly [string, () => void]>, log: ErrorLog): number {
  let failed = 0;
  for (const [key, fn] of steps) if (!runSafe(key, fn, log)) failed++;
  return failed;
}
