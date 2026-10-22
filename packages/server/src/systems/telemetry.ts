// Telemetria de progressão (ciclo 9): tempo jogado, mortes e ouro ganho/gasto por level, por personagem. Fica em
// `CharacterData.play` e alimenta o /status com médias por faixa de level — é o dado que faltava para calibrar o
// balanço do ciclo 8 (pendência "medir playedMs/mortes por level" dos ciclos 7 e 8). Puro: o WorldRoom liga os ganchos
// (entrada, level up, morte, ouro) e chama `serialize` ao gravar o personagem.

export interface LevelStats { ms: number; deaths: number; goldIn: number; goldOut: number }
export interface PlayData { ms: number; byLevel: Record<string, LevelStats> }

interface Live { level: number; since: number; data: PlayData }

const emptyStats = (): LevelStats => ({ ms: 0, deaths: 0, goldIn: 0, goldOut: 0 });

function cloneData(d: PlayData): PlayData {
  const byLevel: Record<string, LevelStats> = {};
  for (const [k, v] of Object.entries(d.byLevel ?? {})) byLevel[k] = { ...emptyStats(), ...v };
  return { ms: d.ms ?? 0, byLevel };
}

/** Faixas de level do resumo (a última é aberta). */
export const LEVEL_BANDS: readonly (readonly [number, number])[] = [[1, 9], [10, 19], [20, 39], [40, 59], [60, 79], [80, 99], [100, 999]];
/** Faixa só entra no resumo com pelo menos isto de tempo jogado somado. */
export const SUMMARY_MIN_MS = 10 * 60_000;

export class PlayTelemetry {
  private live = new Map<string, Live>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Entrou no mundo: continua a contagem a partir do que estava salvo. */
  onJoin(id: string, level: number, saved: PlayData | undefined): void {
    this.live.set(id, { level, since: this.now(), data: saved ? cloneData(saved) : { ms: 0, byLevel: {} } });
  }

  private bucket(l: Live, level = l.level): LevelStats {
    const k = String(level);
    return (l.data.byLevel[k] ??= emptyStats());
  }

  /** Passa o tempo decorrido para o level atual. */
  private flush(l: Live): void {
    const t = this.now(), dt = Math.max(0, t - l.since);
    l.since = t;
    if (dt > 0) { l.data.ms += dt; this.bucket(l).ms += dt; }
  }

  /** Mudou de level (para cima pelo jogo ou por comando de dev): o tempo até aqui fica no level antigo. */
  onLevel(id: string, level: number): void {
    const l = this.live.get(id);
    if (!l || l.level === level) return;
    this.flush(l);
    l.level = level;
  }

  onDeath(id: string): void { const l = this.live.get(id); if (l) this.bucket(l).deaths++; }
  onGold(id: string, n: number): void { const l = this.live.get(id); if (l && n > 0) this.bucket(l).goldIn += Math.floor(n); }
  onSpend(id: string, n: number): void { const l = this.live.get(id); if (l && n > 0) this.bucket(l).goldOut += Math.floor(n); }

  /** Estado para gravar em `CharacterData.play` (cópia, com o tempo até agora já contado no level `level`). */
  serialize(id: string, level: number): PlayData | undefined {
    const l = this.live.get(id);
    if (!l) return undefined;
    this.onLevel(id, level);
    this.flush(l);
    return cloneData(l.data);
  }

  removePlayer(id: string): void { this.live.delete(id); }

  /** Tempo jogado total de uma sessão viva (ms), para o /status. */
  liveMs(id: string): number { const l = this.live.get(id); return l ? l.data.ms + Math.max(0, this.now() - l.since) : 0; }
}

/** Resumo por faixa de level a partir dos dados salvos (de todos os personagens) + sessões vivas. */
export function summarizePlay(all: Iterable<PlayData | undefined>): string[] {
  const bands = LEVEL_BANDS.map(() => ({ ms: 0, levels: 0, deaths: 0, gold: 0 }));
  for (const d of all) {
    if (!d) continue;
    for (const [k, v] of Object.entries(d.byLevel ?? {})) {
      const lv = Number(k);
      const i = LEVEL_BANDS.findIndex(([a, b]) => lv >= a && lv <= b);
      if (i < 0 || !(v.ms > 0)) continue;
      const b = bands[i]!;
      b.ms += v.ms; b.levels++; b.deaths += v.deaths ?? 0; b.gold += (v.goldIn ?? 0) - (v.goldOut ?? 0);
    }
  }
  const parts: string[] = [];
  LEVEL_BANDS.forEach(([a, b], i) => {
    const s = bands[i]!;
    if (s.ms < SUMMARY_MIN_MS) return;
    const hours = s.ms / 3_600_000;
    const label = b >= 999 ? `${a}+` : `${a}–${b}`;
    parts.push(`${label}: ${(hours / s.levels).toFixed(2)} h/level · ${(s.deaths / hours).toFixed(1)} mortes/h · ${fmtGold(s.gold / hours)} ouro/h`);
  });
  return parts.length ? [`Progressão medida (por faixa): ${parts.join(" | ")}`] : ["Progressão medida: ainda sem 10 min jogados em nenhuma faixa."];
}

function fmtGold(n: number): string {
  const sign = n < 0 ? "−" : "+";
  const v = Math.abs(n);
  return `${sign}${v >= 1000 ? `${(v / 1000).toFixed(1)} mil` : Math.round(v)}`;
}
