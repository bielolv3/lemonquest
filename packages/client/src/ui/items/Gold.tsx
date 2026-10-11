// Moeda de ouro (ícone) e rótulo "1.234 ouro".
import { assetUrl } from "./ItemIcon.tsx";
import { fmtNum } from "./itemInfo.ts";

const COIN = "ninja/Items/Treasure/GoldCoin.png";

/** Moeda 16x16 (imagem do pack), nítida. */
export function Coin({ size = 14 }: { size?: number }) {
  return <span class="coin" style={{ width: `${size}px`, height: `${size}px`, backgroundImage: `url("${assetUrl(COIN)}")` }} aria-hidden="true" />;
}

export function GoldLabel({ gold, unit = true, class: cls }: { gold: number; unit?: boolean; class?: string }) {
  return (
    <span class={`gold-label${cls ? ` ${cls}` : ""}`} data-tip="Ouro">
      <Coin size={14} />
      <span class="gold-num">{fmtNum(gold)}{unit ? " ouro" : ""}</span>
    </span>
  );
}
