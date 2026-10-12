// Limitadores em memória (login). Chaves = IP ou name_key. Limpeza periódica via sweep().

/** Bloqueio após N falhas numa janela: `max` falhas em `windowMs` → bloqueado por `lockMs`. */
export class FailureLimiter {
  private readonly m = new Map<string, { fails: number[]; lockedUntil: number; pending: number }>();

  constructor(readonly max: number, readonly windowMs: number, readonly lockMs: number) {}

  private entry(key: string) {
    let e = this.m.get(key);
    if (!e) { e = { fails: [], lockedUntil: 0, pending: 0 }; this.m.set(key, e); }
    return e;
  }

  /**
   * Milissegundos até liberar (0 = livre). Conta também tentativas em andamento (`begin`), para que rajadas
   * paralelas não passem todas antes de a primeira falha ser registrada.
   */
  lockedFor(key: string, now: number): number {
    const e = this.m.get(key);
    if (!e) return 0;
    if (e.lockedUntil > now) return e.lockedUntil - now;
    const recent = e.fails.filter((t) => now - t < this.windowMs).length;
    return recent + e.pending >= this.max ? 1000 : 0;
  }

  /** Tentativa começou (verificação assíncrona em andamento). */
  begin(key: string): void { this.entry(key).pending++; }

  /** Tentativa terminou. `failed` registra a falha (e pode bloquear). */
  end(key: string, failed: boolean, now: number): void {
    const e = this.entry(key);
    e.pending = Math.max(0, e.pending - 1);
    if (!failed) return;
    e.fails = e.fails.filter((t) => now - t < this.windowMs);
    e.fails.push(now);
    if (e.fails.length >= this.max) { e.lockedUntil = now + this.lockMs; e.fails = []; }
  }

  /** Sucesso: zera falhas (não desfaz um bloqueio em vigor). */
  reset(key: string): void {
    const e = this.m.get(key);
    if (e) e.fails = [];
  }

  sweep(now: number): void {
    for (const [k, e] of this.m) {
      if (e.pending === 0 && e.lockedUntil <= now && e.fails.every((t) => now - t >= this.windowMs)) this.m.delete(k);
    }
  }

  get size(): number { return this.m.size; }
}

/** No máximo `max` eventos por `windowMs` (janela deslizante). */
export class RateCounter {
  private readonly m = new Map<string, number[]>();

  constructor(readonly max: number, readonly windowMs: number) {}

  /** Ms até poder de novo (0 = pode). Não registra. */
  waitFor(key: string, now: number): number {
    const list = (this.m.get(key) ?? []).filter((t) => now - t < this.windowMs);
    return list.length >= this.max ? this.windowMs - (now - list[0]!) : 0;
  }

  record(key: string, now: number): void {
    const list = (this.m.get(key) ?? []).filter((t) => now - t < this.windowMs);
    list.push(now);
    this.m.set(key, list);
  }

  sweep(now: number): void {
    for (const [k, list] of this.m) if (list.every((t) => now - t >= this.windowMs)) this.m.delete(k);
  }
}

/** Limitador por chave e por segundo, para mensagens do jogo (descarta o excesso). */
export class PerSecond {
  private readonly m = new Map<string, { at: number; n: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  /** true se ainda cabe (registra). Janela fixa de 1 s por chave. */
  allow(key: string, max: number): boolean {
    const now = this.now();
    const e = this.m.get(key);
    if (!e || now - e.at >= 1000) { this.m.set(key, { at: now, n: 1 }); return true; }
    if (e.n >= max) return false;
    e.n++;
    return true;
  }

  /** Remove todas as chaves com o prefixo (sessão saiu). */
  clearPrefix(prefix: string): void {
    for (const k of this.m.keys()) if (k.startsWith(prefix)) this.m.delete(k);
  }
}
