// Modo E2E (testes Playwright, ver playwright.config.ts): LEMONQUEST_E2E=1 com NODE_ENV != production.
// - o servidor entrega o cliente buildado (packages/client/dist) como em produção (uma porta só);
// - o limite de contas novas por IP (3/h) e de personagens por conta (10/h) é desligado: os testes criam muitas contas
//   a partir de 127.0.0.1.
// NUNCA liga sozinho: exige a variável explícita, e NODE_ENV=production sempre desliga (o servidor do escritório roda assim).
type Env = Record<string, string | undefined>;

export const e2eMode = (env: Env = process.env): boolean => env.LEMONQUEST_E2E === "1" && env.NODE_ENV !== "production";
