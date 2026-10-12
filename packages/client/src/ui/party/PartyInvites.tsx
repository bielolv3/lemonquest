// Convites de grupo recebidos: cartão no topo com "Aceitar" / "Recusar" (expira sozinho; também /aceitar no chat).
import { useStore } from "../hud/store.ts";
import { answerInvite, invitesStore } from "./party.ts";
import "./party.css";

export function PartyInvites() {
  const list = useStore(invitesStore);
  if (!list.length) return null;
  return (
    <div class="party-invites">
      {list.map((i) => (
        <div key={i.fromId} class="panel party-invite" role="alertdialog" aria-label={`Convite de ${i.fromName}`}>
          <span class="party-invite-text"><b>{i.fromName}</b> te convidou para o grupo.</span>
          <span class="party-invite-btns">
            <button class="party-btn primary" onClick={() => answerInvite(i.fromId, true)}>Aceitar</button>
            <button class="party-btn" onClick={() => answerInvite(i.fromId, false)}>Recusar</button>
          </span>
        </div>
      ))}
    </div>
  );
}
