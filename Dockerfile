# The Lemon Quest — imagem de produção (servidor + cliente buildado, uma porta só).
#
#   docker compose up -d --build        (veja docker-compose.yml e deploy/docker/README.md)
#
# Etapa 1: instala tudo e gera o build do cliente (packages/client/dist).
# Etapa 2: imagem enxuta só com o necessário para rodar o servidor.

# ---------------------------------------------------------------- build
FROM node:24-bookworm AS build
WORKDIR /app

# Manifestos primeiro: o `npm ci` fica em cache enquanto as dependências não mudarem.
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# ---------------------------------------------------------------- runtime
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=2567 \
    LEMONQUEST_DB=/app/data/lemonquest.db \
    LEMONQUEST_BACKUP_DIR=/app/data/backups \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

# Só dependências de produção + o tsx (o servidor roda TypeScript direto, como no Windows).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
# (só os workspaces do servidor e do shared: Phaser/Vite/Preact do cliente não entram na imagem final)
# O npm instala os workspaces todos; removemos o que só o cliente/build usa (Phaser, Vite/Rolldown,
# TypeScript) e o uWebSockets.js (o servidor usa o transporte `ws`). Economiza ~300 MB.
RUN npm ci --omit=dev --no-audit --no-fund -w @lemonquest/server -w @lemonquest/shared \
 && npm install --no-save --no-audit --no-fund tsx@4.23.15 \
 && rm -rf node_modules/phaser node_modules/uWebSockets.js node_modules/typescript \
           node_modules/vite node_modules/rolldown node_modules/@rolldown \
           node_modules/@preact/preset-vite node_modules/@babel \
 && npm cache clean --force

# Código do servidor/compartilhado, config do TypeScript (decorators do estado), mapa e o cliente já compilado.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY assets/maps/world.json assets/maps/world.json
COPY --from=build /app/packages/client/dist packages/client/dist

# Banco e backups ficam num volume (sobrevivem a recriar o container).
RUN mkdir -p /app/data/backups && chown -R node:node /app/data
VOLUME ["/app/data"]

EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||2567)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# SIGTERM (docker stop) → o servidor salva todos os jogadores e fecha o banco antes de sair.
STOPSIGNAL SIGTERM
WORKDIR /app/packages/server
# Começa como root só para acertar o dono da pasta de dados (bind mounts no Linux chegam como root)
# e então troca para o usuário `node` (sem privilégios) com o `exec`, que vira o processo principal.
CMD ["sh", "-c", "chown -R node:node /app/data && exec setpriv --reuid=node --regid=node --init-groups node --import tsx src/index.ts"]
