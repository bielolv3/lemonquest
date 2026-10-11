// Lista de criaturas/jogadores próximos. Clique seleciona o alvo (target.ts).
import { useEffect, useMemo } from "preact/hooks";
import { session } from "../../session.ts";
import { battleSourcesStore, buildBattleList, BATTLE_RANGE, type BattleEntry } from "./battle.ts";
import { FightModeControls } from "./FightMode.tsx";
import { Section } from "./Section.tsx";
import { useStore } from "./store.ts";
import { clearTarget, targetStore, toggleTarget } from "./target.ts";
import { vocationMeta } from "./vocations.ts";
import { playersStore } from "./world.ts";

const hpColor = (pct: number) => (pct > 60 ? "#5bbf5b" : pct > 30 ? "#d9a441" : pct > 10 ? "#d9534f" : "#8f2a2a");

/** Lista pura (recebe entradas prontas) — reutilizável por outras fontes. */
export function BattleRows({ entries }: { entries: BattleEntry[] }) {
  const target = useStore(targetStore);
  if (entries.length === 0) {
    return (
      <div class="hud-empty battle-empty">
        <span class="battle-empty-dot" />
        Ninguém por perto
      </div>
    );
  }
  return (
    <ul class="battle-list">
      {entries.map((e) => {
        const sel = target?.id === e.id && target.kind === e.kind;
        return (
          <li key={`${e.kind}:${e.id}`}>
            <button
              class={`battle-row ${e.kind}${sel ? " selected" : ""}`}
              style={e.color ? ({ "--row-accent": e.color } as any) : undefined}
              onClick={() => toggleTarget({ id: e.id, kind: e.kind })}
              data-tip={e.name}
              data-tip-sub={`${e.kind === "player" ? "Jogador" : "Criatura"} · ${e.distance} sqm · ${e.hpPct}% HP`}
            >
              <span class="battle-mark" aria-hidden="true" />
              <span class="battle-main">
                <span class="battle-name">{e.name}</span>
                <span class="battle-hp">
                  <span style={{ width: `${e.hpPct}%`, background: hpColor(e.hpPct) }} />
                </span>
              </span>
              <span class="battle-dist">{e.distance}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function BattleList() {
  const players = useStore(playersStore);
  const extra = useStore(battleSourcesStore);
  const entries = useMemo(() => {
    const list = buildBattleList(players, session.myId, extra, BATTLE_RANGE);
    for (const e of list) if (e.kind === "player" && !e.color) e.color = vocationMeta(players.get(e.id)?.vocation ?? "").color;
    return list;
  }, [players, extra]);
  const target = useStore(targetStore);

  // Alvo que saiu do jogo deixa de existir.
  useEffect(() => {
    if (target?.kind === "player" && !players.has(target.id)) clearTarget();
  }, [players, target]);

  return (
    <Section id="battle" title="Batalha" aside={<span class="count-chip">{entries.length}</span>} class="battle-section" controls={<FightModeControls />}>
      <BattleRows entries={entries} />
    </Section>
  );
}
