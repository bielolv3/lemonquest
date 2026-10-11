// Janela de NPC: fala com digitação, abas Comprar / Vender / Depot.
import { DEPOT_SIZE, itemDef, type NpcOpenMsg } from "@tibinha/shared";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useStore } from "../hud/store.ts";
import { npcBuys } from "../items/actions.ts";
import { GoldLabel, Coin } from "../items/Gold.tsx";
import { defOf, depotStore, inventoryStore } from "../items/inventory.ts";
import { fmtNum, rarityColor, sellPrice } from "../items/itemInfo.ts";
import { ItemIcon } from "../items/ItemIcon.tsx";
import { ItemSlot } from "../items/ItemSlot.tsx";
import { itemTipStore, shopInstance } from "../items/tipStore.ts";
import { buyItem, closeNpc, npcStore, npcTabs, sellItem, setNpcTab, type NpcTab } from "./npc.ts";
import "./npc.css";

const TAB_LABEL: Record<NpcTab, string> = { buy: "Comprar", sell: "Vender", depot: "Depot" };
const TYPE_MS = 25;

export function NpcWindow() {
  const st = useStore(npcStore);
  const inv = useStore(inventoryStore);
  if (!st) return null;
  const m = st.msg;
  const tabs = npcTabs(m);
  return (
    <div class="hud-card hud-window npc-window" role="dialog" aria-label={m.name}>
      <div class="win-title npc-title">
        <span class="win-grip" />
        <span>{m.name}</span>
        <GoldLabel gold={inv?.gold ?? 0} unit={false} class="npc-gold" />
        <button class="win-close" onClick={closeNpc} data-tip="Fechar" data-tip-sub="Esc" aria-label="Fechar">×</button>
      </div>
      <div class="npc-body">
        <Typewriter text={m.greeting} nonce={st.nonce} />
        {tabs.length > 0 && (
          <div class="npc-tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t} class={`npc-tab${st.tab === t ? " active" : ""}`} role="tab" aria-selected={st.tab === t} onClick={() => setNpcTab(t)}>
                {TAB_LABEL[t]}
              </button>
            ))}
          </div>
        )}
        {st.tab === "buy" && m.shop && <BuyList m={m} gold={inv?.gold ?? 0} />}
        {st.tab === "sell" && m.shop && <SellList m={m} />}
        {st.tab === "depot" && m.depot && <DepotGrid />}
      </div>
    </div>
  );
}

function Typewriter({ text, nonce }: { text: string; nonce: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const t = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) { clearInterval(t); return v; }
        return v + 1;
      });
    }, TYPE_MS);
    return () => clearInterval(t);
  }, [text, nonce]);
  return (
    <div class="npc-say" onClick={() => setN(text.length)} data-tip={n < text.length ? "Clique para pular" : undefined}>
      <span>{text.slice(0, n)}</span>
      <span class="npc-say-rest">{text.slice(n)}</span>
    </div>
  );
}

function BuyList({ m, gold }: { m: NpcOpenMsg; gold: number }) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const rows = m.shop!.sells;
  return (
    <ul class="shop-list">
      {rows.map((r) => {
        const def = itemDef(r.itemId);
        const stack = !!def?.stackable;
        const max = stack ? Math.min(def?.maxStack ?? 100, 99) : 1;
        const q = Math.min(max, Math.max(1, qty[r.itemId] ?? 1));
        const total = r.price * q;
        const afford = gold >= total;
        const set = (v: number) => setQty((s) => ({ ...s, [r.itemId]: Math.max(1, Math.min(max, v)) }));
        return (
          <li key={r.itemId} class="shop-row">
            <div
              class="shop-icon"
              onPointerEnter={(e) => {
                const rc = (e.currentTarget as HTMLElement).getBoundingClientRect();
                itemTipStore.set({ inst: shopInstance(r.itemId), rect: { left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom } });
              }}
              onPointerLeave={() => itemTipStore.set(null)}
            >
              <ItemIcon def={def} box={32} count={false} framed />
            </div>
            <div class="shop-main">
              <div class="shop-name">{def?.name ?? r.itemId}</div>
              <div class="shop-price"><Coin size={14} /><span class={afford ? "" : "bad"}>{fmtNum(r.price)}</span>{q > 1 && <small> · total {fmtNum(total)}</small>}</div>
            </div>
            {stack && (
              <div class="qty">
                <button onClick={(e) => set(q - (e.shiftKey ? 10 : 1))} aria-label="Menos">−</button>
                <span>{q}</span>
                <button onClick={(e) => set(q + (e.shiftKey ? 10 : 1))} aria-label="Mais">+</button>
              </div>
            )}
            <button class="shop-btn" disabled={!afford} onClick={() => buyItem(m.npcId, r.itemId, q)} data-tip={afford ? undefined : "Ouro insuficiente"}>
              Comprar
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SellList({ m }: { m: NpcOpenMsg }) {
  const inv = useStore(inventoryStore);
  const rows = useMemo(() => {
    const out: { index: number; price: number }[] = [];
    (inv?.backpack ?? []).forEach((it, index) => {
      const def = defOf(it);
      if (it && def && npcBuys(def, m)) out.push({ index, price: sellPrice(def, m.shop?.sellRatio ?? 0.3, it.rarity) });
    });
    return out;
  }, [inv, m]);
  if (rows.length === 0) return <div class="hud-empty">Nada na mochila que {m.name.split(",")[0]} compre.</div>;
  return (
    <ul class="shop-list">
      {rows.map(({ index, price }) => {
        const it = inv!.backpack[index]!;
        const def = defOf(it);
        return (
          <li key={it.uid} class="shop-row">
            <div
              class="shop-icon"
              onPointerEnter={(e) => {
                const rc = (e.currentTarget as HTMLElement).getBoundingClientRect();
                itemTipStore.set({ inst: it, loc: { where: "backpack", index }, rect: { left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom } });
              }}
              onPointerLeave={() => itemTipStore.set(null)}
            >
              <ItemIcon inst={it} box={32} framed />
            </div>
            <div class="shop-main">
              <div class="shop-name" style={{ color: rarityColor(it.rarity) }}>{def?.name ?? it.defId}</div>
              <div class="shop-price"><Coin size={14} /><span>{fmtNum(price)}</span>{it.count > 1 && <small> cada · {fmtNum(price * it.count)} no total</small>}</div>
            </div>
            <button
              class="shop-btn"
              onClick={(e) => sellItem(m.npcId, index, e.shiftKey ? it.count : 1)}
              data-tip={it.count > 1 ? "Vender 1" : "Vender"}
              data-tip-sub={it.count > 1 ? `Shift: vender os ${it.count}` : undefined}
            >
              Vender
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function DepotGrid() {
  const depot = useStore(depotStore);
  return (
    <div class="depot">
      <div class="depot-hint">Arraste itens entre a mochila e o depot · Shift para dividir pilhas</div>
      <div class="depot-grid">
        {Array.from({ length: DEPOT_SIZE }, (_, i) => (
          <ItemSlot key={i} loc={{ where: "depot", index: i }} inst={depot?.[i]} size={40} class="depot-slot" />
        ))}
      </div>
    </div>
  );
}
