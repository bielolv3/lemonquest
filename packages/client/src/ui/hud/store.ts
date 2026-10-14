// Store mínimo (get/set/subscribe) + hook Preact. Sem dependências de UI: pode ser usado pelo jogo (Phaser).
import { useEffect, useState } from "preact/hooks";

export type Unsubscribe = () => void;

/** Só leitura (ex.: store derivado por selectStore). */
export interface ReadableStore<T> {
  get(): T;
  subscribe(fn: (v: T) => void): Unsubscribe;
}

export interface Store<T> extends ReadableStore<T> {
  set(next: T | ((prev: T) => T)): void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const subs = new Set<(v: T) => void>();
  return {
    get: () => value,
    set(next) {
      const v = typeof next === "function" ? (next as (p: T) => T)(value) : next;
      if (Object.is(v, value)) return;
      value = v;
      for (const s of [...subs]) s(value);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => { subs.delete(fn); };
    },
  };
}

/**
 * Fatia derivada de um store: `get` recalcula na hora; os assinantes só são avisados quando o valor
 * selecionado muda (`equals`, padrão Object.is). Ex.: o jogador local dentro do mapa de todos os jogadores.
 */
export function selectStore<T, U>(src: ReadableStore<T>, select: (v: T) => U, equals: (a: U, b: U) => boolean = Object.is): ReadableStore<U> {
  return {
    get: () => select(src.get()),
    subscribe(fn) {
      let last = select(src.get());
      return src.subscribe((v) => {
        const next = select(v);
        if (equals(last, next)) return;
        last = next;
        fn(next);
      });
    },
  };
}

/** Lê um store e re-renderiza quando ele muda. */
export function useStore<T>(store: ReadableStore<T>): T {
  const [v, setV] = useState(store.get);
  useEffect(() => {
    setV(() => store.get());
    return store.subscribe((nv) => setV(() => nv));
  }, [store]);
  return v;
}

function readLocal(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLocal(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch { /* localStorage indisponível */ }
}

/** Booleano persistido em localStorage (chave "lemonquest.ui.<key>"). */
export function persistedBool(key: string, fallback: boolean, override?: boolean): Store<boolean> {
  const k = `lemonquest.ui.${key}`;
  const raw = readLocal(k);
  const stored = raw === "1" ? true : raw === "0" ? false : fallback;
  // override vale só para esta sessão (não sobrescreve a preferência salva até o usuário mexer).
  const s = createStore(override ?? stored);
  s.subscribe((v) => writeLocal(k, v ? "1" : "0"));
  return s;
}

/** Objeto JSON persistido em localStorage (mesclado sobre o fallback). */
export function persistedJson<T extends object>(key: string, fallback: T): Store<T> {
  const k = `lemonquest.ui.${key}`;
  let initial = fallback;
  try {
    const raw = readLocal(k);
    if (raw) initial = { ...fallback, ...JSON.parse(raw) };
  } catch { /* JSON inválido */ }
  const s = createStore(initial);
  s.subscribe((v) => writeLocal(k, JSON.stringify(v)));
  return s;
}
