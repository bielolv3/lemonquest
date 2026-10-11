# Catálogo de assets — Ninja Adventure (parcial)

Todos os caminhos são relativos a `assets/` (ex.: `ninja-adventure/content/...`).

## 1. Origem e licença

- Pack oficial: https://pixel-boy.itch.io/ninja-adventure-asset-pack (autor: pixel-boy & AAA). A página do itch.io declara licença **Creative Commons Zero (CC0) v1.0**.
- **Não foi possível baixar o zip de 89 MB do itch.io.** O botão de download usa um fluxo JavaScript com IDs de upload que não estão no HTML estático. Tentativas feitas: POST com csrf_token, IDs próximos, endpoints JSON. Nenhuma funcionou.
- **O que foi baixado:** o repositório GitHub oficial do autor, https://github.com/pixel-boy/NinjaAdventure (branch `main`, arquivo `codeload.github.com/pixel-boy/NinjaAdventure/zip/refs/heads/main`). É o projeto Godot do jogo, que contém **um subconjunto** do pack. Está em `ninja-adventure/`, com 6,8 MB.
- O repositório **não tem arquivo LICENSE**. A licença CC0 vem da página do itch.io, não do repositório.
- **Atenção à fonte:** `ninja-adventure/theme/font_normal.ttf` tem, na tabela `name` interna, a frase "FontStruct Non-Commercial License" e "Copyright pixel-boy 2021". Isso contradiz o CC0 da página. **Não use essa fonte em produção sem confirmar a licença com o autor.**
- Arquivos `*.import`, `*.tmp`, `.tscn`, `.tres` e `.gd` são metadados da Godot. Não são assets do jogo e não devem ser usados diretamente. Os `.gd` e `.tscn` servem apenas como referência de layout.

Gaps em relação ao pedido original: não há monstros (além de um porco), NPCs, grade de ícones de itens, FX de magia, sons de SFX, nem sprites de classes além de dois personagens de samurai/ninja. Para essas categorias é preciso o zip completo do itch.io ou outra fonte.

## 2. Tilesets (`ninja-adventure/content/map/`)

Tile size: 16x16. O `tileset.tres` não declara `tile_size`, então vale o padrão da Godot (16x16). Tamanhos em tiles são calculados a partir das dimensões em pixels.

| Arquivo | Imagem | Tiles (colunas x linhas) | Conteúdo (verificado visualmente ou só pelas dimensões) |
|---|---|---|---|
| `tileset_floor.png` | 352x417 | 22 x 26,06 (altura não é múltiplo de 16) | Chão: grama, terra, caminho, pedra/neve, água. Verificado visualmente. A altura não fecha em grade inteira, então confirme antes de fatiar. |
| `tileset_interior_floor.png` | 352x272 | 22 x 17 | Piso de interior (não verificado visualmente). |
| `tileset_wall_simple.png` | 160x176 | 10 x 11 | Paredes simples (não verificado visualmente). |
| `tileset_village_abandoned.png` | 320x192 | 20 x 12 | Vila abandonada: casas, cercas, objetos (não verificado visualmente). |
| `tileset_animated.png` | 64x64 | 4 x 4 | Tiles animados, 3 frames (o `tileset.tres` define `animation_frame_0..2`). Conteúdo não verificado visualmente. |

## 3. Personagens jogáveis (`ninja-adventure/content/character/`)

Layout confirmado pelo código Godot (`system/character/sprite_character.gd`, `system/character/character.tscn` com `hframes = 4`, `vframes = 7`):

- Frame: **16x16**. Sheet: **64x112** (4 colunas x 7 linhas).
- **Colunas = direção** (enum `FrameDirection`): 0 = DOWN, 1 = UP, 2 = LEFT, 3 = RIGHT.
- **Linhas = ação** (`ANIMATION_DATA`): linha 0 = IDLE (frame 0). Linhas 0 a 3 = MOVING (frames `[0,1,2,3]`, ciclo de caminhada). Linha 4 = ATTACK. Linha 5 = JUMP. Linha 6 = DEAD, ITEM e ABILITY. A linha usada por ABILITY_2 não ficou clara no trecho lido.
- Cada linha de ação tem as 4 direções nas 4 colunas, então ataque também existe nas 4 direções (linha 4).

| Sprite | Arquivo | Frame | Imagem | Layout |
|---|---|---|---|---|
| Ninja azul | `ninja-adventure/content/character/ninja_blue/sprite.png` | 16x16 | 64x112 | 4x7, layout acima |
| Samurai azul | `ninja-adventure/content/character/samurai_blue/sprite.png` | 16x16 | 64x112 | 4x7, layout acima |
| Samurai verde | `ninja-adventure/content/character/samurai_green/samurai_green.png` | 16x16 | 64x112 | 4x7, layout acima |

São **3 sprites de jogador distintos**. Para as 4 classes (knight, paladin/archer, sorcerer, druid) faltam pelo menos um sprite: o mapeamento para classes é decisão de design. Não há sprite de druida nem de feiticeiro explícito.

## 4. Monstros e criaturas

Só existe um animal no subconjunto:

| Sprite | Arquivo | Frame | Imagem | Layout |
|---|---|---|---|---|
| Porco | `ninja-adventure/content/character/pig/pig.png` | 16x16 | 32x16 | 2x1 (`animal.tscn` usa `hframes = 2`). Caminhada com 2 frames (`MOVING: [0,1]`), idle com 1 (`IDLE: [0]`). Direção não tratada no `animal.gd`: usa `flip_h`. |

Não há rato, slime, lobo, goblin, esqueleto, morcego, cobra, aranha, fantasma nem boss. **Nenhum dos candidatos da lista está presente no subconjunto.** Para esses, é preciso o zip completo.

## 5. NPCs (moradores, lojista, sacerdote, guardas)

Não há NPCs no subconjunto. A pasta `content/character/` só tem os personagens listados acima e o porco.

## 6. Ícones de itens

Não há grade de ícones de itens (poções, moedas, chaves, armaduras). Itens presentes são **armas em duas imagens** (mão + sprite no chão):

| Item | Arquivo "in_hand" | Arquivo "sprite" (no chão) |
|---|---|---|
| Machado | `ninja-adventure/content/weapon/axe/in_hand.png` (11x8) | `ninja-adventure/content/weapon/axe/sprite.png` (11x13) |
| Espada grande | `ninja-adventure/content/weapon/big_sword/in_hand.png` (7x12) | `ninja-adventure/content/weapon/big_sword/sprite.png` (7x16) |
| Osso | `ninja-adventure/content/weapon/bone/in_hand.png` (7x8) | `ninja-adventure/content/weapon/bone/sprite.png` (7x12) |
| Livro | `ninja-adventure/content/weapon/book/in_hand.png` (12x9) | `ninja-adventure/content/weapon/book/sprite.png` (9x9) |
| Clava | `ninja-adventure/content/weapon/club/in_hand.png` (8x10) | `ninja-adventure/content/weapon/club/sprite.png` (8x14) |

Esses sprites **não são grade de 16x16**. Têm tamanho próprio, então o código precisa tratá-los como imagens únicas.

Também presentes:
- Objetos destrutíveis: `ninja-adventure/content/destroyable/crate.png` (14x15), `grass.png` (16x16), `pot.png` (14x16).
- Coração (HUD): `ninja-adventure/content/ui/heart.png` (80x16), `heart_2.png` (64x16), `heart_3.png` (64x16). Nomes sugerem estados de vida, mas o uso exato não foi verificado.

## 7. Efeitos (FX)

Não há sheet de fogo, gelo, raio, cura, slash nem explosão de magia.

Partículas (`ninja-adventure/content/particle/`) e FX de ambiente (`ninja-adventure/system/environment/fx/`):

| Arquivo | Imagem | Descrição pelo nome |
|---|---|---|
| `content/particle/particle_grass.png` | 72x13 | grama (partícula de quebra) |
| `content/particle/particle_leaf_pink.png` | 72x7 | folha rosa |
| `content/particle/particle_pot.png` | 84x14 | pedaços de pote |
| `content/particle/particle_rock.png` | 80x16 | pedra |
| `content/particle/particle_wood.png` | 96x16 | madeira |
| `system/environment/fx/cloud.png` | 80x36 | nuvem |
| `system/environment/fx/fog.png` | 320x176 | névoa |
| `system/environment/fx/leaf.png` | 72x7 | folha |
| `system/environment/fx/rain.png` | 2x4 | chuva |
| `system/environment/fx/rain_on_floor.png` | 24x8 | respingo da chuva |
| `system/environment/fx/raylight.png` | 216x102 | raio de luz |
| `system/environment/fx/raylight_big.png` | 84x81 | raio de luz grande |
| `system/environment/fx/snow.png` | 56x8 | neve |

As dimensões em frames não estão declaradas no código para esses FX. Não há contagem de frames confirmada.

## 8. UI

- **Fonte:** `ninja-adventure/theme/font_normal.ttf` (20.944 bytes). Nome interno "NinjaAdventure Regular". **Licença incerta:** a tabela `name` cita "FontStruct Non-Commercial License". Não tratar como CC0 sem confirmação.
- **Tema:** `ninja-adventure/theme/theme_1/theme_1.tres`, que usa a fonte acima com `default_font_size = 9`.
- **Botões** (`ninja-adventure/theme/theme_1/`): `button_normal.png`, `button_hover.png`, `button_pressed.png`, `button_disabled.png`, todos 16x8.
- **Painéis (9-patch)**: `ninja-adventure/theme/nine_path_2.png` a `nine_path_12.png` (16x16 cada), `ninja-adventure/theme/theme_1/nine_path_bg.png`, `nine_path_bg_2.png`, `nine_path_panel.png` (16x16), `nine_path_focus.png` (8x8).
- **Checkboxes**: `checked.png`, `unchecked.png`, `checked_disabled.png`, `unchecked_disabled.png` (16x16).
- **Sliders**: `h_slidder_grabber*.png` (13x11), `v_slidder_grabber*.png` (11x13), `slider_progress.png` e `slider_progress_hover.png` (16x16).
- **Barra de vida**: `ninja-adventure/system/ui/life_bar/life_bar.png` (18x4) e `life_bar_bg.png` (18x4).

## 9. Música e SFX

**Música** (`ninja-adventure/audio/music/`, formato Ogg Vorbis, duração não verificada):

- `theme_dream.ogg` (2,3 MB)
- `theme_lost_village.ogg` (0,9 MB)
- `theme_plain.ogg` (0,97 MB)
- `theme_swamp.ogg` (1,5 MB)

**SFX:** não há nenhum arquivo de efeito sonoro no subconjunto. Hit, morte, moeda, level up, menu e magia não estão disponíveis aqui.

## 10. Totais

- Arquivos de imagem (PNG) no subconjunto: 98 (sem contar os `.import`).
- Música: 4 faixas.
- Fonte: 1.
- Tamanho total da pasta `ninja-adventure/`: 6,8 MB.
