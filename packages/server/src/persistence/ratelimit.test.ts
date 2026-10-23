// Limitadores do login/criação (auth.ts) e das mensagens do jogo (WorldRoom/ground). Relógio sempre injetado:
// FailureLimiter e RateCounter recebem `now` em cada chamada; PerSecond recebe a função no construtor.
import { describe, expect, it } from "vitest";
import { FailureLimiter, PerSecond, RateCounter } from "./ratelimit.ts";

// Mesmos valores do login (auth.ts): 5 falhas/min → 5 min de bloqueio.
const MAX = 5, WINDOW = 60_000, LOCK = 300_000;
const T0 = 1_000_000;

/** `n` falhas consecutivas em `key`, uma por ms a partir de `at`. Devolve o instante da última. */
function fail(l: FailureLimiter, key: string, n: number, at: number): number {
  let t = at;
  for (let i = 0; i < n; i++) { t = at + i; l.begin(key); l.end(key, true, t); }
  return t;
}

describe("FailureLimiter (falhas de login por IP/conta)", () => {
  it("chave desconhecida ou abaixo do máximo: livre", () => {
    const l = new FailureLimiter(MAX, WINDOW, LOCK);
    expect(l.lockedFor("ip", T0)).toBe(0);
    fail(l, "ip", MAX - 1, T0);
    expect(l.lockedFor("ip", T0 + 10)).toBe(0);
    expect(l.size).toBe(1);
  });

  it("N-ésima falha bloqueia por lockMs; o tempo restante cai e depois libera (falhas zeradas)", () => {
    const l = new FailureLimiter(MAX, WINDOW, LOCK);
    const last = fail(l, "ip", MAX, T0);
    expect(l.lockedFor("ip", last)).toBe(LOCK);
    expect(l.lockedFor("ip", last + 100_000)).toBe(LOCK - 100_000);
    expect(l.lockedFor("ip", last + LOCK)).toBe(0);
    // Depois do bloqueio começa do zero: mais MAX-1 falhas ainda não bloqueiam.
    fail(l, "ip", MAX - 1, last + LOCK + 1);
    expect(l.lockedFor("ip", last + LOCK + 100)).toBe(0);
  });

  it("janela deslizante: falhas antigas (≥ windowMs) não contam mais", () => {
    const l = new FailureLimiter(MAX, WINDOW, LOCK);
    fail(l, "ip", MAX - 1, T0);
    // A 5ª falha chega quando as 4 primeiras já saíram da janela: não bloqueia.
    l.begin("ip"); l.end("ip", true, T0 + WINDOW + 10);
    expect(l.lockedFor("ip", T0 + WINDOW + 11)).toBe(0);
    // Mas mais 4 falhas dentro da nova janela, sim.
    fail(l, "ip", MAX - 1, T0 + WINDOW + 20);
    expect(l.lockedFor("ip", T0 + WINDOW + 30)).toBe(LOCK - 7);
  });

  it("tentativas em andamento (begin) contam: rajada paralela não passa antes da 1ª falha ser registrada", () => {
    const l = new FailureLimiter(MAX, WINDOW, LOCK);
    for (let i = 0; i < MAX; i++) l.begin("ip");
    expect(l.lockedFor("ip", T0)).toBe(1000); // "tente daqui a 1 s", sem bloqueio longo
    l.end("ip", false, T0); // uma terminou com sucesso: cabe mais uma
    expect(l.lockedFor("ip", T0)).toBe(0);
    for (let i = 0; i < MAX - 1; i++) l.end("ip", false, T0);
    expect(l.lockedFor("ip", T0)).toBe(0);
  });

  it("sucesso não conta como falha; reset zera as falhas, mas não desfaz um bloqueio em vigor", () => {
    const l = new FailureLimiter(MAX, WINDOW, LOCK);
    fail(l, "conta", MAX - 1, T0);
    l.begin("conta"); l.end("conta", false, T0 + 10); // acertou a senha: não bloqueia
    expect(l.lockedFor("conta", T0 + 11)).toBe(0);
    l.reset("conta");
    fail(l, "conta", MAX - 1, T0 + 20); // depois do reset, 4 falhas novas ainda são 4
    expect(l.lockedFor("conta", T0 + 30)).toBe(0);
    const last = fail(l, "conta", 1, T0 + 40); // 5ª: bloqueia
    expect(l.lockedFor("conta", last)).toBe(LOCK);
    l.reset("conta");
    expect(l.lockedFor("conta", last + 1)).toBe(LOCK - 1);
  });

  it("chaves independentes: bloqueio de um IP não afeta outro", () => {
    const l = new FailureLimiter(MAX, WINDOW, LOCK);
    fail(l, "a", MAX, T0);
    expect(l.lockedFor("a", T0 + 10)).toBeGreaterThan(0);
    expect(l.lockedFor("b", T0 + 10)).toBe(0);
  });

  it("sweep remove só entradas livres (sem pendência, sem bloqueio, falhas fora da janela)", () => {
    const l = new FailureLimiter(MAX, WINDOW, LOCK);
    fail(l, "velho", 2, T0);
    fail(l, "bloqueado", MAX, T0);
    fail(l, "recente", 2, T0 + WINDOW - 1000);
    l.begin("pendente");
    expect(l.size).toBe(4);
    l.sweep(T0 + WINDOW + 10);
    expect(l.size).toBe(3); // "velho" saiu
    expect(l.lockedFor("bloqueado", T0 + WINDOW + 10)).toBeGreaterThan(0);
    l.end("pendente", false, T0 + WINDOW + 10);
    l.sweep(T0 + LOCK + WINDOW + 10);
    expect(l.size).toBe(0);
  });
});

describe("RateCounter (contas/personagens por hora)", () => {
  const HOUR = 3_600_000;

  it("waitFor não registra; record conta até max e depois pede para esperar até a 1ª sair da janela", () => {
    const c = new RateCounter(3, HOUR);
    for (let i = 0; i < 10; i++) expect(c.waitFor("ip", T0)).toBe(0); // consultar não consome
    c.record("ip", T0);
    c.record("ip", T0 + 1000);
    expect(c.waitFor("ip", T0 + 2000)).toBe(0);
    c.record("ip", T0 + 2000);
    expect(c.waitFor("ip", T0 + 2000)).toBe(HOUR - 2000); // até a 1ª (T0) sair da janela
    expect(c.waitFor("ip", T0 + 2000 + HOUR / 2)).toBe(HOUR / 2 - 2000);
    // A primeira saiu da janela: cabe mais uma; com ela, a espera passa a contar da 2ª.
    expect(c.waitFor("ip", T0 + HOUR)).toBe(0);
    c.record("ip", T0 + HOUR);
    expect(c.waitFor("ip", T0 + HOUR)).toBe(1000);
    expect(c.waitFor("outro", T0 + HOUR)).toBe(0);
  });

  it("sweep só apaga chaves com todos os eventos fora da janela", () => {
    const c = new RateCounter(3, HOUR);
    c.record("a", T0);
    c.record("b", T0 + HOUR - 1);
    c.sweep(T0 + HOUR);
    expect(c.waitFor("a", T0 + HOUR)).toBe(0);
    // "b" continua contando: mais 2 e bloqueia.
    c.record("b", T0 + HOUR); c.record("b", T0 + HOUR);
    expect(c.waitFor("b", T0 + HOUR)).toBe(HOUR - 1);
  });
});

describe("PerSecond (mensagens do jogo por chave)", () => {
  it("aceita max por segundo por chave e descarta o excesso; o segundo seguinte abre janela nova", () => {
    let clock = T0;
    const l = new PerSecond(() => clock);
    for (let i = 0; i < 3; i++) expect(l.allow("s1:move", 3)).toBe(true);
    expect(l.allow("s1:move", 3)).toBe(false);
    expect(l.allow("s1:move", 3)).toBe(false);
    expect(l.allow("s1:chat", 3)).toBe(true); // outra chave, outro contador
    clock += 999;
    expect(l.allow("s1:move", 3)).toBe(false);
    clock += 1;
    expect(l.allow("s1:move", 3)).toBe(true);
  });

  it("clearPrefix esquece as chaves da sessão que saiu e só elas", () => {
    let clock = T0;
    const l = new PerSecond(() => clock);
    expect(l.allow("s1:move", 1)).toBe(true);
    expect(l.allow("s2:move", 1)).toBe(true);
    expect(l.allow("s1:move", 1)).toBe(false);
    l.clearPrefix("s1:");
    expect(l.allow("s1:move", 1)).toBe(true);
    expect(l.allow("s2:move", 1)).toBe(false);
    clock += 1000;
    expect(l.allow("s2:move", 1)).toBe(true);
  });
});
