<#
.SYNOPSIS
  Desliga a inicialização automática do servidor do The Lemon Quest (remove o atalho da pasta Inicialização).
  Não para o servidor que estiver rodando agora: para isso, feche a janela dele ou aperte Ctrl+C nela.
#>
$lnk = Join-Path ([Environment]::GetFolderPath("Startup")) "The Lemon Quest (servidor).lnk"
if (Test-Path $lnk) {
  Remove-Item -LiteralPath $lnk
  Write-Host "Inicialização automática desligada." -ForegroundColor Green
} else {
  Write-Host "Não havia atalho de inicialização ($lnk)."
}
