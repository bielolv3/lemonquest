// Primeiros passos: cartão curto só para o personagem NOVO (level 1, sem XP). Some ao fechar ou no primeiro abate e não
// volta mais para esse personagem (localStorage). Sem tutorial forçado — estilo Tibia: o mundo ensina, o cartão aponta.
import { useState } from "preact/hooks";
import { session } from "../../session.ts";
import { useStore } from "./store.ts";
import { meStore } from "./world.ts";

const key = (name: string) => `lemonquest.firstSteps.${name.normalize("NFC").toLowerCase()}`;
const seen = (name: string): boolean => { try { return localStorage.getItem(key(name)) === "1"; } catch { return false; } };
const markSeen = (name: string) => { try { localStorage.setItem(key(name), "1"); } catch { /* indisponível */ } };

export function FirstSteps() {
  const me = useStore(meStore);
  const [closed, setClosed] = useState(false);
  const name = session.myName;
  if (!me || !name || closed || seen(name)) return null;
  // Já ganhou XP (primeiro abate) ou não é personagem novo: não mostra e não volta.
  if (me.level > 1 || me.xp > 0) { markSeen(name); return null; }
  const close = () => { markSeen(name); setClosed(true); };
  return (
    <div class="first-steps" role="note" aria-label="Primeiros passos">
      <div class="first-steps-title">Primeiros passos</div>
      <ul>
        <li><b>Andar:</b> W A S D, setas ou clique no chão.</li>
        <li><b>Atacar:</b> clique numa criatura — comece pelos <b>ratos</b> na floresta ao norte da praça.</li>
        <li><b>Missão:</b> fale com o <b>Capitão Rodrigo</b> (o <b>!</b> sobre a cabeça) e com o Quadro de Recompensas.</li>
        <li><b>Q</b> bebe poção de vida · <b>F1</b> mostra todos os atalhos.</li>
      </ul>
      <button class="btn first-steps-ok" onClick={close}>Entendi</button>
    </div>
  );
}
