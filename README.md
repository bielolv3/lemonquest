# The Lemon Quest

Jogo multiplayer no navegador, inspirado em Tibia, feito para jogar com a galera na rede do escritório (~10 jogadores).
Monorepo com npm workspaces:

- `packages/shared` - tipos e regras compartilhados
- `packages/server` - servidor (Node 24 + Colyseus 0.18 + SQLite)
- `packages/client` - cliente (Vite + Phaser + Preact)

## Como jogar

Abra o endereço do servidor no navegador (ex.: `http://192.168.0.10:2567`), digite nome e senha.
Nome novo cria o personagem (senha de no mínimo 6 caracteres; escolha a vocação).
Esqueceu a senha? Peça um código a um admin e use "Esqueci minha senha". Para excluir um personagem: "Excluir" no cartão
dele, na lista de personagens (pede o nome e a senha da conta; não funciona com ele online ou treinando offline).

| Ação | Controle |
| --- | --- |
| Andar | `W A S D`, setas ou teclado numérico (7/9/1/3 = diagonais) |
| Andar até um ponto | clique esquerdo no chão |
| Atacar / soltar alvo | clique (esquerdo ou direito) na criatura |
| Falar com NPC | clique no NPC |
| Largar item no chão | arraste da mochila/equipamento para o mundo (até 3 tiles; `Shift` escolhe a quantidade) |
| Pegar item do chão | clique direito, duplo clique ou `Ctrl`+clique no item (ou arraste para a mochila) |
| Chat | `Enter` |
| Modo de luta | `F5` ofensivo, `F6` equilibrado, `F7` defensivo |
| Mapa | `M` |
| Ajuda com todos os atalhos | `F1` ou `?` |

Itens no chão somem em 10 min (raros ou melhores: 20 min) e também ao reiniciar o servidor (não são salvos).

Não use a mesma senha do trabalho: a rede do escritório não é criptografada (HTTP).

## Administradores

Admin = personagem listado em `LEMONQUEST_ADMINS` (vírgulas, sem diferença de maiúsculas/acentos: `"Leonardo, Ana Maria"`).
Os comandos de admin funcionam **também em produção** (os de dev — `/level`, `/item`... — continuam só com
`LEMONQUEST_DEV_COMMANDS=1` e nunca em produção). Para quem não é admin, todos respondem "Comando desconhecido.".
As respostas aparecem só para o admin (aviso + linha no chat). Toda ação fica no log do servidor com `[admin]`.

| Comando | O que faz |
| --- | --- |
| `/online` | Lista quem está online (com level). |
| `/kick <nome> [motivo]` | Desconecta o jogador; o motivo aparece na tela dele. |
| `/mute <nome> <minutos>` | Silencia no chat (magias continuam). Vale após relogar; funciona com o personagem offline. |
| `/unmute <nome>` | Tira o silêncio. |
| `/anuncio <texto>` | Faixa grande no centro da tela de todos + linha no chat. |
| `/tp <nome>` | Leva você para perto do jogador. |
| `/resetsenha <conta>` | Gera um **código de recuperação** (8 caracteres, vale 24 h, uso único) — só você vê. Passe para o dono da conta, que usa em "Esqueci minha senha" na tela de login. |

Nomes com espaço funcionam (`/kick Ana Maria spam`). Sem nenhum admin online, o dono do servidor gera o código pelo terminal:

```bash
npm run admin -- reset-password <conta>          # na pasta do projeto (usa LEMONQUEST_DB ou data/lemonquest.db)
npm run admin -- deleted                         # lista personagens excluídos (arquivo deleted_characters)
```

Docker: veja [deploy/docker/README.md](deploy/docker/README.md#9-administração).

## Desenvolvimento

```bash
npm ci
npm run dev          # servidor em :2567 + cliente (Vite) em http://localhost:3000
npm run typecheck
npm test
```

O Vite escuta só em `localhost`; para testar de outra máquina use `LEMONQUEST_DEV_LAN=1 npm run dev`.

## Produção (servidor do escritório)

```bash
npm ci
npm run build        # gera packages/client/dist (só os assets usados, ~20 MB)
npm run start:fast   # inicia o servidor em produção (serve o cliente na mesma porta)
npm start            # build + start
```

Em produção o servidor serve tudo na porta 2567 (`PORT` para mudar).

**Guia completo para Windows (serviço, firewall, backups, atualização):** [deploy/windows/README-DEPLOY.md](deploy/windows/README-DEPLOY.md)

**Com Docker (Windows, Linux ou Mac):** `docker compose up -d --build` — guia em [deploy/docker/README.md](deploy/docker/README.md).
