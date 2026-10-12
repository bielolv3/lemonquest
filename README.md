# Tibinha

Jogo multiplayer no navegador, inspirado em Tibia, feito para jogar com a galera na rede do escritório (~10 jogadores).
Monorepo com npm workspaces:

- `packages/shared` - tipos e regras compartilhados
- `packages/server` - servidor (Node 24 + Colyseus 0.18 + SQLite)
- `packages/client` - cliente (Vite + Phaser + Preact)

## Como jogar

Abra o endereço do servidor no navegador (ex.: `http://192.168.0.10:2567`), digite nome e senha.
Nome novo cria o personagem (senha de no mínimo 6 caracteres; escolha a vocação).

| Ação | Controle |
| --- | --- |
| Andar | `W A S D`, setas ou teclado numérico (7/9/1/3 = diagonais) |
| Andar até um ponto | clique esquerdo no chão |
| Atacar / soltar alvo | clique (esquerdo ou direito) na criatura |
| Falar com NPC | clique no NPC |
| Chat | `Enter` |
| Modo de luta | `F5` ofensivo, `F6` equilibrado, `F7` defensivo |
| Mapa | `M` |
| Ajuda com todos os atalhos | `F1` ou `?` |

Não use a mesma senha do trabalho: a rede do escritório não é criptografada (HTTP).

## Desenvolvimento

```bash
npm ci
npm run dev          # servidor em :2567 + cliente (Vite) em http://localhost:3000
npm run typecheck
npm test
```

O Vite escuta só em `localhost`; para testar de outra máquina use `TIBINHA_DEV_LAN=1 npm run dev`.

## Produção (servidor do escritório)

```bash
npm ci
npm run build        # gera packages/client/dist (só os assets usados, ~20 MB)
npm run start:fast   # inicia o servidor em produção (serve o cliente na mesma porta)
npm start            # build + start
```

Em produção o servidor serve tudo na porta 2567 (`PORT` para mudar).

**Guia completo para Windows (serviço, firewall, backups, atualização):** [deploy/windows/README-DEPLOY.md](deploy/windows/README-DEPLOY.md)
