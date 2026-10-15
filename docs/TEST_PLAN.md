# Plano de testes — The Lemon Quest

## Camadas

| Camada | Comando | O que cobre |
|---|---|---|
| Tipos | `npm run typecheck` | shared, server, client (TS estrito) |
| Unitários | `npm test` (vitest) | fórmulas, dados, sistemas do servidor (combate, magias, IA, inventário, chão, grupo, missões, conquistas, coliseu, treino), persistência/auth, sala real com clientes falsos, predição/luzes/stores do cliente |
| Build | `npm run build` | cliente (Vite) + bundle do servidor (esbuild) |
| E2E | `npm run test:e2e` | Playwright/Chromium contra servidor de teste (porta 2851, banco temporário): login/conta, mundo, chão, painéis, grupo, coliseu, treino, conquistas, missões |
| Benchmark manual | `npx tsx packages/server/src/systems/pathfinding.bench.ts` | custo do A* (µs por caminho) |
| Carga | servidor E2E (`E2E_PORT=2872 E2E_SKIP_BUILD=1 node e2e/start-server.mjs`) + `node tools/loadtest.mjs http://127.0.0.1:2872 --bots 10 --secs 130` | tick do servidor (log `[tick]`), ida e volta de um passo |
| Fuzz | servidor E2E com `E2E_ADMINS="Fuzz Inv"` + `node tools/fuzz.mjs <url> --mode proto` / `--mode inventory --name "Fuzz Inv"` | servidor não cai nem registra exceção; inventário sem duplicação |
| CI | `.github/workflows/ci.yml` | typecheck + unitários + build + Docker `/health` + E2E |

Rodar o jogo isolado para testes manuais (não toca no banco real):
`E2E_PORT=2870 E2E_ADMINS="SeuNome" node e2e/start-server.mjs` e abrir `http://localhost:2870/?e2e`.

## Resultados — ciclo 1 (2026-10-14)

| Verificação | Antes | Depois |
|---|---|---|
| Typecheck | ok | ok |
| Unitários | 470/470 | 479/479 (+9 novos) |
| Build de produção | ok | ok (bundle do cliente 1,45 MB, sem mudança relevante) |
| E2E | — | 25/25 (rodada final com tudo, 4,7 min); Coliseu 12/12 em 4 repetições |
| A* (caminho curto, mapa 160×288) | 200–340 µs | 6–11 µs, caminhos idênticos (checksum) |

Testes novos:
- `auth.test.ts`: nomes sósias recusados na criação; nome de admin reservado (com/sem acento) e liberado por `LEMONQUEST_ADMIN_ACCOUNTS`.
- `recovery.test.ts`: troca de senha derruba personagem online e invalida token de entrada pendente.
- `WorldRoom.test.ts`: largar/pegar item grava personagem e chão juntos (≤ 1 s; antes só no autosave de 15 s); `kick` de
  quem espera reconexão cancela a reconexão.
- `client/ui/hud/store.test.ts` (4): `selectStore` não publica quando outro jogador muda; só quando a fatia muda.

Verificações manuais feitas no navegador (servidor isolado):
- Login → lista → mundo; combate desarmado contra rato (morte, XP, efeitos); alvo pela lista de batalha; comandos `/tp` `/heal`.
- Foco num checkbox do HUD + tecla D: o personagem anda (antes ficava parado).
- `curl -I /health`: sem `X-Powered-By`, com `nosniff` e `Referrer-Policy`.
- Console: sem erros do jogo (só mensagens da extensão do navegador).

## Resultados — ciclo 2 (2026-10-14)

| Verificação | Resultado |
|---|---|
| Unitários | 482/482 |
| E2E | 25/25 (rodada com as mudanças de jogabilidade); após a troca de dependências 24/25 → o que falhou passou 3/3 isolado (ver abaixo) |
| `npm audit --omit=dev` | 15 avisos → 0 |
| Bundle do servidor | 5,44 MB → 2,40 MB; `npm run start:bundle` sobe em produção e serve `/health` e o cliente |
| Docker | `docker build` ok (224 MB); container responde `/health` |
| Carga (10 bots, 131 monstros, 2 × 60 s) | tick médio 0,198 / 0,204 ms, máx 4,95 / 2,38 ms; passo p50 46 ms, p95 298 ms |
| Reconexão | monstro morto durante a queda: some do estado e `onRemove` dispara ao reconectar (sem "fantasmas") |

Achado de balanço (#27) medido com as fórmulas: cavaleiro lv 15 / skill 30 bate 48 desarmado, 21 com a Espada Curta e 45
com a Espada Longa; depois do ajuste, a arma nunca fica abaixo do punho.

## Resultados — ciclo 3 (2026-10-14)

| Verificação | Resultado |
|---|---|
| Unitários | 491/491 (inclui permanência ao sair em combate, timeout adaptativo da predição) |
| E2E | 25/25; Coliseu 6/6 em repetição após os ajustes de corrida (mira com espera curta, `/tp` até o vendedor) |
| Heap do cliente (Chromium headless, GC forçado a cada 30 s, 10 bots andando/lutando/falando, 6 min) | **plano: 49,0 → 49,7 MB**; DOM sobe de 365 para ~660 e para (linhas do chat no teto de 80 por aba) |
| Troca de monitor (DPR 1 → 2, emulação CDP) | 151/151 textos do mundo na nova resolução |
| Capturas 1280×720 / 1366×768 / 1440×900 / 1920×1080 | coluna lateral cabe até a mochila (720p: mochila recolhida por padrão, como antes; faixa "▾" indica o resto) |

Uma primeira medição de 10 min foi descartada: o computador entrou em suspensão no meio (passo com "ida e volta"
de 21 min nos bots e janelas de 60 s com 951 ticks em vez de ~1200 no log do servidor).

## Resultados — ciclo 4 (2026-10-14, noite)

| Verificação | Resultado |
|---|---|
| Unitários | 493/493 |
| E2E | 26 testes (novo: `depot.spec.ts`); `ground.spec.ts` 3/3 em repetição depois de repetir o clique de pegar |
| Tour visual 1366×768 / 1440×900 (scripts no scratchpad: conta → personagem → cada janela → cada NPC → morte) | achados #34–#38, corrigidos e recapturados |
| Fundo das janelas (`getComputedStyle`) | 0,85 em todas → 0,94 (missões) / 0,96 (conquistas, ranking) |
| Robô sem admin, 4 vocações, 5 min | level 2–3, 0 mortes |
| Fuzz `proto` (3 488 mensagens malformadas em 90 s, todos os 23 tipos) | nenhuma exceção no log, `/health` ok, conexão mantida. A 66 msg/s o servidor derruba o cliente (limite de 60/s, correto); string de 5 000 caracteres excede o tamanho máximo do WebSocket (conexão fechada, servidor de pé) |
| Fuzz `inventory` (5 849 movimentos mochila/equip/depot com índices e contagens inválidos) | nenhum item aumentou, nenhum uid repetido, nenhuma exceção |

### Como ler falhas do E2E com a máquina ocupada

Duas falhas desta rodada vieram de CPU saturada (testes unitários de outra revisão rodando junto): o log do servidor
mostrou `[tick] 425 ticks: média 8,3 ms, máx 1154 ms` (deveriam ser ~1200 ticks/min). Antes de culpar o código,
confira essa linha do log. O efeito visível no cliente ("Carregando personagens…" sem fim) virou erro com timeout de
15 s nas chamadas da API.

## Instabilidade conhecida do E2E (investigada)

`arena.spec.ts` falhava de vez em quando com a máquina carregada: o toast "Onda N vencida" dura 3 s e a faixa
"Onda N!" some rápido, e a asserção chegava depois. Medido com `--repeat-each=3`: código original 1 falha em 9 (duas
rodadas: 9/9 e 8/9); com as mudanças 2 em 9, e a falha persistia com as mudanças de cliente ou de `WorldRoom.ts`
revertidas (bisseção) → não era regressão. Correção: `recordUi`/`seenUi` gravam cada toast/faixa/barra no momento em
que aparece. Depois: 12/12 (`--repeat-each=4`).

## Pendente / exige avaliação manual

- **Áudio** da atenuação por distância (efeitos de terceiros): ouvir em sessão real com 2+ jogadores.
- **FPS do cliente** numa sessão de 30+ min com vários jogadores (num PC com GPU; o heap já foi medido, ciclo 3).
- **Proxy**: `LEMONQUEST_TRUST_PROXY` atrás do Caddy real com a 2567 fechada.
- Celular/toque: não suportado (fora do escopo, ver roadmap).
