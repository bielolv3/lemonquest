import { useEffect, useState } from "preact/hooks";
import { S2C } from "@tibinha/shared";
import { session } from "../../session.ts";

const IN_MS = 120, OUT_MS = 250;

/** Fade preto rápido ao teletransportar (portal). */
export function TeleportFade() {
  const [opacity, setOpacity] = useState(0);
  const [ms, setMs] = useState(IN_MS);

  useEffect(() => {
    let t1: ReturnType<typeof setTimeout> | undefined;
    const off = session.onRoom((room) => {
      room.onMessage(S2C.Teleported, () => {
        setMs(IN_MS); setOpacity(1);
        clearTimeout(t1);
        t1 = setTimeout(() => { setMs(OUT_MS); setOpacity(0); }, IN_MS);
      });
    });
    return () => { off(); clearTimeout(t1); };
  }, []);

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: "#000", pointerEvents: "none", zIndex: 50,
        opacity, transition: `opacity ${ms}ms linear`,
      }}
    />
  );
}
