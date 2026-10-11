// Slot de item genérico (mochila/equipamento/depot): arrasto, duplo clique/botão direito, balão de detalhes.
import type { ItemInstance, ItemLocation } from "@tibinha/shared";
import type { ComponentChildren } from "preact";
import { useStore } from "../hud/store.ts";
import { activateItem } from "./actions.ts";
import { beginPress, dragStore, locKey } from "./dnd.ts";
import { ItemIcon } from "./ItemIcon.tsx";
import { itemTipStore } from "./tipStore.ts";

interface Props {
  loc: ItemLocation;
  inst: ItemInstance | null | undefined;
  /** Lado do slot em px. */
  size: number;
  /** Conteúdo quando vazio (silhueta). */
  ghost?: ComponentChildren;
  /** Tooltip do slot vazio. */
  tip?: string;
  tipSub?: string;
  class?: string;
}

export function ItemSlot({ loc, inst, size, ghost, tip, tipSub, class: cls }: Props) {
  const drag = useStore(dragStore);
  const key = locKey(loc);
  let state = "";
  if (drag) state = drag.valid.has(key) ? " drop-ok" : " drop-bad";
  if (drag && locKey(drag.from) === key) state += " drag-src";
  const r = inst?.rarity ?? "common";
  return (
    <div
      class={`slot item-slot${inst ? " filled" : ""} rar-${r}${inst && (r === "epic" || r === "legendary") ? " rar-fx" : ""}${state}${cls ? ` ${cls}` : ""}`}
      style={{ width: `${size}px`, height: `${size}px` }}
      data-loc={key}
      data-tip={!inst ? tip : undefined}
      data-tip-sub={!inst ? tipSub : undefined}
      onPointerDown={(e) => { if (inst) beginPress(e, loc, inst); }}
      onContextMenu={(e) => { e.preventDefault(); if (inst) activateItem(loc, inst); }}
      onDblClick={() => { if (inst) activateItem(loc, inst); }}
      onPointerEnter={(e) => {
        if (!inst || dragStore.get()) return;
        const rc = (e.currentTarget as HTMLElement).getBoundingClientRect();
        itemTipStore.set({ inst, loc, rect: { left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom } });
      }}
      onPointerLeave={() => itemTipStore.set(null)}
    >
      {inst ? <ItemIcon inst={inst} box={size - 4} /> : ghost}
    </div>
  );
}
