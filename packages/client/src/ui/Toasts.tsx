import { useEffect, useState } from "preact/hooks";
import { S2C, type NoticeMsg } from "@lemonquest/shared";
import { session } from "../session.ts";
import { onToast } from "./toasts.ts";

interface Toast extends NoticeMsg { id: number; life: number }
let nextId = 1;

/** Tempo na tela: 3 s + 40 ms por caractere (avisos longos, como o de porta selada), até 8 s. */
export const toastLifeMs = (text: string): number => Math.min(8000, 3000 + 40 * text.length);

export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const show = (m: NoticeMsg) => {
      const t = { ...m, id: nextId++, life: toastLifeMs(String(m?.text ?? "")) };
      setToasts((l) => [...l.slice(-3), t]);
      setTimeout(() => setToasts((l) => l.filter((x) => x.id !== t.id)), t.life);
    };
    const off = onToast(show);
    const offRoom = session.onRoom((room) => { room.onMessage(S2C.Notice, show); });
    return () => { off(); offRoom(); };
  }, []);

  return (
    <div class="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class={`panel toast ${t.kind ?? "info"}`} style={{ animationDuration: `${t.life}ms` }}>{t.text}</div>
      ))}
    </div>
  );
}
