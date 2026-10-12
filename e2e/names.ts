// Nomes de personagem dos testes E2E. O servidor de teste recebe TODOS em LEMONQUEST_ADMINS (comandos /level, /tp…).
// Um banco novo a cada execução: cada teste pega o próximo nome livre (o servidor recusa nomes repetidos).
const A = "abcdefghijklmnopqrstuvwxyz";

/** 8*26 nomes: "Qa Aa", "Qa Ab", … "Qa Hz". */
export const E2E_NAMES: string[] = [];
for (const a of A.slice(0, 8)) for (const b of A) E2E_NAMES.push(`Qa ${a.toUpperCase()}${b}`);

export const E2E_PORT = Number(process.env.E2E_PORT ?? 2851);
