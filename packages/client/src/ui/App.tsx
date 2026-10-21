import { useEffect, useState } from "preact/hooks";
import { session } from "../session.ts";
import { Login } from "./Login.tsx";
import { useLoginReady } from "./loading.ts";
import { Chat } from "./Chat.tsx";
import { Toasts } from "./Toasts.tsx";
import { PartyInvites } from "./party/PartyInvites.tsx";
import { TradeWindow } from "./trade/TradeWindow.tsx";
import { EventBadge } from "./events/EventBadge.tsx";
import { MatchBar } from "./arena/ArenaHud.tsx";
import { FeedTicker } from "./items/LootToasts.tsx";
import { NewsWindow } from "./news/NewsWindow.tsx";
import { ChallengesWindow } from "./challenges/ChallengesWindow.tsx";
import { BestiaryWindow } from "./bestiary/Bestiary.tsx";
import { Hud } from "./hud/Hud.tsx";
import { TeleportFade } from "./fx/TeleportFade.tsx";
import { CombatOverlays } from "./combat/CombatOverlays.tsx";
import { ConnectionStatus } from "./ConnectionStatus.tsx";
import { Announce } from "./Announce.tsx";
import { FXTEST } from "../game/fxtest.ts";
import { UITEST } from "./uitest/flag.ts";
import { WorldMapOverlay, ZoneBanner } from "./minimap/Minimap.tsx";

export function App() {
  const [connected, setConnected] = useState(false);

  useEffect(() => session.onRoom(() => setConnected(true)), []);
  useEffect(() => { if (UITEST) void import("./uitest/harness.ts").then((m) => m.startUiTest()); }, []);

  // O login só aparece com o mapa pronto (ou após 15 s): nada de caixa de login sobre tela preta.
  const loginReady = useLoginReady();
  if (!connected && !FXTEST && !UITEST) return loginReady ? <Login /> : null;
  return (
    <>
      <Hud />
      {/* Centro do topo numa pilha só (nada se sobrepõe): evento, barra do Coliseu, avisos e notícias. */}
      <div class="top-stack">
        <EventBadge />
        <MatchBar />
        <Toasts />
        <FeedTicker />
      </div>
      <PartyInvites />
      <TradeWindow />
      <NewsWindow />
      <ChallengesWindow />
      <BestiaryWindow />
      <Chat />
      <WorldMapOverlay />
      <ZoneBanner />
      <Announce />
      <TeleportFade />
      <CombatOverlays />
      <ConnectionStatus />
    </>
  );
}
