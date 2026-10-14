# Plano de testes — The Lemon Quest

## Camadas

| Camada | Comando | O que cobre |
|---|---|---|
| Tipos | `npm run typecheck` | shared, server, client (TS estrito) |
| Unitários | `npm test` (vitest) | fórmulas, dados, sistemas do servidor (combate, magias, IA, inventário, chão, grupo, missões, conquistas, coliseu, treino), persistência/auth, sala real com clientes falsos, predição/luzes/stores do cliente |
| Build | `npm run build` | cliente (Vite) + bundle do servidor (esbuild) |
| E2E | `npm run test:e2e` | Playwright/Chromium contra servidor de teste (porta 2851, banco temporário): login/conta, mundo, chão, painéis, grupo, coliseu, treino, conquistas, missões |
| Benchmark manual | `npx tsx packages/server/src/systems/pathfinding.bench.ts` | custo do A* (µs por caminho) |
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

## Instabilidade conhecida do E2E (investigada)

`arena.spec.ts` falhava de vez em quando com a máquina carregada: o toast "Onda N vencida" dura 3 s e a faixa
"Onda N!" some rápido, e a asserção chegava depois. Medido com `--repeat-each=3`: código original 1 falha em 9 (duas
rodadas: 9/9 e 8/9); com as mudanças 2 em 9, e a falha persistia com as mudanças de cliente ou de `WorldRoom.ts`
revertidas (bisseção) → não era regressão. Correção: `recordUi`/`seenUi` gravam cada toast/faixa/barra no momento em
que aparece. Depois: 12/12 (`--repeat-each=4`).

## Pendente / exige avaliação manual

- **Áudio** da atenuação por distância (efeitos de terceiros): ouvir em sessão real com 2+ jogadores.
- **Desempenho em carga**: FPS e heap do cliente numa sessão de 30+ min com vários jogadores; tick do servidor
  (`[tick] média/máx` no log) com 10 jogadores.
- **Proxy**: `LEMONQUEST_TRUST_PROXY` atrás do Caddy real com a 2567 fechada.
- **Reconexão**: cortar a rede, matar um monstro e voltar (hipótese de entidade "fantasma").
- Celular/toque: não suportado (fora do escopo, ver roadmap).
