# Changelog

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
- Personagem novo: os avisos do topo ("Missão aceita", "Teleportado…") ficavam **atrás** do cartão de primeiros
  passos; agora aparecem logo abaixo dele. Avisos e barra/faixas do Coliseu ficam centrados na área de jogo (sem a
  barra lateral), alinhados com os outros cartões.
- **Volume do som**: o botão ♪ abre um painel com volume (0–100%, lembrado) e mudo — antes era só ligar/desligar.
- Chat: **/ajuda** (ou /comandos, /help) lista os comandos de grupo e lembra das magias e do F1; admins veem também
  os comandos de admin. "Comando desconhecido." agora sugere o /ajuda.
- Loja: caixa **"Só da minha vocação"** (ligada por padrão, lembrada) esconde o que a sua vocação não usa — no Bento
  um mago via 35 itens, metade espadas e arcos; e um "Lv N" em vermelho marca o que pede level acima do seu.

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
