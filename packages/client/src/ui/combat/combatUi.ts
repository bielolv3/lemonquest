// Ponte jogo → UI para eventos de combate que viram overlays Preact.
import { createStore } from "../hud/store.ts";

export interface LevelBanner { level: number; n: number }
export interface DeathInfo { killerName: string; lostXp: number }

export const levelBannerStore = createStore<LevelBanner | null>(null);
export const deathStore = createStore<DeathInfo | null>(null);

let bannerSeq = 0;
export const showLevelBanner = (level: number) => levelBannerStore.set({ level, n: ++bannerSeq });
export const showDeath = (info: DeathInfo) => deathStore.set(info);
export const hideDeath = () => deathStore.set(null);
