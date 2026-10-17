import { Client } from "@colyseus/sdk";

// Em dev o servidor roda na 2567 (VITE_SERVER_PORT troca: o Docker de dev usa 2568); em produção ele serve o
// cliente na mesma origem.
export const endpoint = import.meta.env.DEV
  ? `${location.protocol}//${location.hostname}:${import.meta.env.VITE_SERVER_PORT || 2567}`
  : location.origin;

export const client = new Client(endpoint);
