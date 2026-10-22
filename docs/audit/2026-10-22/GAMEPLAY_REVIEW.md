# Avaliação de gameplay — The Lemon Quest

Data: 2026-10-22 · Base: `main` em `22a00c7` (ciclo 8 aplicado) · Parte da auditoria em [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md).

Método: leitura dos dados e fórmulas reais (`packages/shared/src`) e dos sistemas do servidor, com números calculados
por scripts `tsx` sobre o próprio código (modelo de caça por vocação/level, bandos, Coliseu, curva de skills). Os
achados P1 foram conferidos de novo no código pelo orquestrador. **Nada foi jogado**: onde o resultado depende de
comportamento humano (puxar um monstro por vez, gastar poção, horário de jogo) está marcado como hipótese.

Legenda: **FATO** = lido/calculado no código · **HIPÓTESE** = precisa de playtest · **JC** = já conhecido no roadmap.

## 1. O que o jogo é

**Proposta:** "Tibia de escritório" — MMORPG 2D no navegador para ~10 colegas na LAN, com cliques e atalhos clássicos,
mundo pequeno e compartilhado, progressão lenta e social, pixel art própria. **Público provável:** colegas adultos,
nostálgicos de Tibia, sessões curtas (almoço, fim de tarde), 1–3 ativos ao mesmo tempo na maior parte do tempo.

**Core loop:**

1. Escolher alvo (clique / F9) → ataque automático a cada 2 s + magias por famílias (uma tecla, a mais forte pronta);
   o monstro revida, chama o bando (raio 6), foge a 15–20 % ou usa habilidade com aviso no chão.
2. Curar: poção Q/E (vida com recarga de 2 s, mana 1 s), `exura`, comida, regen (mana pela metade em combate).
3. XP por dano causado com estágios a partir do lv 40; grupo divide com +20 % por membro. Loot com raridade
   (70/20/7,5/2,2/0,3 %) e bônus; em grupo cai no chão sem dono.
4. Voltar à vila: vender (30 %), comprar poções e equipamento (tiers 1–5; 6–7 por encomenda semanal), depot, bênção,
   encantamento, tingimento, cassino.
5. Metas: 37 missões encadeadas até o lv 120, 3 recompensas diárias, encomenda semanal, 3 desafios semanais, bônus de
   login, 65 conquistas → 20 roupas, 40 addons, 24 títulos; bestiário; ranking semanal.
6. Social: Coliseu de 60 ondas, chefes com horário (almoço em dias úteis), quests de mundo (baús, portas, Aniquilação
   para 2–4), PvP com caveiras, troca, amigos, sussurro, emotes.
7. Fora do combate: pesca, treino offline de skills, tingimento por conta.

**Sistemas que sustentam a experiência:** servidor autoritativo com dados centralizados no `shared` (uma transformação
única aplicou o multiplicador do ciclo 8 a todos os monstros), 52 monstros com habilidades legíveis, calendário social
pensado para escritório, sinks de ouro simples e sem poder, novato guiado (seta, cartão, robô de regressão).

## 2. Progressão e curva

### XP e tempo por level (modelo cavaleiro "loja"; outras vocações ±5 %)

| Faixa | Realista (45 % do ideal) | Ideal | Observação |
|---|---|---|---|
| 1–10 | 1,6 h | 0,7 h | 1→2 em ~2 min; 1ª missão trivial (ratos sem multiplicador, sem elite, sem bando; respawn 20 → 14 s) |
| 10–40 | 5,3 h | 2,4 h | rápido para "progressão lenta", mas em 1 h/dia são 1–2 semanas: aceitável |
| 40–60 | 5,6 h | 2,5 h | estágio 0,5 |
| 60–80 | 10,7 h | 4,5 h | estágio 0,3/0,2 |
| 80–100 | 18,5 h | 7,6 h | estágio 0,2/0,12; solo inviável (GD-02) |
| 100–120 | 36 h | 14,7 h | **um único monstro comum** (colosso) no 110–120; 0 missões no 100–109 |
| **1→120** | **~78 h** | **~32 h** | só caça; as diárias encurtam muito (GD-01) |

### Buracos e saltos (FATO)

- **Lv 6–11:** só o lobo (agora em bando, respawn 28 s). 4 lobos tiram 19/s de um lv 7; cavaleiro limpa em 13 s
  gastando ~3,6 poções (142 de ouro) por 56 de ouro de abates; mago sem poção morre antes de limpar. **HIPÓTESE**
  (GD-06): a missão "Os Lobos" ficou mais punitiva e deficitária. O robô novato só vai até a 1ª missão.
- **Lv 18 → 24:** dano/s do monstro da faixa dobra (11,7 → 21,8–22,5) porque o ×1,4 entra no lv 20, e a Cripta tem
  bando de 10 esqueletos (198/s contra 95/s de cura) a um portal do pântano. Nada no jogo diferencia spawn comum de
  bando (GD-07, GD-15).
- **Equipamento à venda** só nos levels 1, 8, 15, 25 e 35; do 35 ao 120 nada novo além da encomenda semanal.
- **Magias por vocação:** cavaleiro sem nada do 15 ao 30 e do 50 ao 70; paladino só com Flecha Perfurante até o 15;
  **nenhuma vocação ganha magia do 90 ao 120** (36–50 h de caça realista sem botão novo).
- **Lv 85+ solo (GD-02):** spawn comum de 3 (senhor dos dragões, behemoth, cão infernal, demônio, colosso) mata em
  8–17 s quem leva 25–90 s para limpar, mesmo com tier 7 e poção grande a cada 2 s. Com 10 contas, quem chega ao 85+
  sem grupo online não caça. (Modelo; o próprio roadmap do ciclo 8 pede medição.)
- **Caves e bandos (lv 12–25):** spawn normal de 4 é confortável solo; bandos de 8–10 matam qualquer solo em 3–5 s e
  um grupo de 4 limpa em 10–13 s. Coerente com o pedido do dono ("bando para área"), desde que o jogador saiba que
  bando é conteúdo de grupo.

### Curva de skills (GD-04, FATO)

`skillTriesFor = base × (rate × 1,15)^(nível − início)` (`shared/skills.ts:18-22`) = ×1,265 por nível na skill
principal. Golpes acumulados do cavaleiro: melee 30 = 12 mil (6,9 h batendo sem parar), 40 = 131 mil (73 h),
**50 = 1,37 M (762 h), 60 = 14 M (8 000 h), 80 = 1,6 bilhões**. ML do mago: 40 ≈ 150 h, 50 ≈ 1 600 h. Treino offline de
12 h rende 0,07 nível em melee 40. Consequências: 6 conquistas (160 dos 1 980 pontos) e seus títulos são
inalcançáveis; a skill para de importar no lv 40; o treino offline é inútil no meio do jogo. Tibia usa ~1,1 por nível;
aqui o ×1,15 extra fecha a curva em ~45.

## 3. Balanceamento entre vocações (modelo "loja, realista")

| lv | vocação | vida | dano/s só com regen de mana | dano/s com poção de mana | cura sustentada |
|---|---|---|---|---|---|
| 50 | cavaleiro | 1 095 | **123** | 147 | 16/s |
| 50 | paladino | 830 | 92 | 159 | 20/s |
| 50 | feiticeiro | 594 | 95 | 176 | 34/s |
| 50 | druida | 594 | 94 | 157 | 34/s |
| 100 | cavaleiro | 1 895 | **200** | 283 | 55/s |
| 100 | paladino | 1 380 | 133 | 234 | 60/s |
| 100 | feiticeiro | 944 | 163 | **360** | 112/s |
| 100 | druida | 944 | 141 | 266 | 112/s |

- **Cavaleiro domina o jogo sustentado** (magias de 8–100 de mana contra 100–260 dos magos; 2× a vida; +2 de armadura
  pelo escudo). Na caça solo é a vocação "certa".
- **Mago só vira mago com poção de mana (GD-03):** no lv 50 a rotação pede 66 de mana/s e a regen em combate dá 16/s
  (`manaRegenAmount` divide por 2 em combate); sustentar custa ~447 Poções de Mana Grandes/h = **143 mil de ouro/h**
  (lv 100: 206 mil/h) contra 45–65 mil/h de renda ideal. Sem poção, o feiticeiro faz 25–35 % do dano de magia e vive
  da varinha. As famílias ◆ e as magias de área viram enfeite; as quatro vocações jogam de "auto-ataque + 1 magia".
- **Paladino é o mais fraco:** arco de duas mãos (sem escudo), ataque dos arcos abaixo dos machados (tier 7: 100 contra
  150), 10 de vida/level, e o alcance 6 perdeu a vantagem porque o bando responde a 6 tiles.
- **Druida:** dano mais baixo com poção, Cura em Grupo custa toda a regen (curandeiro = não atacar), Lobo Espiritual com
  stats fixos de lv 20 (inútil no 35+).
- **Em grupo**, o mago de área brilha nos bandos (62–107/s por alvo × 4) **se tiver poção de mana**. Aceitável para a
  identidade (Tibia é assim); o problema é o preço da mana.
- **Elites** bem calibradas (×3 XP por ×2,5 vida e ×1,3 dano): vale caçar. **PvP (HIPÓTESE):** cavaleiro tende a
  dominar; Escudo de Mana dá ~1 900 de "vida extra" ao feiticeiro no lv 50.

## 4. Economia

**Fontes** (ideal, ouro de abate/h): lobo 5,8 mil (lv 10) · goblin 17,6 mil (25) · orc 42 mil (42) · bárbaro 45 mil
(55) · dragão 40 mil (70) · behemoth 50 mil (90) · colosso 55 mil (110); loot vendável soma 30–100 %; diárias 1,5–10 mil
cada; missões 300 mil no total; Coliseu 13 mil até a onda 30, 118 mil as 60; encomenda semanal 1–15 mil.

**Sinks:**

| Sink | Preço | Avaliação |
|---|---|---|
| Poções de vida | 40/120/300 (0,67 g por HP) | o maior sink; **no lv 42+ curar com poção custa tanto quanto a renda de abates** (35–225 mil/h); sobra o loot vendável (GD-12) |
| Poções de mana | 45/130/320 (0,8–0,9 g por mana) | proibitivo: 3–4× a renda (GD-03) |
| Equipamento tier 2–5 | kit cavaleiro 2,4 mil / 6,6 mil / 40 mil / 134 mil | coerente: tier 4 ≈ 2–4 h, tier 5 ≈ 6–12 h |
| Encomenda tier 6–7 | arma 90–210 mil, 1 por semana | bom sink longo (kit tier 7 ≈ 560 mil ≈ 20–30 h) |
| Bênção | 200 × level (lv 100 = 20 mil) | **mal calibrada** (GD-09): protege 10 % do level = 6–8 min de caça por 25–40 min de renda; ninguém compra |
| Encantamento / tingimento | 5 mil + materiais / 8 mil × 8 tons por conta | pequenos, bom gosto |
| Cassino | ficha 1 mil; retorno esperado ≈ 335 | sink de verdade. O roadmap descreve outra tabela (40/30/15/10/5 com tom) que não é a do código |

**Inflação provável (HIPÓTESE):** até o lv 35 saudável; do 42 ao 70 quem cura com poção fica no zero (esperado num
Tibia); quem evita poção acumula ~20 mil/h e em 2 meses de 1 h/dia tem ~800 mil → encomenda tier 7 + tons bastam para
1 personagem; depois só o cassino. **O que resolve não é mais sink, é a mana**: se a poção de mana ficar sustentável,
o ouro passa a sair por aí (GD-03).

## 5. Variedade, rejogabilidade e fim de jogo

- **Sessão de 30–60 min:** 3 diárias (20–60 abates, dobram a XP da caçada + baú), encomenda semanal, chefe de almoço,
  1–3 ondas do Coliseu em grupo, uma missão, pesca. Cabe numa hora. Faltam mini-objetivos visíveis no HUD (as diárias
  só aparecem na janela do Quadro).
- **Motivos para voltar:** login seguido, diárias às 6 h, desafios/encomenda/ranking na segunda, chefes marcados.
  Completo para o tamanho. Fracos: ranking semanal **sem recompensa** (só grava a linha de base) e **metade dos
  eventos de XP fora do horário de escritório** (sex 19 h, sáb 14 h/21 h, dom 15 h) — HIPÓTESE, depende de quem joga de casa.
- **Grupo vs. solo:** o ciclo 8 empurrou para grupo, mas +20 % por membro faz 4 pessoas ganharem 40 % de um abate solo
  cada: em spawn comum o grupo perde XP por cabeça; só ganha em bando (GD-13). Tibia dá até +100 % com 4 vocações.
- **Fim de jogo (40–120):** Terras Selvagens + Costa Esmeralda cobrem 42–100 com 20 monstros, 6 chefes, 7 quests de baú
  e 14 missões — muito acima do que 10 colegas consomem em meses. Buracos: 100–120 com um monstro comum, 0 missões no
  100–109, nenhuma magia do 90 ao 120, Aniquilação/Ferumbras exigindo 2–6 jogadores de lv 100–120 ao mesmo tempo.
- **Coliseu (GD-10/GD-25):** o level "justo" de cada onda vale para grupo de 4; solo no justo cai 5–10 ondas antes
  (lv 50 → onda 24; lv 120 → 29); grupo de 4 no lv 50 chega à onda 37–38, lv 120 completa. O modelo oficial do teste
  usa Poção Grande (450) em todo level, inclusive lv 5–29. A missão "Glória no Coliseu" (onda 5) e a conquista da onda
  10 continuam alcançáveis solo no lv 12. Falta dizer na UI que o level é "para grupo de 4".
- **Monstros com habilidade mais fraca que o básico** (GD-16): tarântula e demônio perdem dano/s ao usar a habilidade.

## 6. Novato (primeiros 15 minutos)

**O que existe:** kit inicial (arma tier 1 + 3 poções + 5 carnes), seguir alvo ligado (JC #46), cartão "Primeiros
passos" no canto (JC #39), seta-guia até o lv 3, 1ª missão (5 ratos = lv 2, 30 de ouro, 5 poções), barra recomendada
com famílias, Novidades na 1ª entrada. Ritmo: lv 1→2 em ~2 min, 1→5 em 20–30 min, missões 2 e 3 fecham a meia hora.
**Está bem** e o ciclo 8 não mexeu na faixa (ratos sem multiplicador/elite/bando).

**Riscos de frustração:** (1) lobos (GD-06); (2) lv 20 na Cripta (GD-07/GD-15); (3) o "olhar" não diz que o monstro
chama o bando (hipótese: não conferido o texto para `pack`); (4) **PvP aberto desde o lv 1** fora da PZ — um colega de
lv 40 pode matar o novato na floresta; improvável entre 10 amigos, mas derruba a retenção no 1º dia (GD-19, decisão 🧭).

## 7. Pontos fortes e fracos

**Fortes:** loop de combate fiel ao Tibia com famílias de magia (qualidade de vida real); dados coerentes e
centralizados; 50 monstros com habilidades legíveis; calendário social para escritório; sinks sem poder; modelo de
calibração do Coliseu com o poder real; quests de mundo com baús de escolha; novato bem guiado e coberto por robô.

**Fracos:** (1) diárias ignoram os estágios de XP e viram a fonte dominante de level no 40+; (2) mana cara demais faz
as quatro vocações jogarem igual; (3) curva de skills fecha em ~45 e mata 6 conquistas; (4) o ciclo 8 fechou o solo
no lv 85+ e os bandos não se anunciam; (5) cavaleiro dominante, paladino sem papel; (6) 90–120 sem magia, item ou
missão nova; (7) bênção cara demais; (8) metade dos eventos fora do horário do público.

## 8. Achados

| ID | Cat. | Descrição | Evidência | Impacto | Grav. | Esf. | Risco | Deps. | Status | Recomendação | Critério verificável |
|---|---|---|---|---|---|---|---|---|---|---|---|
| GD-01 | Progressão | XP das recompensas diárias = abates × XP cheia, **sem estágio**: `bounties.ts:78` (`xp: count × d.xp`) → `quests.grant` → `combat.gainXp` sem `applyXpStage` (só em `combat.ts:423` e `arena.ts:480`). No lv 100, 3 diárias ≈ 6,5 levels/dia contra ~1 h/level de caça; no lv 40 uma diária ≈ 1 level | conferido | Fim de jogo vira "logar e entregar diárias"; estágios do ciclo 7 não valem. Pode ser decisão de design ("dobra a caçada"), mas contradiz os estágios | **P1** | P | B | decisão do dono | FATO | `applyXpStage` na XP da diária, ou teto de 25 % do level por diária (missões da cadeia continuam cheias) | No lv 100 uma diária de 20 demônios dá ≤ 25 mil XP; teste em `quests.test.ts` |
| GD-02 | Balanço | Solo inviável no lv 85+ (ver §2); lv 65–72 no limite | modelo; `MONSTER_DAMAGE_TIERS` ×1,6/1,7; `HEALTH_POTION_CD_MS` 2 s; spawns de 3 em `expansion*.mjs` | Quem chega ao 85+ sem grupo online não caça | **P1** | P | M | medir `playedMs`/mortes (roadmap ⏳) | FATO (modelo) / HIPÓTESE (jogo) | ×1,35/×1,45 no 70+/100+ **ou** spawns comuns de 2; manter bandos | Modelo: cavaleiro lv 90 loja sobrevive a 3 behemoths e limpa em < 60 s; jogo: < 1 morte/h no Abismo |
| GD-03 | Economia / vocações | Mana insustentável para magos (ver §3) | `manaRegenAmount` (metade em combate), `items.ts:158-160`, custos em `spells.ts` | Feiticeiro/druida jogam de auto-ataque | **P1** | P | M (Coliseu assume poção à vontade) | — | FATO (modelo) | Poções de mana 50/150/400 → 120/350/900 pelo mesmo preço **ou** regen cheia em combate para magos **ou** −30 % nas áreas | Custo de sustentar a rotação ≤ 30 % da renda de abates no lv 50 e 100 (script) |
| GD-04 | Progressão | Curva de skills ×1,265 por nível (ver §2) | `skills.ts:18-22` conferido | 6 conquistas inalcançáveis; skill irrelevante no 40+; treino offline inútil | **P1** | P | M (+15–25 % de dano no fim; compensar com GD-02) | GD-02 | FATO | `rate^from` sem o ×1,15 (ou 1,12 fixo); tentativas acumuladas continuam valendo (sem migração) | Melee 60 ≤ 150 h de golpes contínuos; ML 40 ≤ 60 h |
| GD-05 | Vocações | Cavaleiro domina; paladino o mais fraco; Lobo Espiritual fixo em lv 20 | §3; `items.ts:300-340`; `monsters.ts:155-159` | Escolha de vocação não é escolha | P2 | P | B | GD-03 | FATO (modelo) / HIPÓTESE (sentir) | Arcos +15 % ou crítico 10 % para paladino; lobo escala com o level; reavaliar após GD-03 | Dano/s sustentado das 4 vocações dentro de ±15 % no lv 50 e 100 |
| GD-06 | Novato | Lobos (lv 6–10) com bando e respawn 28 s: deficitário em poção; mago sem poção morre | `monsters.ts:135-153`; modelo | 2ª parede do novato | P2 | P | B | — | HIPÓTESE | Estender `tools/newbie.mjs` até "Os Lobos"; se confirmar, bando só para a fuga ou spawn de 3 | Robô entrega "Os Lobos" nas 4 vocações com ≤ 1 morte |
| GD-07 | Progressão | Salto de dano 18 → 24 e bando de 10 esqueletos na entrada da Cripta | §2; `caveSpawns` em `generate.mjs` | Morte-surpresa do lv 20 | P2 | P | B | GD-15 | FATO | 1º bando da Cripta com 6 ou mais fundo; aviso de zona | Lv 22 loja sobrevive a 1 pull do 1º grupo (modelo) |
| GD-08 | Conteúdo | 90–120 sem magia; 100–109 sem missão; 110–120 um monstro comum | `spellsFor`, `QUEST_LIST`, `expansion2.mjs` | 36–50 h sem novidade | P2 | M | B | — | FATO | 1 magia utilitária por vocação no lv 110; 2 missões 100–110; 1 elite "nomeado" | Cada vocação ≥ 1 magia entre 95 e 115; ≥ 2 missões com minLevel 100–109 |
| GD-09 | Economia | Bênção a 200 × level não vale o que protege; roadmap descreve cassino diferente do código | `blessingPrice`, `deathPenalty`, `npcs.ts:206-222` | Bênção não vende; doc errada | P2 | P | B | — | FATO | Bênção 50 × level (ou penalidade de morte maior sem bênção); corrigir o roadmap | Bênção comprada em ≥ 30 % das mortes de lv 40+ (log) |
| GD-10 | Coliseu | Level "justo" vale para grupo de 4; UI não diz; modelo do teste usa poção grande em todo level | `arena.ts` `ARENA_WAVES`; `arena.test.ts:489` | Expectativa errada ("sou do level, por que morri?") | P2 | P | B | — | FATO (modelo) | Texto "level justo para grupo de 4"; teste com poção do level | Texto do Mestre/janela diz "grupo de 4"; teste com 60/180/450 passa |
| GD-12 | Economia | Poção de vida como cura principal custa 35–225 mil/h no 42–110 contra 32–55 mil/h de abate | §4 | Caça no zero para quem usa poção | P2 | P | M | GD-03 | FATO (modelo) / HIPÓTESE (uso) | Medir ouro líquido/h real (`/status`); se negativo no 42–70, poção grande 300 → 220 | Ouro líquido/h ≥ +10 mil no lv 50 em sessão real |
| GD-13 | Grupo | +20 % por membro pune a XP por cabeça em spawn comum | `party.ts:12` conferido | Desincentivo a grupo num jogo que empurra para grupo | P2 | P | B | — | FATO | 0,35 por membro e +20 % com ≥ 3 vocações diferentes | Grupo de 4 em spawn comum ≥ 90 % da XP/h solo (modelo) |
| GD-14 | Retenção | Metade dos eventos fora do horário de escritório; ranking semanal sem recompensa | `events.ts:25-40`, `weekly.ts` | Eventos vazios; ranking sem gancho | P2 | P | B | — | FATO / HIPÓTESE (hábitos) | Noite de Caçada num almoço; título rotativo "Campeão da semana" | Presença em evento ≥ 3 jogadores (log) |
| GD-15 | UX de design | Nada diferencia spawn comum de bando; "olhar" não diz que chama o bando | `caveSpawns`; cartão de olhar (texto para `pack` não conferido) | Morte-surpresa nas caves | P2 | P/M | B | — | HIPÓTESE | "bando" no cartão de olhar e na lista de batalha; aviso ao entrar em cave com bando | E2E: olhar um lobo mostra "chama o bando" |
| GD-16 | Monstros | Habilidades mais fracas que o básico (tarântula, demônio) | tabela `monsters.ts` | Inconsistência | P3 | P | B | — | FATO | Tarântula 40–75; demônio 180–320 | `abDps ≥ 0` para todos no script |
| GD-17 | Economia | Após ~2 meses por personagem sobra só o cassino como sink | §4 | Inflação lenta | P3 | — | — | GD-03 | HIPÓTESE | Nada agora; se GD-03 entrar, a mana vira o sink; senão, Marca de Caça (reserva do roadmap) | Ouro médio de lv 60+ ≤ 300 mil após 2 meses |
| GD-18 | Conteúdo | Cavaleiro sem magia do 15 ao 30 e do 50 ao 70; paladino só Flecha Perfurante até o 15 | `spellsFor` | 15 levels sem botão novo | P3 | P | B | GD-08 | FATO | Se GD-08 entrar, um golpe do cavaleiro no 22 | — |
| GD-19 | PvP | Sem proteção de novato; `/quem` com zona de todos | `pvp.ts:70-76`, `social.ts:135-146` | Grief possível no 1º dia | P2 | P | B | decisão 🧭 | JC | Ver §9 | Lv 40 não mira lv 5 fora de PZ; `/quem` de terceiro sem zona |
| GD-20 | Chão | Descarte por raridade **já implementado no ciclo 7** (`PROTECTED_RARITIES`, `evictionVictim`) | `ground.ts:33, 344-351` conferido | — | — | — | — | — | JC 🧭 → **fechar** | Marcar ✅ no roadmap | — |
| GD-21 | Grupo | Loot sem dono: atrito social raro | `loot.ts:174-196`; colunas `owner/owner_until` sem uso | — | P3 | P/M | B | — | JC 🧭 | Manter + linha no chat do grupo ao pegar raro+ + prioridade de 15 s para o grupo | E2E: não-membro só pega após 15 s |
| GD-22 | Montaria | Bloqueada por arte | roadmap | — | P3 | G | — | — | JC 🧭 | Não fazer (cosmético, fora da identidade clássica) | — |
| GD-23 | Novato | 1ª missão intacta após o ciclo 8 | `monsterDamageMult`, `ELITE_MIN_LEVEL` | — | P3 | — | — | — | FATO | Rodar `npm run newbie` para confirmar | 4/4 vocações entregam (já era 49–56 s) |

## 9. Decisões abertas do roadmap (🧭) — recomendação

| Decisão | Recomendação | Fundamento |
|---|---|---|
| Proteção de novato no PvP | Reaproveitar a regra dos 2/3 já usada no grupo: `a` só pode **iniciar** ataque contra `b` se `partyLevelsOk([a.level, b.level])`, ou `b` tem caveira, ou `b` atacou `a` antes (revide sempre permitido). Sem level mínimo fixo, sem opt-in | `pvp.ts:70-76` não olha level. Regra conhecida, "justa" no sentido Tibia, impede o lv 40 de caçar o lv 5 sem impedir duelos parelhos. Esforço P (2 linhas em `canAttack` + teste) |
| `/quem` mostrando zona | Zona só de amigos, grupo e de quem está em PZ; para os demais só level/vocação | `social.ts:135-146`. Tibia não mostra onde ninguém está. Esforço P |
| Descarte do chão por raridade | **Já feito no ciclo 7** — marcar ✅ | `ground.ts:33, 344-351` |
| Atrito do loot sem dono | Manter o chão sem dono (fidelidade ao Tibia) + dois amortecedores baratos: linha no chat do grupo ao pegar raro+ do chão; prioridade de 15 s para membros do grupo usando `owner/owner_until` (colunas já existem) | Épico/lendário tem 2,5 % de chance por item: disputa rara mas marcante |
| Montaria | Não fazer. Se um dia entrar, como "addon traseiro tingível" reaproveitando o `backSheet` existente | Risco de asset + identidade clássica |

## 10. Melhorias de maior impacto para o jogador (valor ÷ esforço)

1. **Estágio de XP nas diárias** (GD-01) — 1 linha + teste; restaura a progressão do 40+.
2. **Mana sustentável para magos** (GD-03) — faz feiticeiro/druida existirem e resolve o "ouro sem destino".
3. **Curva de skills** (GD-04) — devolve 6 conquistas, o treino offline e o sentido da skill.
4. **Fim de jogo solo viável com risco** (GD-02) — ×1,35/1,45 ou spawns de 2; medir antes e depois.
5. **Paladino e druida** (GD-05) — arcos +15 % / crítico; lobo escalando.
6. **Grupo que compensa** (GD-13) — 0,35 por membro + bônus de vocações.
7. **Marcar bandos** (GD-15/GD-07) — olhar, lista de batalha, aviso de cave.
8. **Faixa 90–120** (GD-08) — 1 magia por vocação no 110, 2 missões 100–110.
9. **Calibrações pequenas** (GD-09/GD-10/GD-14/GD-16) — bênção 50 × level, texto do Coliseu, evento num almoço,
   título do ranking, habilidades de tarântula/demônio.

Mecânicas novas que **não** propomos: mercado, guilda, casas, montaria — fogem do tamanho (10 pessoas) ou da identidade;
o roadmap já as deixou de fora com razão.

## 11. Incertezas que mais precisam de playtest

1. **Mortes por level no 65+** com o dano ×1,6/1,7 (GD-02). Pré-requisito: `playedMs` + mortes por level no `/status`
   (pendência do roadmap).
2. **Gasto real de poção (vida e mana) por hora** no 40–70 (GD-03, GD-12): decide se a economia é deficitária ou
   inflacionária e se o mago existe.
3. **Lobos no lv 6–10 e o 1º bando da Cripta no lv 20** (GD-06, GD-07): o robô novato estendido responde a primeira em
   minutos; a segunda pede um jogador real.

## 12. Roteiro de teste manual (UX + gameplay, ~25 min, 1366×768, Chrome)

1. Login limpo em aba anônima: senha de 5 caracteres (erro claro), depois 6; criar personagem; anotar o que aparece nos
   primeiros 30 s. A Mochila está visível sem rolar? Há "▾" no fim da coluna? (UX-08)
2. F5 com o jogo aberto: muda a postura e **não** recarrega? Depois Ctrl+F5. (UX-01)
3. Esc em pilha: L (Diário) depois O (Roupas) → Esc fecha qual? J + R: Ranking cobre Conquistas? Clicar na de baixo sobe? (UX-03/04)
4. Aa → "Muito grande"; abrir Novidades, Diário, Desafios, Bestiário: o × está visível? (UX-05)
5. Alto contraste ligado: ler "Ninguém por perto", distância na Batalha, CAP/ARM, hora do chat. (UX-06)
6. Arrastar uma poção e soltar na fresta entre o trilho e a coluna: caiu no chão sem confirmação? (UX-02)
7. Bento, aba Vender, duplo clique numa Carne: vendeu sem confirmar? (UX-02)
8. Gerar 5 avisos (Q sem poção), rolar o chat para cima, apertar Q: o chat pula para o fim? Botão direito sobre o
   chat abre o menu do navegador? (UX-16/14)
9. Floresta/caverna com bando: legibilidade de nomes e barras sobrepostos, mana nos slots a 1 m do monitor, telegraph em
   tile claro, elite dourada × "difícil" amarelo; druida com 9 slots: o chat subiu sobre a barra? (UX-12/13/19/20)
10. Com um colega: Coliseu até a pausa da onda 5 e receber convite de grupo e de troca nesse momento: ficam legíveis?
    Morrer uma vez: a tela de morte fala da bênção? (UX-10/22). Lv 7 contra 4 lobos e lv 20 no 1º bando da Cripta:
    quantas poções, quantas mortes? (GD-06/07)
