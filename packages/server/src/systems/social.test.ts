import { describe, expect, it } from "vitest";
import { S2C } from "@lemonquest/shared";
import { EMOTE_COOLDOWN_MS, MAX_FRIENDS, SocialSystem, WHISPER_COOLDOWN_MS } from "./social.ts";

type Sent = { to: string; type: string; msg: any };

function world(names: string[], extra: { offline?: string[]; muted?: Record<string, number>; zoneAt?: (x: number, y: number) => string | null; away?: string[]; inPz?: (x: number, y: number) => boolean; sameParty?: (a: string, b: string) => boolean } = {}) {
  let t = 1_000_000;
  const players = names.map((n, i) => ({ id: `s${i}`, name: n }) as any);
  const records = new Map(players.map((p: any) => [p.id, { data: {} } as any]));
  const sent: Sent[] = [];
  const broadcasts: { type: string; msg: any }[] = [];
  const social = new SocialSystem({
    players: () => players,
    record: (id) => records.get(id),
    send: (to, type, msg) => sent.push({ to, type, msg }),
    broadcast: (type, msg) => broadcasts.push({ type, msg }),
    exists: (n) => [...names, ...(extra.offline ?? [])].find((x) => x.toLowerCase() === n.toLowerCase()),
    muted: (p) => extra.muted?.[p.name] ?? 0,
    ...(extra.zoneAt ? { zoneAt: extra.zoneAt } : {}),
    ...(extra.away ? { away: (id: string) => extra.away!.includes(id) } : {}),
    ...(extra.inPz ? { inPz: extra.inPz } : {}),
    ...(extra.sameParty ? { sameParty: extra.sameParty } : {}),
    now: () => t,
  });
  const by = (n: string) => players.find((p: any) => p.name === n);
  return { social, players, records, sent, broadcasts, by, advance: (ms: number) => { t += ms; } };
}
const notices = (w: ReturnType<typeof world>, to: string) => w.sent.filter((s) => s.to === to && s.type === S2C.Notice).map((s) => s.msg.text as string);

describe("social: emotes", () => {
  it("/e válido vira broadcast com o id do emote; apelidos e maiúsculas valem; respeita o cooldown", () => {
    const w = world(["Ana", "Beto"]);
    expect(w.social.command(w.by("Ana"), "/e coracao")).toBe(true);
    expect(w.broadcasts).toEqual([{ type: S2C.Emote, msg: { id: "s0", emote: "coracao" } }]);
    w.social.command(w.by("Ana"), "/e rir"); // dentro do cooldown: ignorado
    expect(w.broadcasts).toHaveLength(1);
    w.advance(EMOTE_COOLDOWN_MS);
    w.social.command(w.by("Ana"), "/emote KKK"); // apelido
    expect(w.broadcasts[1]!.msg).toEqual({ id: "s0", emote: "rir" });
    w.social.command(w.by("Beto"), "/e oi"); // cooldown é por jogador
    expect(w.broadcasts).toHaveLength(3);
  });

  it("emote desconhecido ou vazio lista os disponíveis e não difunde nada", () => {
    const w = world(["Ana"]);
    w.social.command(w.by("Ana"), "/e");
    w.social.command(w.by("Ana"), "/e inexistente");
    expect(w.broadcasts).toHaveLength(0);
    expect(notices(w, "s0")[0]).toContain("coracao");
  });
});

describe("social: sussurro", () => {
  it("entrega só aos dois, com nome de várias palavras, e /r responde ao último contato", () => {
    const w = world(["Qa Ab", "Qa Ac", "Qa Ad"]);
    w.social.command(w.by("Qa Ab"), "/w Qa Ac oi, tudo bem?");
    const got = w.sent.filter((s) => s.type === S2C.Chat);
    expect(got.map((s) => s.to).sort()).toEqual(["s0", "s1"]);
    expect(got[0]!.msg).toMatchObject({ from: "Qa Ab", to: "Qa Ac", text: "oi, tudo bem?", channel: "whisper" });
    w.advance(WHISPER_COOLDOWN_MS);
    w.social.command(w.by("Qa Ac"), "/r tudo ótimo");
    const last = w.sent.filter((s) => s.type === S2C.Chat).slice(-2);
    expect(last[0]!.msg).toMatchObject({ from: "Qa Ac", to: "Qa Ab", text: "tudo ótimo" });
    expect(w.sent.some((s) => s.to === "s2" && s.type === S2C.Chat)).toBe(false); // terceiro não recebe
  });

  it("prefere o nome mais longo quando um abre o outro", () => {
    const w = world(["Leo", "Leo Neto", "Ana"]);
    w.social.command(w.by("Ana"), "/w Leo Neto oi");
    expect(w.sent.find((s) => s.type === S2C.Chat)!.msg).toMatchObject({ to: "Leo Neto", text: "oi" });
  });

  it("avisa quando o destino não está online, texto vazio, a si mesmo, silenciado e rajada", () => {
    const w = world(["Ana", "Beto"], { muted: { Beto: 120_000 } });
    w.social.command(w.by("Ana"), "/w Fantasma oi");
    w.social.command(w.by("Ana"), "/w Beto");
    w.social.command(w.by("Ana"), "/w Ana oi");
    expect(w.sent.filter((s) => s.type === S2C.Chat)).toHaveLength(0);
    expect(notices(w, "s0")).toHaveLength(3);
    w.social.command(w.by("Beto"), "/w Ana oi");
    expect(notices(w, "s1")[0]).toContain("silenciado");
    w.social.command(w.by("Ana"), "/w Beto 1");
    w.social.command(w.by("Ana"), "/w Beto 2"); // sem esperar o cooldown
    expect(w.sent.filter((s) => s.type === S2C.Chat)).toHaveLength(2); // só a 1ª (2 cópias)
  });

  it("/r sem contato avisa", () => {
    const w = world(["Ana"]);
    w.social.command(w.by("Ana"), "/r oi");
    expect(notices(w, "s0")[0]).toContain("Ninguém para responder");
  });
});

describe("social: amigos", () => {
  it("adiciona, remove (alterna), lista com online/offline e persiste no registro", () => {
    const w = world(["Ana", "Beto"], { offline: ["Carla"] });
    w.social.command(w.by("Ana"), "/amigo beto");
    w.social.command(w.by("Ana"), "/amigo Carla");
    expect(w.records.get("s0").data.friends).toEqual(["Beto", "Carla"]);
    w.social.command(w.by("Ana"), "/amigos");
    expect(notices(w, "s0").at(-1)).toContain("Beto ●");
    expect(notices(w, "s0").at(-1)).toContain("Carla ○");
    w.social.command(w.by("Ana"), "/amigo Beto"); // alterna: remove
    expect(w.records.get("s0").data.friends).toEqual(["Carla"]);
  });

  it("recusa inexistente, a si mesmo e passou do limite", () => {
    const w = world(["Ana"], { offline: Array.from({ length: MAX_FRIENDS + 1 }, (_, i) => `Amigo${String.fromCharCode(97 + (i % 26))}${i}`) });
    w.social.command(w.by("Ana"), "/amigo Ninguém");
    w.social.command(w.by("Ana"), "/amigo Ana");
    expect(w.records.get("s0").data.friends).toEqual([]);
    for (let i = 0; i <= MAX_FRIENDS; i++) w.social.command(w.by("Ana"), `/amigo AmigoX`.replace("AmigoX", `Amigo${String.fromCharCode(97 + (i % 26))}${i}`));
    expect(w.records.get("s0").data.friends).toHaveLength(MAX_FRIENDS);
    expect(notices(w, "s0").at(-1)).toContain("Lista cheia");
  });

  it("avisa os amigos online quando alguém entra e sai, e quem entra vê quais amigos estão online", () => {
    const w = world(["Ana", "Beto", "Caio"]);
    w.records.get("s0").data.friends = ["Beto"]; // Ana tem Beto como amigo
    w.records.get("s1").data.friends = ["Ana"]; // Beto tem Ana
    w.social.onJoin(w.by("Beto"));
    expect(notices(w, "s0")).toEqual(["Beto (amigo) entrou no jogo."]);
    expect(notices(w, "s1")).toEqual(["Amigos online: Ana."]);
    expect(notices(w, "s2")).toEqual([]); // Caio não é amigo de ninguém
    w.social.onLeave(w.by("Beto"));
    expect(notices(w, "s0").at(-1)).toBe("Beto (amigo) saiu do jogo.");
  });

  it("comandos de outros sistemas não são tratados aqui", () => {
    const w = world(["Ana"]);
    expect(w.social.command(w.by("Ana"), "/convidar Beto")).toBe(false);
    expect(w.social.command(w.by("Ana"), "oi")).toBe(false);
  });
});

describe("social: /quem", () => {
  const zoneAt = (x: number) => (x < 100 ? "Vila de Pedra Clara" : x < 200 ? "Pântano Turvo" : null);
  const setup = (away?: string[]) => {
    const w = world(["Ana", "Beto", "Caio", "Duda"], { zoneAt, ...(away ? { away } : {}) });
    const stats: [string, number, string, number][] = [["Ana", 30, "knight", 50], ["Beto", 45, "druid", 150], ["Caio", 19, "paladin", 60], ["Duda", 100, "sorcerer", 300]];
    for (const [n, level, vocation, x] of stats) Object.assign(w.by(n), { level, vocation, x, y: 10 });
    return w;
  };
  const rows = (w: ReturnType<typeof world>, to: string) => w.sent.filter((s) => s.to === to && s.type === S2C.Chat).map((s) => s.msg);

  it("lista todos (maior level primeiro) com level, vocação e zona; ✓ grupo pela regra dos 2/3 em relação a quem pergunta", () => {
    const w = setup();
    expect(w.social.command(w.by("Ana"), "/quem")).toBe(true);
    expect(notices(w, "s0")).toEqual(["Online (4): veja a lista no chat. ✓ grupo = divide XP com você."]);
    const r = rows(w, "s0");
    expect(r.every((m) => m.channel === "system" && m.from === "")).toBe(true);
    // Zona só de você (e de amigos, grupo e quem está na PZ — abaixo): a de terceiros era um radar para PK.
    expect(r.map((m) => m.text)).toEqual([
      "Duda · lv 100 · Feiticeiro",
      "Beto · lv 45 · Druida ✓ grupo", // 30 ≥ 2/3 de 45
      "Ana · lv 30 · Cavaleiro · Vila de Pedra Clara (você)",
      "Caio · lv 19 · Paladino", // 19 < 2/3 de 30 (20)
    ]);
    expect(w.sent.every((s) => s.to === "s0")).toBe(true); // só quem perguntou recebe
    expect(w.broadcasts).toHaveLength(0);
  });

  it("a marca é relativa a quem pergunta; /who é apelido; sem zoneAt no host a zona fica de fora", () => {
    const w = setup();
    w.social.command(w.by("Beto"), "/who");
    expect(rows(w, "s1").map((m) => m.text).filter((t) => t.includes("✓ grupo"))).toEqual(["Ana · lv 30 · Cavaleiro ✓ grupo"]);
    w.social.command(w.by("Caio"), "/quem"); // 19 não divide com 30 (precisa de 20)
    expect(rows(w, "s2").some((m) => m.text.includes("✓ grupo"))).toBe(false);

    const bare = world(["Ana"]);
    Object.assign(bare.by("Ana"), { level: 5, vocation: "druid", x: 1, y: 1 });
    bare.social.command(bare.by("Ana"), "/quem");
    expect(rows(bare, "s0").map((m) => m.text)).toEqual(["Ana · lv 5 · Druida (você)"]);
  });

  it("zona aparece para amigos, para o grupo e para quem está em zona de proteção", () => {
    const w = world(["Ana", "Beto", "Caio", "Duda"], { zoneAt, inPz: (x) => x >= 200, sameParty: (a, b) => new Set([a, b]).size === 2 && [a, b].every((id) => id === "s0" || id === "s2") });
    Object.assign(w.by("Ana"), { level: 30, vocation: "knight", x: 10, y: 1 });
    Object.assign(w.by("Beto"), { level: 45, vocation: "druid", x: 150, y: 1 }); // amigo
    Object.assign(w.by("Caio"), { level: 19, vocation: "paladin", x: 50, y: 1 }); // mesmo grupo
    Object.assign(w.by("Duda"), { level: 100, vocation: "sorcerer", x: 250, y: 1 }); // na PZ (x ≥ 200)
    w.records.get("s0")!.data.friends = ["Beto"];
    w.social.command(w.by("Ana"), "/quem");
    expect(rows(w, "s0").map((m) => m.text)).toEqual([
      "Duda · lv 100 · Feiticeiro · fora das zonas",
      "Beto · lv 45 · Druida · Pântano Turvo ✓ grupo",
      "Ana · lv 30 · Cavaleiro · Vila de Pedra Clara (você)",
      "Caio · lv 19 · Paladino · Vila de Pedra Clara",
    ]);
  });

  it("quem está no mundo sem ninguém no controle aparece como (ausente); a hora da linha vem do relógio do host", () => {
    const w = setup(["s1"]); // Beto caiu (ou saiu em combate) e o personagem ainda está no mundo
    w.social.command(w.by("Ana"), "/quem");
    const r = rows(w, "s0");
    expect(r.map((m) => m.text)).toContain("Beto · lv 45 · Druida (ausente) ✓ grupo");
    expect(r.filter((m) => m.text.includes("(ausente)"))).toHaveLength(1);
    expect(r.every((m) => m.ts === 1_000_000)).toBe(true);
  });
});
