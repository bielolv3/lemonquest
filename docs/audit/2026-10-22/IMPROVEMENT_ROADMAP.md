# Plano de evolução — The Lemon Quest (ciclo 9)

Data: 2026-10-22 · Base: `22a00c7` · Derivado de [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md) e
[GAMEPLAY_REVIEW.md](GAMEPLAY_REVIEW.md). **Aguarda aprovação do dono antes de qualquer implementação.** Depois de
aprovado, o status de cada item deve viver em `docs/GAME_ROADMAP.md` (seção "Ciclo 9"), não aqui.

Convenções: prioridade P0–P3 · esforço P (horas) / M (1–2 dias) / G (semana+) · risco de regressão B/M/A ·
🧭 = exige decisão do dono antes de começar. IDs entre parênteses remetem aos achados dos dois documentos acima.

## Princípios

- Primeiro recuperar o gate (CI verde) e instrumentar; **nenhum rebalanço do ciclo 8 antes de medir**.
- Mudanças de regra entram como dado/fórmula no `shared` com teste ao lado; metas viram asserções (padrão do projeto).
- Nada de reescrita: `WorldRoom`/`WorldScene` só mudam no que a tarefa exige (decisão ⛔ do roadmap mantida).
- Cada fase termina com a baseline de regressão de [VALIDATION_BASELINE.md](VALIDATION_BASELINE.md) verde.

## Fase 0 — Estabilização e preservação (1–2 dias)

| # | Iniciativa | Prio. | Impacto | Esf. | Risco | Deps. | Critério de aceitação |
|---|---|---|---|---|---|---|---|
| F0-1 | **CI verde**: corrigir a corrida do helper `teleport()`/`settled()` (esperar `tileX/tileY` do ator e câmera centrada), fechar o cartão de olhar com Esc no `look.spec`, `expect.poll` com Esc repetido no `quests.spec`, filtrar ratos no `spells.spec` (TST-01/02/03/04) | P0 | gate de merge volta a valer; 3 flaky conhecidos somem | P | B (só `e2e/` e a sonda `__lq`) | — | `fishing`, `look`, `spells`, `quests` com `--repeat-each=5` 100 % verdes; 2 runs seguidos verdes em `main` |
| F0-2 | **CI mais barato e mais útil**: cache de `~/.cache/ms-playwright`, `timeout-minutes: 45` no E2E, build do cliente reaproveitado (`E2E_SKIP_BUILD=1` com artifact), `tools/smoke.mjs` contra o bundle no job `test` e contra o container no job `docker` (TST-05/16) | P1 | sem vermelho por timeout; bundle e rotas `/api` testados | P | B | F0-1 | job E2E < 25 min; `smoke` verde nos dois jobs |
| F0-3 | **Instrumentação para decidir balanço**: `playedMs` e mortes por level por personagem, ouro ganho/gasto por hora no `/status` (pendência ⏳ do ciclo 7); log `[save] N em X ms`; `Encoder.BUFFER_SIZE = 64 KB` no boot (OBS-01) | P1 | pré-requisito de toda a Fase 2; remove o aviso a cada login | P | B | — | `/status` mostra tempo jogado, mortes e ouro líquido por level; join sem aviso de buffer; `[save]` no log |
| F0-4 | **Medição de carga nas caves**: `loadtest.mjs --tp x,y --names` (bots como `E2E_ADMINS`) com ataque automático, flags `--max-p95`/`--max-tick` com `exit 1`; executar o protocolo da VALIDATION_BASELINE §5 e registrar (PERF-22, pendência "573 monstros") | P1 | fecha a pendência de dois ciclos; decide se PERF-02/03/04 valem | P | — | F0-3 | `[tick]` média/máx registrados com 10 e 32 bots nas caves; limiares definidos |
| F0-5 | **Docs vivos consolidados** (CLAUDE_CLEANUP §5): "Ciclo 9" no `GAME_ROADMAP.md` com estes itens, `#50+` no `GAME_AUDIT.md`, `TEST_PLAN.md` com os resultados de hoje, README (10 comandos de admin, `smoke`, teclas de janela, `dist` 25 MB), deploy READMEs, correção das contradições listadas; `CLAUDE.md` commitado | P1 | sessão nova produtiva com `CLAUDE.md` + 1 tela do ROADMAP | P | — | aprovação | nenhuma das 7 contradições de CLAUDE_CLEANUP §3 restante; `grep` dos números bate |
| F0-6 | **Limpeza aprovada** 🧭: `tools/gen-placeholder-map.mjs`, 10 branches locais mescladas, `origin/fix/voltar-aba-snap`, decisão sobre `proposta/todas` e `assets/ninja-adventure/`; `.claude/settings.json` + `.gitignore` | P2 | menos ruído e proteção de `data/` em todo clone | P | B (tudo recuperável no git) | aprovação | itens executados ou explicitamente recusados no ROADMAP |

## Fase 1 — Melhorias de alto impacto (3–5 dias)

| # | Iniciativa | Prio. | Impacto | Esf. | Risco | Deps. | Critério de aceitação |
|---|---|---|---|---|---|---|---|
| F1-1 | **Condição depois da morte** (BUG-01): só aplicar veneno/queimadura/lentidão se o golpe não matou; teste de golpe letal com condição; `conditions.test.ts` novo (também cobre BUG-08: nome da condição em PT na morte por DoT) | P2 | bug visível e frequente com dragões/liches | P | B | — | jogador morto por sopro renasce sem condição; `killerName` em PT |
| F1-2 | **Estágio de XP nas diárias** 🧭 (GD-01): `applyXpStage` na XP da recompensa diária ou teto de 25 % do level | P1 | progressão do 40+ volta a ser a da caça | P | B | decisão (pode ser design intencional) | no lv 100, diária de 20 demônios ≤ 25 mil XP; teste em `quests.test.ts` |
| F1-3 | **Pilha única de overlays + foco de janela** (UX-04/03/11): um handler de Esc que fecha a última aberta; `z-index` por clique; `useWindowDrag` nas janelas com grip (ou remover o grip) | P2 | expectativa Tibia "Esc fecha a de cima"; estabiliza o E2E do diário de vez | M | M (11 listeners) | F0-1 | qualquer sequência: Esc fecha a última aberta; teste unitário da pilha; J e R visíveis juntas |
| F1-4 | **Fricções de interação** (UX-01/02/07/15/16): posturas em F2/F3/F4 e F5 devolvido ao navegador (+ texto da troca, F1, README, `RESERVED_KEYS`); venda só pelo botão da aba Vender e confirmação ao largar raro+ por arrasto; Novidades com os 5 sinks, `/ajuda` "1–0", dicas do boot "60 ondas"; andar na hora em tile com loot; chat sem puxar para o fim ao ler histórico | P2 | perdas acidentais e hábitos de escritório respeitados | P | B | — | F5 recarrega; duplo clique com aba Vender não vende; `grep` sem "1–8"/"30 ondas"; clique em tile com item anda em < 100 ms |
| F1-5 | **Legibilidade e texto grande** (UX-06/05/08/19): `--hud-faint`/`--hud-muted` ≥ 4,5:1 e redefinidos no alto contraste; zoom só no corpo das janelas; piso de 10 px; "Texto maior" alcançando barra de ações e painéis; em ≤ 820 px, Equipamento dobrado e Mochila aberta por padrão | P2 | acessibilidade real na resolução mais comum do escritório | P/M | B | — | pares de contraste ≥ 4,5:1; × visível em 1366×768 com "Muito grande"; ≥ 1 linha da mochila visível sem rolar |
| F1-6 | **Ciclo de vida dos sistemas** (ARQ-01, BUG-05/06): `SessionHooks { onLeave?, onReconnect? }` e um array único de sistemas no `WorldRoom`; `events.sendTo` na reconexão; `trade.cancel` no ramo de linger | P2 | elimina a classe de regressão "esqueci de registrar" | M | M | — | teste: reconexão com evento ativo recebe `S2C.Event`; linger cancela troca; um só array |
| F1-7 | **Persistência consistente** (PERF-09, BUG-04): `saveAll` em `transaction()` + `PRAGMA synchronous = NORMAL`; tom de tingimento e bônus de login gravados junto com o personagem | P2 | sem tom grátis/bônus duplicado após queda; sem fsync por jogador | P | B | F0-3 (`[save]`) | `[save]` ≤ 10 ms com 10 jogadores; após `BuyOutfitTone` o ouro já está no banco |
| F1-8 | **Rede de proteção de testes** (TST-06/08/09): `fuzz.mjs` com os 34 tipos derivados de `C2S`; testes de `ratelimit`, `ai` (fuga/bando/grito), `bounties`; consistência de `quests.ts`, `spellFamilies.ts`, `outfitTones.ts`; rotas de `index.ts` com `app` exportado | P2 | IA do ciclo 8 e limite de login cobertos | M | — | — | `vitest list` ≥ 820; `fuzz --mode proto` reporta 34 tipos sem exceção |
| F1-9 | **Pequenos bugs e limites** (BUG-02/03/07/12, ARQ-06/12): dreno não cura no boneco; `limited: true` na loja; cassino respeita mochila cheia; `MESSAGE_LIMITS` para `NpcTrade`, `UseItem`, `QuickPotion`, `Drop/Pickup/DiscardItem`, `MoveGroundItem`, `FightMode`; remover as 3 referências a `shared/data/` | P3 | polimento com teste | P | B | — | testes novos passam; `hardening.test.ts` recusa o 6º `NpcTrade` no segundo |

## Fase 2 — Evolução das mecânicas (após F0-3/F0-4 e decisões 🧭)

| # | Iniciativa | Prio. | Impacto | Esf. | Risco | Deps. | Critério de aceitação |
|---|---|---|---|---|---|---|---|
| F2-1 | **Mana sustentável para magos** 🧭 (GD-03): escolher entre (a) poções de mana 120/350/900 pelo mesmo preço, (b) regen cheia em combate para magos, (c) −30 % no custo das áreas; recalibrar o modelo do Coliseu (`arena.test.ts` já assume poção à vontade) | P1 | feiticeiro/druida passam a jogar de mago; o ouro ganha destino | P | M | F0-3 (gasto real de poção) | custo de sustentar a rotação ≤ 30 % da renda de abates no lv 50 e 100 (script no teste); Coliseu grupo lv 50 segue na onda 35–40 |
| F2-2 | **Curva de skills** (GD-04): `rate^from` sem o ×1,15 (ou 1,12 fixo); conferir as metas das 6 conquistas; compensar o dano extra junto com F2-3 | P1 | skills, treino offline e conquistas voltam a existir | P | M (+15–25 % de dano no fim) | F2-3 | melee 60 ≤ 150 h de golpes; ML 40 ≤ 60 h; tentativas acumuladas preservadas |
| F2-3 | **Fim de jogo solo viável com risco** 🧭 (GD-02): ×1,35/×1,45 no 70+/100+ **ou** spawns comuns de 2 em `expansion*.mjs`; bandos ficam como estão | P1 | quem chega ao 85+ sem grupo online continua jogando | P | M | F0-3 (mortes por level reais) | modelo: cavaleiro lv 90 loja sobrevive a 3 behemoths e limpa em < 60 s; jogo: < 1 morte/h no Abismo |
| F2-4 | **Paladino e druida** (GD-05): arcos +15 % de ataque ou crítico base 10 % para o paladino; Lobo Espiritual escalando com o level | P2 | escolha de vocação volta a ser escolha | P | B | F2-1 | dano/s sustentado das 4 vocações dentro de ±15 % no lv 50 e 100 (script) |
| F2-5 | **Grupo que compensa e bandos anunciados** (GD-13/15/07/06): `PARTY_SHARE_BONUS` 0,35 + bônus por vocações diferentes; "bando" no cartão de olhar e na lista de batalha; aviso ao entrar em cave com bando; 1º bando da Cripta menor/mais fundo; `newbie.mjs` estendido até "Os Lobos" | P2 | o jogo empurra para grupo sem punir; sem morte-surpresa no lv 20 | P/M | B | — | grupo de 4 em spawn comum ≥ 90 % da XP/h solo; E2E: olhar um lobo mostra "chama o bando"; robô entrega "Os Lobos" com ≤ 1 morte |
| F2-6 | **PvP: proteção de novato e `/quem`** 🧭 (GD-19): iniciar ataque só com a regra dos 2/3 (revide e caveira sempre permitidos); zona no `/quem` só para amigos/grupo/PZ | P2 | sem grief no 1º dia | P | B | decisão (o dono já recusou "level mínimo"; esta é outra regra) | lv 40 não mira lv 5 fora de PZ; teste em `pvp.test.ts` |
| F2-7 | **Calibrações pequenas** (GD-09/10/14/16): bênção 50 × level; texto do Coliseu "level justo para grupo de 4" e teste com poção do level; Noite de Caçada num almoço; título rotativo "Campeão da semana"; habilidades de tarântula/demônio ≥ básico | P2 | retorno de sistemas já construídos | P | B | — | bênção comprada em ≥ 30 % das mortes de lv 40+; presença em evento ≥ 3 jogadores; `abDps ≥ 0` |
| F2-8 | **Faixa 90–120** (GD-08/18): 1 magia utilitária por vocação no lv 110; 2 missões 100–110; 1 elite "nomeado" de colosso/demônio | P2 | 36–50 h de caça com novidade | M | B | F2-1..3 | cada vocação ≥ 1 magia entre 95 e 115; ≥ 2 missões com minLevel 100–109 |
| F2-9 | **Loot de grupo** 🧭 (GD-21): linha no chat do grupo ao pegar raro+ do chão; prioridade de 15 s para membros usando `owner/owner_until` | P3 | amortece o atrito sem abrir mão do chão sem dono | P/M | B | decisão | E2E: não-membro só pega após 15 s |

## Fase 3 — Refinamento e escalabilidade (contínuo)

| # | Iniciativa | Prio. | Impacto | Esf. | Risco | Deps. | Critério de aceitação |
|---|---|---|---|---|---|---|---|
| F3-1 | **Cliente** (PERF-13/14/15/17/18/20): nome/barras criados só ao sair do cull (ou atores em lotes no join); `setDepth` só quando muda e `update` pulado quando culled; `ground.update` com `shown`; minimapa só com `version` nova; `BattleList`/`PartyPanel` com `selectStore`; `world.json` buscado uma vez (Phaser + minimapa) e gzip/brotli no Express | P3 | login sem hitch; frame p95 ≤ 16,7 ms; 1º acesso ~5 MB → ~2 MB | M | M | medição F0-4 (cliente, PC com GPU) | tarefa longa no join ≤ 50 ms; `List.depthSort` fora do perfil parado; `world.json` 1 pedido; `content-encoding: gzip` |
| F3-2 | **Servidor** (PERF-02/03/04/05), só se F0-4 passar dos limiares: buffers reutilizados no BFS de visão + caso no bench; respawns espalhados (N por tick + jitter); índice de jogadores por tile para `blockedForMonster`; índice espacial compartilhado por `alliesOf`/`callForHelp`/`autoTarget` | P3 | tick nas caves ≤ 5 ms média / 25 ms máx | M | M (IA) | F0-4 | bench BFS ≤ 30 µs; `[tick]` máx sem picos periódicos ≥ 10 ms |
| F3-3 | **Repo e deploy** (ARQ-04/05/07/15/16/17, PERF-21): allowlist de áudio no `build-public` a partir de `SOUNDS`; `assets/maps/preview*.png` fora do git; `.dockerignore` completo; `engines` + `.nvmrc`; `npm ls @colyseus/schema` no CI; `LEMONQUEST_ADMINS` em `.env`; `.editorconfig` LF | P3 | `dist` ≤ 12 MB; clone não cresce a cada mapa; Docker mais rápido | P/M | B | F0-6 | `dist` ≤ 12 MB; contexto do Docker < 90 MB; `node -v` 20 avisa |
| F3-4 | **Acessibilidade e feedback** (UX-09/10/12/13/14/18/21/22/23/25): `aria-label` nos botões de ícone e foco ao abrir janela; convites dentro da `.top-stack`; elite com glifo ★ mantendo a cor de dificuldade; glifos nos estados da barra; menu nativo bloqueado sobre o HUD; seção "Painéis" no F1; mostrar senha/Caps Lock; tela de morte cita a bênção; títulos de seção sem corte; fonte servida localmente | P3 | polimento que o público casual sente | P/M | B | — | axe: 0 botões sem nome; captura 1366×768 sem sobreposição com evento + Coliseu + 2 avisos + convite |
| F3-5 | **Testes e automação** (TST-10/11/12/13/17, CLAUDE_CLEANUP §5.2): E2E de morte real + bênção, viagem, `/kick`, reconexão via CDP, 1 spec "sinks"; fixture de migração com save antigo sanitizado; `@vitest/coverage-v8` manual; ESLint mínimo (`no-floating-promises`, `no-misused-promises`), sem Prettier; limpeza do `%TEMP%`; comando `/fechar-ciclo` | P3 | lacunas dos ciclos 7–8 cobertas; fechamento de ciclo repetível | M/G | B | F0-1 | +5 specs com suíte ≤ 30 min; migração testada com fixture; `npm run lint` < 1 min |
| F3-6 | **Arquitetura sem reescrita** (ARQ-02/03/09/11/18/19): `rooms/compose.ts` com `createSystems(deps)` e `ach` criado antes (sem `?.`); extrair `pointer.ts`/`worldClicks.ts` do `WorldScene` **só quando uma mudança de input exigir**; constantes de `ai.ts`↔`monsters.ts` num módulo próprio; chunk `harness` fora do build; remover `// DONO:` e `LoginResponse` | P3 | `onCreate` legível; sem ciclo de import | M | M | — | `onCreate` < 150 linhas; script de ciclos reporta 0; E2E inalterado |

## Ordem executável

1. **F0-1 → F0-2** (CI verde e barato) — sem isso nada do resto é verificável no gate.
2. **F0-3** (instrumentação) e **F0-5** (docs + `CLAUDE.md`) em paralelo; **F0-6** conforme aprovação.
3. **F0-4** (medição nas caves) com a máquina ociosa; registrar em `TEST_PLAN.md`.
4. **Fase 1** em frentes com arquivos separados e revisão cruzada (padrão dos ciclos 7–8): F1-1 + F1-9 (servidor,
   pequenos), F1-6 + F1-7 (WorldRoom/persistência), F1-3 + F1-4 + F1-5 (cliente), F1-8 (testes). F1-2 depende da
   decisão 🧭.
5. **Fase 2** só depois de 1–2 semanas de dados de F0-3 (mortes e ouro por level) e das decisões 🧭: F2-1 e F2-2
   primeiro (mudam o poder do jogador), F2-3 em seguida (ajusta o poder do monstro ao novo jogador), depois F2-4..9.
6. **Fase 3** por oportunidade: F3-2 só se F0-4 mostrar necessidade; F3-6 só quando uma mudança tocar o arquivo.

## Decisões pedidas ao dono (🧭)

| Decisão | Opções | Recomendação |
|---|---|---|
| Diárias com estágio de XP (F1-2) | aplicar estágio · teto por diária · manter como está (design) | aplicar estágio |
| Mana dos magos (F2-1) | poções 2–3× · regen cheia em combate · áreas −30 % | poções 2–3× (sink + sem mexer em fórmula de combate) |
| Fim de jogo solo (F2-3) | ×1,35/1,45 · spawns de 2 · manter e esperar dados | esperar F0-3 por 1–2 semanas, depois ×1,35/1,45 |
| PvP (F2-6) | regra dos 2/3 para iniciar · manter aberto | regra dos 2/3 |
| Limpeza (F0-6) | branches, `gen-placeholder-map.mjs`, `ninja-adventure`, `proposta/todas`, `settings.json` | tudo, exceto `ninja-adventure` que pode esperar |
| Docs (F0-5) | opção C (snapshot + ROADMAP vivo) · substituir | opção C |
