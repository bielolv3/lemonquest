# Changelog

## [Não lançado] — 2026-10-14 · auditoria, ciclo 1

Diagnóstico completo em [docs/GAME_AUDIT.md](docs/GAME_AUDIT.md); estado em [docs/GAME_ROADMAP.md](docs/GAME_ROADMAP.md).

### Segurança
- Nomes de admin (`LEMONQUEST_ADMINS`) ficam reservados: só contas em `LEMONQUEST_ADMIN_ACCOUNTS` criam personagens com
  eles (variantes com/sem acento incluídas). Antes, qualquer conta podia criar um nome de admin ainda livre e usar
  `/resetsenha` para tomar outras contas.
- Nomes novos só com letras latinas comuns (ASCII, Latin-1, Latin Extended-A): barra sósias como `Ｌｅｏ`, `ʟeo`, `ﬁ`.
  Nomes já existentes continuam valendo.
- Troca de senha por código de recuperação desconecta os personagens da conta que estão no mundo e anula tokens de
  entrada pendentes.
- Chat (incluindo comandos e palavras mágicas) limitado a 6 mensagens/s por jogador.
- Cabeçalhos: sem `X-Powered-By`; `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`.
- `LEMONQUEST_TRUST_PROXY` (opcional) para o limite de login por IP funcionar atrás do Caddy.

### Correções
- Largar/pegar item grava o personagem e o chão juntos, numa transação (no máximo 1×/s): uma queda brusca do servidor
  não duplica nem some mais com o item.
- `/kick` e troca de senha também derrubam quem caiu e está esperando reconexão.
- Testes E2E do Coliseu sem corrida com toasts/faixas efêmeros.
- Backup é gravado em `.tmp` e só então substitui o da hora (uma falha não apaga o backup anterior).
- A Investida do cavaleiro não para mais em cima de portal.
- Teclas de movimento voltam a funcionar depois de clicar em checkbox/select do HUD (rastrear missão, título).
- Teleporte visual não lança exceção se o jogador sai nos 40 ms seguintes.

### Experiência
- Efeitos visuais de combate/magias/mortes de outros jogadores só aparecem até 16 tiles; som atenuado com a distância
  (mudo a partir de 10 tiles). O que envolve você ou seu grupo nunca é filtrado.
- Luzes de magias e projéteis têm vagas reservadas no modo de luz "baixo" (tochas da cidade não as apagam mais).

### Desempenho
- A* reaproveita buffers: ~200–340 µs → ~6–11 µs por caminho curto, sem lixo por busca.
- HUD não re-renderiza quando outro jogador anda (`meStore`/`selectStore`).
- Listeners `onChange` por entidade são liberados quando a entidade sai (antes acumulavam a sessão toda).
- Chat com chaves estáveis por linha.
