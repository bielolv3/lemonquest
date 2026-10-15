// Janela de troca: sua oferta × oferta do outro, mochila para escolher, e confirmação dos dois lados.
import { itemDef, type ItemInstance, type TradeSideView } from "@lemonquest/shared";
import { useEffect, useState } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { inventoryStore } from "../items/inventory.ts";
import { ItemIcon } from "../items/ItemIcon.tsx";
import { acceptTrade, cancelTrade, confirmTrade, declineTrade, offerGold, offerItem, tradeStore, unofferItem } from "./trade.ts";
import "../party/party.css";
import "./trade.css";

const nameOf = (i: ItemInstance) => itemDef(i.defId)?.name ?? i.defId;

function Offer({ side, editable, title }: { side: TradeSideView; editable: boolean; title: string }) {
  const [gold, setGold] = useState(String(side.gold));
  useEffect(() => setGold(String(side.gold)), [side.gold]);
  return (
    <section class={`trade-side${side.confirmed ? " confirmed" : ""}`} aria-label={title}>
      <header class="trade-side-head">
        <span>{title}</span>
        {side.confirmed && <span class="trade-ok" data-testid="trade-confirmed">✓ confirmou</span>}
      </header>
      <ul class="trade-items">
        {side.items.length === 0 && <li class="trade-empty">Nenhum item</li>}
        {side.items.map((i) => (
          <li key={i.uid}>
            <button class="trade-item" disabled={!editable} onClick={() => unofferItem(i.uid)} data-tip={editable ? "Tirar da oferta" : undefined} data-offer-item={i.defId}>
              <ItemIcon inst={i} box={32} />
              <span class="trade-item-name">{nameOf(i)}{i.count > 1 ? ` ×${i.count}` : ""}</span>
            </button>
          </li>
        ))}
      </ul>
      <label class="trade-gold">
        <span>Ouro</span>
        <input
          type="number" min={0} inputMode="numeric" value={gold} readOnly={!editable} aria-label={`Ouro (${title})`}
          onInput={(e) => setGold((e.target as HTMLInputElement).value)}
          onBlur={() => { if (editable && Number(gold) !== side.gold) offerGold(Number(gold)); }}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        />
      </label>
    </section>
  );
}

export function TradeWindow() {
  const st = useStore(tradeStore);
  const inv = useStore(inventoryStore);
  if (st.phase === "closed") return null;
  if (st.phase === "invite") {
    return (
      <div class="trade-invite panel" role="alertdialog" aria-label={`Convite de troca de ${st.from}`}>
        <span class="trade-invite-text"><b>{st.from}</b> quer trocar itens com você.</span>
        <span class="trade-invite-btns">
          <button class="party-btn primary" onClick={acceptTrade}>Aceitar</button>
          <button class="party-btn" onClick={declineTrade}>Recusar</button>
        </span>
      </div>
    );
  }
  const offered = new Set(st.mine.items.map((i) => i.uid));
  const mineConfirmed = st.mine.confirmed;
  const status = mineConfirmed
    ? (st.theirs.confirmed ? "Trocando…" : `Aguardando ${st.partner} confirmar…`)
    : (st.theirs.confirmed ? `${st.partner} já confirmou.` : "Os dois precisam confirmar.");
  return (
    <div class="trade-window panel" role="dialog" aria-label={`Troca com ${st.partner}`} onKeyDown={(e) => { if (e.key === "Escape") cancelTrade(); }}>
      <div class="trade-title">
        <b>Troca com {st.partner}</b>
        <button class="trade-x" onClick={cancelTrade} aria-label="Cancelar a troca" data-tip="Cancelar a troca">×</button>
      </div>
      <div class="trade-cols">
        <Offer side={st.mine} editable title="Sua oferta" />
        <Offer side={st.theirs} editable={false} title={`Oferta de ${st.partner}`} />
      </div>
      <div class="trade-bag-title">Sua mochila <span class="trade-hint">clique para ofertar · Shift: só 1</span></div>
      <div class="trade-bag">
        {(inv?.backpack ?? []).map((it) => it && (
          <button
            key={it.uid} class={`trade-bag-item${offered.has(it.uid) ? " used" : ""}`} disabled={offered.has(it.uid)}
            data-bag-item={it.defId} data-tip={nameOf(it)}
            onClick={(e) => offerItem(it, e.shiftKey ? 1 : it.count)}
          >
            <ItemIcon inst={it} box={32} />
          </button>
        ))}
      </div>
      <div class="trade-foot">
        <span class="trade-status">{status}</span>
        <button class={`party-btn${mineConfirmed ? "" : " primary"}`} onClick={() => confirmTrade(!mineConfirmed)} data-testid="trade-confirm">
          {mineConfirmed ? "Desfazer confirmação" : "Confirmar troca"}
        </button>
        <button class="party-btn" onClick={cancelTrade}>Cancelar</button>
      </div>
    </div>
  );
}
