import { describe, expect, it } from "vitest";
import { attentionTitle, isFriendNotice } from "./attentionLogic.ts";

describe("attentionTitle", () => {
  it("sem aviso, o título normal; com aviso, o contador na frente; passou de 9 vira 9+", () => {
    expect(attentionTitle("Jogo", 0)).toBe("Jogo");
    expect(attentionTitle("Jogo", 3)).toBe("(3) Jogo");
    expect(attentionTitle("Jogo", 12)).toBe("(9+) Jogo");
  });
});

describe("isFriendNotice", () => {
  it("reconhece os avisos de amigo do servidor e nada além", () => {
    expect(isFriendNotice("Beto (amigo) entrou no jogo.")).toBe(true);
    expect(isFriendNotice("Beto (amigo) saiu do jogo.")).toBe(true);
    expect(isFriendNotice("Troca concluída com Beto.")).toBe(false);
  });
});
