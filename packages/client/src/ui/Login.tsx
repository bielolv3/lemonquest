import { useState } from "preact/hooks";
import type { Vocation } from "@tibinha/shared";
import { session } from "../session.ts";

const VOCS: { id: Vocation; name: string; desc: string; color: string }[] = [
  { id: "knight", name: "Cavaleiro", desc: "Resistente, luta de perto com espada.", color: "#c0563b" },
  { id: "paladin", name: "Paladino", desc: "Ágil, acerta de longe com arco.", color: "#d9a441" },
  { id: "sorcerer", name: "Feiticeiro", desc: "Frágil, magias de fogo devastadoras.", color: "#7b5cd6" },
  { id: "druid", name: "Druida", desc: "Cura aliados e domina a natureza.", color: "#4f9d5d" },
];

const ERRORS: Record<string, string> = {
  invalid_name: "Nome inválido: use de 3 a 16 letras (espaços entre palavras).",
  wrong_password: "Senha incorreta (mínimo de 3 caracteres).",
  already_online: "Este personagem já está online.",
  invalid_request: "Requisição inválida. Tente novamente.",
};

export function Login() {
  const [name, setName] = useState(() => localStorage.getItem("tibinha.name") ?? "");
  const [password, setPassword] = useState("");
  const [step, setStep] = useState<"creds" | "vocation">("creds");
  const [vocation, setVocation] = useState<Vocation | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(voc?: Vocation) {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const res = await session.login({ name, password, vocation: voc });
      if (res.ok) {
        localStorage.setItem("tibinha.name", res.name);
        await session.connect(res.token, res.name);
        return;
      }
      if (res.error === "need_vocation") {
        setStep("vocation");
      } else {
        setStep("creds");
        setError(ERRORS[res.error] ?? "Erro desconhecido.");
      }
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setBusy(false);
    }
  }

  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") submit(step === "vocation" ? (vocation ?? undefined) : undefined);
  };

  return (
    <div class="login-wrap">
      <div class="panel login-card">
        <h1 class="login-title">Tibinha</h1>
        {step === "creds" ? (
          <>
            <label class="field">
              Nome
              <input
                value={name}
                maxLength={16}
                autoFocus
                autocomplete="username"
                onInput={(e) => setName((e.target as HTMLInputElement).value)}
                onKeyDown={onKey}
              />
            </label>
            <label class="field">
              Senha
              <input
                type="password"
                value={password}
                autocomplete="current-password"
                onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
                onKeyDown={onKey}
              />
            </label>
            <button class="btn" disabled={busy} onClick={() => submit()}>
              {busy ? "Entrando..." : "Entrar"}
            </button>
            <p class="hint">Nome novo? Basta entrar para criar o personagem.</p>
          </>
        ) : (
          <>
            <p class="hint">Escolha a vocação de <b>{name.trim()}</b>:</p>
            <div class="voc-grid">
              {VOCS.map((v) => (
                <button
                  key={v.id}
                  class={`voc-card${vocation === v.id ? " selected" : ""}`}
                  style={{ "--accent": v.color } as any}
                  onClick={() => setVocation(v.id)}
                  onKeyDown={onKey}
                >
                  <span class="voc-name">{v.name}</span>
                  <span class="voc-desc">{v.desc}</span>
                </button>
              ))}
            </div>
            <button class="btn" disabled={busy || !vocation} onClick={() => submit(vocation!)}>
              {busy ? "Criando..." : "Criar personagem"}
            </button>
            <button class="btn ghost" disabled={busy} onClick={() => setStep("creds")}>Voltar</button>
          </>
        )}
        {error && <div class="error">{error}</div>}
      </div>
    </div>
  );
}
