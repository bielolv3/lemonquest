import { useEffect, useState } from "preact/hooks";
import { S2C, type NoticeMsg } from "@tibinha/shared";
import { session } from "../session.ts";

interface Toast extends NoticeMsg { id: number }
const LIFETIME_MS = 3000;
let nextId = 1;

export function Toasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => session.onRoom((room) => {
    room.onMessage(S2C.Notice, (m: NoticeMsg) => {
      const t = { ...m, id: nextId++ };
      setToasts((l) => [...l, t]);
      setTimeout(() => setToasts((l) => l.filter((x) => x.id !== t.id)), LIFETIME_MS);
    });
  }), []);

  return (
    <div class="toasts">
      {toasts.map((t) => (
        <div key={t.id} class={`panel toast ${t.kind ?? "info"}`}>{t.text}</div>
      ))}
    </div>
  );
}
