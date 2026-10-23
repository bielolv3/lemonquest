# The Lemon Quest — imagem de produção (servidor + cliente buildado, uma porta só).
#
#   docker compose up -d --build        (veja docker-compose.yml e deploy/docker/README.md)
#
# Etapa 1 (build): instala tudo e gera o cliente (packages/client/dist) e o servidor empacotado com esbuild
#                  (packages/server/dist/server.mjs — um arquivo só, com todas as dependências dentro).
# Etapa 2 (runtime): Alpine + só o binário do Node + o bundle + mapa + cliente. Sem node_modules, sem tsx, sem npm.

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

# ---------------------------------------------------------------- node (só o binário)
FROM node:24-alpine AS nodebin
# strip: tira a tabela de símbolos/debug do binário (não afeta a execução; -20 a -40 MB).
RUN apk add --no-cache binutils && strip --strip-all /usr/local/bin/node && node --version

# ---------------------------------------------------------------- runtime
FROM alpine:3.22 AS runtime
# libstdc++/libgcc: exigidos pelo binário do Node no Alpine · tzdata: TZ=America/Sao_Paulo (backups e logs).
# setpriv: o de verdade (o do busybox não tem --reuid) (o do busybox não tem --reuid).
RUN apk add --no-cache libstdc++ libgcc tzdata setpriv
COPY --from=nodebin /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
ENV NODE_ENV=production \
    PORT=2567 \
    LEMONQUEST_ROOT=/app \
    LEMONQUEST_DB=/app/data/lemonquest.db \
    LEMONQUEST_BACKUP_DIR=/app/data/backups \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning

# Usuário sem privilégios (mesmo uid/gid 1000 do `node` das imagens oficiais).
RUN addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node

# O mapa (o servidor e o cliente leem o MESMO arquivo), o cliente compilado (com os .gz do build:server — o servidor
# só os usa se forem mais novos que o original, e aqui são: o world.json vem do contexto, os .gz da etapa de build)
# e o servidor empacotado.
COPY assets/maps/world.json assets/maps/world.json
COPY --from=build /app/packages/client/dist packages/client/dist
COPY --from=build /app/packages/server/dist/server.mjs /app/packages/server/dist/admin.mjs packages/server/dist/

# Banco e backups ficam num volume (sobrevivem a recriar o container).
RUN mkdir -p /app/data/backups && chown -R node:node /app/data
VOLUME ["/app/data"]

EXPOSE 2567
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||2567)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# SIGTERM (docker stop) → o servidor salva todos os jogadores e o chão, e fecha o banco antes de sair.
STOPSIGNAL SIGTERM
# Começa como root só para acertar o dono da pasta de dados (bind mounts no Linux chegam como root)
# e então troca para o usuário `node` (sem privilégios) com o `exec`, que vira o processo principal.
CMD ["sh", "-c", "chown -R node:node /app/data && exec setpriv --reuid=node --regid=node --init-groups node packages/server/dist/server.mjs"]
