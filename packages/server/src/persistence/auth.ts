// DONO: agente "contas+chat". Contrato público usado por WorldRoom/index — não mudar as assinaturas.
import { Router } from "express";
import type { CharacterRecord } from "./types.ts";

/** Rotas HTTP montadas em /api (POST /api/login — ver LoginRequest/LoginResponse em shared). */
export const authRouter = Router();

/** Valida o token emitido no login e devolve o personagem. Lança Error se inválido/expirado. */
export function consumeToken(_token: string): CharacterRecord {
  throw new Error("not implemented");
}

/** Marca o personagem como online/offline (impede login duplo). */
export function setOnline(_name: string, _online: boolean): void {}
