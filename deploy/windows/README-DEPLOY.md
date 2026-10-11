# Tibinha - Deploy no Windows (rede do escritório)

Passo a passo para colocar o servidor no ar numa máquina Windows e deixar a galera jogar.

## 1. Requisitos

- **Node.js 24 LTS** - https://nodejs.org (instalador padrão; marque a opção de adicionar ao PATH).
- **Git** - https://git-scm.com (ou copie a pasta do projeto num pendrive).
- Máquina ligada e com IP fixo (ou reservado no roteador) para os jogadores não perderem o endereço.

Confira num PowerShell: `node -v` (deve mostrar v24.x) e `git --version`.

## 2. Baixar e preparar

```powershell
cd C:\
git clone <URL-DO-REPOSITORIO> tibinha
cd C:\tibinha
npm ci
npm run build
```

`npm run build` gera `packages\client\dist` (cerca de 20 MB). **O servidor em produção não sobe sem essa pasta.**

## 3. Primeiro teste (manual)

```powershell
npm run start:fast
```

(ou dê dois cliques em `deploy\windows\start-tibinha.cmd`). Abra `http://localhost:2567` no navegador da própria máquina.
Para parar: `Ctrl+C` (o servidor salva os jogadores antes de sair).

## 4. Testar de outro computador

1. Descubra o IP da máquina: `ipconfig` e procure **Endereço IPv4** do adaptador em uso (ex.: `192.168.0.10`).
2. Libere a porta no firewall (PowerShell **como administrador**):

   ```powershell
   powershell -ExecutionPolicy Bypass -File C:\tibinha\deploy\windows\firewall.ps1 -Port 2567
   ```

   A regra vale para redes Domínio e Privada. Se o Windows classificou a rede como "Pública", mude para "Privada" em Configurações > Rede.
3. Em outro PC da rede abra `http://192.168.0.10:2567` (use o seu IP).

> A conexão é HTTP, sem criptografia. Avise o pessoal para não reutilizar a senha do trabalho.

## 5. Instalar como serviço (inicia com o Windows)

Usamos o **NSSM** (https://nssm.cc/download): baixe o zip, extraia (ex.: `C:\nssm`) e use `win64\nssm.exe`.

### Opção automática

PowerShell **como administrador**:

```powershell
powershell -ExecutionPolicy Bypass -File C:\tibinha\deploy\windows\install-service.ps1 -RepoPath C:\tibinha -NssmPath C:\nssm\win64\nssm.exe -Port 2567
nssm start Tibinha
```

O script pode ser executado de novo para atualizar a configuração.

### Opção manual (o que o script faz)

```powershell
nssm install Tibinha
```

Na janela que abre:

| Aba | Campo | Valor |
| --- | --- | --- |
| Application | Path | `C:\Program Files\nodejs\node.exe` |
| Application | Startup directory | `C:\tibinha\packages\server` |
| Application | Arguments | `--import tsx src/index.ts` |
| Details | Startup type | Automatic |
| I/O | Output (stdout) | `C:\tibinha\logs\tibinha.out.log` |
| I/O | Error (stderr) | `C:\tibinha\logs\tibinha.err.log` |
| File rotation | Rotate files + Rotate while running + Restrict rotation to 1048576 bytes | marcados |
| Shutdown | Método | deixe apenas **Generate Ctrl+C** (timeout 20000 ms), desmarque os demais |
| Exit actions | Default action | Restart application, delay 5000 ms |
| Environment | Environment variables | uma por linha: `NODE_ENV=production` e `NODE_OPTIONS=--disable-warning=ExperimentalWarning` (e `PORT=...`, se mudar) |

Ou, tudo por linha de comando:

```powershell
nssm install Tibinha "C:\Program Files\nodejs\node.exe" "--import tsx src/index.ts"
nssm set Tibinha AppDirectory C:\tibinha\packages\server
nssm set Tibinha AppEnvironmentExtra NODE_ENV=production NODE_OPTIONS=--disable-warning=ExperimentalWarning
nssm set Tibinha AppStopMethodConsole 20000
nssm set Tibinha AppStopMethodWindow 0
nssm set Tibinha AppStopMethodThreads 0
nssm set Tibinha AppStdout C:\tibinha\logs\tibinha.out.log
nssm set Tibinha AppStderr C:\tibinha\logs\tibinha.err.log
nssm set Tibinha AppRotateFiles 1
nssm set Tibinha AppRotateOnline 1
nssm set Tibinha AppRotateBytes 1048576
nssm set Tibinha AppExit Default Restart
nssm set Tibinha AppRestartDelay 5000
nssm set Tibinha Start SERVICE_AUTO_START
```

(Crie a pasta `C:\tibinha\logs` antes.) O Ctrl+C no encerramento faz o servidor salvar tudo e fechar o banco corretamente.

Comandos úteis: `nssm start Tibinha`, `nssm stop Tibinha`, `nssm restart Tibinha`, `nssm status Tibinha`, `nssm remove Tibinha confirm`.

## 6. Atualizar o jogo

```powershell
nssm stop Tibinha
cd C:\tibinha
git pull
npm ci
npm run build
nssm start Tibinha
```

## 7. Variáveis de ambiente

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `2567` | Porta HTTP/WebSocket do servidor. |
| `TIBINHA_DB` | `data\tibinha.db` (na raiz do repo) | Caminho do banco SQLite. |
| `TIBINHA_BACKUP_DIR` | `data\backups` | Pasta onde o servidor grava os backups automáticos. |
| `TIBINHA_DEV_COMMANDS` | desligado | `1` habilita comandos de desenvolvimento (só para teste, **não** deixe ligado em produção sem necessidade). |
| `TIBINHA_ADMINS` | vazio | Nomes de personagens admin, separados por vírgula (ex.: `Leo,Ana`); usado com `TIBINHA_DEV_COMMANDS=1`. |
| `NODE_ENV` | - | Use `production` (o `npm run start:fast` já define). |

No serviço, acrescente-as em `AppEnvironmentExtra` (ex.: `nssm set Tibinha AppEnvironmentExtra NODE_ENV=production TIBINHA_BACKUP_DIR=D:\backups-tibinha`). Lembre que esse comando **substitui** a lista inteira.

## 8. Backups e restauração

O servidor gera backups do banco automaticamente em `data\backups` (ou em `TIBINHA_BACKUP_DIR`). Recomendado: apontar para outro disco ou pasta sincronizada.

Para restaurar:

```powershell
nssm stop Tibinha
cd C:\tibinha\data
copy backups\<ARQUIVO-DE-BACKUP>.db tibinha.db
del tibinha.db-wal, tibinha.db-shm
nssm start Tibinha
```

(Se o `del` reclamar que os arquivos não existem, tudo bem. Guarde uma cópia do `tibinha.db` antigo antes de sobrescrever.)

## 9. Problemas comuns

- **Servidor não sobe e pede para rodar `npm run build`**: falta `packages\client\dist`. Rode `npm run build` e inicie de novo.
- **Porta em uso (`EADDRINUSE`)**: outro programa (ou o serviço já rodando) usa a porta. Veja com `netstat -ano | findstr :2567`; encerre o processo ou mude `PORT`.
- **Funciona na própria máquina, mas não nos outros PCs**: firewall (rode `firewall.ps1`), rede classificada como Pública, ou IP errado (`ipconfig`). Teste a porta de outro PC: `Test-NetConnection 192.168.0.10 -Port 2567`.
- **Serviço não inicia**: veja `C:\tibinha\logs\tibinha.err.log`. Confirme que o caminho do `node.exe` está certo (`where node`) e que o Startup directory é `packages\server`.
- **Jogadores caem e voltam**: o cliente tenta reconectar sozinho por até ~20 s; se o servidor reiniciar, aparece "Você foi desconectado" com o botão "Voltar ao login".
- **"Muitas tentativas"** no login: aguardar alguns minutos.
