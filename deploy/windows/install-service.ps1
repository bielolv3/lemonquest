<#
.SYNOPSIS
  Instala (ou reconfigura) o LemonQuest como servico do Windows usando o NSSM.
  Execute como Administrador. Idempotente: pode rodar de novo para atualizar a configuracao.
.PARAMETER RepoPath
  Pasta do repositorio (padrao: duas pastas acima deste script).
.PARAMETER NssmPath
  Caminho do nssm.exe (padrao: procura no PATH e em C:\nssm\win64\nssm.exe).
.PARAMETER Port
  Porta do servidor (padrao 2567).
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install-service.ps1 -RepoPath C:\lemonquest -NssmPath C:\nssm\win64\nssm.exe
#>
param(
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path,
  [string]$NssmPath = "",
  [int]$Port = 2567
)

$ErrorActionPreference = "Stop"
$svc = "LemonQuest"

$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Error "Execute como Administrador."; exit 1 }

# --- nssm ---
if (-not $NssmPath) {
  $cmd = Get-Command nssm.exe -ErrorAction SilentlyContinue
  if ($cmd) { $NssmPath = $cmd.Source } elseif (Test-Path "C:\nssm\win64\nssm.exe") { $NssmPath = "C:\nssm\win64\nssm.exe" }
}
if (-not $NssmPath -or -not (Test-Path $NssmPath)) {
  Write-Error "nssm.exe nao encontrado. Baixe em https://nssm.cc e informe -NssmPath."; exit 1
}

# --- node ---
$node = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $node) { Write-Error "node.exe nao encontrado no PATH. Instale o Node 24 LTS."; exit 1 }

# --- repo ---
$server = Join-Path $RepoPath "packages\server"
if (-not (Test-Path (Join-Path $server "src\index.ts"))) { Write-Error "Repositorio invalido: $RepoPath"; exit 1 }
if (-not (Test-Path (Join-Path $RepoPath "packages\client\dist\index.html"))) {
  Write-Error "Cliente nao compilado. Rode 'npm ci' e 'npm run build' em $RepoPath primeiro."; exit 1
}
$logs = Join-Path $RepoPath "logs"
New-Item -ItemType Directory -Force $logs | Out-Null

# Nota: o servico continua rodando o TypeScript direto com tsx (src/index.ts). Alternativa sem tsx: `npm run build:server`
# e usar AppParameters "dist/server.mjs" (a pasta de trabalho continua packages/server; NODE_ENV=production).
# --- instala / atualiza ---
# Daqui em diante o nssm.exe pode escrever mensagens normais no stderr; no Windows PowerShell 5.1 isso,
# com ErrorActionPreference=Stop, vira erro fatal. Por isso relaxamos para Continue e checamos $LASTEXITCODE.
$ErrorActionPreference = "Continue"
$exists = [bool](Get-Service -Name $svc -ErrorAction SilentlyContinue)
if (-not $exists) {
  & $NssmPath install $svc $node "--import tsx src/index.ts" | Out-Null
} else {
  Write-Host "Servico '$svc' ja existe: atualizando configuracao."
  & $NssmPath set $svc Application $node | Out-Null
  & $NssmPath set $svc AppParameters "--import tsx src/index.ts" | Out-Null
}

& $NssmPath set $svc AppDirectory $server | Out-Null
& $NssmPath set $svc DisplayName "LemonQuest (servidor do jogo)" | Out-Null
& $NssmPath set $svc Description "Servidor do jogo LemonQuest (Colyseus)" | Out-Null
& $NssmPath set $svc Start SERVICE_AUTO_START | Out-Null
& $NssmPath set $svc AppEnvironmentExtra "NODE_ENV=production" "PORT=$Port" "NODE_OPTIONS=--disable-warning=ExperimentalWarning" | Out-Null

# Parada graciosa: Ctrl+C no console para o servidor salvar os jogadores.
& $NssmPath set $svc AppStopMethodSkip 0 | Out-Null
& $NssmPath set $svc AppStopMethodConsole 20000 | Out-Null
& $NssmPath set $svc AppStopMethodWindow 0 | Out-Null
& $NssmPath set $svc AppStopMethodThreads 0 | Out-Null

# Logs com rotacao (1 MB)
& $NssmPath set $svc AppStdout (Join-Path $logs "lemonquest.out.log") | Out-Null
& $NssmPath set $svc AppStderr (Join-Path $logs "lemonquest.err.log") | Out-Null
& $NssmPath set $svc AppRotateFiles 1 | Out-Null
& $NssmPath set $svc AppRotateOnline 1 | Out-Null
& $NssmPath set $svc AppRotateBytes 1048576 | Out-Null

# Reinicia se cair (apos 5 s)
& $NssmPath set $svc AppExit Default Restart | Out-Null
& $NssmPath set $svc AppRestartDelay 5000 | Out-Null

Write-Host ""
Write-Host "Servico '$svc' configurado." -ForegroundColor Green
Write-Host "Proximos passos:"
Write-Host "  1. Libere a porta:   powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\firewall.ps1`" -Port $Port"
Write-Host "  2. Inicie o servico: nssm start $svc    (ou: Start-Service $svc)"
Write-Host "  3. Teste:            http://localhost:$Port  e, de outro PC, http://<IP-DESTA-MAQUINA>:$Port"
Write-Host "  Logs em: $logs"
Write-Host "  Variaveis opcionais (LEMONQUEST_DB, LEMONQUEST_BACKUP_DIR, ...): veja README-DEPLOY.md"
