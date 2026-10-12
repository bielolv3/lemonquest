// Janela de ranking (tecla R): top 10 por categoria, recorde do Coliseu. Dados de GET /api/ranking (cache de 30 s).
import { useEffect, useState } from "preact/hooks";
import type { RankingCategoryId } from "@lemonquest/shared";
import { useStore } from "../hud/store.ts";
import { fmtNum, loadRanking, rankingOpen, rankingStore } from "./achievements.ts";
import "./achievements.css";

const PAGE_URL = import.meta.env.DEV ? "/ranking.html" : "/ranking";

export function RankingWindow() {
  const open = useStore(rankingOpen);
  if (!open) return null;
  return <RankingDialog />;
}

function RankingDialog() {
  const { data, error } = useStore(rankingStore);
  const [cat, setCat] = useState<RankingCategoryId>("level");
  useEffect(() => { void loadRanking(); }, []);
  const c = data?.categories.find((x) => x.id === cat);

  return (
    <div class="hud-card hud-window rank-win" role="dialog" aria-label="Ranking">
      <div class="win-title">
        <span class="win-grip" aria-hidden="true" />
        <span>Ranking</span>
        <button class="win-close" onClick={() => rankingOpen.set(false)} data-tip="Fechar" data-tip-sub="R ou Esc">×</button>
      </div>
      <div class="rank-tabs" role="tablist">
        {(data?.categories ?? []).map((x) => (
          <button key={x.id} role="tab" aria-selected={cat === x.id} class={`ach-filter${cat === x.id ? " on" : ""}`} onClick={() => setCat(x.id)}>
            {x.title}
          </button>
        ))}
      </div>
      <div class="rank-body">
        {!data && !error && <div class="ach-empty">Carregando…</div>}
        {error && <div class="ach-empty">Não foi possível carregar o ranking.</div>}
        {c && (
          <table class="rank-table">
            <thead><tr><th>#</th><th>Personagem</th><th>Lv</th><th class="num">{c.unit}</th></tr></thead>
            <tbody>
              {c.entries.map((e) => (
                <tr key={e.rank} class={e.rank <= 3 ? `top${e.rank}` : ""}>
                  <td>{e.rank}</td><td>{e.name}</td><td>{e.level}</td><td class="num">{fmtNum(e.value)}</td>
                </tr>
              ))}
              {c.entries.length === 0 && <tr><td colspan={4} class="ach-empty">Ninguém ainda.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
      <div class="rank-foot">
        {data && <span>Recorde do Coliseu: <b>{data.arenaServerBest > 0 ? `${data.arenaServerBest} ondas` : "—"}</b></span>}
        <a href={PAGE_URL} target="_blank" rel="noopener">Página pública</a>
      </div>
    </div>
  );
}
