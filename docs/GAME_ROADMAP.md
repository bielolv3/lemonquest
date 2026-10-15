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

Já existiam (conferido no código, sem mudança): cadeia de missões até o level 35 (12 missões), texto flutuante de dano
por tipo/crítico, mapa-múndi em tela cheia (tecla M), chefes de zona e Coliseu até a onda 30 com Lich e Rei Goblin.

Ficou de fora (precisa de mapa/arte novos): **dungeon instanciada própria** (o Coliseu e os chefes de zona cobrem o
conteúdo para grupo), **mineração** (só a pesca foi feita) e **casas com decoração** (o depot já guarda itens; casa
pede áreas no mapa e itens colocáveis no mundo).

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

Configuração de produção:

| Item | O que fazer |
|---|---|
| #12 Backup fora do disco | Ligar `LEMONQUEST_BACKUP_COPY_DIR` em produção (pasta de rede/outro disco) |
| Admin em produção | Definir `LEMONQUEST_ADMIN_ACCOUNTS` com a(s) conta(s) dos admins, para poder recriar um personagem admin |

## Não fazer agora ⛔

- **Reescrever `WorldScene.ts`** (1,1 mil linhas): funciona e tem E2E; dividir só quando uma mudança exigir.
- **Interesse por área no servidor** (mandar combate só para quem está perto): o filtro no cliente resolve o
  sintoma; no servidor muda o protocolo e só compensa com bem mais que 32 jogadores.
- **Layout mobile/toque (#14)**: o público é o escritório no PC; custo alto sem demanda.
- **Atualizar dependências em massa**: nenhuma vulnerabilidade alcançável; risco de regressão sem ganho.
