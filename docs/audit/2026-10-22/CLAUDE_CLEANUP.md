# Arquivos auxiliares do Claude Code e documentação — inventário e decisões

Data: 2026-10-22 · Base: `22a00c7` · Parte da auditoria em [REPOSITORY_AUDIT.md](REPOSITORY_AUDIT.md).

## 1. Situação encontrada

O projeto é desenvolvido com Claude Code como ferramenta principal (354 commits em 11 dias, ciclos de auditoria com
agentes), mas **não tinha nenhuma configuração do Claude no repositório**:

| Item | Estado em `22a00c7` |
|---|---|
| `CLAUDE.md` do projeto | não existia |
| `.claude/` | só `worktrees/` (pasta vazia desde 12/10); a pasta inteira está no `.gitignore` desde `cad8fc1` |
| `.claude/agents`, `commands`, `skills`, `rules`, `settings.json`, hooks, `.mcp.json` | não existem |
| Memória do projeto (perfis `.claude-daniel` e `.claude`) | vazia (o perfil antigo tem só transcrições `.jsonl`, não lidas) |
| `CLAUDE.md` global do usuário | fala só dos projetos "embeddo" (IoT); irrelevante para este jogo |
| `.claude.json` global, entrada deste projeto | `allowedTools: []`, `hasTrustDialogAccepted: true`, `mcpServers: {}` |

Consequência: cada sessão nova começava do zero, sem saber da regra "nunca aponte para `data/`", dos E2E instáveis,
das decisões ⛔/🧭 do roadmap nem de onde está o quê. O contexto vivia em ~700 linhas de docs (README + ROADMAP +
AUDIT) e no CHANGELOG (534 l.).

## 2. Inventário e classificação

Regras aplicadas: nada do jogo, assets, saves ou configuração operacional foi classificado como Remover; só o que tem
zero referências (grep em código, docs, CI, Dockerfile, scripts) e cuja função foi entendida.

### 2.1 Arquivos de contexto e documentação (tracked)

| Arquivo | Finalidade | Referenciado por | Atualizado? | Decisão | Justificativa |
|---|---|---|---|---|---|
| `README.md` (163 l.) | Como jogar, controles, admin, dev, E2E, produção | READMEs de deploy, CHANGELOG | parcial | **Atualizar** | Tabela de admin com 7 comandos; código (`admin.ts:23`) tem 10 (faltam `/status`, `/evento`, `/desbloquear`). Não cita `npm run smoke` nem as teclas de janela I/K/O/L/J/R/B. `dist` "~20 MB" (é 25). Resto conferido e correto |
| `CHANGELOG.md` (534 l.) | Histórico por ciclo | README | sim (ciclo 8) | **Manter + atualizar formato** | 21 seções `[Não lançado]` sem versão nem tag; tudo já está em produção. Entrada de 21/10 (estágios de XP) ficou desatualizada pelo ciclo 7 sem nota |
| `docs/GAME_AUDIT.md` (214 l.) | Achados `#1–#49`, método, "o que está sólido", notas | README, CHANGELOG, ROADMAP | parcial | **Manter (histórico) + corrigir números** | Define a numeração `#N` citada em 60+ linhas do ROADMAP/CHANGELOG, não pode sumir. Números defasados: 41 magias (39), ~44 mil linhas (49,1 mil), `WorldScene` 1.390 (1.459), 672 testes (774) |
| `docs/GAME_ROADMAP.md` (337 l.) | Status, pendências, decisões 🧭/⛔ | README, CHANGELOG, AUDIT | sim, com contradições | **Consolidar/reestruturar** | Única fonte de status: deve continuar. Problemas: afirma que `proposta/todas` "recebe por merge tudo" (parada em 15/10, não mesclada); cabeçalho "nenhum item decidido" sobre tabela com 7 ✅; odds do cassino de rascunho (40/30/15/10/5) diferentes da tabela e do código (45/35/15/5); seção "Próximos" com 2 de 3 itens ✅; ciclos 1–6 (130 l., 100 % ✅) no meio do doc vivo; pendência "E2E de 2º jogador pegando loot" já coberta por `ground.spec.ts:38` |
| `docs/TEST_PLAN.md` (111 l.) | Camadas de teste e resultados | README, AUDIT, ROADMAP | **não** (parado em 15/10) | **Atualizar** | Camadas corretas; resultados param no ciclo 5 ("497 testes", "28 E2E"); nada dos ciclos 7, 7b, 8 |
| `assets/CATALOG.md` (465 l.) | Catálogo do pack Ninja Adventure | ninguém no código (só `.dockerignore`) | sim | **Manter** | Referência de arte (layout 4×7, licença da fonte). Linkado agora no `CLAUDE.md` |
| `assets/ninja/README.md`, `LICENSE.txt` | Atribuição CC0 | CATALOG; copiados para o `dist` | sim | **Manter** | Licença viaja com o pack |
| `deploy/docker/README.md` (236 l.), `deploy/windows/README-DEPLOY.md` (216 l.) | Guias de produção | README, Dockerfile, compose, scripts | parcial | **Atualizar (pequeno)** | Listas de admin com 7 e 6 comandos; tabela de env vars sem `TRUST_PROXY`, `RECONNECT_S`, `LOGIN_BONUS` |
| `.github/workflows/ci.yml` | CI | TEST_PLAN, AUDIT | sim | **Manter** | Bate com `package.json`; melhorias em IMPROVEMENT_ROADMAP (cache do Playwright, timeout, smoke) |

### 2.2 Configuração operacional (tracked) — nunca remover

`Dockerfile`, `docker-compose.yml`, `docker-compose.dev.yml`, `deploy/docker/{docker-compose.https.yml, Caddyfile*}`,
`deploy/windows/*.ps1`, `start-lemonquest.cmd`, `.gitignore`, `.dockerignore`, `.gitattributes`, `package.json`,
`vitest.config.ts`, `playwright.config.ts`, `tsconfig.base.json`: **Manter**. Observações (não são limpeza):
`docker-compose.yml:22` commita nomes reais de admin (repo privado; sugestão `.env` em IMPROVEMENT_ROADMAP);
`vitest.config.ts` e `shared/{package,tsconfig}.json` apontam para `packages/shared/data/`, pasta inexistente (ARQ-06).

### 2.3 Ferramentas em `tools/` (tracked)

| Arquivo | Decisão | Justificativa |
|---|---|---|
| `build-public.mjs`, `build-server.mjs` | **Manter** | Build |
| `smoke.mjs`, `newbie.mjs`, `loadtest.mjs`, `fuzz.mjs` | **Manter** | Usados pelos docs/scripts; `smoke` só precisa ser documentado |
| `addons/`, `icons/`, `favicon/` | **Manter** | Geram assets do jogo |
| `mapgen/{generate,expansion,expansion2,lib,lemon,polish,stamps,speeds}.mjs`, `floor-terrain.json` | **Manter** | Núcleo do gerador do mapa |
| `mapgen/{crop,view,dump-terrain,lemon-sheet,sheet,pal}.mjs` | **Investigar** | Utilitários manuais de inspeção sem referência externa; `dump-terrain.mjs` ainda aponta para `assets/ninja-adventure`. Confirmar com o dono se continuam em uso |
| `gen-placeholder-map.mjs` | **Remover (proposto; não removido)** | Zero referências em código, docs, scripts e CI; mapa placeholder 60×60 anterior ao mapgen; se rodado **sobrescreve** `assets/maps/world.json`. É arquivo do projeto, não do Claude: fica para aprovação do dono |

### 2.4 Assets (tracked) — nunca remover por esta auditoria

| Pasta | Decisão | Nota |
|---|---|---|
| `assets/ninja/` (2 234 arq., 109 MB) | **Manter** | Pack usado pelo build |
| `assets/ninja-adventure/` (298 arq., 6,8 MB) | **Investigar** | Projeto Godot de exemplo do pack (`project.godot`, `.gd`, `.tscn`, `.import`) e um `tes4A3E.tmp`. Nada do jogo usa; já fora da imagem Docker. Só `dump-terrain.mjs` (one-off já consumido) e `gen-placeholder-map.mjs` (obsoleto) o leem. Recomendação ao dono: tirar do git (fica no histórico), ou ao menos apagar o `.tmp` |
| `assets/{maps,tiles,icons,favicon,addons}/` | **Manter** | Gerados pelos `tools/`, usados pelo jogo. `maps/preview*.png` (7,9 MB, commitado 8×) deveria deixar de ser versionado (ARQ-07) |

### 2.5 Não tracked / ignorados no disco

| Pasta | O que é | Decisão |
|---|---|---|
| `data/` (`lemonquest.db` + WAL 226 KB + `backups/`) | **Save real** do servidor local | **Manter — não tocar** (nenhum arquivo foi aberto) |
| `docker-data/`, `docker-data-dev/` | Bancos dos containers | **Manter** |
| `logs/` (2 arquivos de 12/10) | stdout/stderr do serviço NSSM | **Manter (ignorado)**; obsoleto nesta máquina, o serviço recria |
| `playwright-report/`, `test-results/` | Saída da última rodada E2E | **Manter (gerado)**; os artefatos da falha de hoje foram copiados para o scratchpad antes da nova rodada |
| `tools/mapgen/_v/` (8 PNG) | Previews de depuração do gerador | **Manter (gerado, ignorado)** |
| `packages/client/.public/`, `packages/*/dist/` | Saídas de build | **Manter (gerado)** |
| `.claude/worktrees/` | Pasta vazia desde 12/10 | **Removida** (ver §4) |

### 2.6 Branches

| Branch | Estado | Decisão |
|---|---|---|
| `auditoria-ciclo-1`, `ciclo-7`, `ciclo-8`, `feature/magias-e-atalhos`, `melhorias/pvp-habilidades-ritmo`, `pr-4`, `proposta/31-tier4-a-venda`, `proposta/32-mais-espiritos`, `proposta/33-vida-magos`, `terras-selvagens` | todas em `git branch --merged main` | **Remover (proposto)**: `git branch -d` só apaga o que já está em `main`; recuperável pelo reflog. Aguarda aprovação |
| `proposta/todas` | não mesclada; 26 commits fora de `main` (todos merges), 27 de `main` fora dela; parada em 15/10 | **Investigar → Remover (proposto)**: o conteúdo das propostas 31/32/33 já entrou em `main`. Aguarda aprovação |
| `origin/fix/voltar-aba-snap` | 1 commit fora de `main`; `git cherry` marca como equivalente a `35c8efb` (diff vazio) | **Remover no remoto (proposto)**: `git push origin --delete fix/voltar-aba-snap`. Aguarda aprovação |

### 2.7 Resumo

| Classe | Qtd. | Itens |
|---|---|---|
| Manter | 28 | assets, deploy, compose, CI, configs, `tools/*` em uso, pastas geradas/ignoradas, CATALOG, licença |
| Atualizar | 6 | README, CHANGELOG (formato), TEST_PLAN, 2 READMEs de deploy, `.gitignore` (se versionar `settings.json`) |
| Consolidar | 2 | GAME_AUDIT (números + nota), GAME_ROADMAP (reestruturar, corrigir contradições) |
| Remover | 1 feito + 3 propostos | **feito**: `.claude/worktrees/` (vazio, ignorado). **Propostos**: `tools/gen-placeholder-map.mjs`; 10 branches locais mescladas; `origin/fix/voltar-aba-snap` |
| Investigar | 3 | `assets/ninja-adventure/`; 6 utilitários de `tools/mapgen/`; `proposta/todas` |
| Criar | 2 | `CLAUDE.md` (**feito**), `.claude/settings.json` (**proposto**, §5) |

## 3. Contradições e redundâncias encontradas (todas confirmadas)

1. ROADMAP diz que `proposta/todas` "continua existindo e recebe por merge tudo o que entra aqui" → parada em 15/10,
   não mesclada, 27 commits atrás.
2. Comandos de admin: código 10, README 7, Docker README 7, README-DEPLOY 6, comentário do compose 6; `/status` e
   `/evento` só aparecem no histórico (CHANGELOG/ROADMAP); `/desbloquear` em nenhum doc.
3. Contagens do AUDIT (magias, linhas, testes, `WorldScene`) defasadas; TEST_PLAN parado em 497 testes / 28 E2E.
4. ROADMAP "Propostas — sink de ouro": cabeçalho "nenhum item decidido" sobre tabela com 7 ✅; parágrafo do cassino
   com odds de rascunho diferentes da tabela e do código; "Bênção" ✅ em dois lugares; "Próximos" com itens ✅.
5. CHANGELOG: 21 seções `[Não lançado]`, 0 tags, tudo em produção; `npm run smoke` não citado em doc nenhum;
   `LEMONQUEST_LOGIN_BONUS` e `E2E_SWIFTSHADER` só existem em comentários de código; a entrada de 21/10 dos estágios de
   XP foi alterada no ciclo 7 sem nota.
6. Mesma pendência em dois ciclos: "teste de carga no mapa de 400 colunas" (ciclo 7) e "com 573 monstros" (ciclo 8);
   "FPS do cliente" em "Próximos" e no TEST_PLAN; "oportunidades" do AUDIT ciclo 5 repetidas como ⏳/🧭 no 7b.
7. README não lista as teclas de janela (`I K O L J R B`), que o F1 do jogo lista.

## 4. O que foi feito nesta sessão

| Ação | Risco | Reversão |
|---|---|---|
| Criado `CLAUDE.md` na raiz (≤ 80 linhas: identidade, arquitetura, comandos, convenções, armadilhas, links, "não fazer") | nenhum | `git rm CLAUDE.md` |
| Criado `docs/audit/2026-10-22/` com os 5 documentos desta auditoria | nenhum | apagar a pasta |
| Removida `.claude/worktrees/` (pasta vazia e ignorada pelo git; resto de worktrees do Claude Code de 12/10) | nenhum | o Claude Code recria quando precisa |

**Não** foi feito (aguarda aprovação, por ser arquivo do jogo, branch do usuário ou configuração de permissões):
apagar `tools/gen-placeholder-map.mjs`; apagar branches locais/remota; tirar `assets/ninja-adventure/` do git; criar
`.claude/settings.json`; editar os docs vivos (README, ROADMAP, AUDIT, TEST_PLAN, CHANGELOG, deploy).

## 5. Propostas

### 5.1 `.claude/settings.json` (permissões) — proposto, não criado

Hoje `allowedTools: []` significa um prompt para cada `git log` e cada `npm run typecheck`. Os `deny` protegem o save
real e evitam que um agente derrube o container de produção. Fora da lista de propósito: `test:e2e` e `dev` (pesam e
sobem processos), `git commit/push`, `docker compose up`.

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run typecheck)", "Bash(npm test)", "Bash(npx vitest run:*)", "Bash(npm run build:*)",
      "Bash(npm run newbie)", "Bash(npm run smoke:*)",
      "Bash(git status:*)", "Bash(git log:*)", "Bash(git diff:*)", "Bash(git show:*)", "Bash(git branch:*)", "Bash(git blame:*)"
    ],
    "deny": [
      "Read(./data/**)", "Read(./docker-data/**)", "Read(./docker-data-dev/**)",
      "Bash(rm -rf data:*)", "Bash(rm -rf docker-data:*)", "Bash(docker compose down:*)",
      "Bash(git push --force:*)", "Bash(git push -f:*)"
    ]
  }
}
```

Para versionar: trocar a linha `.claude/` do `.gitignore` por `.claude/*` + `!.claude/settings.json`
(`settings.local.json` e `worktrees/` continuam ignorados). `CLAUDE.md` já está na raiz, fora do ignore.

**Recomendação: versionar os dois.** Projeto de um dev com Claude Code como ferramenta principal: a configuração é
ambiente, como o `ci.yml`; os `deny` só protegem de verdade se vierem com o clone. O `.dockerignore` já exclui
`.claude`. Nada de perfil pessoal (modelo, tema) entra no `settings.json` do projeto.

### 5.2 Agentes, skills e comandos personalizados

Há **uma** tarefa repetitiva clara no histórico: o fechamento de ciclo (18 commits "Docs: ciclo N…"; os ciclos 7, 7b
e 8 fizeram o mesmo dentro do commit). Vale **um** comando, `/fechar-ciclo` (`.claude/commands/fechar-ciclo.md`):
dada a lista de commits do ciclo, (a) abre seção no `CHANGELOG.md`; (b) marca no `GAME_ROADMAP.md` os itens e move
pendências novas; (c) acrescenta resultados reais ao `TEST_PLAN.md` (`npx vitest run` e último E2E); (d) entrada em
`shared/src/data/news.ts`; (e) confere README/deploy se mudou comando de admin ou variável de ambiente (exatamente o
que falhou nos itens 2 e 5 do §3). Nenhum agente personalizado: os ciclos usam equipes ad hoc com briefing específico,
e isso funciona.

### 5.3 Consolidação dos docs (opção recomendada)

| Opção | Prós | Contras |
|---|---|---|
| A. Novos substituem os antigos | um só lugar | perde a numeração `#1–#49` citada em 60+ linhas, as decisões 🧭/⛔ e o histórico |
| B. Antigos congelados, novos viram a fonte viva | corte limpo | dois roadmaps até migrar tudo |
| **C (recomendada).** Fonte viva continua ROADMAP + AUDIT + TEST_PLAN; esta pasta é um **snapshot datado** que os alimenta | uma só fonte de status; numeração continua (`#50+`); README não muda | exige um passo de destilar (é o `/fechar-ciclo`) |

Passos da opção C (todos aguardam aprovação; nenhum foi feito):

1. `GAME_ROADMAP.md`: abrir "Ciclo 9 (2026-10-22) — auditoria do repositório" com as iniciativas de
   IMPROVEMENT_ROADMAP.md e status; mover ciclos 1–6 (100 % ✅) para o fim sob "Histórico" ou para
   `docs/audit/HISTORY.md`; abrir o arquivo com Pendências / Decisões 🧭 / ⛔; corrigir os itens 1, 4 e 6 do §3; marcar
   ✅ a pendência "E2E de 2º jogador pegando loot" e fechar "mochila não encolhe" (só via `/level` de dev) e a hipótese
   "fantasmas na reconexão" (refutada pelo `decodeResync` do SDK).
2. `GAME_AUDIT.md`: seção "Ciclo 9" com achados `#50+` apontando para este snapshot (sem repetir evidência); corrigir
   39 magias, ~49 mil linhas, `WorldScene` 1.459, 774 testes.
3. `TEST_PLAN.md`: "Resultados — ciclos 7, 7b, 8 e 9" com os números de VALIDATION_BASELINE.md e a baseline de regressão.
4. `CHANGELOG.md`: trocar `[Não lançado] — data · tema` por `## 2026-10-22x — tema` (id de `news.ts`) ou criar tags git
   por ciclo; nota "(alterado no ciclo 7)" na entrada dos estágios de XP de 21/10.
5. `README.md`: tabela de admin com os 10 comandos (ou link para `admin.ts`), `npm run smoke`, teclas de janela,
   `dist` 25 MB, link para `docs/audit/`.
6. `deploy/*/README*` e `docker-compose.yml`: alinhar comandos de admin e env vars.

Com isso, quem chega lê `CLAUDE.md` + a primeira tela do ROADMAP e está pronto; AUDIT e CHANGELOG viram consulta.

## 6. Não investigado

- Os dois `.jsonl` de sessão do perfil antigo (transcrições, não memória).
- `install-service.ps1`, `firewall.ps1` e `Caddyfile*` linha a linha contra os READMEs.
- As 465 linhas do CATALOG contra os arquivos do pack.
- Conteúdo de `proposta/todas` além das contagens de commits; `assets/ninja-adventure/tes4A3E.tmp`.
