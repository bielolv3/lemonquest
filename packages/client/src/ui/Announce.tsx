import { useEffect, useState } from "preact/hooks";
import { S2C, type AnnounceMsg } from "@lemonquest/shared";
import { session } from "../session.ts";
import { sfx } from "../game/sfx.ts";

/** Tempo na tela: 6 s + 60 ms por caractere (máx. 14 s). */
const lifeMs = (text: string) => Math.min(14_000, 6000 + text.length * 60);

/** Anúncio de admin (/anuncio): faixa grande no centro da tela para todos. Um novo substitui o anterior. */
export function Announce() {
  const [msg, setMsg] = useState<(AnnounceMsg & { id: number }) | null>(null);

  useEffect(() => {
    let id = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = session.onRoom((room) => {
      room.onMessage(S2C.Announce, (m: AnnounceMsg) => {
        if (!m || typeof m.text !== "string") return;
        clearTimeout(timer);
        const cur = { ...m, id: ++id };
        setMsg(cur);
        sfx.play("levelup", { volume: 0.3 });
        timer = setTimeout(() => setMsg((x) => (x?.id === cur.id ? null : x)), lifeMs(m.text));
      });
    });
    return () => { off(); clearTimeout(timer); };
  }, []);

  if (!msg) return null;
  return (
    <div key={msg.id} class="announce" role="alert" onClick={() => setMsg(null)} title="Clique para fechar">
      <div class="announce-label">Anúncio · {msg.from}</div>
      <div class="announce-text">{msg.text}</div>
    </div>
  );
}
