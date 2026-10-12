# The Lemon Quest — rodando com Docker

Alternativa ao serviço do Windows (NSSM). Funciona igual em Windows (Docker Desktop), Linux ou Mac.
A imagem tem o servidor e o cliente já compilado; o jogo fica em `http://<IP-da-máquina>:2567`.

> **Use um ou outro.** O serviço do Windows (`LemonQuest`, via NSSM) e o container usam a mesma porta 2567.
> Para trocar para o Docker, pare e desative o serviço primeiro (passo 2).

## 1. Requisitos

- Docker com Compose v2 (`docker compose version`). No Windows: Docker Desktop com WSL2.
- A pasta do projeto (git clone ou cópia).

## 2. Trocar do serviço do Windows para o Docker (só se o NSSM estiver instalado)

PowerShell **como administrador**:

```powershell
C:\nssm\win64\nssm.exe stop LemonQuest        # para o servidor (salva os jogadores)
Set-Service LemonQuest -StartupType Disabled  # não sobe mais com o Windows
```

**Levar os personagens para o container** (o banco do serviço fica em `data\`, o do Docker em `docker-data\`):

```powershell
cd C:\Users\leocs\Desktop\lemonquest
mkdir docker-data -Force
copy data\lemonquest.db docker-data\lemonquest.db
```

(Só o `.db` basta: o servidor fecha o banco direito ao parar, então os arquivos `-wal`/`-shm` ficam vazios.)

## 3. Subir

Na pasta do projeto:

```powershell
docker compose up -d --build
```

A primeira vez leva alguns minutos (baixa a imagem do Node e compila o cliente). Depois:

```powershell
docker compose ps          # STATUS deve ficar "healthy"
docker compose logs -f     # acompanhar (Ctrl+C sai do log, não para o jogo)
```

Abra `http://localhost:2567`. De outro PC: `http://<IP-desta-máquina>:2567` (o firewall precisa liberar a porta 2567 — veja `deploy\windows\firewall.ps1`).

## 4. Dia a dia

| Ação | Comando (na pasta do projeto) |
| --- | --- |
| Parar (salva todos os jogadores) | `docker compose stop` |
| Iniciar de novo | `docker compose start` |
| Reiniciar | `docker compose restart` |
| Ver logs | `docker compose logs -f` |
| Ver estado | `docker compose ps` |
| **Atualizar o jogo** | `git pull` e depois `docker compose up -d --build` |
| Remover o container (os dados ficam em `docker-data\`) | `docker compose down` |

**Inicia junto com o Windows?** Sim: o container tem `restart: unless-stopped`, então volta sozinho sempre que o Docker iniciar. No Docker Desktop, ative *Settings → General → Start Docker Desktop when you sign in to your computer*. (Diferente do NSSM, o Docker Desktop só sobe quando alguém entra no Windows. Num servidor Linux o Docker sobe no boot.)

## 5. Dados e backups

- Banco: `docker-data\lemonquest.db`. Backups automáticos de hora em hora: `docker-data\backups\` (48 h de horários + 1 por dia por 14 dias).
- Restaurar um backup:

  ```powershell
  docker compose stop
  copy docker-data\backups\<ARQUIVO>.db docker-data\lemonquest.db
  del docker-data\lemonquest.db-wal, docker-data\lemonquest.db-shm
  docker compose start
  ```

  (Se o `del` reclamar que os arquivos não existem, tudo bem.)

## 6. Configuração

Edite `docker-compose.yml` (seção `environment`) e rode `docker compose up -d` de novo:

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `2567` | Porta dentro do container (para mudar a porta de fora, altere `ports: "NOVA:2567"`). |
| `TZ` | `America/Sao_Paulo` | Fuso dos nomes de backup e dos logs. |
| `LEMONQUEST_DEV_COMMANDS` | desligado | `"1"` liga /level, /item etc. **Não use no escritório.** |
| `LEMONQUEST_ADMINS` | vazio | Personagens que podem usar os comandos de dev (ex.: `"Leonardo"`). |

## 7. Servidor Linux do escritório (repositório privado no GitHub)

O código fica em `github.com/leocsd/lemonquest` (privado). No servidor:

1. **Docker**: `curl -fsSL https://get.docker.com | sh` e `sudo usermod -aG docker $USER` (saia e entre de novo). Confira com `docker compose version`.
2. **Chave de leitura só deste repositório (deploy key)** — assim o servidor baixa o código sem usar a sua conta:

   ```bash
   ssh-keygen -t ed25519 -f ~/.ssh/lemonquest_deploy -N "" -C "servidor-escritorio"
   cat ~/.ssh/lemonquest_deploy.pub
   ```

   Cole a chave pública em GitHub → repositório → *Settings → Deploy keys → Add deploy key* (deixe **sem** "Allow write access"). Depois:

   ```bash
   cat >> ~/.ssh/config <<'EOF'
   Host github-lemonquest
     HostName github.com
     User git
     IdentityFile ~/.ssh/lemonquest_deploy
     IdentitiesOnly yes
   EOF
   git clone git@github-lemonquest:leocsd/lemonquest.git ~/lemonquest
   ```

3. **Levar os personagens** (opcional): pare o jogo na máquina antiga (`docker compose stop`) e copie o banco para o servidor:

   ```bash
   # na máquina antiga (PowerShell), por exemplo:
   scp C:\Users\leocs\Desktop\lemonquest\docker-data\lemonquest.db usuario@IP-DO-SERVIDOR:~/lemonquest/docker-data/
   ```

   (Crie a pasta antes no servidor: `mkdir -p ~/lemonquest/docker-data`.)
4. **Subir**: `cd ~/lemonquest && docker compose up -d --build`, depois `docker compose ps` até ficar *healthy*.
5. **Firewall** (se usar ufw): `sudo ufw allow 2567/tcp`. O jogo fica em `http://IP-DO-SERVIDOR:2567`.
6. **Inicia com o servidor**: o Docker sobe no boot no Linux e o container tem `restart: unless-stopped` — não precisa de mais nada (confira com `sudo systemctl is-enabled docker`).
7. **Atualizar** quando houver versão nova no GitHub: `cd ~/lemonquest && git pull && docker compose up -d --build`.

> Não deixe a máquina antiga e o servidor rodando o jogo ao mesmo tempo com o mesmo banco copiado — cada um vira um "mundo" separado. Depois de migrar, desligue o antigo (`docker compose down`).

## 8. Como a imagem é montada

- `Dockerfile` em duas etapas: a primeira instala tudo e gera o build do cliente; a final (`node:24-bookworm-slim`, ~500 MB) leva só o servidor, as dependências de produção, o mapa e o cliente compilado.
- O processo roda como o usuário `node` (sem privilégios). Na partida o container acerta o dono da pasta `/app/data`, para funcionar também com pastas montadas no Linux.
- `docker stop` manda SIGTERM: o servidor salva todos os jogadores e fecha o banco antes de sair (até 30 s, `stop_grace_period`).
- Healthcheck em `/health` a cada 30 s.

## Problemas comuns

- **`port is already allocated` / porta 2567 em uso**: o serviço do Windows ainda está rodando — veja o passo 2 — ou outro programa usa a porta (`netstat -ano | findstr :2567`).
- **Fica `unhealthy`**: `docker compose logs` mostra o motivo.
- **Funciona no PC, mas não nos outros**: firewall do Windows (porta 2567) ou rede classificada como Pública.
