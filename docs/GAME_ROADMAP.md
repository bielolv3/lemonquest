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
| C | Acessibilidade: dificuldade da criatura em texto (dica da lista de batalha) e "!" para perigosa/chefe | ✅ | captura conferida |
| F | Heap do cliente em sessão com 10 bots | ✅ | plano (49,0 → 49,7 MB em 6 min) |
| D | #28 Armas tier 3 (lv 15) à venda: Bento (todas), Velho Caçador (arco), Dona Marta (varinha/cajado) — antes não caíam de nenhum monstro para cavaleiro e feiticeiro | ✅ | unitários; levantamento de fontes por vocação/tier |

### Ciclo 3 — depois da revisão independente

| Etapa | Item | Status | Validação |
|---|---|---|---|
| D | Crédito "só quem está perto" também em missões, conquistas de abate e abate em grupo (antes só XP/loot) | ✅ | `WorldRoom.test.ts` |
| A | Quem fica no mundo ao sair em combate para de andar (como na queda) | ✅ | `WorldRoom.test.ts` |
| A | `lastCreditId` zerado quando o monstro volta ao spawn | ✅ | unitários |
| E | Predição: amostra de confirmação limitada a 1 s | ✅ | `predictor.test.ts` |
| C | Login: chamadas da API com timeout de 15 s (servidor travado não deixa "Carregando personagens…" para sempre) | ✅ | typecheck + E2E |
| F | E2E: conferências sem `poll` logo após ações (chão/mochila) e canto livre de jogadores/itens que sobraram | ✅ | 25/25 |
| C | Cartão "Primeiros passos" para personagem novo | ✅ | capturas 1440×900 / 1280×720; some ao fechar/primeiro abate |
| D | #29 Armas tier 1 +1/+2 de ataque; lobo vida 80 / dano [6,15] | ✅ | unitários (metas de magias do lv 1 ≥ 1,5×); E2E 25/25 |
| D | #30 Druida: Lasca de Gelo (exori frigo), espelho da Bola de Fogo | ✅ | conferido no jogo: 8 de mana, rato 25 → 3 |

### Ciclo 4 — tour visual e robô

| Etapa | Item | Status | Validação |
|---|---|---|---|
| C | #34 Fundo próprio das janelas | ✅ | `getComputedStyle` 0,85 → 0,94/0,96 |
| C | #35 Depot abre a mochila dobrada e devolve ao fechar | ✅ | `e2e/depot.spec.ts` (novo) |
| C | #36 Ajuda F1 completa e agrupada | ✅ | captura |
| C | #37 Banner da zona abaixo das janelas | ✅ | capturas do treino/missão |
| C | #38 Loja/conquistas/ranking: textos cortados ou duplicados | ✅ | capturas |
| F | Robô que joga sem admin (4 vocações) | ✅ | lv 1→2–3 em 5 min sem mortes |
| F | E2E do chão resistente a monstro no tile | ✅ | 3/3 repetido |
| C | #39 Cartão de primeiros passos fora do caminho do novato (canto inferior direito) | ✅ | robô novato chega ao Capitão em 5 s (antes: parado); E2E `world.spec.ts` |
| C | #40 Chat sobe para cima da barra de magias em janela estreita | ✅ | 960 / 1100 / 1366 px sem sobreposição |
| C | #41 Loja: "Só da minha vocação" e "Lv N" | ✅ | no jogo: 18 de 35 itens para o mago |
| C | #42 /ajuda | ✅ | `admin.test.ts`; no jogo como jogador e admin |
| C | #43 Volume do som | ✅ | E2E novo em `world.spec.ts` |
| C | #44 Tela de desconectado avisa quando o servidor voltou | ✅ | servidor derrubado e religado com jogador dentro |
| F | #45 Phaser num chunk próprio; `/assets/*` immutable | ✅ | curl dos cabeçalhos; E2E confere `/ranking` |
| C | Rastreador de missões: com a missão pronta, mostra "→ Fale com <NPC que deu a missão>" | ✅ | `e2e/quests.spec.ts` (texto + captura `quest-ready`) |
| C | Chat sobre a cabeça do personagem (estilo Tibia): geral amarelo, grupo azul-claro, itálico menor que o nome, até 3 linhas, some sozinho, texto longo vira "…" (90 caracteres) | ✅ | `e2e/speech.spec.ts` (novo) + `party.spec.ts` |
| F | `tools/fuzz.mjs` (protocolo e inventário) | ✅ | 3 488 mensagens inválidas e 5 849 movimentos sem exceção nem duplicação |

### Ciclo 5 — funcionalidades novas (2026-10-15)

| Etapa | Item | Status | Validação |
|---|---|---|---|
| C | Seta-guia do novato (Capitão → floresta → Capitão) | ✅ | `guide.test.ts`, `e2e/guide.spec.ts` |
| C | Emotes (`/e`, botão ☺), sussurro (`/w`, `/r`) e amigos (`/amigo`, `/amigos`) | ✅ | `social.test.ts` (10), `e2e/social.spec.ts` |
| C | Troca entre jogadores (janela, confirmação dupla, troca atômica) | ✅ | `trade.test.ts` (11), `e2e/trade.spec.ts` |
| C | Pesca: vara, boia, 3 peixes, conquistas | ✅ | `fishing.test.ts` (9), `water.test.ts` (mapa real), `e2e/fishing.spec.ts` |
| C | Barra de ações: arrastar para reordenar (salva por personagem) | ✅ | `slotOrder.test.ts` |
| D | Eventos semanais com bônus de XP/loot + `/evento` (admin) + etiqueta no HUD | ✅ | `events.test.ts` (shared e server), `combat.test.ts` |
| F | `/status` do admin | ✅ | `admin.test.ts`, `status.test.ts` |
| F | `tools/newbie.mjs` (`npm run newbie`): regressão da 1ª missão nas 4 vocações | ✅ | 4/4 em 49–56 s |
| D | Respawn não trava com jogador parado no spawn (druida novato 4/6 → 8/8) | ✅ | `monsters.test.ts` (2 novos), 8 execuções do robô |
| F | E2E isolado: reconexão de 2 s em modo E2E; `party`/`ground` 10/10 em repetição | ✅ | `--repeat-each=5` |

### Ciclo 6 — retenção e qualidade de vida (2026-10-15)

| Etapa | Item | Status | Validação |
|---|---|---|---|
| D | Desafios da semana (3 metas + bônus, resgate tudo-ou-nada) | ✅ | `challenges.test.ts` (6), `e2e/challenges.spec.ts` |
| D | Ranking semanal (XP, abates, peixes, chefes) + categoria Pescador | ✅ | `weekly.test.ts` (shared e server), `achievements.test.ts` |
| D | Chefes na agenda (Lich qua 20h, Rei Goblin dom 20h) + `/evento` convoca | ✅ | `monsters.test.ts` (`callBoss`), `events.test.ts` |
| D | Bônus de login por dias seguidos (7 dias) | ✅ | `loginBonus.test.ts` (6) + conferido num servidor real (ouro e aviso; sem repetir no dia) |
| C | Bestiário (tecla B) com abates por monstro e drops | ✅ | `bestiaryLogic.test.ts`, `achievements.test.ts`, `e2e/bestiary.spec.ts` |
| C | Poção automática por % | ✅ | `autoPotion.test.ts` |
| C | Acessibilidade: texto maior, alto contraste, animações reduzidas | ✅ | `a11yLogic.test.ts` (efeito visual não conferido em captura) |
| C | Tela de Novidades; aviso fora da aba | ✅ | `news.test.ts`, `newsLogic.test.ts`, `attentionLogic.test.ts` |
| F | Evento manual persistido (reinício) | ✅ | `events.test.ts` |
| A | Avisos de entrada perdidos (cliente ainda não escutava): agora 3 s depois | ✅ | conferido num servidor real |

Ficou de fora de propósito: painel web de admin (os comandos `/status` e `/evento` bastam por enquanto), teste visual
automático por comparação de imagens, mercado entre jogadores, guilda, receitas, resistências de monstros e prestígio
(sistemas inteiros que pedem decisão de design).

Já existiam (conferido no código, sem mudança): cadeia de missões até o level 35 (12 missões), texto flutuante de dano
por tipo/crítico, mapa-múndi em tela cheia (tecla M), chefes de zona e Coliseu até a onda 30 com Lich e Rei Goblin.

Ficou de fora (precisa de mapa/arte novos): **dungeon instanciada própria** (o Coliseu e os chefes de zona cobrem o
conteúdo para grupo), **mineração** (só a pesca foi feita) e **casas com decoração** (o depot já guarda itens; casa
pede áreas no mapa e itens colocáveis no mundo).

## Ciclo 7 (2026-10-22) — correções e lacunas do delta pós-expansão

Auditoria do delta desde o ciclo 1 (185 commits): três frentes independentes sobre Coliseu até a onda 60, chão sem
dono, mochila escalável, atalhos, habilidades de monstro, estágios de XP, PvP persistido, Costa Esmeralda e quests.
Detalhe de cada achado em [GAME_AUDIT.md, Ciclo 5](GAME_AUDIT.md#ciclo-5-auditoria-do-delta-pós-expansão-2026-10-22).

| Etapa | Item | Status | Nota |
|---|---|---|---|
| A | #47 Pilha no chão não reinicia o prazo de validade ao fazer merge (largar ou mover) | ⏳ | `ground.ts:162-168`, `:246-249` |
| A | #48 Limite de taxa próprio para `C2S.MoveGroundItem` em `MESSAGE_LIMITS` | ⏳ | `WorldRoom.ts:75` |
| A | #49 Migração do minimapa remapeia linha a linha mesmo sem `exploredW` salvo | ⏳ | `shared/explore.ts:51-69` |
| D | Descarte automático do chão (2000 itens) poupa `rare`+ antes de olhar idade | 🧭 | decisão do dono: vale a complexidade para um risco raro? |
| C | Destaque visual quando a mochila cresce de level (hoje só texto no chat) | ⏳ | |
| C | Atalho de teclado para abrir/fechar o painel de atalhos além de `H`; feedback ao soltar fora de slot | ⏳ | |
| F | `docs/TEST_PLAN.md` atualizado com os ciclos 2 a 6 (Terras Selvagens até olhar) | ⏳ | hoje parado no ciclo 5 (2026-10-15) |
| F | E2E das ondas-chefe 35-60 do Coliseu, da recompensa da onda 60 e do botão "Vender tudo" | ⏳ | |
| F | E2E de um segundo jogador pegando/movendo o loot de outro no chão | ⏳ | garantia central do "chão sem dono" |
| F | E2E da Aniquilação (4 placas + alavanca) | ⏳ | hoje só a checagem de alcançabilidade no gerador do mapa |

## Próximos (ordem sugerida)

| Etapa | Item | Status | Nota |
|---|---|---|---|
| F | FPS do **cliente** numa sessão longa com vários jogadores | ⏳ | heap já medido (plano); FPS headless sem GPU não é confiável — medir num PC do escritório |
| E | #13 Timeout da predição baseado na latência medida | ✅ | `predictor.test.ts`: 60 ms → 450 ms (igual); 600 ms → >1,2 s; teto 2 s. E2E de movimento ok |
| A | #11 Saída voluntária em combate: o personagem fica RECONNECT_S (20 s) no mundo, como numa queda (pode morrer); relogin/kick cancelam | ✅ | `WorldRoom.test.ts` (4 casos: permanência, fora de combate/morto, relogin, kick) |

## Decididas ✅ e ainda pendentes 🧭

As três propostas de balanço foram **aceitas pelo dono do jogo** e já estão nesta branch (merges `proposta/31`, `32` e
`33`). `proposta/todas` continua existindo e recebe por merge tudo o que entra aqui.

| Item | O que mudou | Status |
|---|---|---|
| #31 Ouro sem destino no lv 25+ | tier 4 nas lojas (Bento / Tomé / Dona Marta): kit completo 22–27 mil; tier 5 segue recompensa | ✅ |
| #32 Fim de jogo (lv 40+) | espíritos de chama 3 → 7 em dois bandos; mapa idêntico (0 tiles alterados) | ✅ |
| #33 Magos e paladino | magos 6 de vida/level (lv 30: 295 → 324); paladino com conjuntos tier 3 (Caçador, loja do Tomé) e tier 5 (Arqueiro-Mestre, loot) | ✅ |

Sessões de conta persistidas (antes ficavam só na memória e todo mundo digitava a senha de novo a cada reinício): ✅
tabela `account_sessions` guarda só o hash do token; mesma expiração de 30 min sem uso. Testado com reinício real do
servidor (a mesma sessão voltou a valer) e em `auth.test.ts` (3 casos novos).

Alternativas que ficaram de fora: para #31, manter tier 4–5 como recompensa e criar outro gasto; para #32, um monstro
novo lv 45–48 (precisa de sprite e de um lugar no mapa — um spawn novo na lista do gerador muda ~3 mil tiles).

| Item | O que mudou | Status |
|---|---|---|
| Atrito social do loot de grupo sem dono | Funciona como desenhado (qualquer um pega/move o que está no chão), mas numa rede de ~10 colegas pode gerar reclamação que nenhum teste automatizado capta | 🧭 revisitar só se houver reclamação real |

Configuração de produção:

| Item | O que fazer |
|---|---|
| #12 Backup fora do disco | Ligar `LEMONQUEST_BACKUP_COPY_DIR` em produção (pasta de rede/outro disco) |
| Admin em produção | Definir `LEMONQUEST_ADMIN_ACCOUNTS` com a(s) conta(s) dos admins, para poder recriar um personagem admin |

## Propostas — sink de ouro e conteúdo novo (2026-10-22) 🧭

Motivo: personagem de lv 80 com 500 mil de ouro sem o que comprar (lojas vendem só até tier 4, tier 5-7 só caem de
loot). Nenhum item desta seção está decidido ainda, cada linha espera aprovação antes de virar código. Benchmark:
bênção e imbuement vêm do Tibia (identidade que o jogo já persegue), cassino vem de Diablo (sink "de diversão" sem
custo de poder).

| Item | O que é | Esforço | Status |
|---|---|---|---|
| Bênção no templo | Reduz a zero a penalidade de XP na próxima morte; preço = level × 200 de ouro. Vendida por Liora (Vila), Irmão Tadeu (Posto) e Irmã Celeste (Porto) | pequeno | ✅ |
| Venda de tier 5-7 | Tier 5 no preço de tabela (Bento/Tomé/Dona Marta); tier 6-7 em "encomenda especial" a 1,5× o valor de loot, 1 peça por personagem por semana | pequeno | ✅ |
| Tarefas de caça | **Já existia** (Quadro de Recompensas, `bounties.ts`): 3/dia por faixa de level, até lv 88+. Moeda nova (Marca de Caça) descartada nesta rodada, ver nota | quase zero | ✅ |
| Missões recorrentes | NPC pede N de um material específico, rotação semanal. Reaproveita o próprio Quadro de Recompensas (aba "Encomenda") | pequeno | ✅ |
| Encantamento (imbuement) | 1 efeito ativo por personagem (dreno de vida, dreno de mana, espinhos, perfurante, veloz), ouro + material, Dona Marta | médio | ✅ |
| Montaria | Cosmética, sprite reaproveitado e tingido (sem bônus de velocidade) | médio (arte) | 🧭 bloqueado |
| Tingimento de outfit (por conta) | 8 tons pré-definidos na sprite da roupa (reusa `tint`, já usado em monstro, e `kv` existente pro unlock por conta); 8.000 de ouro cada, vale pra qualquer personagem da conta | médio | ✅ |
| Cassino | Ficha de 1.000 de ouro (Hanna, a Mascate): 45% nada, 35% +400 de ouro, 15% material, 5% +3.000 de ouro | pequeno | ✅ |

Bênção e venda de tier 5-7 implementadas (2026-10-22): `blessingPrice` em `shared/formulas.ts`, ação `C2S.NpcTrade`
`"blessing"`, flag `blessed` persistida no personagem, consumida em `combat.ts` na morte (zera `lostXp`, notice
própria). Tier 6-7 usa `NpcShopEntry.limited` + semana ISO (`weekId`) guardada em `rec.data.limitedBuyWeek`, checada
no servidor (não só esconder no cliente). Testes: `combatFormulas.test.ts`, `combat.test.ts` (morte com bênção),
`m4.test.ts` (compra de bênção e limite semanal).

Tingimento de outfit implementado (2026-10-22): catálogo em `shared/data/outfitTones.ts` (8 tons, `OUTFIT_TONE_PRICE`
= 8.000). `CharacterRecord` ganhou `accountId` (já vinha na linha do banco, só não estava exposto). Unlock por conta
guardado na tabela `kv` já existente (`account.tones.<id>`), sem migração de schema nova. Tingimento em si reaproveita
o campo `tint` que `CharacterLook`/`Actor` já aplicavam só em monstro (`outfitLook` ganhou um 4º parâmetro). No preview
da janela (canvas 2D puro, sem Phaser) foi preciso um tingimento manual (multiply + recorte pelo alpha original,
cacheado por imagem+cor). Testes: `outfit.test.ts` (validação do tom e `addAccountTone`/`getAccountTones`).

**Marca de Caça** (moeda nova, opcional, liga tarefas aos sinks sem imprimir mais ouro): descartada nesta rodada de
construção. Tarefas de caça e missões recorrentes pagam ouro direto, mais simples de construir e manter. Fica
anotada como ideia de reserva se algum dia o ouro direto dessas duas fontes virar demais.

Tarefas de caça e missões recorrentes implementadas (2026-10-22): a primeira já existia (Quadro de Recompensas), só
confirmado que cobre até o fim de jogo (banda lv 88+). A segunda é nova (`shared/data/materialRequest.ts`,
`server/systems/materialRequest.ts`): pede N de um material específico por semana (10 faixas de level, mesmos
materiais que já existem como loot vendável), paga ouro na entrega. Reaproveita o Quadro de Recompensas como NPC
(aba "Encomenda" nova ao lado de "Recompensas") e o padrão leve de `challenges.ts` (estado em `rec.data.request`,
sem passo de "aceitar"). Testes: `materialRequest.test.ts`.

Cassino implementado (2026-10-22): ficha fixa em `CASINO_TICKET_PRICE` (1.000), vendida por Hanna (Posto da
Fronteira, já era mercadora, só ganhou o flag `casino`). Prêmio puramente aleatório no servidor (`NpcSystem.rng`),
em expectativa paga menos que a ficha (sink de verdade, não fonte): 45% nada, 35% +400, 15% um material de flavor
(ferro/dente de goblin/ectoplasma/escama), 5% +3.000. Sem prêmio de poder nem de tom de tingimento (achei generoso
demais dar um tom de 8.000 numa ficha de 1.000, ficou só pra compra direta na janela de roupas). Testes:
caso novo em `m4.test.ts` (sorteio determinístico via `rng` injetado, uma faixa por vez).

**Encantamento implementado (2026-10-22), simplificado em relação ao desenho original**: o plano original era 1
slot na arma (o item), 3 tiers por efeito, decaimento por hora de combate, tier 3 preso a uma "Essência" nova só de
chefe. Construído de verdade: 1 efeito ativo **por personagem** (não pela arma), sem tiers, sem decaimento, troca
por outro a qualquer hora sem reembolso. Mais simples de manter e já entrega a parte que importava (a passiva em
si). Preço único de 5.000 de ouro + 5 do material por efeito, vendido pela Dona Marta:

| Efeito | Material | Onde aplica |
|---|---|---|
| Dreno de vida (5%) | Presa de Lobo | `combat.ts`, ataque automático contra monstro selvagem |
| Dreno de mana (4%) | Olho de Aranha | idem |
| Espinhos (8%) | Couro de Lobo | dano recebido de monstro, reflete de volta |
| Perfurante (ignora 15% da armadura) | Barra de Ferro | mitigação do ataque automático |
| Veloz (8% mais rápido) | Ferrão de Abelha | intervalo entre ataques automáticos |

Atordoante (crítico) ficou de fora: precisava de um sistema novo de status no monstro (stun), risco maior sem poder
testar visualmente. Só vale no PvE (ataque automático contra monstro selvagem), não em PvP nem em magia/invocação,
pra limitar o escopo do que foi tocado em `combat.ts`. Testes: 5 casos novos em `combat.test.ts` (um por efeito,
com monstro invulnerável pra isolar sem revide onde fazia sentido), 1 caso em `m4.test.ts` (compra/troca na loja).

**Tier 5-7 à venda, números reais do `items.ts`**: kit tier 5 completo ≈ 50 mil, tier 6 ≈ 144 mil, tier 7 ≈ 360 mil
(cavaleiro, paladino e mago na mesma escala, menores). Tier 6-7 a 1,5× o valor de loot (ex.: armadura da Coroa por
84 mil em vez de 56 mil), 1 peça por conta por semana.

**Cassino, estrutura de prêmio**: ficha ≈ 1.000 ouro. 40% nada, 30% ouro de volta (≈ 50% do preço), 15% material raro,
10% tom de tingimento, 5% cosmético único (título, moldura de ranking). Valor esperado de volta ≈ 600-700, número a
calibrar com playtest, não é final.

**Montaria: bloqueada, não por decisão, por risco de asset.** Dos 8 itens desta rodada, é o único que não dá pra
construir só com código testável: precisa de uma sprite de montaria no formato de addon (32×32, grade 4×7,
`tools/addons/generate.mjs`), e sem conseguir ver o resultado renderizado (sem navegador nesta sessão), o risco de
entregar algo visualmente quebrado é alto. Técnica já mapeada (reaproveitar o mesmo `backSheet` que já existe pra
addons de capa/mochila, desenhado atrás do personagem, sincronizado com o próprio ciclo de caminhada), só falta a
arte em si e alguém conferir o resultado numa tela de verdade antes de ir pra produção.

## Não fazer agora ⛔

- **Reescrever `WorldScene.ts`** (1,1 mil linhas): funciona e tem E2E; dividir só quando uma mudança exigir.
- **Interesse por área no servidor** (mandar combate só para quem está perto): o filtro no cliente resolve o
  sintoma; no servidor muda o protocolo e só compensa com bem mais que 32 jogadores.
- **Layout mobile/toque (#14)**: o público é o escritório no PC; custo alto sem demanda.
- **Atualizar dependências em massa**: nenhuma vulnerabilidade alcançável; risco de regressão sem ganho.
