<#
.SYNOPSIS
  Libera a porta do LemonQuest no Firewall do Windows (entrada TCP, perfis Dominio e Privado).
  Execute como Administrador. Idempotente: recria a regra se ela ja existir.
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\firewall.ps1 -Port 2567
#>
param(
  [int]$Port = 2567,
  # Também libera em redes "Públicas" (use se o Wi-Fi do escritório estiver classificado como Pública).
  [switch]$IncludePublic
)

$ErrorActionPreference = "Stop"
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) { Write-Error "Execute este script como Administrador (botao direito no PowerShell > Executar como administrador)."; exit 1 }

$name = "LemonQuest (TCP $Port)"
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
$profiles = @("Domain", "Private"); if ($IncludePublic) { $profiles += "Public" }
New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $Port `
  -Action Allow -Profile $profiles | Out-Null

Write-Host "Regra '$name' criada (perfis: $($profiles -join ', '))."
Write-Host "Se a rede do escritorio estiver classificada como 'Publica', mude para 'Privada' em Configuracoes > Rede."
