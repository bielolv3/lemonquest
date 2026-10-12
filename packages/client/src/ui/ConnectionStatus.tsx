import { useEffect, useState } from "preact/hooks";
import { CLOSE_TRAINING } from "@lemonquest/shared";
import { closeMessage, session } from "../session.ts";
import { SKILL_NAMES, trainingSkill } from "./training/training.ts";

/** Banner "Reconectando..." (não bloqueia) e overlay "Você foi desconectado" (bloqueia). */
export function ConnectionStatus() {
  const [, tick] = useState(0);
  useEffect(() => session.onStatus(() => tick((n) => n + 1)), []);

  if (session.status === "reconnecting") {
    return <div class="conn-banner panel" role="status">Reconectando...</div>;
  }
  if (session.status === "closed") {
    const info = session.closeInfo;
    // Recarregar volta à LISTA DE PERSONAGENS se a sessão da conta (sessionStorage) ainda valer (ver Login).
    const back = session.accountSession ? "Voltar aos personagens" : "Voltar ao login";
    if (info?.code === CLOSE_TRAINING) {
      const skill = trainingSkill();
      return (
        <div class="conn-overlay" role="alertdialog" aria-modal="true">
          <div class="panel conn-card">
            <h2>Treinamento offline</h2>
            <p>Seu personagem está treinando{skill ? ` ${SKILL_NAMES[skill]}` : ""}. Volte quando quiser!</p>
            <button class="btn" autoFocus onClick={() => location.reload()}>{back}</button>
          </div>
        </div>
      );
    }
    return (
      <div class="conn-overlay" role="alertdialog" aria-modal="true">
        <div class="panel conn-card">
          <h2>Você foi desconectado</h2>
          <p>{closeMessage(info?.code ?? 0, info?.reason)}</p>
          {/* Recarregar a página é o reset mais limpo: zera Phaser, stores e sala. */}
          <button class="btn" autoFocus onClick={() => location.reload()}>{back}</button>
        </div>
      </div>
    );
  }
  return null;
}
