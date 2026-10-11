import { Schema, MapSchema, type } from "@colyseus/schema";
import type { PlayerView, Vocation } from "@tibinha/shared";

/** Deve espelhar PlayerView (packages/shared/src/types.ts). */
export class PlayerState extends Schema implements PlayerView {
  @type("string") id = "";
  @type("string") name = "";
  @type("string") vocation: Vocation = "knight";
  @type("uint16") level = 1;
  @type("uint16") x = 0;
  @type("uint16") y = 0;
  @type("uint8") dir = 4;
  @type("uint16") stepMs = 0;
  @type("uint32") seq = 0;
}

export class WorldState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
