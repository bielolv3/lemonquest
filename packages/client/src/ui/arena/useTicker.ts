import { useEffect, useState } from "preact/hooks";

/** Re-renderiza a cada `ms` (0 = parado). Para contagens regressivas. */
export function useTicker(ms: number): void {
  const [, set] = useState(0);
  useEffect(() => {
    if (!ms) return;
    const t = window.setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}
