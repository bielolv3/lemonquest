// Entrega de arquivos pré-comprimidos (.gz gerados por tools/build-server.mjs em packages/client/dist) sem
// dependência nova: se o navegador aceita gzip e existe `<arquivo>.gz` no dist, responde com ele. Só para os poucos
// arquivos de texto grandes (JS, CSS, HTML e o world.json de 1,5 MB); o resto segue pelo express.static.
import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, Response } from "express";

const TYPES: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

export interface GzipCandidate {
  /** Caminho do .gz relativo ao dist (separador "/"). */
  gz: string;
  /** Content-Type do arquivo original. */
  type: string;
  cacheControl: string;
}

/** `Accept-Encoding` admite gzip? (`gzip`, `gzip;q=0.8`, `*`; `gzip;q=0` e ausência não). */
export function acceptsGzip(acceptEncoding: string | undefined): boolean {
  if (!acceptEncoding) return false;
  let star = false;
  for (const part of acceptEncoding.split(",")) {
    const [name, ...params] = part.trim().toLowerCase().split(";");
    const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
    const weight = q ? Number(q.slice(2)) : 1;
    if (name === "gzip") return weight > 0;
    if (name === "*") star = weight > 0;
  }
  return star;
}

/**
 * Decide, pela URL, qual `.gz` do dist serviria o pedido (sem olhar o disco). Só os caminhos que o build comprime:
 * `/`, `/index.html`, `/ranking`, `/ranking.html`, `/assets/*.js|.css` e `/maps/world.json`. Caminhos fora disso
 * (ou com `..`) devolvem null e seguem para o express.static.
 */
export function gzipCandidate(urlPath: string): GzipCandidate | null {
  const p = urlPath.split("?")[0];
  if (p.includes("..") || p.includes("\\")) return null;
  let file: string;
  if (p === "/" || p === "/index.html") file = "index.html";
  else if (p === "/ranking" || p === "/ranking.html") file = "ranking.html";
  else if (p === "/maps/world.json") file = "maps/world.json";
  else if (/^\/assets\/[^/]+\.(js|css)$/.test(p)) file = p.slice(1);
  else return null;
  const type = TYPES[path.posix.extname(file)];
  if (!type) return null;
  // Mesma política do express.static em index.ts: /assets/* tem hash no nome (1 ano, immutable); o resto revalida.
  const cacheControl = file.startsWith("assets/") ? "public, max-age=31536000, immutable" : "public, max-age=0";
  return { gz: `${file}.gz`, type, cacheControl };
}

/**
 * Middleware: vai antes do express.static. O `.gz` só é usado se for mais novo que o original (`originalFor` diz onde
 * ele está: o world.json servido vem de assets/maps, não do dist) — um mapa regenerado sem rebuild nunca sai
 * desatualizado. Sem `.gz` (build só do cliente, como no E2E) cai no express.static como antes.
 */
export function gzipStatic(dist: string, originalFor: (candidate: GzipCandidate) => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") { next(); return; }
    if (!acceptsGzip(req.headers["accept-encoding"] as string | undefined)) { next(); return; }
    const c = gzipCandidate(req.url);
    if (!c) { next(); return; }
    const gzPath = path.join(dist, c.gz);
    let st: fs.Stats, orig: fs.Stats;
    try {
      st = fs.statSync(gzPath);
      orig = fs.statSync(originalFor(c));
    } catch { next(); return; }
    if (!st.isFile() || st.mtimeMs < orig.mtimeMs) { next(); return; }
    const etag = `W/"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}-gz"`;
    res.setHeader("Vary", "Accept-Encoding");
    res.setHeader("Cache-Control", c.cacheControl);
    res.setHeader("ETag", etag);
    res.setHeader("Last-Modified", st.mtime.toUTCString());
    if (req.headers["if-none-match"] === etag) { res.status(304).end(); return; }
    res.setHeader("Content-Type", c.type);
    res.setHeader("Content-Encoding", "gzip");
    res.setHeader("Content-Length", String(st.size));
    if (req.method === "HEAD") { res.end(); return; }
    fs.createReadStream(gzPath)
      .on("error", (e) => { console.error("[gzip] falha ao ler", gzPath, e); res.destroy(e); })
      .pipe(res);
  };
}
