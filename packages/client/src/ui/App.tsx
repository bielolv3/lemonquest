import { useEffect, useState } from "preact/hooks";
import { session } from "../session.ts";
import { Login } from "./Login.tsx";
import { Chat } from "./Chat.tsx";
import { Toasts } from "./Toasts.tsx";
import { Hud } from "./hud/Hud.tsx";
import { TeleportFade } from "./fx/TeleportFade.tsx";
import { CombatOverlays } from "./combat/CombatOverlays.tsx";
import { FXTEST } from "../game/fxtest.ts";
import { WorldMapOverlay, ZoneBanner } from "./minimap/Minimap.tsx";

export function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => session.onRoom(() => setConnected(true)), []);

  if (!connected && !FXTEST) return <Login />;
  return (
    <>
      <Hud />
      <Toasts />
      <Chat />
      <WorldMapOverlay />
      <ZoneBanner />
      <TeleportFade />
      <CombatOverlays />
    </>
  );
}
