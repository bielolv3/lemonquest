import { describe, expect, it, vi } from "vitest";
import { MAX_CHAT_LEN } from "@tibinha/shared";
import { handleChat } from "./chat.ts";

function mk(id: string) {
  const sent: Array<[string, unknown]> = [];
  return { client: { sessionId: id, send: (t: string, m: unknown) => sent.push([t, m]) } as any, sent };
}

describe("chat", () => {
  it("difunde, apara e limita tamanho; ignora vazio e canal não-global", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const broadcast = vi.fn();
    const room = { broadcast } as any;
    const { client } = mk("a");
    const from = { name: "Leo" } as any;
    handleChat(room, client, from, { text: "   ", channel: "global" });
    handleChat(room, client, from, { text: "oi", channel: "party" });
    expect(broadcast).not.toHaveBeenCalled();
    handleChat(room, client, from, { text: "  oi  ", channel: "global" });
    handleChat(room, client, from, { text: "x".repeat(MAX_CHAT_LEN + 50), channel: "global" });
    expect(broadcast).toHaveBeenCalledTimes(2);
    expect(broadcast.mock.calls[0]![1]).toMatchObject({ from: "Leo", text: "oi", channel: "global" });
    expect(broadcast.mock.calls[1]![1].text).toHaveLength(MAX_CHAT_LEN);
  });

  it("rate limit: 5 por 5s, extras viram aviso", () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const broadcast = vi.fn();
    const { client, sent } = mk("b");
    const from = { name: "Ana" } as any;
    for (let i = 0; i < 7; i++) handleChat({ broadcast } as any, client, from, { text: "m" + i, channel: "global" });
    expect(broadcast).toHaveBeenCalledTimes(5);
    expect(sent).toHaveLength(2);
    expect(sent[0]![0]).toBe("notice");
    expect(sent[0]![1]).toMatchObject({ kind: "warn" });
  });
});
