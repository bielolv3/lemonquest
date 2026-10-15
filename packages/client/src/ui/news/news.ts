// Tela de novidades: aberta/fechada e o que o jogador já viu (por personagem, no navegador).
import { LATEST_NEWS_ID } from "@lemonquest/shared";
import { createStore } from "../hud/store.ts";

export const newsOpen = createStore(false);

const key = (name: string) => `lemonquest.news.${name.normalize("NFC").toLowerCase()}`;
export const seenNews = (name: string): string | null => { try { return localStorage.getItem(key(name)); } catch { return null; } };
export const markNewsSeen = (name: string): void => { try { localStorage.setItem(key(name), LATEST_NEWS_ID); } catch { /* indisponível */ } };
