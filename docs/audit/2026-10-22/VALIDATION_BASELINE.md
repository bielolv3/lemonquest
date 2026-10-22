# Linha de base de validação — The Lemon Quest

Data: 2026-10-22 (17:42–18:17) · Base: `main` em `22a00c7`, árvore limpa · Máquina: Windows 11, Node 24.4.1,
npm 11.16.0 · Parte da auditoria em [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md).

Tudo abaixo foi **executado de verdade** nesta sessão, em sequência (nunca duas suítes ao mesmo tempo), contra
servidores isolados com banco temporário. Nenhum arquivo de `data/`, `docker-data/` ou `docker-data-dev/` foi tocado.

## 1. Comandos verificados

| Finalidade | Comando | Existe? | Observação |
|---|---|---|---|
| Instalar | `npm ci` | sim | não executado (node_modules de 15/10 já consistente com o lock; CI executa) |
| Rodar em dev | `npm run dev` | sim | não executado (sobe Vite + servidor em :2567; fora do escopo de uma auditoria) |
| Tipos | `npm run typecheck` | sim | 3× `tsc` (shared, server, client) |
| Unitários | `npm test` / `npx vitest run` | sim | `vitest.config.ts`: metade dos núcleos, `LEMONQUEST_LOGIN_BONUS=0` |
| Build | `npm run build` | sim | Vite (cliente, com `tools/build-public.mjs`) + esbuild (`tools/build-server.mjs`) |
| Servidor isolado | `E2E_PORT=<p> E2E_SKIP_BUILD=1 E2E_ADMINS="<nomes>" node e2e/start-server.mjs` | sim | banco em `%TEMP%/lemonquest-e2e-<p>`, `NODE_ENV=test`, `LEMONQUEST_E2E=1`, comandos de dev ligados |
| Fumaça | `node tools/smoke.mjs http://127.0.0.1:<p> [--drop\|--expect-ground] [--user X]` (`npm run smoke`) | sim | **não citado em nenhum doc** antes desta auditoria |
| E2E | `npm run test:e2e` / `npx playwright test` | sim | `E2E_SKIP_BUILD=1` pula o build do cliente; 1 worker por padrão |
| Robô novato | `npm run newbie` | sim | não executado (4–6 min; a 1ª missão não mudou no ciclo 8, ver GAMEPLAY_REVIEW GD-23) |
| Carga / fuzz | `node tools/loadtest.mjs …` / `node tools/fuzz.mjs …` | sim | não executados: o `loadtest` não chega às caves (PERF-22) e o `fuzz` cobre 23/34 tipos (TST-06); ambos entram na Fase 0/1 |
| Lint / formatação | — | **não existe** | só `tsc --strict`; decisão: ESLint mínimo opcional, sem Prettier |
| Auditoria de deps | `npm audit --omit=dev` | sim | |
| CI | `.github/workflows/ci.yml` | sim | consultado com `gh run list/view` |

## 2. Resultados obtidos

| # | Verificação | Resultado | Tempo | Detalhe |
|---|---|---|---|---|
| 1 | `npm run typecheck` | **ok** (exit 0) | ~17 s | sem erros nos 3 projetos |
| 2 | `npx vitest run` | **774/774** em 77 arquivos | 13,1 s | 0 falhas, 0 skip; aviso esperado "SQLite is an experimental feature" |
| 3 | `npm run build` | **ok** | 4,9 s cliente + 0,5 s servidor | cliente: `main` 320 KB, `npc` 353 KB, `phaser` 1 196 KB, css 92 KB, `harness` 8 KB (órfão); `dist` 25 MB. Servidor: `server.mjs` 2,6 MB (331 módulos), `admin.mjs` 1,6 MB. Aviso do Vite: `__dirname` em `vite.config.ts:18` (trocar por `import.meta.dirname` antes do Vite 9) |
| 4 | `npm audit --omit=dev` | **0 vulnerabilidades** | 3 s | |
| 5 | Servidor isolado na porta 2873 + `curl /health` | **ok** `{"ok":true}` | ~5 s até responder | cabeçalhos: sem `X-Powered-By`, com `X-Content-Type-Options: nosniff` e `Referrer-Policy: same-origin` (#23 continua válido) |
| 6 | `tools/smoke.mjs --drop` (conta nova, personagem cavaleiro, entrar, largar item) | **ok** | ~3 s | "entrou como smoke em (79,92), hp 150"; item largado apareceu em `groundItems` (0 → 1) |
| 7 | `tools/smoke.mjs --expect-ground --user smoke2` (segunda sessão vê o item) | **ok** | ~3 s | "itens no chão sincronizados: 1" |
| 8 | Log do servidor durante 5–7 | **aviso novo** a cada entrada | — | `@colyseus/schema buffer overflow. Encoded state is higher than default BUFFER_SIZE` (16 KB; pede 48 KB). Não é falha: a lib realoca e recodifica. Causa provável: estado inicial com 582 monstros. Correção: `Encoder.BUFFER_SIZE = 64 * 1024` no boot (OBS-01) |
| 9 | `npx playwright test` (suíte completa, `E2E_SKIP_BUILD=1`, 1 worker, `retries: 0`) | **44 passed, 2 failed** | 10,3 min | falhas: `look.spec.ts:20` "dois botões numa criatura" e `quests.spec.ts:…` "missão de matar" (`toBeHidden` do diário expirou) — **exatamente os dois instáveis diagnosticados** (TST-02/TST-03). `fishing.spec.ts` (que quebra o CI) **passou** localmente nas duas vezes: a corrida do helper depende do tempo de câmera, maior no runner de 2 vCPU |
| 10 | CI do GitHub (`gh run list --branch main`) | **vermelho** nos 2 últimos runs | — | `39836896375` (`22a00c7`, 22/10 19:04) e `39828409420` (`306cf88`): job "Typecheck, testes e build" ok (41 s), "Docker build" ok (1,5 min), **"E2E (Playwright)" falhou** (32 min): `fishing.spec.ts:25` ✘ nas 2 tentativas, `fishing.spec.ts:48` ✘ e depois ✓ no retry. Últimos verdes: `a63db70` e `e2efcf9` (22/10 17:07–17:23) |

Artefatos: logs em `scratchpad/baseline/{typecheck-vitest,build-audit,smoke-server,e2e}.log` da sessão; os
artefatos da falha E2E de hoje de manhã (`test-results/quests-*`) foram copiados para o scratchpad antes da nova
rodada e continuam em `test-results/` (gerado, ignorado pelo git).

## 3. Estado inicial (resumo)

- Código: compila, tipa e passa 774 unitários. Build de produção íntegro. Sem vulnerabilidade alcançável.
- Servidor: sobe, autentica, sincroniza estado e chão; um aviso de buffer por login (novo, inofensivo).
- E2E: 44/46 localmente; os 2 que falham são os instáveis conhecidos (corrida no helper e no Esc do diário).
- CI: vermelho em `main` por instabilidade de E2E no runner lento, não por regressão de produto (a mesma spec passa
  localmente). **Enquanto não for corrigido, o gate não protege nada.**
- Não medido: desempenho real (tick nas caves, FPS, heap), balanço real do ciclo 8, áudio, proxy/TLS.

## 4. Limitações

- Nenhum teste foi executado em paralelo com outro para não saturar a CPU (o `TEST_PLAN.md` registra falsos negativos
  com a máquina ocupada). Os 7 agentes de análise rodaram durante o typecheck/vitest/build, mas só liam arquivos.
- `npm run newbie`, `loadtest` e `fuzz` ficaram de fora por tempo e porque dois deles precisam das correções da
  Fase 0/1 para serem úteis (caves e tipos novos).
- Sem navegador manual: capturas de 1366×768, contraste e legibilidade reais ficam para o roteiro de
  GAMEPLAY_REVIEW.md §12.
- A causa da falha no CI foi lida no trace do run (clique em `y=-1662`) e no código; não foi reproduzida localmente
  porque localmente a câmera converge a tempo.

## 5. Procedimento de regressão (para todo ciclo daqui em diante)

Rodar numa máquina ociosa, nesta ordem; qualquer etapa vermelha para o ciclo até ser explicada.

| # | Etapa | Comando | Tempo esperado | Critério de aceitação |
|---|---|---|---|---|
| 1 | Tipos | `npm run typecheck` | ~15 s | exit 0 |
| 2 | Unitários | `npm test` | ~15 s | 100 % verdes e o **total não caiu** (hoje 774; `passWithNoTests` não pode mascarar) |
| 3 | Build | `npm run build` | ~10 s | `dist/index.html`, `dist/ranking.html`, `server.mjs`, `admin.mjs` existem; `server.mjs` ≈ 2,6 MB (alerta se dobrar) |
| 4 | Fumaça do bundle | `PORT=3050 LEMONQUEST_DB=%TEMP%/lq-smoke.db node packages/server/dist/server.mjs` + `node tools/smoke.mjs http://127.0.0.1:3050 --drop` | ~10 s | `ok: entrou…`, exit 0; `curl -I /health` com `nosniff` e sem `X-Powered-By`; **sem** aviso de buffer no log (após OBS-01) |
| 5 | E2E subconjunto estável | `E2E_SKIP_BUILD=1 npx playwright test e2e/login.spec.ts e2e/world.spec.ts e2e/ground.spec.ts e2e/party.spec.ts e2e/trade.spec.ts e2e/hotkeys.spec.ts e2e/account.spec.ts e2e/panels.spec.ts e2e/training.spec.ts e2e/depot.spec.ts` | ~4–5 min | 100 % verde sem retry |
| 6 | E2E completo (antes de merge em `main`) | `npm run test:e2e` | ~10 min local, ~20 min no CI | 0 failed; até a Fase 0 terminar, `look`/`quests`/`spells`/`fishing` podem falhar por instabilidade conhecida — qualquer **outra** falha é regressão; depois da Fase 0, 0 flaky |
| 7 | Novato | `npm run newbie` | ~4–6 min | 4/4 vocações `ok`, 0 mortes, < 120 s cada; estender até "Os Lobos" (GD-06) |
| 8 | Semanal: carga + fuzz | servidor E2E na 2872 + `loadtest --bots 10 --secs 130 [--tp <cave>]` + `fuzz --mode proto --secs 90` + `fuzz --mode inventory --secs 180` | ~8 min | `[tick]` média ≤ 1 ms (vila) / ≤ 5 ms (caves) e máx ≤ 25 ms; p95 de passo ≤ 300 ms; fuzz sem exceção no log, `/health` ok, `inventory` exit 0 |
| 9 | CI | push em branch → PR | ~25 min | 3 jobs verdes; E2E < 25 min após F0-2 |

Antes de culpar o código por uma falha E2E, conferir no log do servidor a linha `[tick] … máx`: ticks de centenas
de ms significam CPU saturada (falso negativo).

## 6. Protocolo de medição de desempenho (pendência dos ciclos 7–8)

Pré-requisito: `loadtest.mjs` com `--tp` e `--names` (F0-4) e `[save]`/`playedMs` no `/status` (F0-3).

**Servidor** (`E2E_PORT=2872 E2E_SKIP_BUILD=1 E2E_ADMINS="Bot 01,…" node e2e/start-server.mjs`):
1. Piso: 0 bots, 3 min → `[tick]` média ≤ 1 ms, máx ≤ 10 ms (compara com 0,2 ms de 131 monstros no ciclo 2).
2. Vila: `--bots 10 --secs 130` → média ≤ 1 ms, máx ≤ 10 ms, p95 ≤ 300 ms (reprodução da baseline antiga).
3. Caves com ataque automático: `--bots 10 --tp <cave> --secs 300`, depois `--bots 32` → **média ≤ 5 ms, máx ≤ 25 ms**,
   0 `[erro]`, `pendingRespawns` volta a 0 em ≤ 5 min (`/status`).
4. Picos fora do tick: `[save] N em X ms` ≤ 10 ms com 10 jogadores; `[backup]` ≤ 50 ms; p95 do passo sem degrau a cada 15 s.
5. Perfil: `node --cpu-prof` durante o passo 3: `findPath` + `findLosTilePath` + `playerAt` + `alliesOf` +
   `callForHelp` < 30 % do tick; `pathfinding.bench.ts` ≤ 11 µs/caminho e novo caso de BFS ≤ 30 µs.

**Cliente** (PC do escritório com GPU, Chrome, sem `?e2e`, luz "alto"):
6. Join: nenhuma tarefa longa > 100 ms após o estado inicial; login → mundo ≤ 2 s.
7. 5 min lutando nas caves com 10 bots: frame p95 ≤ 16,7 ms; `List.depthSort`/`syncDisplay` < 5 % do perfil.
8. 30 min: 3 snapshots de heap (±10 %), DOM estável; repetir com luz "desligado" (diferença ≤ 15 %).
9. Rede: WebSocket ≤ 20 KB/s por cliente nas caves; `world.json` baixado 1 vez.
