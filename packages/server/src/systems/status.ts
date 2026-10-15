// /status (admin): fotografia do servidor para o chat. Puro: o WorldRoom coleta os números, aqui só se formata.
export interface StatusInfo {
  uptimeMs: number;
  online: number;
  peakOnline: number;
  /** Entradas no mundo desde que o servidor subiu. */
  joins: number;
  monsters: number;
  pendingRespawns: number;
  groundItems: number;
  /** Duração do tick nas últimas amostras. */
  tickAvgMs: number;
  tickMaxMs: number;
  tickBudgetMs: number;
  rssMb: number;
  heapMb: number;
  /** Erros isolados (sistemas que lançaram) desde que subiu. */
  errors: number;
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}

export function statusLines(i: StatusInfo): string[] {
  const load = i.tickBudgetMs > 0 ? Math.round((i.tickAvgMs / i.tickBudgetMs) * 100) : 0;
  return [
    `Servidor no ar há ${formatUptime(i.uptimeMs)} · ${i.online} online (pico ${i.peakOnline}) · ${i.joins} entradas`,
    `Mundo: ${i.monsters} monstros (${i.pendingRespawns} voltando) · ${i.groundItems} itens no chão`,
    `Tick: média ${i.tickAvgMs.toFixed(2)} ms, máx ${i.tickMaxMs.toFixed(1)} ms de ${i.tickBudgetMs.toFixed(0)} ms (${load}% do orçamento)`,
    `Memória: ${i.rssMb} MB (heap ${i.heapMb} MB) · erros isolados: ${i.errors}`,
  ];
}
