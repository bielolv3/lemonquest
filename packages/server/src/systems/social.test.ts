import { describe, expect, it } from "vitest";
import { S2C } from "@lemonquest/shared";
import { EMOTE_COOLDOWN_MS, MAX_FRIENDS, SocialSystem, WHISPER_COOLDOWN_MS } from "./social.ts";

type Sent = { to: string; type: string; msg: any };

function world(names: string[], extra: { offline?: string[]; muted?: Record<string, number> } = {}) {
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
