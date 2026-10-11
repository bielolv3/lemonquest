// Vinheta vermelha nas bordas quando o HP está abaixo de 30% (pulsa mais forte abaixo de 15%).
import { useStore } from "./store.ts";
import { playersStore, selectMe } from "./world.ts";

export function LowHpVignette() {
  const me = selectMe(useStore(playersStore));
  const pct = me && me.maxHp > 0 ? me.hp / me.maxHp : 1;
  const level = me && me.hp > 0 && pct < 0.15 ? " critical" : pct < 0.3 ? " low" : "";
  return <div class={`vignette${level}`} aria-hidden="true" />;
}
