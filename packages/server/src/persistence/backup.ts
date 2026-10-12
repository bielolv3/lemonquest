// Backups da base: `VACUUM INTO data/backups/tibinha-YYYYMMDD-HH.db` a cada hora (e um no boot).
// Rotação: todos das últimas 48 h + o mais recente de cada dia por 14 dias.
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR, backupTo } from "./db.ts";

export const BACKUP_HOURLY_KEEP_H = 48;
export const BACKUP_DAILY_KEEP_D = 14;
const NAME_RE = /^tibinha-(\d{4})(\d{2})(\d{2})-(\d{2})\.db$/;
const pad = (n: number) => String(n).padStart(2, "0");

export const backupDir = (): string => process.env.TIBINHA_BACKUP_DIR || path.join(DATA_DIR, "backups");

/** Nome do backup da hora de `d` (hora local). */
export function backupFileName(d: Date): string {
  return `tibinha-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}.db`;
}

/** Hora (local) codificada no nome, ou null se não for um backup nosso. */
export function parseBackupName(name: string): Date | null {
  const m = NAME_RE.exec(name);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Lógica pura da rotação: devolve os nomes a apagar.
 * Mantém tudo das últimas `hourlyH` horas; entre isso e `dailyD` dias, só o mais recente de cada dia; o resto sai.
 * Arquivos com nome fora do padrão são ignorados (nunca apagados).
 */
export function selectBackupsToDelete(
  names: string[], now: Date, hourlyH = BACKUP_HOURLY_KEEP_H, dailyD = BACKUP_DAILY_KEEP_D,
): string[] {
  const hourlyCut = now.getTime() - hourlyH * 3600_000;
  const dailyCut = now.getTime() - dailyD * 86400_000;
  const del: string[] = [];
  const newestOfDay = new Map<string, { name: string; t: number }>();
  for (const name of names) {
    const d = parseBackupName(name);
    if (!d) continue;
    const t = d.getTime();
    if (t >= hourlyCut) continue;
    if (t < dailyCut) { del.push(name); continue; }
    const day = name.slice(8, 16); // YYYYMMDD
    const cur = newestOfDay.get(day);
    if (!cur) newestOfDay.set(day, { name, t });
    else if (t > cur.t) { del.push(cur.name); newestOfDay.set(day, { name, t }); }
    else del.push(name);
  }
  return del.sort();
}

/** Faz o backup da hora atual e roda a rotação. Nunca lança (loga). */
export function runBackup(dir = backupDir(), now = new Date()): string | null {
  const file = path.join(dir, backupFileName(now));
  try {
    const t0 = performance.now();
    backupTo(file);
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`[backup] ${file} (${kb} KB, ${(performance.now() - t0).toFixed(0)} ms)`);
  } catch (e) {
    console.error("[backup] falhou:", e);
    return null;
  }
  try {
    for (const name of selectBackupsToDelete(fs.readdirSync(dir), now)) fs.rmSync(path.join(dir, name), { force: true });
  } catch (e) {
    console.error("[backup] rotação falhou:", e);
  }
  return file;
}

/** Backup no boot + um por hora (checado a cada minuto, robusto a suspensão/ajuste de relógio). */
export function startBackups(dir = backupDir()): () => void {
  let last = backupFileName(new Date());
  runBackup(dir);
  const timer = setInterval(() => {
    const now = new Date();
    const name = backupFileName(now);
    if (name === last) return;
    last = name;
    runBackup(dir, now);
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
