// Transporte de mensagens da UI de itens/NPC. O harness ?uitest troca o transporte por um servidor falso.
import { session } from "../../session.ts";

type Transport = (type: string, msg: unknown) => void;
let transport: Transport = (type, msg) => { session.room?.send(type, msg); };

export const setItemTransport = (fn: Transport): void => { transport = fn; };
export const send = (type: string, msg: unknown): void => transport(type, msg);
