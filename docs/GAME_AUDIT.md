# Auditoria — The Lemon Quest

Data: 2026-10-14 · Base: `e7a6e45` (main). Diagnóstico de engenharia, gameplay e operação. O andamento das correções
está em [GAME_ROADMAP.md](GAME_ROADMAP.md); testes em [TEST_PLAN.md](TEST_PLAN.md).

Atualizado em 2026-10-22 (base `35c8efb`) com o delta de 185 commits desde o ciclo 1, ver [Ciclo 5](#ciclo-5-auditoria-do-delta-pós-expansão-2026-10-22).

## 1. O que é o jogo

MMORPG 2D no navegador inspirado em Tibia, para ~10 colegas na rede do escritório. Monorepo TypeScript:
`shared` (regras, fórmulas, dados), `server` (Node 24 + Colyseus 0.18 + SQLite, tick de 50 ms, servidor autoritativo),
`client` (Vite + Phaser 3 para o mundo, Preact para o HUD). ~49 mil linhas nos 3 pacotes (contagem do ciclo 9), 774
testes unitários + 21 specs E2E (46 testes).

**Loop principal:** escolher alvo → ataque automático + magias da vocação → loot com raridade e bônus → vender/comprar
no NPC → missões, recompensas diárias, Coliseu em grupo (agora até a onda 60) → subir level/skills → novas áreas
(floresta, pântano, ruínas, cavernas, Terras Selvagens, Costa Esmeralda). 4 vocações (cavaleiro, paladino, feiticeiro,
druida), 39 magias em 9 famílias (16 de fim de jogo), monstros com habilidades próprias (golpe, área, onda, cura, invocação),
grupos com XP compartilhada, PvP estilo Tibia (caveiras, bloqueio de PZ), quests com baús e portas de quest, conquistas
que liberam roupas/addons/títulos, ranking semanal, bestiário, pesca, trocas entre jogadores, treino offline.

**Identidade a preservar:** sensação de "Tibia de escritório" — cliques e atalhos clássicos, mundo compartilhado
pequeno, progressão lenta e social, pixel art própria (tema limão).

## 2. Método

- Leitura do código por três auditorias independentes (servidor/gameplay, cliente/UI/desempenho, segurança/operação),
  com verificação dos achados principais no código antes de corrigir.
- Execução real: servidor isolado (banco temporário, porta 2870), personagem novo, combate com rato, alvo pela
  lista de batalha, comandos de admin/dev, inspeção de console (sem erros) e do estado via sonda `?e2e`.
- Linha de base: `typecheck` ok, 470/470 unitários, build ok (bundle JS principal 1,45 MB; `dist` 24 MB com assets).

## 3. Achados

Legenda: **C** = confirmado (código lido e/ou reproduzido) · **H** = hipótese · status em GAME_ROADMAP.md.

### P1 — Alto

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| 1 | Nome de admin livre podia ser criado por qualquer conta (admin é decidido só pelo nome do personagem) | C — `systems/admin.ts:21`, `persistence/auth.ts` não reservava; `/resetsenha` entrega código de qualquer conta | Tomada de conta inteira se o admin ainda não criou/excluiu o personagem |
| 2 | Efeitos visuais e sons de combate/magia/morte de **qualquer lugar do mapa** tocavam a volume cheio | C — servidor difunde para a sala (`combat.ts:316`, `spells.ts:201`); cliente aplicava para qualquer ator conhecido | Ruído constante com vários jogadores; pool de números de dano reciclava os seus |
| 3 | Limite de login por IP do socket: atrás de proxy (Caddy/Docker Desktop) todos dividem o mesmo IP | C — `auth.ts:446` | 5 erros de digitação de alguém bloqueiam o login do escritório por 5 min (só com proxy) |

### P2 — Médio

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| 4 | Chão (5 s) e personagem (15 s) gravados em momentos diferentes | C — `ground.ts:61`, `WorldRoom.ts:46` | Queda brusca do processo duplica ou some com item largado/pegado |
| 5 | Teclas de movimento paravam após clicar num checkbox/select do HUD | C — `input.ts` tratava todo INPUT/SELECT como "digitando"; `focus.ts` não | Personagem "trava" com a janela de missões/conquistas aberta |
| 6 | HUD inteiro re-renderizava quando **qualquer** jogador andava | C — ~13 componentes liam `selectMe(useStore(playersStore))` | Trabalho de DOM ~60×/s sem necessidade |
| 7 | `onChange` de cada entidade acumulava até o fim da cena | C — `WorldScene.ts:249-270` | Vazamento de memória em sessões longas (respawns, itens) |
| 8 | A* alocava 3 arrays do tamanho do mapa (~600 KB) por busca | C — `pathfinding.ts:55-58` | ~200–340 µs por caminho curto, lixo constante no servidor |
| 9 | Nomes sósias aceitos (fullwidth, small caps, ligaduras, acento) | C — `NAME_RE` aceita qualquer `\p{Script=Latin}` | Imitar admin/colega no chat e ranking |
| 10 | Coliseu escala ondas pela média de level e divide XP igualmente | C — `arena.ts:415-475` | Power-leveling (level 40 + três level 1) |
| 11 | Sair da sala no meio do combate remove o personagem na hora | C (servidor) — `WorldRoom.ts:608-640`; cliente oficial nunca chama `leave()` | Escapar da morte com cliente modificado |
| 12 | Backups no mesmo disco; cópia externa desligada por padrão | C — `docker-compose.yml`, `backup.ts` | Uma falha de disco perde base e backups |
| 13 | Predição com timeout fixo de 450 ms | C — `predictor.ts:26` | Personagem "elástico" com RTT alto (não é o caso da LAN) |
| 14 | Sem layout para telas pequenas/toque | C — sidebar fixa de 220 px, menus só no botão direito | Celular não joga (não é público-alvo declarado) |

### P3 — Baixo

| # | Problema | Evidência |
|---|---|---|
| 15 | Comandos de chat (`/convidar`…) e palavras mágicas fora do limite de taxa | C — `chat.ts:45`; sem `C2S.Chat` em `MESSAGE_LIMITS` |
| 16 | Investida do cavaleiro podia parar num portal e teleportar | C — `spells.ts:327` não checava portais |
| 17 | Backup que falha apagava o backup daquela hora | C — `db.ts:199` (`rmSync` antes do `VACUUM INTO`) |
| 18 | `setTimeout(apply, 40)` sem guarda: ator destruído no meio → exceção | C — `WorldScene.ts:400` |
| 19 | Chat com `key={i}` numa janela deslizante | C — `Chat.tsx:151` |
| 20 | Troca de senha não derruba sessões de jogo já abertas | C — `auth.ts:369` |
| 21 | Loot/XP para quem deu dano e foi embora (qualquer distância) | C — `monsters.ts:438`; decisão de design |
| 22 | Recargas de magia/poção não persistem no relog | C — decisão de design |
| 23 | `X-Powered-By` e sem cabeçalhos básicos | C — `index.ts` |
| 24 | Dependências: 15 avisos (low/moderate) vindos do meta-pacote `colyseus` (auth/monitor/playground) não usados | C — `npm audit --omit=dev` |
| 25 | Iluminação "baixa" (14 luzes) dá prioridade às tochas fixas sobre magias | C — `lighting.ts:230-250` |
| 26 | Personagem novo começa sem arma, ouro ou comida | C — `db.ts:231`; desarmado é previsto (`combat.ts:22`); decisão de design |

### Encontrado no ciclo 2

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| 27 | **P1** Arma abaixo do seu tier bate menos que o punho: o dano desarmado cresce com level e skill (`VOC_DAMAGE.perLevel`), o da arma quase não | C — cavaleiro lv 15 / skill 30: punho 48, Espada Curta 21, Espada Longa 45; lv 50 / skill 80: punho 267, melhor arma (Katana de Mithril) 287 | Loot de arma vira armadilha; no fim do jogo arma quase não importa. **Resolvido no ciclo 2** (arma nunca pior + punho cresce devagar) |

| 28 | **P2** Armas de tier 3 inacessíveis para cavaleiro e feiticeiro (nem loja nem monstro); tier 4 só para cavaleiro (goblin 1,2%). Única outra fonte: baú diário (15% de equipamento, sorteado entre todas as peças da faixa) | C — levantamento de `MONSTERS.loot` × lojas dos NPCs × `chestGearPool` | Depois do rebalanço do punho, ficar preso no tier 2 entre os levels 15 e 35. **Ciclo 3:** tier 3 passou a ser vendido (Bento + lojas da vocação); tiers 4–5 seguem como recompensa de loot/baú/chefe |

### Análise quantitativa de balanço (ciclo 3)

Scripts com os dados e fórmulas reais (`autoAttackRange`, `mitigate`, regen, preços), só auto-ataque, sem kiting,
skill 10/20/30/45/60 nos levels 1/8/15/25/35; "ideal" = um jogador sem disputa de spawn (realista ≈ 40–50%).

| Faixa | Alvos | h/level ideal (cav. / pal. / feit.) |
|---|---|---|
| 1–5 | rato, gosma, abelha | 0,09 / 0,09 / 0,12 |
| **5–10** | abelha, lobo, cobra | **0,26 / 0,35 / 0,33–0,52** (2,5–3× a faixa anterior) |
| 10–15 | cobra, aranha, morcego | 0,14 / 0,17 / 0,33 |
| 15–25 | aranha, esqueleto, goblin | 0,16 / 0,19 / 0,32 |
| 25–35 | goblin, fantasma, homem-lagarto | 0,12–0,21 / 0,14–0,29 / 0,29–0,56 |
| 35–50 | só espírito de chama | 0,10–0,19 / 0,16–0,26 / 0,27–0,54 |

- Missões: 1,2–2,2 levels de XP cada (chefes no topo) — coerente. Ouro de 30 a 15 000, escala sensata.
- Economia no lv 15: ~4 mil de ouro/h realista → arma tier 3 em ~45–60 min. No lv 25 o ouro sobra (nada de tier 4–5 à venda).
- Perigo: nenhum monstro mata em 2–3 golpes um jogador do mesmo level; os dois chefes estão calibrados para 3–4 jogadores.
- Rebalanço do punho: cada tier de arma supera o punho até ~15 levels depois de liberar; o tier 1 empatava cedo (lv 7) — **corrigido** (+1/+2 de ataque).

| # | Achado | Status |
|---|---|---|
| 29 | Faixa 5–10 lenta (tier 1 empatava com o punho no lv 7; lobo pesado para magos) | arma tier 1 ✅; lobo ✅ (vida 80, dano [6,15]) |
| 30 | Druida sem magia de dano barata no início (feiticeiro tem Bola de Fogo) | ✅ Lasca de Gelo (exori frigo) |
| 31 | Sem destino para o ouro depois do tier 3 (tier 4–5 não vendidos) | ✅ na branch `proposta/31-tier4-a-venda`: tier 4 nas lojas (kit completo 22–27 mil); tier 5 segue só loot/chefe/baú |
| 32 | Sem conteúdo acima do lv 40 (só 3 spawns de espírito de chama) | ✅ na branch `proposta/32-mais-espiritos`: 7 espíritos em 2 bandos (4 + 3). 7 num bando só dava ~180 de dano/s ao chegar (cavaleiro lv 40 cai em ~4 s); um spawn novo na lista do gerador mudava ~3 mil tiles (264 de colisão) — por isso o ponto novo entra só como objeto, no fim (0 tiles alterados) |
| 33 | Magos frágeis em corpo a corpo no lv 25+; paladino sem armadura tier 3 | ✅ na branch `proposta/33-vida-magos`: magos 6 de vida/level (7 quebrava a meta da Cura: 27,7% no lv 30); paladino com conjuntos tier 3 (Caçador, loja do Tomé) e tier 5 (Arqueiro-Mestre, loot) |

### Ciclo 4 — tour visual de todas as telas (1366×768 e 1440×900) e partidas por robô

Capturas de cada tela (conta, personagem, janelas K/O/L/J/R/F1/M, cada NPC, morte, Coliseu, treino, missões) e um
robô que joga **sem comandos de admin** (anda, ataca o mais perto, magia de dano, poção).

| # | Achado | Evidência | Status |
|---|---|---|---|
| 34 | **P2** Fundo próprio das janelas (0,93–0,97) perdia para o `.hud-card` (0,85) | `getComputedStyle`: todas 0,85; mesma especificidade e os CSS das janelas carregam antes do `hud.css` | ✅ `.hud-card.<janela>` |
| 35 | **P2** Depot inutilizável à primeira vista em tela < 860 px: a mochila (de onde se arrasta) começa dobrada | captura 1366×768 | ✅ abre a mochila enquanto o depot está aberto |
| 36 | **P3** Ajuda F1 sem L, I, Q/E, F5–F8; teclas quebravam linha ("W A S / D") | captura | ✅ |
| 37 | **P3** Banner da zona (z 40) por cima de janelas (30) e do cartão de missão (27) | capturas do treino e da missão | ✅ z 8 |
| 38 | **P3** Nomes longos cortados na loja; "0 / 1.310 pts" em duas linhas; coluna Lv repetida no ranking de level | capturas | ✅ |

| 39 | **P1** Cartão "Primeiros passos" no topo bloqueava o novato: cobria os avisos e o caminho até o Capitão (noroeste) e a floresta (norte); o clique para andar caía no cartão | robô novato sem admin: 74 s parado tentando andar até o Capitão | ✅ cartão no canto inferior direito; E2E novo |
| 46 | **P1** Cavaleiro e druida de level 1 não conseguiam fazer a primeira missão: ratos fogem com 15% de vida e, sem "seguir" (F8, desligado por padrão), não dá para alcançá-los (a Lasca de Gelo deixa o rato com ~3) | robô novato sem admin: cavaleiro 2 ratos e druida 4 em 10 min; paladino 105 s, feiticeiro 41–433 s | ✅ personagem novo começa seguindo o alvo (`m4.test.ts`) |
| 40 | **P2** Meia tela (960 px) com barra lateral: o chat cobria as magias 1–3 | captura + medição | ✅ chat sobe para cima da barra quando não cabe ao lado |
| 41 | **P3** Bento lista 35 itens para qualquer vocação (metade inútil para um mago) | captura | ✅ filtro "Só da minha vocação" + "Lv N" no que pede level |
| 42 | **P3** Sem como descobrir os comandos de grupo no jogo; "Comando desconhecido." sem pista | código | ✅ /ajuda (/comandos, /help) |
| 43 | **P3** Som só liga/desliga (escritório: quer baixo, não mudo) | código | ✅ volume 0–100% lembrado |
| 44 | **P3** Tela de desconectado não dizia quando o servidor voltou (deploy) | simulação: servidor derrubado e religado | ✅ consulta /health a cada 3 s |
| 45 | **P3** Deploy fazia baixar 1,46 MB de JS de novo (Phaser junto com o jogo; tudo revalidando) | build + curl | ✅ Phaser num chunk próprio + `/assets/*` immutable (o ranking.html chegou a sumir do build nessa troca — pego e coberto no E2E) |

Robô (5 min, os quatro juntos disputando os mesmos ratos): todos chegam ao level 2–3, **sem mortes**; sozinho, o
feiticeiro faz ~63 XP/min no level 1–2. No level 7 só contra lobos (bando de 3, sem recuar e com "seguir" ligado,
inclusive os magos): 1–4 mortes em 4 min — mede o robô, que não foge, mais do que o jogo; não justifica mexer de novo.

### Ciclo 5 — auditoria do delta pós-expansão (2026-10-22)

Três frentes independentes (servidor/gameplay/balanço, cliente/UI/performance, mapa/segurança/operação), cada uma
lendo o código real dos sistemas novos ou mudados desde o ciclo 1: Coliseu até a onda 60, chão sem dono com loot de
grupo, mochila escalável, atalhos de magia, habilidades de monstro com aviso (telegraph), estágios de XP, PvP
persistido no relog, Costa Esmeralda e as quests estilo Tibia, olhar com dois botões. Baseline conferida antes da
leitura: `npm ci`, `typecheck` e os 672 testes unitários limpos, `npm audit --omit=dev` em 0 vulnerabilidades.

| # | Problema | Evidência | Impacto |
|---|---|---|---|
| 47 | **P2** Empilhar um item sobre uma pilha já existente no chão reinicia o prazo de validade para o tempo cheio da raridade, tanto ao largar quanto ao mover | C — `ground.ts:162-168` (`place()`), `ground.ts:246-249` (`onMoveGround` só preserva o prazo quando não há merge) | Item raro, épico ou legendário no chão fica praticamente eterno se alguém empilhar +1 igual a cada menos de 20 min, contra o que o próprio código documenta ("o tempo até sumir não reinicia") |
| 48 | **P2** `C2S.MoveGroundItem` sem limite de taxa próprio em `MESSAGE_LIMITS` (diferente de `MoveItem`, 20/s, e `LookGround`, 5/s) | C — `WorldRoom.ts:75` (ausente da lista); só vale o teto global de 60 msg/s | Com o chão sem dono, a falta de um limite específico amplia a superfície de spam de movimentação de item de qualquer um |
| 49 | **P3** Migração do minimapa (fog of war) não remapeia linha a linha quando `exploredW` é `undefined` mas a máscara salva é mais estreita que o mapa atual | C — `shared/explore.ts:51-69` | Cosmético, só o minimapa, autocurável ao explorar de novo; afeta só personagem com save de antes do campo `exploredW` existir |

Confirmado como correto (não é achado): geração da Costa Esmeralda (3 passagens novas, Cidadela sem sobrepor o
subterrâneo antigo), gate de comando dev centralizado (nenhum comando novo escapa de `isDevAdmin`), escala de
dificuldade do Coliseu até a onda 60, garantias das invocações de monstro (sem XP/loot/respawn), estágios de XP
isolados de missão, checagens da alavanca da Aniquilação, validação server-side do "vender tudo".

#### Lacunas de teste e documentação

- `docs/TEST_PLAN.md` parou no ciclo 5 do roadmap (2026-10-15): nada registrado de Terras Selvagens, PvP, Costa
  Esmeralda, habilidades de monstro, atalhos, mochila escalável, Coliseu até a onda 60 ou olhar.
- `e2e/arena.spec.ts` só cobre as ondas 1 a 6: sem E2E para as ondas-chefe 35 a 60, a recompensa da onda 60 (30 mil
  de ouro, título "Imperador") ou o botão "Vender tudo".
- Nenhum E2E cobre a garantia central do chão sem dono: um segundo jogador pegando ou movendo o loot de outro.
- A Aniquilação (4 placas, alavanca, sala) não tem E2E, só a checagem de alcançabilidade no gerador do mapa.

#### Oportunidades (não são bugs)

- Descarte automático ao bater em 2000 itens no chão remove sempre o mais antigo, sem olhar raridade: alguém
  largando e pegando lixo em sequência pode empurrar para fora um item raro de outro jogador.
- Mochila sem destaque visual no momento em que o grid cresce (o aviso é só texto no chat).
- Painel de atalhos e barra de ações sem atalho de teclado além de `H`. Soltar um item fora de qualquer slot não dá
  feedback de "cancelado".
- `.top-stack` empilha até 4 elementos (evento, Coliseu, avisos, notícias). Em tela baixa com vários ativos ao mesmo
  tempo vale conferir visualmente se não fica alto demais (não verificado em captura).
- `WorldScene.ts` foi de ~1.100 para 1.390 linhas, crescimento difuso, sem bloco óbvio para extrair. Ainda não
  parece ter cruzado o ponto que o roadmap usa como critério para dividir.

#### Ponto de decisão (produto)

- Loot de grupo sem dono caindo no chão é decisão de design já tomada, mas numa rede de ~10 colegas pode gerar
  atrito social real (alguém leva o loot do colega) que teste automatizado não capta. Sem ação preventiva sugerida
  agora: revisitar só se aparecer reclamação real.

### Não confirmado

- **H** — Reconexão automática do SDK pode deixar "fantasmas" de entidades removidas enquanto offline. **Refutada no
  ciclo 9** pela leitura do SDK: `@colyseus/sdk` 0.18.5 reconcilia o estado no rejoin (`decodeResync`), e os
  `onRemove` disparam para o que sumiu durante a queda.

### Ciclo 9 — auditoria completa do repositório (2026-10-22)

Sete agentes (arquitetura, gameplay, bugs, performance, UX, testes, docs/Claude) com baseline executada. Evidência
completa em [docs/audit/2026-10-22/](audit/2026-10-22/REPOSITORY_AUDIT.md) (ids `ARQ/BUG/PERF/UX/TST/GD`); aqui só a
numeração `#N` dos achados que entram no roadmap. Status em [GAME_ROADMAP.md](GAME_ROADMAP.md#ciclo-9).

| # | Grav. | Achado | Origem |
|---|---|---|---|
| 50 | **P0** | CI vermelho em `main`: helper E2E `teleport()`/`settled()` considerava o personagem assentado antes de a câmera se mover (clique fora da tela em `fishing.spec`); mesma corrida por trás de `look`/`spells`/`quests` | TST-01/02/03 |
| 51 | P1 | XP das recompensas diárias ignora os estágios de XP (`bounties.ts` → `combat.gainXp` sem `applyXpStage`) | GD-01 |
| 52 | P1 | Solo inviável no lv 85+ após o ciclo 8 (modelo; medir com a telemetria antes de mexer) | GD-02 |
| 53 | P1 | Mana insustentável para magos: sustentar a rotação custa 3–4× a renda; as quatro vocações jogam de auto-ataque | GD-03 |
| 54 | P2 | Condição de habilidade de monstro aplicada depois de o golpe matar: renasce envenenado e o DoT tica na PZ | BUG-01 |
| 55 | P2 | Listas manuais do `WorldRoom`; `onReconnect` não reenvia o evento semanal; sair em combate não cancela a troca | ARQ-01, BUG-05/06 |
| 56 | P2 | Autosave fora de transação e sem `synchronous` (1 fsync por jogador); tom de tingimento e bônus de login gravados em tempos diferentes do ouro | PERF-09, BUG-04 |
| 57 | P1 | Curva de skills ×1,265 por nível fecha em ~45: 6 conquistas inalcançáveis, treino offline inútil | GD-04 |
| 58 | P3 | `@colyseus/schema` avisa "buffer overflow" a cada login (estado inicial > 16 KB) | OBS-01 |
| 59 | P2 | `dist` com 15 MB de áudio para 1,1 MB usado; `preview.png` de 7,9 MB commitado 8× (pack de 112 MB) | ARQ-07 |
| 60 | P2 | Esc fecha a janela errada (11 listeners na ordem de registro; diário/bestiário/roupas fora da cadeia do HUD); janelas sem foco/z-index | UX-03/04 |
| 61 | P2 | F5 capturado como "modo ofensivo"; venda por duplo clique e largada por arrasto sem confirmação | UX-01/02 |
| 62 | P2 | Contraste abaixo de AA em texto pequeno; "texto grande" estoura 768p; mochila fora da tela em 1366×768 | UX-05/06/08 |
| 63 | P2 | Novidades/`/ajuda`/dicas desatualizados (sinks, "1–8", "30 ondas") | UX-07 |
| 64 | P2 | Lacunas de teste: `ratelimit`, `ai`, `conditions`, `bounties`, `index.ts`; dados sem consistência (`quests`, `spellFamilies`); fuzz com 23/34 tipos; migrações só em base nova | TST-06/08/09/10 |
| 65 | P2 | `loadtest.mjs` nunca exercitou as caves; sem critério de falha; nenhuma ferramenta no CI | PERF-22, TST-07 |

## 4. O que está sólido (não mexer sem motivo)

- Inventário: toda movimentação/equip/pilha validada; uids novos ao dividir; sem aliasing chão↔mochila.
- Autenticação: scrypt + `timingSafeEqual`, sessões aleatórias com expiração, tokens de entrada de uso único,
  códigos de recuperação com hash e limite; comandos de dev/E2E nunca ligam com `NODE_ENV=production`.
- Mensagens do cliente: checagem de tipo consistente, limite por tipo + 60/s global.
- Tick isolado por sistema (`runSafe`), migrações em transação, WAL, desligamento grava todos.
- Sem `innerHTML` com conteúdo de usuário; token de sessão em `sessionStorage`; teclas soltas no blur.
- Dados de jogo coerentes (sem outliers absurdos de dano/XP/preço); NPC compra a 30% (sem arbitragem).
- CI: typecheck, unitários, build, Docker `/health` e E2E.

## 5. Notas por área

Nota inicial → nota depois dos 4 ciclos (2026-10-15).

| Área | Nota | Base |
|---|---|---|
| Arquitetura | 8/10 | servidor autoritativo, sistemas isolados e testáveis; `WorldScene.ts` (1,1 mil linhas) concentra muito |
| Estabilidade | 8 → 9/10 | sem erros no console; chão e personagem gravados juntos (4), backup atômico (17); fuzz do protocolo e do inventário sem exceção nem duplicação |
| Segurança | 6 → 8/10 | nomes de admin reservados (1), sósias (9), limite de chat (15), cabeçalhos (23), dependências 15 → 0 avisos (24) |
| Desempenho | ? → 8/10 | carga com 10 bots: tick médio 0,2 ms (orçamento 50 ms); A* 30× mais rápido; heap do cliente plano; deploy baixa só o código do jogo. FPS com GPU ainda não medido |
| Game feel / UI | 8 → 9/10 | efeitos remotos filtrados (2), tour visual de todas as telas (#34–#45), novato sem travas na primeira missão (#39, #46), volume |
| Acessibilidade | 5 → 7/10 | dificuldade em texto e "!" (não só cor), foco visível no teclado, atalhos completos no F1 e /ajuda; sem toque (fora do escopo) |

Recheck em 2026-10-22 (185 commits depois, ciclo 5): notas mantidas. Arquitetura sem mudança de nota (`WorldScene.ts`
foi a 1.390 linhas, ainda não no ponto de dividir); Estabilidade e Segurança ganharam dois achados P2 novos (#47, #48)
sem rebaixar a nota (escopo pequeno, correção simples); Desempenho e Game feel / UI sem achado novo.
