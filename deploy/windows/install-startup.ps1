<#
.SYNOPSIS
  Faz o servidor do The Lemon Quest iniciar sozinho quando o usuário entra no Windows.
  Cria um atalho (janela minimizada) na pasta Inicialização do usuário atual. Não precisa de administrador.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\install-startup.ps1
  powershell -ExecutionPolicy Bypass -File .\install-startup.ps1 -RepoPath C:\lemonquest
#>
param(
  # Pasta do projeto (padrão: duas pastas acima deste script).
  [string]$RepoPath = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
)

$ErrorActionPreference = "Stop"
$cmd = Join-Path $RepoPath "deploy\windows\start-lemonquest.cmd"
if (-not (Test-Path $cmd)) { throw "Não encontrei $cmd. Confira o -RepoPath." }
if (-not (Test-Path (Join-Path $RepoPath "packages\client\dist\index.html"))) {
  Write-Warning "O cliente ainda não foi compilado. Rode 'npm run build' na pasta $RepoPath (o atalho também compila na primeira vez, mas demora mais)."
}

$startup = [Environment]::GetFolderPath("Startup")
$lnk = Join-Path $startup "The Lemon Quest (servidor).lnk"
$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut($lnk)
$s.TargetPath = $cmd
$s.WorkingDirectory = $RepoPath
$s.WindowStyle = 7   # minimizada
$s.Description = "Inicia o servidor do The Lemon Quest"
$s.Save()

Write-Host "Pronto: o servidor vai iniciar quando você entrar no Windows." -ForegroundColor Green
Write-Host "Atalho: $lnk"
Write-Host "Para iniciar agora sem reiniciar o PC: dê dois cliques em $cmd"
Write-Host "Para desfazer: powershell -ExecutionPolicy Bypass -File `"$PSScriptRoot\remove-startup.ps1`""
