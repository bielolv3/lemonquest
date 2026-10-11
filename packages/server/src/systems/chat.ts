// DONO: agente "contas+chat".
import type { Client, Room } from "colyseus";
import type { ChatSendMsg } from "@tibinha/shared";
import type { PlayerState } from "../state.ts";

export function handleChat(_room: Room, _client: Client, _from: PlayerState, _msg: ChatSendMsg): void {}
