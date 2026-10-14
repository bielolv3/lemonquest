# Auditoria — The Lemon Quest

Data: 2026-10-14 · Base: `e7a6e45` (main). Diagnóstico de engenharia, gameplay e operação. O andamento das correções
está em [GAME_ROADMAP.md](GAME_ROADMAP.md); testes em [TEST_PLAN.md](TEST_PLAN.md).

## 1. O que é o jogo

MMORPG 2D no navegador inspirado em Tibia, para ~10 colegas na rede do escritório. Monorepo TypeScript:
`shared` (regras, fórmulas, dados), `server` (Node 24 + Colyseus 0.18 + SQLite, tick de 50 ms, servidor autoritativo),
`client` (Vite + Phaser 3 para o mundo, Preact para o HUD). ~28 mil linhas, 470 testes unitários + 12 specs E2E.

**Loop principal:** escolher alvo → ataque automático + magias da vocação → loot com raridade e bônus → vender/comprar
no NPC → missões, recompensas diárias, Coliseu em grupo → subir level/skills → novas áreas (floresta, pântano,
ruínas, cavernas). 4 vocações (cavaleiro, paladino, feiticeiro, druida), 25 magias, 13 monstros + 2 chefes,
grupos com XP compartilhada, conquistas que liberam roupas/addons/títulos, ranking público, treino offline.

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

### Não confirmado

- **H** — Reconexão automática do SDK pode deixar "fantasmas" de entidades removidas enquanto offline.

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

| Área | Nota | Base |
|---|---|---|
| Arquitetura | 8/10 | servidor autoritativo, sistemas isolados e testáveis; `WorldScene.ts` (1,1 mil linhas) concentra muito |
| Estabilidade | 8/10 | sem erros no console; testes amplos; janelas de perda de dados pequenas (itens 4, 17) |
| Segurança | 6→8/10 | o item 1 era grave; resolvido junto com 9 e 15 |
| Desempenho | não medido em carga | só microbenchmark do A*; sem perfil de FPS com muitos jogadores |
| Game feel / UI | 8/10 | HUD caprichado, feedback de dano/morte/XP; ruído de efeitos remotos (item 2) |
| Acessibilidade | 5/10 | dificuldade só por cor do nome; foco visível fraco em inputs; sem toque |
