import { Client } from "@colyseus/sdk";

// Em dev o servidor roda na 2567; em produção ele serve o cliente na mesma origem.
export const endpoint = import.meta.env.DEV
  ? `${location.protocol}//${location.hostname}:2567`
  : location.origin;

export const client = new Client(endpoint);
