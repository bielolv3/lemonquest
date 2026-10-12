import { useEffect, useRef, useState } from "preact/hooks";
import {
  GAME_NAME, MAX_CHARACTERS_PER_ACCOUNT, MAX_NAME_LEN,
  type AuthError, type AuthFail, type CharacterSummary, type SkillId, type Vocation,
} from "@lemonquest/shared";
import { session } from "../session.ts";
import { loading } from "./loading.ts";
import { VOCATION_META, vocationMeta } from "./hud/vocations.ts";
import { OutfitCanvas } from "./outfit/OutfitCanvas.tsx";
import { resolveOutfit } from "@lemonquest/shared";

const VOCS: { id: Vocation; desc: string }[] = [
  { id: "knight", desc: "Resistente, luta de perto com espada." },
  { id: "paladin", desc: "Ágil, acerta de longe com arco." },
  { id: "sorcerer", desc: "Frágil, magias de fogo devastadoras." },
  { id: "druid", desc: "Cura aliados e domina a natureza." },
];

const SKILL_LABEL: Record<SkillId, string> = { melee: "Corpo a corpo", distance: "Distância", magic: "Magic Level", shield: "Escudo" };

const MIN_NEW_PASSWORD = 6;
const MAX_ACCOUNT = 20;

const ERRORS: Record<AuthError, string> = {
  invalid_request: "Requisição inválida. Tente novamente.",
  invalid_account: "Conta inválida: use de 3 a 20 caracteres (letras, números, espaço, ponto, _ ou -).",
  invalid_name: "Nome inválido: use de 3 a 16 letras (somente letras, com espaços entre palavras).",
  wrong_password: "Senha incorreta.",
  no_account: "Conta não encontrada. Confira o nome ou crie uma conta nova.",
  account_taken: "Já existe uma conta com esse nome.",
  weak_password: `A senha precisa ter pelo menos ${MIN_NEW_PASSWORD} caracteres.`,
  too_many_attempts: "Muitas tentativas. Aguarde alguns minutos.",
  name_taken: "Esse nome de personagem já está em uso.",
  too_many_characters: `Limite de ${MAX_CHARACTERS_PER_ACCOUNT} personagens por conta.`,
  invalid_session: "Sua sessão expirou. Entre na conta de novo.",
  no_character: "Personagem não encontrado nesta conta.",
  already_online: "Este personagem já está online.",
};

function errorText(r: AuthFail): string {
  if (r.error === "too_many_attempts" && r.message) return r.message;
  return ERRORS[r.error] ?? r.message ?? "Não foi possível entrar. Tente novamente.";
}

/** "há 5 min", "há 2h", "há 1d 3h". */
export function sinceText(sinceMs: number, now = Date.now()): string {
  const min = Math.max(0, Math.floor((now - sinceMs) / 60_000));
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `há ${d}d ${h % 24}h` : `há ${d}d`;
}

const LAST_CHAR_KEY = "lemonquest.lastCharacter";
function storeLastChar(): string | null { try { return localStorage.getItem(LAST_CHAR_KEY); } catch { return null; } }

type Step = "loading" | "account" | "chars" | "new";

/** Teclas digitadas na tela de login não vão para o jogo. */
const stop = (e: KeyboardEvent) => e.stopPropagation();

export function Login() {
  const [step, setStep] = useState<Step>(() => (session.accountSession ? "loading" : "account"));
  const [account, setAccount] = useState(() => session.lastAccount);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [creating, setCreating] = useState(false);
  const [accName, setAccName] = useState("");
  const [chars, setChars] = useState<CharacterSummary[]>([]);
  const [sel, setSel] = useState(0);
  const [newName, setNewName] = useState("");
  const [vocation, setVocation] = useState<Vocation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false); // trava síncrona (clique + duplo clique no mesmo tick)

  // Voltando de uma desconexão: a sessão da conta ainda vale → direto para a lista de personagens.
  useEffect(() => {
    if (step !== "loading") return;
    session.resume()
      .then((r) => {
        if (r?.ok) { showChars(r.account, r.characters); return; }
        if (r && !r.ok && r.error !== "invalid_session") setError(errorText(r));
        setStep("account");
      })
      .catch(() => setStep("account"));
  }, []);

  useEffect(() => { if (step === "chars") listRef.current?.focus(); }, [step]);

  function showChars(acc: string, list: CharacterSummary[], select?: string) {
    setAccName(acc);
    setChars(list);
    const want = select ?? storeLastChar();
    const i = want ? list.findIndex((c) => c.name === want) : 0;
    setSel(Math.max(0, i));
    setPassword(""); setConfirm("");
    setStep("chars");
  }

  async function run(fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setError("");
    setBusy(true);
    try { await fn(); } catch { setError("Não foi possível conectar ao servidor."); } finally { busyRef.current = false; setBusy(false); }
  }

  const submitAccount = () => run(async () => {
    if (creating) {
      if (password.length < MIN_NEW_PASSWORD) { setError(ERRORS.weak_password); return; }
      if (password !== confirm) { setError("As senhas não conferem."); return; }
    }
    const r = await session.login({ account, password, create: creating || undefined });
    if (!r.ok) { setError(errorText(r)); return; }
    setCreating(false);
    if (r.characters.length === 0) { setAccName(r.account); setChars([]); setStep("new"); return; }
    showChars(r.account, r.characters);
  });

  const play = (c: CharacterSummary | undefined) => c && run(async () => {
    const r = await session.play(c.name);
    if (!r.ok) {
      if (r.error === "invalid_session") setStep("account");
      setError(errorText(r));
      return;
    }
    try { localStorage.setItem(LAST_CHAR_KEY, r.name); } catch { /* indisponível */ }
    loading.enterWorld(); // "Entrando no mundo…" até a sala chegar e a câmera estar no jogador
    try { await session.connect(r.token, r.name); } catch (e) { loading.cancelEnter(); throw e; }
  });

  const createChar = () => run(async () => {
    if (!vocation) { setError("Escolha uma vocação."); return; }
    const r = await session.createCharacter({ name: newName, vocation });
    if (!r.ok) {
      if (r.error === "invalid_session") setStep("account");
      setError(errorText(r));
      return;
    }
    setNewName(""); setVocation(null);
    showChars(r.account, r.characters, r.characters[r.characters.length - 1]?.name);
  });

  const logout = () => run(async () => {
    await session.logout();
    setChars([]); setAccName("");
    setStep("account");
  });

  const canCreate = chars.length < MAX_CHARACTERS_PER_ACCOUNT;
  const slots = chars.length + (canCreate ? 1 : 0);

  const onListKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); setSel((i) => (i + 1) % slots); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); setSel((i) => (i - 1 + slots) % slots); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (sel < chars.length) play(chars[sel]); else openNew();
    } else if (e.key === "Escape") { e.preventDefault(); logout(); }
  };

  function openNew() { setError(""); setNewName(""); setVocation(null); setStep("new"); }

  const onFieldKey = (submit: () => void) => (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); submit(); }
  };

  let body;
  if (step === "loading") {
    body = <p class="hint login-loading">Carregando personagens...</p>;
  } else if (step === "account") {
    body = (
      <>
        <h2 class="login-step">{creating ? "Criar conta" : "Entrar na conta"}</h2>
        <label class="field">
          Conta
          <input
            value={account}
            maxLength={MAX_ACCOUNT}
            autoFocus
            autocomplete="username"
            spellcheck={false}
            onInput={(e) => setAccount((e.target as HTMLInputElement).value)}
            onKeyDown={onFieldKey(submitAccount)}
          />
        </label>
        <label class="field">
          Senha
          <input
            type="password"
            value={password}
            autocomplete={creating ? "new-password" : "current-password"}
            onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            onKeyDown={onFieldKey(submitAccount)}
          />
        </label>
        {creating && (
          <label class="field">
            Confirmar senha
            <input
              type="password"
              value={confirm}
              autocomplete="new-password"
              onInput={(e) => setConfirm((e.target as HTMLInputElement).value)}
              onKeyDown={onFieldKey(submitAccount)}
            />
          </label>
        )}
        <button class="btn" disabled={busy} onClick={submitAccount}>
          {busy ? (creating ? "Criando..." : "Entrando...") : creating ? "Criar conta" : "Entrar"}
        </button>
        <button class="btn ghost" disabled={busy} onClick={() => { setCreating((c) => !c); setError(""); setConfirm(""); }}>
          {creating ? "Já tenho conta" : "Criar conta"}
        </button>
        <p class="hint">
          {creating
            ? `A conta é privada (ninguém a vê no jogo) e pode ter até ${MAX_CHARACTERS_PER_ACCOUNT} personagens. Senha de no mínimo ${MIN_NEW_PASSWORD} caracteres.`
            : "Uma conta guarda todos os seus personagens."}
        </p>
      </>
    );
  } else if (step === "chars") {
    body = (
      <>
        <div class="login-head">
          <h2 class="login-step">Personagens</h2>
          <span class="login-acc" title="Conta">{accName}</span>
        </div>
        <div
          class="char-list"
          role="listbox"
          aria-label="Personagens"
          tabIndex={0}
          ref={listRef}
          aria-activedescendant={`char-${sel}`}
          onKeyDown={onListKey}
        >
          {chars.map((c, i) => {
            const m = vocationMeta(c.vocation);
            return (
              <div
                key={c.name}
                id={`char-${i}`}
                role="option"
                aria-selected={sel === i}
                class={`char-card${sel === i ? " selected" : ""}`}
                style={{ "--accent": m.color } as any}
                onClick={() => { if (sel === i) play(c); else setSel(i); }}
                onDblClick={() => play(c)}
              >
                <span class="char-face char-outfit" aria-hidden="true">
                  <OutfitCanvas outfit={resolveOutfit(c.outfit, c.vocation)} addons={c.addons ?? 0} scale={2} tight />
                </span>
                <div class="char-info">
                  <span class="char-name">{c.name}</span>
                  <span class="char-meta"><span class="char-voc">{m.label}</span> · Nível {c.level}</span>
                  {(c.training || c.online) && (
                    <span class="char-badges">
                      {c.online && <span class="badge online">online</span>}
                      {c.training && (
                        <span class="badge training" title={new Date(c.training.sinceMs).toLocaleString("pt-BR")}>
                          Treinando: {SKILL_LABEL[c.training.skill] ?? c.training.skill} {sinceText(c.training.sinceMs)}
                        </span>
                      )}
                    </span>
                  )}
                </div>
                <span class="char-play" aria-hidden="true" />
              </div>
            );
          })}
          {canCreate && (
            <div
              id={`char-${chars.length}`}
              role="option"
              aria-selected={sel === chars.length}
              class={`char-card new${sel === chars.length ? " selected" : ""}`}
              onClick={openNew}
            >
              <span class="char-plus" aria-hidden="true">+</span>
              <div class="char-info">
                <span class="char-name">Novo personagem</span>
                <span class="char-meta">{chars.length}/{MAX_CHARACTERS_PER_ACCOUNT} personagens</span>
              </div>
            </div>
          )}
        </div>
        <button class="btn" disabled={busy || sel >= chars.length} onClick={() => play(chars[sel])}>
          {busy ? "Entrando..." : sel < chars.length ? `Jogar com ${chars[sel]!.name}` : "Jogar"}
        </button>
        <p class="hint">↑↓ escolhe · Enter joga · duplo clique também</p>
        <button class="link-btn" disabled={busy} onClick={logout}>Sair da conta</button>
      </>
    );
  } else {
    body = (
      <>
        <div class="login-head">
          <h2 class="login-step">Novo personagem</h2>
          <span class="login-acc" title="Conta">{accName}</span>
        </div>
        <label class="field">
          Nome do personagem
          <input
            value={newName}
            maxLength={MAX_NAME_LEN}
            autoFocus
            spellcheck={false}
            onInput={(e) => setNewName((e.target as HTMLInputElement).value)}
            onKeyDown={onFieldKey(createChar)}
          />
        </label>
        <p class="hint left">É o nome que os outros jogadores veem: 3 a {MAX_NAME_LEN} letras, espaços entre palavras.</p>
        <div class="voc-grid">
          {VOCS.map((v) => {
            const m = VOCATION_META[v.id];
            return (
              <button
                key={v.id}
                class={`voc-card${vocation === v.id ? " selected" : ""}`}
                style={{ "--accent": m.color } as any}
                aria-pressed={vocation === v.id}
                onClick={() => setVocation(v.id)}
                onKeyDown={onFieldKey(createChar)}
              >
                <span class="voc-top">
                  <img class="voc-face" src={m.faceset} alt="" draggable={false} />
                  <span class="voc-name">{m.label}</span>
                </span>
                <span class="voc-desc">{v.desc}</span>
              </button>
            );
          })}
        </div>
        <button class="btn" disabled={busy || !vocation || newName.trim().length < 3} onClick={createChar}>
          {busy ? "Criando..." : "Criar personagem"}
        </button>
        {chars.length > 0 ? (
          <button class="btn ghost" disabled={busy} onClick={() => { setError(""); setStep("chars"); }}>Voltar</button>
        ) : (
          <button class="link-btn" disabled={busy} onClick={logout}>Sair da conta</button>
        )}
      </>
    );
  }

  return (
    <div class="login-wrap" onKeyDown={stop}>
      <div class={`panel login-card step-${step}`}>
        <h1 class="login-title">{GAME_NAME}</h1>
        {body}
        {error && <div class="error" role="alert">{error}</div>}
        <p class="login-notice">Rede do escritório sem criptografia: não use a mesma senha do trabalho.</p>
      </div>
    </div>
  );
}
