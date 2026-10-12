// Utilitários dos testes E2E: contas/personagens novos pela API, entrar no mundo, chat/comandos de dev e leitura do
// estado do jogo pela sonda window.__lq (WorldScene.installE2EProbe, ligada com ?e2e na URL).
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { E2E_NAMES } from "./names.ts";

export type Vocation = "knight" | "paladin" | "sorcerer" | "druid";

export interface Player {
  account: string;
  password: string;
  name: string;
  vocation: Vocation;
  session: string;
}

interface Tile { x: number; y: number }
export interface MonsterInfo extends Tile { id: string; defId?: string; name?: string; hp?: number; maxHp?: number }
export interface GroundInfo extends Tile { id: string; defId: string; count: number }

let nameCursor = -1;
/** Próximo nome da lista de admins (cada worker começa num trecho diferente). */
function nextName(): string {
  if (nameCursor < 0) nameCursor = (test.info().workerIndex * 97 + test.info().retry * 31) % E2E_NAMES.length;
  nameCursor = (nameCursor + 1) % E2E_NAMES.length;
  return E2E_NAMES[nameCursor]!;
}

let accSeq = 0;
export function freshAccount(): string {
  return `e2e${Date.now().toString(36)}${test.info().workerIndex}${(accSeq++).toString(36)}`.slice(0, 20);
}

/** Cria conta + personagem pela API (sem UI). */
export async function createPlayer(request: APIRequestContext, vocation: Vocation = "knight"): Promise<Player> {
  const account = freshAccount();
  const password = "senha-e2e-123";
  const login = await (await request.post("/api/login", { data: { account, password, create: true } })).json();
  expect(login.ok, JSON.stringify(login)).toBe(true);
  for (let i = 0; i < 40; i++) {
    const name = nextName();
    const r = await (await request.post("/api/characters", { data: { session: login.session, name, vocation } })).json();
    if (r.ok) return { account, password, name, vocation, session: login.session };
    expect(r.error, JSON.stringify(r)).toBe("name_taken");
  }
  throw new Error("nenhum nome livre");
}

/** Abre o jogo já com a sessão da conta (vai direto à lista de personagens). */
export async function openWithSession(page: Page, p: Player): Promise<void> {
  await page.addInitScript(([s]) => {
    if (!sessionStorage.getItem("lemonquest.accountSession")) sessionStorage.setItem("lemonquest.accountSession", s!);
  }, [p.session]);
  await page.goto("/?e2e");
}

/** Lista de personagens → Jogar → espera o personagem no mundo e o HUD. */
export async function playFromList(page: Page, p: Player): Promise<void> {
  const btn = page.getByRole("button", { name: `Jogar com ${p.name}` });
  await expect(btn).toBeVisible({ timeout: 30_000 });
  await btn.click();
  await waitInWorld(page);
}

export async function waitInWorld(page: Page): Promise<void> {
  await page.waitForFunction(() => !!(window as any).__lq?.me(), null, { timeout: 30_000 });
  await expect(page.locator(".hud-rail")).toBeVisible();
  // Overlay "Entrando no mundo…" some.
  await expect(page.locator("#boot")).toBeHidden({ timeout: 15_000 });
}

/** Conta nova + personagem + entra no mundo. */
export async function enterGame(page: Page, vocation: Vocation = "knight"): Promise<Player> {
  const p = await createPlayer(page.request, vocation);
  await openWithSession(page, p);
  await playFromList(page, p);
  return p;
}

/** Fala no chat (Enter abre, Enter envia). */
export async function say(page: Page, text: string): Promise<void> {
  const input = page.locator(".chat-input");
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await input.fill(text);
  await input.press("Enter");
  await expect(input).not.toBeFocused();
}

export const me = (page: Page) => page.evaluate(() => (window as any).__lq.me() as { x: number; y: number; tileX: number; tileY: number; moving: boolean } | null);
export const meState = (page: Page) => page.evaluate(() => (window as any).__lq.meState() as Record<string, any> | null);
export const monsters = (page: Page) => page.evaluate(() => (window as any).__lq.monsters() as MonsterInfo[]);
export const ground = (page: Page) => page.evaluate(() => (window as any).__lq.ground() as GroundInfo[]);
export const inventory = (page: Page) => page.evaluate(() => (window as any).__lq.inventory() as { backpack: ({ defId: string; count: number } | null)[]; equipment: Record<string, unknown>; gold: number } | null);

/** /level N e espera o level aplicado. */
export async function setLevel(page: Page, level: number): Promise<void> {
  await say(page, `/level ${level}`);
  await expect.poll(async () => (await meState(page))?.level, { timeout: 10_000 }).toBe(level);
}

/** /tp x y e espera chegar (e a câmera parar). */
export async function teleport(page: Page, x: number, y: number): Promise<void> {
  await say(page, `/tp ${x} ${y}`);
  await expect.poll(async () => { const m = await me(page); return m ? `${m.x},${m.y}` : ""; }, { timeout: 10_000 }).toBe(`${x},${y}`);
  await waitSettled(page);
}

/** Jogador e câmera parados: coordenadas de tela confiáveis. */
export async function waitSettled(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__lq.settled(), null, { timeout: 15_000 });
}

/** Centro do tile em px da página. `fy` = fração vertical dentro do tile (0 topo, 1 base). */
export const tileToClient = (page: Page, x: number, y: number, fy = 0.5) =>
  page.evaluate(([x, y, fy]) => (window as any).__lq.tileToClient(x, y, fy) as { x: number; y: number }, [x, y, fy] as const);

export async function clickTile(page: Page, x: number, y: number, opts: { button?: "left" | "right"; modifiers?: ("Control")[]; fy?: number } = {}): Promise<void> {
  const c = await tileToClient(page, x, y, opts.fy);
  await page.mouse.click(c.x, c.y, { button: opts.button ?? "left", modifiers: opts.modifiers });
}

/** Arrasta com o mouse real (pointer events), em passos. */
export async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, steps = 12): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.up();
}

export async function center(page: Page, selector: string | import("@playwright/test").Locator) {
  const loc = typeof selector === "string" ? page.locator(selector) : selector;
  const b = await loc.boundingBox();
  if (!b) throw new Error(`sem caixa: ${selector}`);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Tiles andáveis livres ao redor de (x,y) até `r`. */
export async function walkableNear(page: Page, x: number, y: number, r = 3): Promise<Tile[]> {
  return page.evaluate(([x, y, r]) => {
    const lq = (window as any).__lq;
    const out: { x: number; y: number }[] = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (lq.walkable(x + dx, y + dy)) out.push({ x: x + dx, y: y + dy });
    return out;
  }, [x, y, r] as const);
}

/** Clica no monstro mais perto até virar o alvo. */
export async function targetNearest(page: Page, filter?: (defId: string) => boolean): Promise<string> {
  let id = "";
  await expect.poll(async () => {
    const m = (await me(page))!;
    const list = (await monsters(page)).filter((x) => !filter || filter(x.defId ?? ""))
      .sort((a, b) => Math.max(Math.abs(a.x - m.x), Math.abs(a.y - m.y)) - Math.max(Math.abs(b.x - m.x), Math.abs(b.y - m.y)));
    const t = list[0];
    if (!t) return "";
    const cur = await page.evaluate(() => (window as any).__lq.target());
    if (cur && list.some((x) => x.id === cur)) { id = cur; return cur; }
    await clickTile(page, t.x, t.y, { fy: 0.6 });
    await page.waitForTimeout(150);
    id = await page.evaluate(() => (window as any).__lq.target());
    return id;
  }, { timeout: 30_000, intervals: [300] }).not.toBe("");
  return id;
}


/** Captura para revisão visual (só com E2E_SNAPS=1): test-results/snaps/<nome>.png. */
export async function snap(page: Page, name: string): Promise<void> {
  if (process.env.E2E_SNAPS !== "1") return;
  await page.screenshot({ path: `test-results/snaps/${name}.png` });
}
