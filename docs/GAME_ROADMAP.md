# Roadmap — The Lemon Quest

Reflete o estado real. Números `#` = itens de [GAME_AUDIT.md](GAME_AUDIT.md). Status: ✅ concluído · 🔄 em andamento ·
⏳ pendente · 🧭 precisa de decisão do dono do jogo · ⛔ não fazer agora.

## Ciclo 1 (2026-10-14) — estabilidade, segurança e desempenho de base

| Etapa | Item | Status | Validação |
|---|---|---|---|
| A | #1 Nome de admin reservado na criação (inclui variantes com acento); liberar com `LEMONQUEST_ADMIN_ACCOUNTS` | ✅ | `auth.test.ts` (novo caso) |
| A | #9 Nomes novos só com letras latinas comuns (ASCII, Latin-1, Latin Ext-A) e NFKC; nomes antigos seguem válidos | ✅ | `auth.test.ts` (novo caso) |
| A | #4 Largar/pegar item grava jogador + chão juntos (transação), no máximo 1×/s (regravar o chão custa 1,4–7,3 ms com 100–2000 itens) | ✅ | `WorldRoom.test.ts` (novo caso) |
| A | #17 Backup grava em `.tmp` e só então substitui | ✅ | `persistence/*.test.ts` |
| A | #15 Limite de 6 msg/s para `C2S.Chat` (comandos e magias incluídos) | ✅ | unitários + E2E |
| A | #16 Investida não para em portal | ✅ | unitários de magias |
| A | #18 Teleporte visual com guarda do ator (`time.delayedCall`) | ✅ | typecheck + E2E |
| A | #20 Troca de senha derruba tokens pendentes e personagens online da conta (inclusive quem caiu e espera reconexão: `kick` cancela a reconexão) | ✅ | `recovery.test.ts`, `WorldRoom.test.ts` |
| A | #23 `x-powered-by` desligado; `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` | ✅ | `curl -I /health` |
| A | #3 `LEMONQUEST_TRUST_PROXY` opcional (`req.ip`); documentado só com a 2567 fechada | ✅ | typecheck; sem teste com Caddy real |
| B | #5 Uma regra só de "digitando"; checkbox/select soltam o foco após mudar | ✅ | navegador (foco em checkbox + D anda) + E2E |
| C | #2 Efeitos de terceiros só até 16 tiles; som atenuado (cheio até 3, mudo a partir de 10); jogador e grupo nunca filtrados | ✅ | typecheck + E2E; avaliação manual de áudio pendente |
| C | #19 Chat com chave estável por linha | ✅ | typecheck |
| E | #6 `meStore`/`selectStore`: HUD só re-renderiza quando o jogador local muda | ✅ | `store.test.ts` (0 publicações com outro jogador andando) |
| E | #7 `onChange` por entidade solto no `onRemove` | ✅ | typecheck + E2E |
| E | #8 A* com buffers reaproveitados (geração) | ✅ | 200–340 → 6–11 µs/caminho (`pathfinding.bench.ts`); 0 diferenças em 9000 buscas aleatórias com bloqueios vs. a versão antiga |
| E | #25 Luz: vagas reservadas (1/3) para magias/projéteis recortados pela tela; o resto entra no fim se sobrar vaga | ✅ | typecheck + E2E |
| F | E2E do Coliseu instável (já falhava no código original: 1/9 em repetição) — toasts/faixas efêmeros agora são gravados por um MutationObserver | ✅ | `arena.spec.ts` 12/12 em 4 repetições |

## Ciclo 2 (2026-10-14) — decisões de design + balanço

| Etapa | Item | Status | Validação |
|---|---|---|---|
| D | #10 Coliseu: XP das ondas só para quem está na faixa de level (≥ 2/3 do maior vivo); fora da faixa ganha só o ouro, com aviso | ✅ | `arena.test.ts` (novo caso) |
| D | #26 Kit inicial na criação: arma tier 1 da vocação equipada + 3 Poções de Vida + 5 Carnes | ✅ | `auth.test.ts` (novo caso); E2E ajustados (ground/quests não contam mais com mochila vazia) |
| D | #21 Loot para o maior causador de dano a até 12 tiles (senão, quem deu o último golpe); XP só entre quem está perto (sem ninguém perto, todos os que bateram) | ✅ | `combat.test.ts` (novo caso) |
| D | #27 Arma nunca dá menos dano que o punho (vale a faixa de maior média; a arma define alcance/tipo) | ✅ | `inventory.test.ts`; E2E do Coliseu voltou a vencer as ondas |
| D | #27 (decisão "a") Punho cresce devagar: `VOC_DAMAGE.perLevel` 1,6/1,4/1,1 → 0,85/0,75/0,6. Arma do tier bate 1,5–2,5× o punho; um tier atrás ainda ganha dele; equipado fica no patamar em que o Coliseu foi calibrado | ✅ | unitários (metas de magias usam o auto-ataque **com arma**; Bola de Fogo lv 1 = 1,8× com a varinha inicial, piso da meta 2× → 1,5×); E2E 25/25 |
| C | Foco por teclado visível em botões/links/selects/checkbox (`:focus-visible`) | ✅ | typecheck |
| E | #24 `colyseus` (meta-pacote) → `@colyseus/core` + `@colyseus/schema` explícito | ✅ | `npm audit --omit=dev`: 15 → **0**; lock 378 → 300 pacotes; `server.mjs` 5,44 → 2,40 MB; bundle de produção e imagem Docker sobem e respondem `/health`; E2E |
| F | Teste de carga `tools/loadtest.mjs` (10 bots andando/atacando/falando, 131 monstros) | ✅ | tick **0,20 ms em média, máx 2,4–5,0 ms** (orçamento 50 ms); passo ida e volta p50 46 ms / p95 298 ms |
| F | E2E "atacar e matar um monstro na floresta" falhava às vezes: jogador de teste anterior (janela de reconexão de 20 s) matava o alvo antes — o teste agora mira no próximo | ✅ | 3/3 isolado + 25/25 completo |
| F | Hipótese de "fantasmas" após reconexão automática | ✅ refutada | experimento com o SDK: monstro morto durante a queda some do estado e dispara `onRemove` ao reconectar |

## Ciclo 3 (2026-10-14) — polimento autônomo

| Etapa | Item | Status | Validação |
|---|---|---|---|
| C | Balão do item: **"Dano por golpe X–Y ▲/▼ atual A–B"** para armas da vocação; avisa "igual a lutar sem arma". A conta (`autoAttackRange`) foi para o shared e o servidor usa a mesma | ✅ | `itemInfo.test.ts` (igual ao servidor); capturas 1440×900 conferidas |
| C | Coliseu: janela mostra o level de cada membro e marca **"sem XP"** quem está abaixo de 2/3 do maior | ✅ | `arena.test.ts` |
| C | Telas baixas (720p/768p): minimapa 150 px, batalha com 3 linhas por padrão, faixa "▾" quando a coluna tem mais conteúdo (a barra de rolagem é escondida) | ✅ | `panelSize.test.ts`; capturas 1280×720 / 1366×768 / 1920×1080 |
| C | Chat: 80 linhas **por aba** (o Grupo não apaga o Geral); avisos do servidor contam como não lidos fora do Geral | ✅ | `chatLines.test.ts` |
| C | Textos do mundo acompanham a troca de monitor (DPR) | ✅ | emulação CDP: 151/151 textos 1 → 2 |
| E | Hover: vetor reaproveitado e cursor só escrito quando muda (rodava a cada frame) | ✅ | typecheck + E2E |
| F | Teste estatístico de dano: 160 mil `expect()` estouravam o tempo limite com CPU ocupada → conta violações | ✅ | arquivo em < 1 s |
| F | Docs do Docker: comando do admin e diretório de trabalho (`/app`) conferidos na imagem | ✅ | `docker run … node packages/server/dist/admin.mjs` |

## Próximos (ordem sugerida)

| Etapa | Item | Status | Nota |
|---|---|---|---|
| F | FPS/heap do **cliente** numa sessão longa com vários jogadores | ⏳ | o servidor já foi medido (ciclo 2); no cliente headless sem GPU o FPS não é confiável — medir num PC do escritório |
| C | Acessibilidade: dificuldade da criatura além da cor do nome | ⏳ | foco visível já feito (ciclo 2) |
| E | #13 Timeout da predição baseado no RTT medido | ⏳ | baixo valor na LAN |
| A | #11 Saída voluntária em combate: manter o personagem ~6 s no mundo | ⏳ adiado | só cliente modificado chama `leave()`; fechar a aba já deixa o personagem 20 s no mundo. Atrasar a limpeza cria corrida com relogin — fazer só com teste dedicado |

## Precisa de decisão 🧭

| Item | Opções |
|---|---|
| _Design: nenhuma pendente._ Configuração de produção: | |
| #12 Backup fora do disco | Ligar `LEMONQUEST_BACKUP_COPY_DIR` em produção (pasta de rede/outro disco) |
| Admin em produção | Definir `LEMONQUEST_ADMIN_ACCOUNTS` com a(s) conta(s) dos admins, para poder recriar um personagem admin |

## Não fazer agora ⛔

- **Reescrever `WorldScene.ts`** (1,1 mil linhas): funciona e tem E2E; dividir só quando uma mudança exigir.
- **Interesse por área no servidor** (mandar combate só para quem está perto): o filtro no cliente resolve o
  sintoma; no servidor muda o protocolo e só compensa com bem mais que 32 jogadores.
- **Layout mobile/toque (#14)**: o público é o escritório no PC; custo alto sem demanda.
- **Atualizar dependências em massa**: nenhuma vulnerabilidade alcançável; risco de regressão sem ganho.
