// Etiqueta do evento com bônus: nome, bônus e horário de término, no topo da área de jogo.
import { eventBonusText } from "@lemonquest/shared";
import { useStore } from "../hud/store.ts";
import { eventStore } from "./events.ts";
import "./events.css";

const hhmm = (ms: number) => new Date(ms).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function EventBadge() {
  const e = useStore(eventStore);
  if (!e) return null;
  return (
    <div class="event-badge" role="status" aria-label={`Evento: ${e.name}`} data-testid="event-badge" data-tip={e.desc} data-tip-sub={`Termina às ${hhmm(e.until)}`}>
      <span class="event-star" aria-hidden="true">★</span>
      <b>{e.name}</b>
      <span class="event-bonus">{eventBonusText(e)}</span>
      <span class="event-until">até {hhmm(e.until)}</span>
    </div>
  );
}
