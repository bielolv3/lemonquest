import brand from "./brand.json";

/**
 * Nome do jogo exibido para os jogadores. Para trocar, use o script (não edite à mão):
 *   node tools/rename-game.mjs "Novo Nome"
 */
export const GAME_NAME: string = brand.name;
/** Versão sem espaços/acentos usada em caminhos de instalação e no nome do serviço do Windows. */
export const GAME_SLUG: string = brand.slug;
