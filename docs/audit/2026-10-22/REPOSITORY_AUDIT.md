# Auditoria do repositório — The Lemon Quest

Data: 2026-10-22 · Base: `main` em `22a00c7` (ciclo 8), árvore limpa · Snapshot: esta pasta não é editada depois;
status e decisões vivem em `docs/GAME_ROADMAP.md`. Plano derivado: [IMPROVEMENT_ROADMAP.md](IMPROVEMENT_ROADMAP.md).
Gameplay: [GAMEPLAY_REVIEW.md](GAMEPLAY_REVIEW.md). Validação executada: [VALIDATION_BASELINE.md](VALIDATION_BASELINE.md).
Arquivos auxiliares do Claude: [CLAUDE_CLEANUP.md](CLAUDE_CLEANUP.md).

Legenda de status: **C** = confirmado por leitura do código · **R** = reproduzido/observado em execução · **H** =
hipótese (precisa medir ou reproduzir) · **JC #N** = já conhecido em `docs/GAME_AUDIT.md`/roadmap (número do achado).
Gravidade P0–P3 · Esforço P/M/G · Risco de regressão B/M/A.

## 1. Método

- Reconhecimento central (git, estrutura, docs, configs) e depois **7 agentes de análise somente leitura** em paralelo
  (arquitetura, gameplay, bugs, performance, UX, testes/ferramentas, docs/Claude), cada um com escopo e arquivos
  delimitados e a instrução de marcar o que já estava em `GAME_AUDIT.md`/`GAME_ROADMAP.md`. Os relatórios brutos
  ficaram no scratchpad da sessão; este documento é a consolidação, com divergências resolvidas e os achados P0–P2
  conferidos de novo no código pelo orquestrador.
- Execução real (ver VALIDATION_BASELINE.md): `npm run typecheck`, `npx vitest run`, `npm run build`,
  `npm audit --omit=dev`, servidor E2E isolado + `tools/smoke.mjs` (2 rodadas), suíte E2E completa, e consulta ao CI do
  GitHub (`gh run list/view`).
- Este é o **9º ciclo** de auditoria do projeto. Os oito anteriores (14/10 a 22/10) estão em `docs/GAME_AUDIT.md` e
  `docs/GAME_ROADMAP.md`; não repetimos o que está resolvido. Onde este relatório diverge dos docs antigos, a
  evidência está citada.

## 2. O que é o projeto

MMORPG 2D no navegador inspirado em Tibia, para ~10 colegas na rede do escritório (até 32 clientes). Identidade:
"Tibia de escritório" (cliques e atalhos clássicos, mundo pequeno compartilhado, progressão lenta e social, pixel art
própria com tema limão). 354 commits em 11 dias (11/10 → 22/10), desenvolvidos com Claude Code em ciclos de
auditoria → implementação → docs. Público: adultos no PC, telas 1366×768 a 1920×1080; sem toque por decisão.

## 3. Arquitetura e fluxo de execução

Monorepo npm workspaces, TypeScript estrito (`tsconfig.base.json`: `noEmit`, `moduleResolution: Bundler`,
`allowImportingTsExtensions`, decorators para o `@colyseus/schema`). **Nenhum pacote é compilado em dev**: o `shared`
é publicado como fonte (`exports: ./src/index.ts`) e consumido como `.ts` pelo `tsx` (servidor), pelo esbuild
(`tools/build-server.mjs` → `server.mjs` + `admin.mjs`, `keepNames` obrigatório) e pelo Vite/rolldown (cliente).

| Camada | Tecnologia | Entrada | Responsabilidade |
|---|---|---|---|
| `packages/shared` (8 013 l.) | TS puro | `src/index.ts` | tipos, protocolo `C2S` (34) / `S2C` (41), fórmulas, catálogos de dados (`src/data/*`) |
| `packages/server` (22 158 l.) | Node 24, Colyseus 0.18, express 5, `node:sqlite` | `src/index.ts` → `rooms/WorldRoom.ts` | servidor autoritativo, sala única, tick 50 ms com 25 passos (`runSteps`/`runSafe`), ~30 sistemas em `systems/*` injetados por closures, persistência (`persistence/db.ts` com 7 migrações, WAL, backup `VACUUM INTO`) |
| `packages/client` (18 926 l.) | Vite 8, Phaser 3.90, Preact 11 | `src/main.tsx` | `scenes/WorldScene.ts` (ponte Colyseus→Phaser, input, FX) + `game/*`; HUD Preact em `ui/**` com stores |
| `tools/` (5 916 l.) | mjs | — | build do servidor e da pasta curada de assets, gerador de mapa (`mapgen/`), addons/ícones/favicon, smoke, robô novato, carga, fuzz |
| `e2e/` (2 005 l.) | Playwright 1.64 | `playwright.config.ts` → `e2e/start-server.mjs` | 21 specs / 46 testes contra servidor isolado (porta 2851, banco em `%TEMP%`) |
| `deploy/` | Docker (Alpine + Node stripado), Caddy opcional, NSSM no Windows | `Dockerfile`, `docker-compose*.yml`, `deploy/windows/*.ps1` | produção |

Fluxo: boot → `initDb()` (migrações) → Express (`/api/*` auth, `/health`, `/api/ranking`, estáticos do `dist` e
`/maps`) → Colyseus cria a sala única no boot → `onJoin` hidrata `PlayerState` do JSON em `characters.data`, chama
`load()` de cada sistema e envia o que não está no schema (inventário, mapa explorado, atalhos, conquistas, eventos) →
tick de 50 ms → `saveAll` a cada 15 s, `saveTransfers` (jogador + chão numa transação, ≤ 1×/s) → `cleanupSession` no
leave (lista manual de 21 sistemas). Cliente: `session.ts` (login/token) → `WorldScene.bindRoom` assina
`players/monsters/groundItems` e os handlers `S2C`; HUD lê stores alimentados por `ui/items/bind.ts`.

Estado sincronizado (`server/src/state.ts`): `players` (34 campos), `monsters` (11), `groundItems`, `worldTimeMs`.
Tudo o mais viaja por mensagens e precisa ser **reenviado à mão** em `onReconnect`.

## 4. Inventário e contagens (base `22a00c7`)

| Métrica | Valor |
|---|---|
| Arquivos tracked / pack git | 3 051 / 112 MB (histórico: `assets/ninja` 99 MB, `assets/maps` 42 MB — `preview.png` de 7,9 MB commitado 8×) |
| Linhas (ts/tsx/css/mjs) | shared 8 013 · server 22 158 · client 18 926 · tools 5 916 · e2e 2 005 (testes: 12 461 nos 3 pacotes) |
| Testes | unitários **774** em 77 arquivos (server 567, shared 123, client 84), 13 s; E2E 21 specs / 46 testes (~20 min, 1 worker) |
| Dados de jogo | 39 magias (9 famílias) · 52 monstros (9 chefes) · 213 itens · 37 missões (+10 faixas de caça, 10 de encomenda) · 26 NPCs · 65 conquistas (24 títulos) · 20 outfits · 8 tons · 5 encantamentos · 60 ondas de Coliseu · 9 eventos · 15 notícias |
| Mapa | 400 × 288 tiles; 582 monstros em 187 spawns (573 + 9 bonecos) |
| Assets | `assets/` 128 MB: `ninja` 109 MB / 2 234 arq. (CC0), `ninja-adventure` 6,8 MB / 298 (projeto Godot de exemplo), `maps` 12 MB, `addons` 0,8 MB |
| Build | `dist` do cliente 25 MB (JS 1,87 MB: phaser 1,20 + npc 0,35 + main 0,32; áudio 15 MB para 1,1 MB usado); `server.mjs` 2,6 MB |
| Dependências | 300 pacotes no lock; `npm audit --omit=dev` = 0 vulnerabilidades; sem `engines`/`.nvmrc` |
| Branches | 10 locais já mescladas em `main`; `proposta/todas` não mesclada (26 à frente / 27 atrás, parada em 15/10); `origin/fix/voltar-aba-snap` = mesmo conteúdo de `35c8efb` |
| CI | `.github/workflows/ci.yml`: typecheck + vitest + build + Docker `/health` + E2E. **Vermelho em `main` nos 2 últimos runs** (job E2E) |

Divergências entre docs e contagens reais: `GAME_AUDIT.md` diz 41 magias (são 39), ~44 mil linhas (49,1 mil nos 3
pacotes), 672 testes (774 hoje), `WorldScene.ts` 1.100/1.390 linhas (1 459); README diz `dist` ~20 MB (25 MB); README e
READMEs de deploy listam 6–7 comandos de admin (o código tem 10: faltam `/status`, `/evento`, `/desbloquear`);
`npm run smoke` não é citado em doc nenhum; `TEST_PLAN.md` parou em 15/10 (497 testes, 28 E2E).

## 5. Achados

### 5.1 Críticos e altos (P0–P1)

| ID | Cat. | Descrição | Evidência | Impacto | Grav. | Esf. | Risco | Deps. | Status | Recomendação | Critério de conclusão |
|---|---|---|---|---|---|---|---|---|---|---|---|
| TST-01 | CI / E2E | **CI vermelho em `main`** nos 2 últimos runs (`39828409420`, `39836896375`): `e2e/fishing.spec.ts:25` falha 2/2 tentativas; `fishing.spec.ts:48` falhou e passou no retry. Causa: corrida no helper `teleport()`→`waitSettled()`: `me()` devolve a posição **do servidor** (`WorldScene.ts:976-979`), o ator só salta 40 ms depois (`moveVisual`, `WorldScene.ts:466-476`), a câmera faz lerp (`pixelCamera.ts:46-51`) e `settled()` (`WorldScene.ts:983`) devolve `true` antes de a câmera se mover; o trace do CI mostra `mouse.click y=-1662` (fora da tela). `teleport` é usado em 17 dos 21 specs | `e2e/helpers.ts:102-111`; trace do CI; código conferido | O gate de merge não protege nada; regressões reais passam despercebidas | **P0** | P | B (só helpers + sonda) | — | **R** (CI) + **C** (código) | `teleport` esperar `tileX/tileY` do ator **e** câmera centrada no ator (comparar `scrollX/Y` com a posição do ator, tolerância 1 px) além de `stableFrames ≥ 3`; specs que clicam uma vez (`fishing`, `look`, `ground:135`) usarem `expect.poll` com reclique | `fishing`+`look`+`spells` `--repeat-each=5` 100 % verdes; CI verde em `main` |
| TST-02 / UX-04 | E2E + produto | "Missão de matar": Esc logo após abrir o diário não fecha (falha local de hoje e 1ª tentativa no CI). O diário registra o Esc num `useEffect` (Preact 11: rAF com fallback de 35 ms) e a cadeia de Esc do HUD (`Hud.tsx:104-114`) **não inclui** diário, bestiário, roupas, treino, novidades, desafios; são 11 listeners independentes fechados na **ordem de registro**, não na visual (Diário + Roupas → Esc fecha o Diário por baixo do modal) | `QuestLog.tsx:25-31`; `OutfitWindow.tsx:64-73` (sem deps, re-registra a cada render); `test-results/quests-*/error-context.md` | E2E instável; para o jogador, "Esc fecha a de cima" (expectativa de Tibia) às vezes fecha outra ou tira o alvo | P1 | M | M | — | **R** (teste) + **C** (mecânica); corrida em si **H** | Pilha única de overlays (`push/pop` por janela) consultada por um único handler de Esc; migrar primeiro as 5 janelas simples | Qualquer sequência: Esc fecha a última aberta; teste unitário da pilha; `quests.spec` `--repeat-each=10` verde |
| TST-03 | E2E | `look.spec.ts:39` fecha o cartão clicando no chão; `look.ts:63-70` não para a propagação e o clique vira "andar"; o Shift+clique seguinte usa a posição do servidor | código | Spec instável (2/9, JC) | P1 | P | B | TST-01 | **C** (JC roadmap) | Fechar o cartão com Esc; esperar ator parado (`tileX/tileY`) antes do Shift+clique | `--repeat-each=5` verde |
| TST-05 | CI | Job E2E levou **32 min** contra `timeout-minutes: 35`; sem cache de `~/.cache/ms-playwright`; o cliente é rebuildado dentro do `webServer` | `ci.yml`; timestamps do run | Risco de timeout → vermelho sem causa | P1 | P | B | — | **R** | `actions/cache` dos navegadores (chave = versão do `@playwright/test`), `timeout-minutes: 45`; opcional: artifact do build do job `test` + `E2E_SKIP_BUILD=1` | Job < 25 min |

### 5.2 Médios (P2)

| ID | Cat. | Descrição | Evidência | Impacto | Grav. | Esf. | Risco | Deps. | Status | Recomendação | Critério de conclusão |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BUG-01 | Lógica (ciclo 8) | Condição de habilidade de monstro (veneno/queimadura/lentidão) aplicada **depois** de o golpe matar: `damagePlayer` teleporta, enche a vida e limpa condições; em seguida `if (a.condition && c.hp > 0)` vê vida cheia e aplica. Jogador renasce no templo (ou na saída do Coliseu) envenenado; o DoT tica na PZ (`conditions.ts:116` não olha PZ) | `monsterAbilities.ts:195-207`; `combat.ts:463-470`; conferido | Frequente com dragões/liches do ciclo 8; estado errado após a morte; "lentidão" no templo | P2 | P | B | — | **C** | Guardar `before = c.hp` e só aplicar a condição se `c.hp > 0 && taken < before` (ou `damagePlayer` devolver "morreu") | Teste: golpe letal com condição → sem condição; `S2C.Conditions` vazio após `Died` |
| ARQ-01 / BUG-06 | Ciclo de vida | Três listas manuais no `WorldRoom` (tick 25 passos, `cleanupSession` 21 sistemas, `onReconnect` 8 reenvios). Lacuna concreta nova: `onReconnect` **não** chama `events.sendTo(sid)` (só `onJoin`, `WorldRoom.ts:743`): evento iniciado/terminado durante a queda não chega ao cliente até a próxima mudança | `WorldRoom.ts:743`, `941-958`; conferido | Regressões silenciosas ao adicionar sistema (a troca já ficou de fora no ciclo 7); banner/multiplicador errados após reconexão | P2 | M | M | — | **C** (JC pendência "lista de sistemas", item concreto novo) | Interface opcional `SessionHooks { onLeave?, onReconnect? }` e um array único de sistemas iterado por `cleanupSession`/`onReconnect`; incluir `events.sendTo` e `trade.cancel` no ramo de linger (BUG-05) | Teste: reconexão com evento ativo recebe `S2C.Event`; um só array de sistemas |
| PERF-09 | Persistência | `saveAll` a cada 15 s grava cada jogador num `UPDATE` **fora de transação** e sem `PRAGMA synchronous` (padrão FULL → 1 fsync por jogador), síncrono no event loop | `WorldRoom.ts:1195-1199`; `db.ts:184-187` (só WAL/foreign_keys/busy_timeout); conferido | Estimativa: 10–100 ms bloqueados a cada 15 s com 10 jogadores; jitter de passo invisível na média do `[tick]` | P2 | P | B | — | **C** (estrutura) / **H** (ms) | Envolver `saveAll` em `transaction()` (já existe) e `PRAGMA synchronous = NORMAL`; instrumentar `[save] N em X ms` | `[save]` ≤ 10 ms com 10 jogadores; p95 de ida e volta do loadtest sem degrau a cada 15 s |
| PERF-13 | Cliente | 582 atores vivos o tempo todo (7 game objects cada ≈ 6 400 objetos) e 582 `Text` de nome criados de uma vez no join | `WorldScene.ts:304-308`; `actor.ts:166-186` | Hitch estimado de 100–300 ms no login e 2–9 MB de texturas de texto | P2 | M | M | — | **H** | Criar `label`/barras preguiçosamente no primeiro `setCulled(false)`, ou criar atores em lotes por frame no join | DevTools: nenhuma tarefa longa > 100 ms após o estado inicial |
| PERF-03 | Servidor | BFS de linha de visão (`findLosTilePath`) aloca `Map`/array por chamada e roda `los()` por nó, a cada 250–400 ms por monstro à distância sem visão; nas caves (muitos `minotaur_mage`/`ice_witch`/`necromancer`) estimado 0,5–2 ms/tick | `ai.ts:160-166, 188-217` | Item de maior variância do tick em caves estreitas | P2 | M | M (IA) | PERF-22 | **H** | Buffers reutilizados (técnica do A*, #8); refazer BFS só quando o alvo mudou de tile **e** passou `PATH_RECOMPUTE_MS`; caso novo no `pathfinding.bench.ts` | Bench ≤ 30 µs por BFS de 400 nós; `[tick]` máx ≤ 25 ms em luta nas caves |
| PERF-22 / TST-07 | Medição | `tools/loadtest.mjs` deixa os bots na vila: a baseline de 0,2 ms (ciclo 2, 131 monstros) nunca exercitou caves/bandos/573 monstros; `loadtest` sempre sai com 0 (sem critério); nenhuma ferramenta (`smoke`, `newbie`, `loadtest`, `fuzz`) está no CI | `loadtest.mjs:52-87`; `ci.yml` | A pendência "teste de carga com 573 monstros" não é executável como está | P2 | P | — | — | **C** | Opção `--tp x,y` + `--names` determinísticos (bots como `E2E_ADMINS`); flags `--max-p95`/`--max-tick` com `exit 1`; `smoke` no job Docker e contra o bundle no job `test` | Protocolo de medição da seção 7 executado e registrado |
| ARQ-07 / PERF-21 | Assets / build | `dist` tem 25 MB, dos quais 15 MB são 138 WAV de `ninja/Audio` para ~45 referenciados (1,1 MB) em `sfx.ts`; `build-public.mjs` só exclui `Musics`/`Ambient`/gifs/previews. Histórico git: `assets/maps/preview.png` (7,9 MB) commitado 8× → pack de 112 MB | `tools/build-public.mjs:13-41`; `git rev-list --objects` | Clone de 112 MB e deploy de 25 MB para ~7 MB servidos; cada regeneração do mapa soma ~9 MB ao histórico | P2 | M | B | — | **C** | Lista de permissão de áudio a partir de `SOUNDS` em `sfx.ts`; parar de versionar `preview*.png` (gerar no mapgen e ignorar); opcional e só com o dono: `git filter-repo` dos previews | `dist` ≤ 12 MB; `assets/maps/preview*.png` no `.gitignore` |
| TST-06 | Ferramentas | `tools/fuzz.mjs` cobre 23 dos 34 tipos `C2S` (faltam `Trade`, `Fish`, `Challenge`, `Travel`, `SetHotkeys`, `MoveGroundItem`, `LookGround`, `Follow`, `BuyOutfitTone`, `MaterialRequest`, `UseQuestObject`) | `fuzz.mjs:43-45` vs `messages.ts:10-80` | Fuzz não vê 11 handlers novos, inclusive a troca atômica | P2 | P | — | — | **C** | Derivar `TYPES` de `Object.values(C2S)` (via `tsx`); acrescentar chaves novas; falhar se o servidor logar exceção | `fuzz --mode proto` reporta 34 tipos; sem exceção |
| TST-08 | Unitários | Sem teste próprio: `ai.ts` (fuga, bando, grito), `npcs.ts`, `summons.ts`, `conditions.ts`, `fightmode.ts`, `bounties.ts`; `ratelimit.ts` e `index.ts` (rotas HTTP, cabeçalhos, `TRUST_PROXY`) não são importados por **nenhum** teste (e os limites ficam desligados em modo E2E) | §1.2 do relatório de testes | IA do ciclo 8 e limite de login sem rede de proteção | P2 | M | — | — | **C** | Priorizar `ratelimit` (puro), `conditions` (inclui BUG-01), `ai`, `bounties`; exportar `app` de `index.ts` para teste de rotas | +5 arquivos de teste; `vitest list` ≥ 820 |
| TST-09 | Shared | Dados sem teste de consistência: `quests.ts` (745 l.), `spellFamilies.ts`, `outfitTones.ts`, `outfitsExtraTop.ts`, `achievements`, `challenges`, `materialRequest`, `imbuement`, `arena` | §1.3 do relatório de testes | NPC/item inexistente numa recompensa só aparece em jogo | P2 | P | — | — | **C** | `data/quests.test.ts` (giver existe, itens existem, ids únicos, monstro dos passos existe) e `spellFamilies.test.ts` (família → magias da vocação, ordem por level) | Testes passam e falham ao quebrar um id |
| TST-10 | Persistência | Migrações v4–v7 só testadas a partir de base nova (`:memory:`); nenhuma fixture de save antigo real | `db.test.ts:93-160`; `db.ts:33-176` | Migração quebrada só aparece no deploy do escritório | P2 | M | B | — | **C** | Fixture sanitizada de um backup v3/v5 + teste de abertura (`integrity_check`, login, chão) | Teste novo passa; falha ao remover uma migração |
| TST-13 | E2E | Fluxos sem E2E: PvP, viagem, morte real com perda de XP, bênção, encantamento, tingimento, cassino, encomendas, bônus de login, eventos/chefes, elites/bandos, conversão de atalhos no login, reconexão real, `/kick` `/mute`, ondas 35–60, "Vender tudo", Aniquilação. (A pendência "2º jogador pegando loot de outro" **já está coberta** por `ground.spec.ts:38`) | grep nos specs | Sinks de ouro e PvP (ciclos 7–8) só com unitários | P2 | G | B | TST-01 | **C** | Priorizar: morte real + bênção, viagem, `/kick`, reconexão (fechar WebSocket via CDP), 1 spec "sinks" | +5 specs; suíte ≤ 30 min |
| UX-01 | Interação | **F5 é capturado** como "modo ofensivo" (F6/F7 idem) com `preventDefault`; o servidor manda "Atualize a página (F5) para concluir a troca" | `ui/items/keys.ts:37-42`; `trade.ts:148`; conferido | Hábito de escritório quebrado; instrução impossível de seguir | P2 | P | B | — | **C** | Posturas em F2/F3/F4 (livres) e F5 devolvido ao navegador; atualizar F1, README, `RESERVED_KEYS`, tooltips; mínimo: trocar o texto do servidor | F5 recarrega a página; mensagem da troca não cita F5 |
| UX-02 | Interação | Venda e largada sem confirmação: com a aba Vender aberta, duplo clique/botão direito na mochila **vende 1 na hora** (`actions.ts:28`); soltar um arrasto na fresta entre trilho e coluna larga o item no chão "sem dono" (`dnd.ts:215-224`) | código conferido | Item raro vendido/largado por engano; qualquer colega pega | P2 | P | B | — | **C** | Na aba Vender, só vender pelo botão da linha; confirmação (ou Shift) ao largar item `rare`+ por arrasto | Duplo clique com aba Vender não envia `NpcTrade sell`; soltar raro no canvas pede confirmação |
| UX-03 | Layout | Sem gerenciamento de janelas: todas com `z-index: 30`, nenhuma sobe ao clique; Conquistas e Ranking na **mesma posição**; 8 de 10 janelas mostram grip/cursor "grab" sem serem arrastáveis (UX-11) | `hud.css:414`; `achievements.css:2`; `quests.css:60` | Com 2–3 janelas abertas, fechar para ver a de baixo | P2 | M | M | UX-04 | **C** | Contador de foco (`mousedown` → `z-index: 30+n`); deslocar Ranking; hook `useWindowDrag` para quem tem grip | Clicar numa janela coberta a traz para frente; J e R visíveis juntas |
| UX-05 | Acessibilidade | "Texto muito grande" (×1,3) aplica `zoom` na janela inteira: em 768p Novidades vira 920 px e o × sai da tela; Diário 780 px | `a11y/a11y.css:4-5`; `news.css:2`; `quests.css:60` | Quem precisa de texto grande não fecha a janela em 1366×768 | P2 | P | B | — | **C** (aritmética CSS; captura pendente) | Zoom só no corpo (`.news-body`, `.ql-body`…), como já é feito no painel H | Com "Muito grande" em 1366×768, o × de todas as janelas está visível |
| UX-06 | Acessibilidade | Contraste abaixo de AA em texto pequeno: `--hud-faint #5d6272` = 3,0:1 sobre o painel e ≈ 2,3:1 sobre grama ("Ninguém por perto", distância, CAP/ARM, hora do chat, 9–11 px); alto contraste não muda essas variáveis (3,35:1) | `hud.css:12-13`; `a11y.css:11-13`; cálculo de luminância | Informação secundária ilegível com baixa visão ou monitor fraco | P2 | P | B | — | **C** | `--hud-faint` ≈ `#7d8396`, `--hud-muted` ≈ `#9ba0b0`; em `data-contrast="high"` redefinir as duas | Todos os pares texto/fundo do HUD ≥ 4,5:1 |
| UX-07 | Texto | Novidades sem entrada para bênção, encantamento, tingimento, cassino e encomenda; `/ajuda` diz "teclas 1–8"; dicas do boot dizem "Coliseu tem 30 ondas" e "números 1 a 8" | `shared/data/news.ts`; `admin.ts:96`; `index.html:105,114` | 5 sinks de ouro invisíveis para quem não fala com cada NPC; info errada no 1º contato | P2 | P | B | — | **C** | Entrada nova nas Novidades ("Para onde vai o ouro"); corrigir `/ajuda` e `TIPS` | Textos sem "1–8"/"30 ondas"; `LATEST_NEWS_ID` cita os 5 sinks |
| UX-08 | Layout | 1366×768: os cards da coluna somam ≈ 704 px de 752; a mochila nasce dobrada e exige rolar com barra escondida; na captura 1440×900 o cabeçalho "MOCHI…" já está cortado e a faixa "▾" não aparece | `hud.css:76-78`; `panelSize.ts:29-35`; captura | O painel mais usado é o que o novato não vê na resolução mais comum | P2 | M | M | — | **C** (JC #35 parcial) | Em telas ≤ 820 px dobrar Equipamento por padrão e manter Mochila aberta; ou rolar até a Mochila ao receber loot | Em 1366×768 limpo, ≥ 1 linha da mochila visível sem rolar |

### 5.3 Baixos (P3) — resumo

| ID | Descrição curta | Evidência | Status | Recomendação |
|---|---|---|---|---|
| OBS-01 | **Observado na execução**: a cada entrada no mundo o servidor loga `@colyseus/schema buffer overflow… Encoded state is higher than default BUFFER_SIZE` (16 KB; pede 48 KB). O estado inicial com 582 monstros excede o buffer; a lib realoca e recodifica (só aviso) | log do servidor E2E (2/2 joins); `node_modules/@colyseus/schema/build/index.js:9683,9835`; nenhum `Encoder.BUFFER_SIZE` no código | **R** | `Encoder.BUFFER_SIZE = 64 * 1024` no boot (`index.ts`) e teste de que o join não loga o aviso |
| BUG-02 | Dreno de vida/mana cura ao bater no boneco de treino (`damageMonster` devolve o dano "mostrado" para `invulnerable`); `combat.test.ts:161-179` codifica isso | `combat.ts:245-247, 282-293` | **C** | Devolver 0 no ramo `invulnerable`; ajustar o teste |
| BUG-03 | Loja nunca envia `limited: true` (`npcs.ts:113-115`); etiqueta "1/semana" nunca aparece | `NpcWindow.tsx:123` | **C** | Incluir `limited` no `openMsg` |
| BUG-04 | Tingimento grava o tom no `kv` na hora mas o ouro só no autosave (queda = tom grátis); bônus de login idem (prêmio duplicado) | `WorldRoom.ts:572-583`; `loginBonus.ts:51` | **C** | `transaction(() => { addAccountTone(); this.save(id) })`; `save` ao conceder bônus |
| BUG-05 | Sair em combate (linger) não cancela a troca; parceiro preso 20–60 s | `WorldRoom.ts:960-983`; `trade.ts:70-72` | **C** (JC) | `trade.cancel` no ramo de linger |
| BUG-07 | Cassino dá material com `addItem` sem olhar o retorno: mochila cheia = item some com aviso de "ganhou" | `npcs.ts:216-219` | **C** | Checar `roomFor` antes de cobrar ou `placeLoot` no chão |
| BUG-08 | Morte por DoT difunde "derrotado por poison/burn" (id interno) | `conditions.ts:116` | **C** | Rótulo PT ou nome do monstro-fonte |
| BUG-09/10/11 | Hardening: drag preso ao perder o foco da janela (sem `blur`); hp 0 gravado vira "zumbi" sem clamp; `GroundSystem.restore` sem `sanitizeItem` | `dnd.ts:160-176`; `WorldRoom.ts:698`; `ground.ts:318-320` | **H** | `blur` → cancelar; `Math.max(1, hp)`; sanear no `restore` |
| BUG-12 / ARQ-12 | `MESSAGE_LIMITS` cobre 23/34 tipos `C2S`; `MoveGroundItem` (#48) já limitado a 10/s internamente (`ground.ts:245`); sem limite próprio `NpcTrade`, `UseItem`, `QuickPotion`, `Drop/Pickup/DiscardItem`, `FightMode` | `WorldRoom.ts:78-82` | **C** (amplia #48) | Adicionar entradas; fechar #48 |
| BUG-13 | Migração do minimapa sem `exploredW` (#49) continua aberta | `shared/explore.ts:52` | **C** (JC) | Inferir largura antiga (160/280/400) |
| BUG-14 | "Mochila não encolhe ao perder level": a morte nunca derruba level (`formulas.ts:233-237`); só via `/level` de dev | código | **C** | Fechar a pendência como "só dev" |
| — | Hipótese antiga "fantasmas na reconexão" pode ser **fechada**: o SDK 0.18.5 usa `decodeResync` no rejoin | `@colyseus/sdk/build/serializer/SchemaSerializer.mjs:31-44` | **C** | Marcar refutada no AUDIT |
| ARQ-02 | `WorldRoom.onCreate` com ~445 linhas de composição; `this.ach?.` com optional chaining por ordem de construção | `WorldRoom.ts:183-628` | **C** | Extrair `createSystems(deps)`; criar `ach` antes (sem reescrever) |
| ARQ-03 | `WorldScene.ts` em 1 459 linhas (docs: 1.100/1.390); bloco coeso extraível (ponteiro/NPC/chão, linhas 606–1011) | `wc -l` | **C** (JC ⛔) | Manter a decisão; registrar que o critério "bloco óbvio" agora existe |
| ARQ-04/05 | Pacotes Colyseus não hoisted (`packages/server/node_modules`), schema único na raiz (ok); sem `engines`/`.nvmrc` apesar de `node:sqlite` exigir Node ≥ 22.5; `@types/node` 26 com runtime 24 | `package.json` | **C** | `"engines": {"node": ">=24"}` + `.nvmrc`; `npm ls @colyseus/schema` no CI |
| ARQ-06 | Três configs apontam para `packages/shared/data/` (inexistente): `exports["./data/*"]`, `tsconfig include "data"`, `vitest include` | conferido | **C** | Remover as três referências |
| ARQ-08/20 | `assets/ninja-adventure` (298 arquivos tracked, projeto Godot + `tes4A3E.tmp`) só é lido por `tools/mapgen/dump-terrain.mjs` (one-off já consumido) e `tools/gen-placeholder-map.mjs` (obsoleto; se rodado **sobrescreve** `world.json`) | grep | **C** | Apagar `gen-placeholder-map.mjs`; decidir com o dono tirar `ninja-adventure` do git |
| ARQ-09 | Chunk órfão `harness-*.js` (8 KB) no `dist` (harness `?uitest` de dev) | `dist/assets` | **C** | `if (import.meta.env.DEV && UITEST)` |
| ARQ-11 | Único ciclo de import: `ai.ts` ↔ `monsters.ts` (benigno) | script Tarjan | **C** | Mover `HELP_FLEE`, `SLEEP_DIST`, `cheb` para módulo de constantes |
| ARQ-15 | `.dockerignore` não exclui `playwright-report/`, `test-results/`, `tools/mapgen/_v/`, `Audio/Musics`, `Audio/Sounds/Ambient` (~140 MB de contexto; `COPY . .` invalida cache) | `.dockerignore` | **C** | Acrescentar as entradas |
| ARQ-16 | `docker-compose.yml:22` commita nomes reais de admin (`LEMONQUEST_ADMINS`) | arquivo | **C** | `.env` + `.env.example` |
| ARQ-17/18/19 | 9 arquivos com CRLF na árvore (índice LF); comentários `// DONO: agente "..."` em `WorldScene.ts:1` e `movement.ts:1`; `LoginResponse` `@deprecated` sem uso | `git ls-files --eol`; grep | **C** | `.editorconfig`; remover resíduos |
| PERF-02/04/05/06 | A* consulta `playerAt` linear por nó (0,2–1,5 ms/tick em luta; ×3 com 32 jogadores); rajada de respawns pendentes no mesmo tick a cada 5 s (1–5 ms); `alliesOf`/`callForHelp`/`autoTarget` O(M) por evento (barato hoje); `conditions.sync`/`party.sync` serializam por tick | `pathfinding.ts:88-104`; `monsters.ts:637-648`; `monsterAbilities.ts:108,134` | **C** (complexidade) / **H** (ms) | Só se a medição passar dos limiares: índice de jogadores por tile; espalhar respawns (N por tick + jitter) |
| PERF-14/15/17/18 | Cliente: `setDepth` em todos os atores a cada frame força `queueDepthSort` (~1 000 objetos); `ground.update` com 5 `setVisible` por item por frame; minimapa a 15 fps fixos; `BattleList`/`PartyPanel` ainda assinam `playersStore` inteiro (resíduo do #6) | `actor.ts:519-527`; `game/ground.ts:205-212`; `Minimap.tsx:41`; `BattleList.tsx:72` | **C** | `if (depth !== root.depth)`; pular `update` quando culled; redesenhar só com `version` nova; `selectStore` |
| PERF-19 | Caches sem teto (`toasts.ts lastAt`, `WorldScene.chargeAt`) | código | **C** | Podar em `removePlayer`/`pushToast` |
| PERF-20 | Sem gzip/brotli no Express; `world.json` (1,5 MB) baixado 2× (Phaser + minimapa) | `index.ts:98-108`; `minimap/store.ts:188-192` | **C** | Compartilhar o JSON; `compression()` ou pré-compressão no build |
| TST-11/12 | Sem cobertura (`@vitest/coverage-v8`) e sem lint | — | **C** | Cobertura manual/semanal sem gate; ESLint mínimo (`no-floating-promises`, `no-misused-promises`); **não** adotar Prettier (diff gigante) |
| TST-16/17/18 | CI não sobe o bundle nem roda `smoke`; tmp de testes não limpo; 7 specs compartilham `FOREST {70,62}` (só com `E2E_WORKERS > 1`) | `ci.yml`; `db.test.ts:96` | **C** | `smoke` no CI; `afterAll` com `rmSync`; spots por worker |
| UX-09…UX-25 | A11y de botões só com ícone (sem `aria-label`, foco não movido ao abrir janela); convites de grupo/troca fora da `.top-stack`; grip falso em 8 janelas; elite dourada apaga a cor de dificuldade (≈ amarelo "difícil"); estados da barra só por cor; menu nativo do botão direito sobre o HUD; clique em tile com loot atrasa 350 ms; chat puxa para o fim ao ler histórico; "Nível" × "level", "Depot" × "depósito", "arena" × "Coliseu", "Magic Level"; funções escondidas sem pista (fixar/reordenar/redimensionar painéis, roda no minimapa, luz); fontes pixel de 9 px no HUD e "Texto maior" não alcança o HUD; chat sobe sobre a barra com 9 slots em 1366; login sem "mostrar senha"/Caps Lock; tela de morte não cita a bênção; títulos de seção cortados; fonte do Google Fonts (sem internet cai para monospace) | relatório de UX §1 | **C** (maioria) / **H** (legibilidade real, fonte) | Ordem sugerida: UX-07 → UX-01 → UX-06 → UX-05 → UX-02 → UX-04 → UX-03 → UX-08; o resto por oportunidade |
| DOC-* | README/deploy com 6–7 comandos de admin (código: 10); `npm run smoke` não documentado; `TEST_PLAN.md` parado em 15/10; `GAME_AUDIT.md` com contagens erradas; ROADMAP afirma que `proposta/todas` "recebe por merge tudo" (parada em 15/10, não mesclada), cabeçalho "nenhum item decidido" sobre tabela com 7 ✅, odds do cassino de rascunho (40/30/15/10/5) ≠ código (45/35/15/5), seção "Próximos" com itens ✅; CHANGELOG com 21 seções "[Não lançado]" e 0 tags; `LEMONQUEST_LOGIN_BONUS`/`E2E_SWIFTSHADER` só em comentários | ver CLAUDE_CLEANUP.md §3 | **C** | Consolidação descrita em CLAUDE_CLEANUP.md §5 |

## 6. Riscos principais

1. **Gate de merge quebrado** (TST-01/TST-05): enquanto o CI estiver vermelho por corrida de helper, qualquer regressão
   real entra em `main` sem alarme. É a primeira coisa a corrigir.
2. **Ciclo 8 sem medição**: dano ×1,4–1,7, respawn ×0,7, 573 monstros, cura de aliados e reforço de bando foram
   calibrados por modelo ("otimista para o jogador", segundo o próprio roadmap). O risco é de jogabilidade (faixa
   inicial e solo nas caves), não de código. Ver GAMEPLAY_REVIEW.md.
3. **Listas manuais do `WorldRoom`**: cada sistema novo precisa entrar em três lugares; já falhou duas vezes (troca,
   eventos). É dívida pequena com efeito recorrente.
4. **Persistência em dois tempos** (BUG-04, PERF-09): compras gravadas em `kv` na hora e ouro só no autosave; autosave
   sem transação. Não há via de duplicação de item encontrada (troca, chão, loot, cassino, compras foram lidos a fundo).
5. **Peso do repositório e do deploy** (ARQ-07): 112 MB de pack e 25 MB de `dist` para ~7 MB servidos; cresce ~9 MB a
   cada regeneração do mapa enquanto `preview.png` for versionado.
6. **Docs vivos em deriva**: três docs de status com contradições internas; o próximo ciclo tende a piorar sem a
   consolidação proposta.

## 7. O que está sólido (não mexer sem motivo)

Conferido pelos agentes e, nos pontos críticos, pelo orquestrador:

- **Separação shared/server/client** sem import cruzado; injeção por closures que torna cada sistema testável isolado.
- **Tick isolado** por `runSafe`, métricas em anel e `/status`; ordem dos passos coerente; `combat.flush` em 1 broadcast
  por tick; monstros dormem a > 16 tiles e pensam a cada 250 ms (582 parados custam quase nada).
- **Inventário/troca/chão**: uid novo em toda divisão, `swap` revalidado, `rev` por oferta, teto 2× no prazo do chão
  (#47), despejo protege raro+, limite 10/s, ouro nunca negativo. Nenhuma via de duplicação encontrada.
- **Ciclo 8**: elites só em spawn comum; reforço respeita arena/sala; cura de aliados exclui chefes e exige LOS;
  invocações sem XP/loot; `monsterHunt.test.ts` cobre tudo isso.
- **Auth/sessões**: scrypt + `timingSafeEqual`, sessões persistidas só por hash, expiração, teto por conta, troca de
  senha derruba tudo; comandos de dev/E2E nunca ligam em produção; `MESSAGE_LIMITS` + teto global 60/s.
- **Persistência**: migrações numeradas em transação, `transaction()` com SAVEPOINT aninhável, backup atômico,
  desligamento salva tudo; WAL + checkpoint.
- **Testes unitários**: 774 em 13 s, `rng` injetado/semeado, `:memory:`, sem `.only/.skip`, sem timers reais, sala real
  com clientes falsos (`WorldRoom.test.ts`), testes de paridade cliente×servidor.
- **Build/deploy**: bundle único do servidor, Phaser em chunk próprio e `/assets/*` immutable, imagem Alpine com
  usuário sem privilégios, healthcheck, `STOPSIGNAL`; CI com Docker e E2E.
- **UX**: seta-guia + cartão de primeiros passos, mensagens de login específicas, feedback de combate em camadas,
  tooltips com tecla em tudo, "Reduzir animações" sem esconder avisos, foco visível por teclado.

## 8. O que não foi investigado e por quê

- **Medições reais de performance** (tick nas caves, FPS, heap em sessão longa): o `loadtest` atual não chega às caves
  (PERF-22) e FPS exige PC com GPU; todos os números de performance são estimativas com a conta mostrada no relatório
  do agente. Protocolo proposto em VALIDATION_BASELINE.md.
- **Sessão manual no navegador** (capturas em 1366×768, contraste real, fonte sem internet, telegraph em tile claro):
  roteiro de 10 passos em GAMEPLAY_REVIEW.md §7 para o dono executar.
- **Playtest do ciclo 8**: progressão real por level, Coliseu solo/grupo, caves com bando. Só modelo.
- **Proxy/TLS** (`TRUST_PROXY` atrás do Caddy): sem ambiente.
- **Tamanho real da imagem Docker** e **conteúdo de `proposta/todas`** além das contagens de commits.
- **Causa do `data/lemonquest.db-wal` de 226 KB** (processo não fechou limpo ou servidor parado desde 16/10): fora do
  escopo; nenhum arquivo de `data/` foi aberto.
