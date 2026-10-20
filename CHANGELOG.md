# Changelog

## [Não lançado] — 2026-10-17 · Terras Selvagens (expansão leste)

### Combate
- **Ataque automático** (`F9`, botão no cabeçalho da Batalha): sem alvo, o personagem escolhe sozinho o monstro mais
  próximo com linha de visão (fora da zona protegida). Com "seguir o alvo" ligado procura até 6 tiles e vai atrás; com
  ele desligado só pega o que já está ao alcance. O modo é salvo com o personagem.
- **Seguir jogador** (clique direito → *Seguir* / *Parar de seguir*): anda atrás do jogador até ficar ao lado. Mover
  manualmente, escolher um alvo de ataque, `Esc`, ou o jogador ficar a mais de 15 tiles cancelam. Seguindo, o
  personagem ainda ataca o que estiver ao alcance sem sair do jogador. Quem você segue fica marcado com um quadrado
  verde (no mundo e na Batalha).
- **Batalha**: clique direito num jogador da lista → *Atacar* / *Seguir*.
- **Correr** (*Pés Ligeiros*, `utani hur`): agora de todas as vocações (lv 5, 20 de mana), +30% de velocidade por 30 s,
  cooldown de 15 s (dá para manter sempre ligada) e fora do cooldown global (dá para correr e atacar em seguida). Antes era só do paladino (8 s, cd 30 s).

### PvP (estilo Tibia)
- **Jogadores podem se atacar em qualquer lugar fora da zona de proteção** (Vila, Centro de Treinamento e Posto da
  Fronteira), sem limite de level: clique direito → *Atacar*, ou clique no jogador na Batalha. Ataque básico e magias de
  alvo único atingem jogadores; magias de área só atingem o alvo atual, quem tem caveira ou quem atacou você (passar
  perto de um inocente não dá caveira). Não vale contra o próprio grupo nem no Coliseu.
- **Caveira branca** (15 min) para quem ataca um jogador sem caveira que não o atacou antes. O revide é justo.
- **Caveira vermelha** com 3 mortes injustas em 24 h (salvas no personagem): ao morrer, perde o dobro de XP e metade
  do ouro cai no chão.
- Depois de atacar um jogador, não se entra em zona de proteção por 1 min.
- A caveira aparece ao lado do nome do personagem.
- **Morrer tira a caveira branca** (e o bloqueio de PZ); a vermelha continua até as mortes saírem da janela de 24 h.
- **Morrer tira do grupo** (party). Cair no Coliseu não conta.

### Coliseu
- **Sem limite de pessoas** por grupo (antes, 4). A quantidade de monstros e a vida dos chefes continuam escalando com o
  tamanho do grupo.

### Interface
- Largar uma pilha no chão sempre abre a barrinha de quantidade (começa em tudo); antes só com `Shift`.
- Cabeçalho da Batalha: os botões de modo de luta não ficam mais por cima do título e do contador.
- **Nomes de personagem** aceitam números (com pelo menos uma letra) e vão até 20 caracteres (antes, 16 e só letras).

### Viagem
- **Cocheiros** Bastião (portão leste da Vila) e Zuleica (sul do Posto da Fronteira): carroça entre os dois por 150 de
  ouro, grátis até o level 8. Não dá para viajar em combate. Os dois NPCs entraram no mapa só como objetos (nenhum
  tile mudou).

### Mapa
- **O mapa passou de 160 para 280 colunas.** A expansão é gerada por `tools/mapgen/expansion.mjs` (semente própria) DEPOIS
  do mapa original: tudo nas 160 colunas antigas fica igual (mesmos tiles e mesmos ids de objeto), menos duas passagens
  abertas na borda leste (ruínas, y=22; pântano, y=70). Personagens salvos continuam no mesmo lugar.
- Regiões: Deserto de Zao (Fortaleza Orc), Picos Gelados (Monte Ciclope, Cemitério dos Olhos), Floresta Sombria (Forte
  Negro, boca do Labirinto), Vale dos Dragões (covil de Demodras) e o **Posto da Fronteira** (zona protegida com loja,
  depósito, sacerdote e batedora).
- Subterrâneo: **Labirinto dos Minotauros** (labirinto gerado, salão da Raposa Chifruda) e **Abismo** (behemoths,
  demônios e o trono de Orshabaal).

### Monstros e itens
- 11 monstros (lv 42-100): orc guerreiro/xamã, minotauro/minotauro mago, ciclope, olho maligno, cavaleiro negro,
  dragão, senhor dos dragões, behemoth, demônio. 3 chefes: Raposa Chifruda, Demodras e Orshabaal.
- Raids agendados: Fúria de Demodras (terça 20h) e Invasão de Orshabaal (sábado 21h).
- Tier 6 (lv 50) e tier 7 (lv 70) para as 4 vocações (só no loot), Botas da Pressa, anéis/amuletos de chefe,
  materiais novos e Presunto de Dragão.

### Docker
- `docker-compose.dev.yml`: ambiente de desenvolvimento (Vite em http://localhost:3100 + servidor na 2568, código montado, recarrega ao
  salvar), com nome de projeto próprio para não brigar com o de produção.

## [Não lançado] — 2026-10-17 · roupas novas

### Jogo
- **7 roupas novas estilo Tibia**, cada uma com 2 addons gerados por `tools/addons/generate.mjs`: Nórdico (capa de pele,
  escudo redondo), Mendigo (bengala, trouxa), Domador de Feras (pele de fera, chicote), Caçador de Demônios (chifres,
  espada larga), Peregrino (cajado com lanterna, cabaça), Senhor da Guerra (capa de guerra, martelo) e Monge (contas,
  bastão). Total: 20 roupas.
- Desbloqueio por conquistas: 13 novas (`bestiary_10`, `kills_2500`, `boss_10`, `boss_lich_5`, `boss_goblin_5`,
  `level_75`, `melee_80`, `shield_60`, `offline_3h`, `offline_48h`, `pickup_2000`, `steps_150k`, `explore_90`) e
  recompensas novas em conquistas que antes davam só título ou nada (escudo 40, Coliseu 10, pesca 100, missões 10,
  itens largados/pegos, exploração 25%, grupo).

## [Não lançado] — 2026-10-15 · ciclo 6 (retenção e qualidade de vida)

### Jogo
- **Desafios da semana** (diário de missões > "Desafios semanais"): Caçada (150 abates), Pescaria (12 peixes) e
  Evolução (um level de XP), medidos desde a segunda-feira, com resgate manual e bônus por cumprir os três. Resgate
  só se a mochila comportar os itens (tudo ou nada).
- **Ranking semanal** (XP, abates, peixes, chefes) que zera na virada da semana ISO, e categoria geral **Pescador**.
  A janela e a página pública mostram "zera em…".
- **Bestiário** (tecla B): abates por monstro, vida, XP, dano e tabela de drops; o que ainda não foi derrotado fica
  como "???" com o level à mostra.
- **Chefes na agenda**: Despertar do Lich (quarta 20h) e Caçada ao Rei Goblin (domingo 20h) convocam o chefe no spawn
  (com loot +50%). `/evento <nome>` também convoca.
- **Bônus de login** por dias seguidos (ciclo de 7 dias; dia 7 é o maior; faltar um dia volta ao dia 1). O dia de
  jogo troca às 6h de Brasília, como as recompensas diárias.

### Interface
- **Poção automática** (botão ⚗): limite de vida e de mana (0–90%) que bebe a primeira poção da mochila sozinho.
- **Acessibilidade** (botão Aa): texto maior nas janelas de leitura, alto contraste e animações reduzidas.
- **Novidades**: tela que abre uma vez por versão (e pelo botão da ajuda).
- **Aviso fora da aba**: o título da aba ganha "(2)" com sussurro, convite de troca/grupo, amigo entrando e evento.

### Servidor
- O evento disparado por `/evento` sobrevive a reinício. Avisos de entrada (amigos online, bônus de login) saem 3 s
  depois da entrada: antes se perdiam porque o chat do cliente ainda não escutava.

## [Não lançado] — 2026-10-15 · ciclo 5

### Interface
- **Chat sobre a cabeça do personagem**, como no Tibia: o canal geral aparece em amarelo e o do grupo em azul-claro,
  em itálico e menor que o nome (para não confundir com o nick), com até 3 linhas empilhadas. Some sozinho; texto
  longo vira "…" no balão (o chat guarda o inteiro).

- **Seta-guia do novato** (até o level 3, enquanto a 1ª missão não acaba): aponta o Capitão, depois a floresta dos
  ratos e de volta ao Capitão; na borda da tela mostra a distância em passos.
- **Emotes** (`/e coracao`, `/e rir`... ou o botão ☺ do chat): ícone sobre a cabeça por ~2 s (8 emotes).
- **Sussurro** (`/w Nome mensagem`, `/r` responde) e **amigos** (`/amigo Nome` adiciona/remove, `/amigos` lista com
  ● online / ○ offline; aviso quando um amigo entra ou sai). Nomes com espaço funcionam.
- **Troca entre jogadores** (botão direito > "Trocar itens"): janela com a oferta dos dois (itens + ouro); os dois
  confirmam e a troca é atômica (nada muda se a mochila de alguém encher); qualquer mudança zera as confirmações;
  cancela por distância, morte, Coliseu ou saída.
- **Pesca**: Vara de Pesca (Velho Caçador Tomé), botão direito na água perto da margem, 5 s parado (andar ou apanhar
  solta a linha); truta, salmão e peixe dourado (raro); a chance de morder cresce com os peixes pescados; conquistas
  "Pescador" e "Mestre Pescador".
- **Barra de ações editável**: arraste uma magia para outro slot (a ordem fica salva por personagem).
- **Eventos semanais com bônus** (etiqueta ★ no topo): Maré de Tesouros (quarta 12h, loot +50%), Noite de Caçada (sexta
  19h, XP ×2) e Tarde de Sábado (14h–16h, XP ×1,5 e loot +25%). Admin: `/evento` mostra o andamento, `/evento <nome>
  [min]` dispara na hora e `/evento parar` encerra.

### Jogo
- **Druida novato não ficava mais sem o 5º rato**: o respawn só acontecia com ninguém a 7 tiles, então quem esperava
  parado no centro do spawn o impedia de voltar. Respawn adiado por mais de 30 s agora nasce, a mais de 3 tiles do
  jogador (chefes seguem só a regra de 7). Primeira missão do druida: 4 de 6 → 8 de 8.

### Ferramentas e testes
- `npm run newbie` (`tools/newbie.mjs`): robô novato sem admin nas 4 vocações; sai com erro se alguma não entregar.
- Admin: `/status` (uptime, online e pico, monstros, tick médio/máx, memória, erros).
- E2E: em modo E2E a janela de reconexão cai de 20 para 2 s (`LEMONQUEST_RECONNECT_S`; em produção segue 20): sem
  personagens fantasmas do teste anterior. Playwright com 1 worker por padrão; Vitest com metade dos núcleos.

### Servidor
- **Sessões de conta sobrevivem a reinício/deploy**: ninguém precisa digitar a senha de novo. Só o hash SHA-256 do
  token vai para o SQLite (tabela `account_sessions`, migração v6); a validade segue 30 min sem uso, logout e troca
  de senha invalidam, e continuam no máximo 8 sessões por conta.

## [Não lançado] — 2026-10-14 · ciclo 4 (polimento da noite)

### Interface
- Ajuda de atalhos (F1) agrupada em Movimento / Combate / Janelas e com as teclas que faltavam: L (missões),
  I (equipamento e mochila), Q/E (poções), F5–F7 (modo de luta), F8 (seguir o alvo).
- Janelas (missões, conquistas, ranking, NPC, Coliseu, roupas, treino, diálogo de item, menu de contexto) com o
  fundo próprio, mais opaco: antes todas saíam com o fundo genérico translúcido e o mapa aparecia por trás do texto.
- Depot: abrir o Guarda-Volumes abre a mochila (e a barra lateral, se recolhida) para dar de onde arrastar; ao
  fechar, tudo volta como estava. Em telas baixas a mochila começa dobrada e o depot parecia não funcionar.
- Loja: nomes longos quebram em duas linhas ("Poção de Vida Média" e "Poção de Mana Média" saíam iguais, cortados).
- Nome da zona ao entrar numa área passa por baixo das janelas e cartões (antes cobria a janela aberta por 2 s).
- Conquistas: "0 / 1.310 pts" numa linha só; ranking de level sem a coluna "Lv" repetida.
- Cartão de **primeiros passos** no canto inferior direito: no topo ele cobria os avisos e o caminho do novato (o
  Capitão fica a noroeste, os ratos ao norte) — o clique para andar até lá caía no cartão e o personagem não saía do
  lugar. Avisos e barra/faixas do Coliseu ficam centrados na área de jogo (sem a barra lateral).
- Desconectado (servidor reiniciado, rede caiu): a tela agora diz **"Aguardando o servidor voltar…"** e depois **"O
  servidor está no ar. Pode voltar."** (consulta `/health` a cada 3 s) — antes não dava para saber quando clicar.
- Janela estreita (meia tela, barra lateral aberta): o chat cobria as 3 primeiras magias da barra; agora ele sobe para
  cima dela quando não cabe ao lado.
- Tela de morte mostra uma **dica** para quem está começando (até o level 10): poção no Q, um monstro por vez,
  descansar na vila, o "!" da lista de batalha.
- **Volume do som**: o botão ♪ abre um painel com volume (0–100%, lembrado) e mudo — antes era só ligar/desligar.
- Chat: **/ajuda** (ou /comandos, /help) lista os comandos de grupo e lembra das magias e do F1; admins veem também
  os comandos de admin. "Comando desconhecido." agora sugere o /ajuda.
- Loja: caixa **"Só da minha vocação"** (ligada por padrão, lembrada) esconde o que a sua vocação não usa — no Bento
  um mago via 35 itens, metade espadas e arcos; e um "Lv N" em vermelho marca o que pede level acima do seu.

### Jogabilidade
- **Personagem novo começa com "seguir o alvo" ligado** (F8): parado, ninguém alcançava o rato que foge com pouca
  vida e a primeira missão emperrava (robô novato: cavaleiro 2 ratos e druida 4 em 10 min — a Lasca de Gelo deixa o
  rato com ~3 de vida; feiticeiro 41–73 s). À distância, seguir só aproxima até o alcance. Quem já tem personagem fica
  com o modo que escolheu.

### Economia (proposta #31)
- Tier 4 (level 25) à venda: Bento (armas de todas as vocações e o conjunto de Aço), Velho Caçador Tomé (Arco
  Composto, conjunto de Franco-Atirador) e Dona Marta (Varinha Flamejante, Bastão do Pântano, conjunto Arcano).
  Conjunto completo: 22–27 mil de ouro. O tier 5 continua só no loot, nos chefes e nos baús.

### Fim de jogo (proposta #32)
- Espíritos de chama (lv 38–40): de 3 para 7, em dois bandos — 4 no lugar de sempre e 3 num ponto novo das ruínas a
  leste. O mapa (tiles, colisão, decoração) não muda: o ponto novo entra só como objeto no fim do gerador.

### Jogabilidade (proposta #33)
- Feiticeiro e druida ganham 6 de vida por level (antes 5): no level 30, 324 em vez de 295.
- Paladino ganha os conjuntos que faltavam: **Caçador** (level 15, vendido pelo Velho Caçador Tomé; botas na aranha,
  capuz no morcego) e **Arqueiro-Mestre** (level 35: homem-lagarto, espírito de chama e Rei Goblin). Antes o
  paladino ficava do level 8 ao 25 com o conjunto de Patrulheiro (armadura 4; cavaleiro 7) e sem peça de fim de jogo.

### Engenharia
- Arquivos do cliente com hash no nome (`/assets/*`) ficam 1 ano no cache do navegador (antes revalidavam a cada
  visita); `index.html`, mapa e sprites continuam revalidando, então um deploy novo chega no próximo F5. Sem o Caddy
  (`deploy/docker/docker-compose.https.yml`) o servidor não comprime nada (~2,4 MB de JS + mapa por carga) — o
  Caddy já faz `encode zstd gzip`.
- Phaser num arquivo próprio (1,2 MB) separado do código do jogo (265 kB): com o cache longo, um deploy novo faz os
  jogadores baixarem só o código do jogo. O E2E agora confere que a página pública `/ranking` existe (a segunda
  entrada do build chegou a sumir nessa mudança).
- E2E novo do depot (abre a mochila dobrada, guarda um item arrastando, devolve a mochila dobrada).
- E2E do chão: repete o clique de pegar se um monstro passar pelo tile.

## [Não lançado] — 2026-10-14 · ciclo 3 (polimento)

### Interface
- Balão do item mostra o **dano por golpe** da arma e compara com o atual (▲/▼); avisa quando a arma não supera lutar
  sem arma. A conta é a mesma do servidor.
- Coliseu: a janela mostra o level de cada membro e marca **"sem XP"** quem está fora da faixa.
- Telas baixas (720p/768p): minimapa menor, batalha com 3 linhas por padrão e uma faixa "▾" quando a barra lateral
  tem mais conteúdo abaixo.
- Lista de batalha diz a **dificuldade** da criatura em texto (fraca/normal/difícil/perigosa/chefe) e marca com "!"
  as perigosas e os chefes — não depende mais só da cor do nome.
- Chat: cada aba guarda as próprias 80 linhas (o Grupo não apaga o Geral); avisos do servidor contam como não lidos
  quando você está na aba Grupo.
- Nomes e números do mundo ficam nítidos ao arrastar a janela para um monitor com outra escala.

### Engenharia
- Login: se o servidor não responder em 15 s, aparece "Não foi possível conectar ao servidor." (antes ficava em
  "Carregando personagens…" para sempre).
- Hover do mouse sem alocação por frame; cursor só é escrito quando muda.
- Testes E2E do Coliseu e do grupo sem corridas com a pausa e com alvos abatidos por outros jogadores.
- Heap do cliente medido com 10 bots: estável (~49–50 MB).

### Jogabilidade
- Personagem novo vê um cartão de **primeiros passos** (andar, atacar, primeira missão, atalhos); some ao fechar ou
  no primeiro abate.
- Druida ganha **Lasca de Gelo** (*exori frigo*) no level 1: dano de gelo barato, como a Bola de Fogo do feiticeiro.
  Na barra ela entra na tecla 2 e as outras magias do druida andam uma tecla.
- Lobo um pouco mais fraco (vida 80, dano 6–15; mesma XP): a faixa 5–10 ficava pesada para magos.
- Armas de tier 1 um pouco mais fortes (Espada Curta 11, Clava 10, Arco Curto 9, varinha/graveto 7): a arma inicial
  continua melhor que o punho até o tier 2.
- Quem bateu num monstro e foi para longe também não conta mais o abate em missões e conquistas (mesma regra da XP).
- Sair do jogo de propósito no meio de uma luta não salva mais da morte: o personagem fica 20 s no mundo, igual a uma
  queda de conexão (fechar a aba já funcionava assim).
- Armas de tier 3 (level 15) agora são vendidas: Bento (todas as vocações), Velho Caçador (Arco Longo) e Dona Marta
  (Varinha da Tempestade, Bastão de Gelo). Antes cavaleiros e feiticeiros não tinham de onde tirar arma de tier 3.

## [Não lançado] — 2026-10-14 · ciclo 2

### Jogabilidade
- Kit inicial: personagem novo começa com a arma básica da vocação equipada, 3 Poções de Vida e 5 Carnes.
- Coliseu: XP das ondas só para quem está na faixa de level do grupo (≥ 2/3 do maior); quem está abaixo ganha só o
  ouro (aviso explica). Acaba com o "carregar" personagens level 1.
- Loot vai para quem mais bateu **e está perto** (12 tiles); quem bateu e foi embora não leva. A XP do abate também é
  dividida só entre quem está perto.
- Arma nunca dá menos dano que lutar desarmado (antes uma arma abaixo do seu tier batia menos que o punho).
- **Balanço:** o dano desarmado cresce bem mais devagar com o level (cerca de metade). Arma do seu tier bate 1,5–2,5×
  o punho; quem joga equipado fica no mesmo patamar de antes. Quem lutava sem arma deve comprar uma (o Bento vende
  tier 1 e 2) ou usar a do loot.

### Acessibilidade
- Foco por teclado visível em botões, links, selects e checkboxes.

### Engenharia
- Servidor depende de `@colyseus/core` em vez do meta-pacote `colyseus` (que trazia auth, monitor, playground e Redis
  sem uso): `npm audit` 15 → 0 avisos, bundle 5,4 → 2,4 MB.
- `tools/loadtest.mjs`: teste de carga com bots (10 jogadores: tick médio 0,2 ms de 50 ms).

## [Não lançado] — 2026-10-14 · auditoria, ciclo 1

Diagnóstico completo em [docs/GAME_AUDIT.md](docs/GAME_AUDIT.md); estado em [docs/GAME_ROADMAP.md](docs/GAME_ROADMAP.md).

### Segurança
- Nomes de admin (`LEMONQUEST_ADMINS`) ficam reservados: só contas em `LEMONQUEST_ADMIN_ACCOUNTS` criam personagens com
  eles (variantes com/sem acento incluídas). Antes, qualquer conta podia criar um nome de admin ainda livre e usar
  `/resetsenha` para tomar outras contas.
- Nomes novos só com letras latinas comuns (ASCII, Latin-1, Latin Extended-A): barra sósias como `Ｌｅｏ`, `ʟeo`, `ﬁ`.
  Nomes já existentes continuam valendo.
- Troca de senha por código de recuperação desconecta os personagens da conta que estão no mundo e anula tokens de
  entrada pendentes.
- Chat (incluindo comandos e palavras mágicas) limitado a 6 mensagens/s por jogador.
- Cabeçalhos: sem `X-Powered-By`; `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
- `LEMONQUEST_TRUST_PROXY` (opcional) para o limite de login por IP funcionar atrás do Caddy.

### Correções
- Largar/pegar item grava o personagem e o chão juntos, numa transação (no máximo 1×/s): uma queda brusca do servidor
  não duplica nem some mais com o item.
- `/kick` e troca de senha também derrubam quem caiu e está esperando reconexão.
- Testes E2E do Coliseu sem corrida com toasts/faixas efêmeros.
- Backup é gravado em `.tmp` e só então substitui o da hora (uma falha não apaga o backup anterior).
- A Investida do cavaleiro não para mais em cima de portal.
- Teclas de movimento voltam a funcionar depois de clicar em checkbox/select do HUD (rastrear missão, título).
- Teleporte visual não lança exceção se o jogador sai nos 40 ms seguintes.

### Experiência
- Efeitos visuais de combate/magias/mortes de outros jogadores só aparecem até 16 tiles; som atenuado com a distância
  (mudo a partir de 10 tiles). O que envolve você ou seu grupo nunca é filtrado.
- Luzes de magias e projéteis têm vagas reservadas no modo de luz "baixo" (tochas da cidade não as apagam mais).

### Desempenho
- A* reaproveita buffers: ~200–340 µs → ~6–11 µs por caminho curto, sem lixo por busca.
- HUD não re-renderiza quando outro jogador anda (`meStore`/`selectStore`).
- Listeners `onChange` por entidade são liberados quando a entidade sai (antes acumulavam a sessão toda).
- Chat com chaves estáveis por linha.
