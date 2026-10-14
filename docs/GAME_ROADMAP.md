# Roadmap — The Lemon Quest

Reflete o estado real. Números `#` = itens de [GAME_AUDIT.md](GAME_AUDIT.md). Status: ✅ concluído · 🔄 em andamento ·
⏳ pendente · 🧭 precisa de decisão do dono do jogo · ⛔ não fazer agora.

## Ciclo 1 (2026-10-14) — estabilidade, segurança e desempenho de base

| Etapa | Item | Status | Validação |
|---|---|---|---|
| A | #1 Nome de admin reservado na criação (inclui variantes com acento); liberar com `LEMONQUEST_ADMIN_ACCOUNTS` | ✅ | `auth.test.ts` (novo caso) |
| A | #9 Nomes novos só com letras latinas comuns (ASCII, Latin-1, Latin Ext-A) e NFKC; nomes antigos seguem válidos | ✅ | `auth.test.ts` (novo caso) |
| A | #4 Largar/pegar item grava jogador + chão juntos (transação), no máximo 1×/s (regravar o chão custa 1,4–7,3 ms com 100–2000 itens) | ✅ | `WorldRoom.test.ts` (novo caso) |
| A | #17 Backup grava em `.tmp` e só então substitui | ✅ | `persistence/*.test.ts` |
| A | #15 Limite de 6 msg/s para `C2S.Chat` (comandos e magias incluídos) | ✅ | unitários + E2E |
| A | #16 Investida não para em portal | ✅ | unitários de magias |
| A | #18 Teleporte visual com guarda do ator (`time.delayedCall`) | ✅ | typecheck + E2E |
| A | #20 Troca de senha derruba tokens pendentes e personagens online da conta (inclusive quem caiu e espera reconexão: `kick` cancela a reconexão) | ✅ | `recovery.test.ts`, `WorldRoom.test.ts` |
| A | #23 `x-powered-by` desligado; `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin` | ✅ | `curl -I /health` |
| A | #3 `LEMONQUEST_TRUST_PROXY` opcional (`req.ip`); documentado só com a 2567 fechada | ✅ | typecheck; sem teste com Caddy real |
| B | #5 Uma regra só de "digitando"; checkbox/select soltam o foco após mudar | ✅ | navegador (foco em checkbox + D anda) + E2E |
| C | #2 Efeitos de terceiros só até 16 tiles; som atenuado (cheio até 3, mudo a partir de 10); jogador e grupo nunca filtrados | ✅ | typecheck + E2E; avaliação manual de áudio pendente |
| C | #19 Chat com chave estável por linha | ✅ | typecheck |
| E | #6 `meStore`/`selectStore`: HUD só re-renderiza quando o jogador local muda | ✅ | `store.test.ts` (0 publicações com outro jogador andando) |
| E | #7 `onChange` por entidade solto no `onRemove` | ✅ | typecheck + E2E |
| E | #8 A* com buffers reaproveitados (geração) | ✅ | 200–340 → 6–11 µs/caminho (`pathfinding.bench.ts`); 0 diferenças em 9000 buscas aleatórias com bloqueios vs. a versão antiga |
| E | #25 Luz: vagas reservadas (1/3) para magias/projéteis recortados pela tela; o resto entra no fim se sobrar vaga | ✅ | typecheck + E2E |
| F | E2E do Coliseu instável (já falhava no código original: 1/9 em repetição) — toasts/faixas efêmeros agora são gravados por um MutationObserver | ✅ | `arena.spec.ts` 12/12 em 4 repetições |

## Próximos (ordem sugerida)

| Etapa | Item | Status | Nota |
|---|---|---|---|
| F | Medir FPS/heap numa sessão longa com vários clientes (antes/depois dos itens 2, 6, 7) | ⏳ | ainda não há medição em carga |
| F | Verificar hipótese de "fantasmas" após reconexão automática | ⏳ | E2E com rede cortada |
| E | #24 Trocar `colyseus` por `@colyseus/core` + `@colyseus/ws-transport` | ⏳ | some com os avisos do audit; testar boot/Docker. **Não** usar `npm audit fix --force` (rebaixa para 0.15) |
| C | Acessibilidade: dificuldade da criatura além da cor do nome; foco visível nos inputs | ⏳ | |
| E | #13 Timeout da predição baseado no RTT medido | ⏳ | baixo valor na LAN |
| A | #11 Saída voluntária em combate: manter o personagem ~6 s no mundo | ⏳ adiado | só cliente modificado chama `leave()`; fechar a aba já deixa o personagem 20 s no mundo. Atrasar a limpeza cria corrida com relogin — fazer só com teste dedicado |

## Precisa de decisão 🧭

| Item | Opções |
|---|---|
| #10 Coliseu e power-leveling | (a) exigir a regra de level do grupo (`partyLevelsOk`) para entrar; (b) escalar ondas pelo maior level; (c) XP do Coliseu só para quem está na faixa de level do maior. (a) é a mais simples e coerente com o grupo, mas impede jogar com colegas de level muito diferente |
| #26 Kit inicial | Começar desarmado parece intencional. Opção: arma básica da vocação + 2 poções + comida no primeiro login |
| #21 Loot para quem foi embora | Exigir que o maior causador de dano esteja a até ~12 tiles |
| #12 Backup fora do disco | Ligar `LEMONQUEST_BACKUP_COPY_DIR` em produção (pasta de rede/outro disco) |
| Admin em produção | Definir `LEMONQUEST_ADMIN_ACCOUNTS` com a(s) conta(s) dos admins, para poder recriar um personagem admin |

## Não fazer agora ⛔

- **Reescrever `WorldScene.ts`** (1,1 mil linhas): funciona e tem E2E; dividir só quando uma mudança exigir.
- **Interesse por área no servidor** (mandar combate só para quem está perto): o filtro no cliente resolve o
  sintoma; no servidor muda o protocolo e só compensa com bem mais que 32 jogadores.
- **Layout mobile/toque (#14)**: o público é o escritório no PC; custo alto sem demanda.
- **Atualizar dependências em massa**: nenhuma vulnerabilidade alcançável; risco de regressão sem ganho.
