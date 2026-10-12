@echo off
rem Inicio manual do HappyHour (producao). Fechar a janela ou Ctrl+C encerra o servidor.
rem Requer: npm ci e npm run build ja executados.
setlocal
cd /d "%~dp0\..\.."
if not exist "packages\client\dist\index.html" (
  echo [happyhour] Cliente nao compilado. Rodando npm run build...
  call npm run build || (echo Falha no build. & pause & exit /b 1)
)
if "%PORT%"=="" set PORT=2567
echo [happyhour] Iniciando na porta %PORT% - acesse http://localhost:%PORT%
call npm run start:fast
pause
