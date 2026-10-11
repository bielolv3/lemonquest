// Toasts disparados pelo cliente (além dos "notice" do servidor).
export interface ToastMsg { text: string; kind?: "info" | "warn" | "good" }
type Fn = (t: ToastMsg) => void;
const subs = new Set<Fn>();
const lastAt = new Map<string, number>();

export function onToast(fn: Fn): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}
/** `dedupeMs`: ignora o mesmo texto repetido dentro desse intervalo (anti-spam de teclas). */
export function pushToast(t: ToastMsg, dedupeMs = 0): void {
  if (dedupeMs) {
    const now = performance.now();
    if (now - (lastAt.get(t.text) ?? -1e9) < dedupeMs) return;
    lastAt.set(t.text, now);
  }
  for (const s of [...subs]) s(t);
}
