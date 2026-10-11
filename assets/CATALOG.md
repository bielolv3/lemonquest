# Catálogo de assets — Ninja Adventure (pack completo)

Todos os caminhos são relativos a `assets/` (ex.: `ninja/Actor/Character/Knight/SpriteSheet.png`).

Legenda de confiança:
- **[verificado]**: confirmado por comparação de pixels com outro arquivo, ou pelo código Godot do próprio repositório.
- **[visual]**: conferido ao abrir a imagem, sem medição exata.
- **[inferido]**: tirado do nome do arquivo ou das dimensões. Não confirmado.

## 1. Origem e licença

- Pack: https://pixel-boy.itch.io/ninja-adventure-asset-pack (Pixel-boy & AAA).
- Licença: **CC0 1.0 Universal**. Texto em `ninja/LICENSE.txt`. O `ninja/README.md` também declara CC0.
- Pasta: `ninja/` (~109 MB, 2.234 arquivos; 1.915 PNG).
- Exemplos e pré-visualizações (não são assets): `ninja/Example 1.gif` a `Example 4.gif`, `ninja/Example 5 ( Old Version).png`, `ninja/MusicCover.png`, `ninja/Palette.png`, `ninja/preview-part-1.png`, `ninja/preview-part-2.png`.

**Atenção à fonte:** `ninja/Ui/Font/NormalFont.ttf` declara "FontStruct Non-Commercial License" na tabela `name`, apesar do CC0 do pack. Confirme antes de usar em produção.

## 2. Convenções gerais

- Tile base: **16x16**. Exceções explícitas abaixo.
- Sheets de personagem de 64x112 têm **4 colunas x 7 linhas** de 16x16.
- Dimensões em tiles são calculadas a partir de pixels com tile de 16x16.

## 3. Personagens jogáveis (Actor/Character)

### 3.1 Layout das sheets de personagem [verificado]

Cada pasta `ninja/Actor/Character/<Nome>/` tem:

| Arquivo | Tamanho da imagem | Frame | Frames | Conteúdo |
|---|---|---|---|---|
| `SpriteSheet.png` | 64x112 | 16x16 | 4 x 7 | Sheet principal, todas as ações |
| `Faceset.png` | 38x38 | — | 1 | Retrato para diálogo |
| `SeparateAnim/Walk.png` | 64x64 | 16x16 | 4 x 4 | Caminhada: linhas 0..3 da sheet |
| `SeparateAnim/Idle.png` | 64x16 | 16x16 | 4 x 1 | Parado: linha 0 |
| `SeparateAnim/Attack.png` | 64x16 | 16x16 | 4 x 1 | Ataque: linha 4 |
| `SeparateAnim/Jump.png` | 64x16 | 16x16 | 4 x 1 | Pulo: linha 5 |
| `SeparateAnim/Dead.png` | 16x16 | 16x16 | 1 | Morto: linha 6, coluna 0 |
| `SeparateAnim/Item.png` | 16x16 | 16x16 | 1 | Usar item: linha 6, coluna 1 |
| `SeparateAnim/Special1.png` | 16x16 | 16x16 | 1 | Habilidade 1: linha 6, coluna 2 |
| `SeparateAnim/Special2.png` | 16x16 | 16x16 | 1 | Habilidade 2: linha 6, coluna 3 |

**Mapeamento verificado por comparação de pixels (Knight):**
- Idle = linha 0 da sheet.
- Walk = linhas 0, 1, 0, 3 da sheet, nessa ordem de frame. Frame 2 é idêntico ao frame 0 em pixels. **Sugestão:** use as linhas 0..3 da sheet como frames de caminhada.
- Attack = linha 4. Jump = linha 5.
- Dead, Item, Special1, Special2 = linha 6, colunas 0 a 3.

**Direção (colunas), pelo código Godot** (`ninja/system/character/sprite_character.gd`, enum `FrameDirection{RIGHT=3,DOWN=0,LEFT=2,UP=1}`):
- Coluna 0 = DOWN, 1 = UP, 2 = LEFT, 3 = RIGHT.
- Confirmação visual para Knight: coluna 0 é de frente (visor visível). Colunas 1 a 3 são de costas ou de lado, sem certeza de qual é qual.

**Layout das 90 sheets:** todas as pastas têm as mesmas dimensões acima. Verificado por contagem: 90 `SpriteSheet.png` em 64x112, 90 `Walk.png` em 64x64, 266 arquivos 64x16, 360 arquivos 16x16. Nenhuma exceção no layout. Algumas pastas têm uma sheet a menos (ex.: `SamuraiRed` sem `SpriteSheet.png` no disco; `MaskFrog` e `OldWoman` com 7 arquivos separados).

### 3.2 Propostas para as 4 classes [visual + inferido]

| Classe | Sugestão | Caminho base | Motivo |
|---|---|---|---|
| Knight | **Knight** | `ninja/Actor/Character/Knight/` | Armadura de metal cinza, verificado visualmente. |
| Paladin | **KnightGold** | `ninja/Actor/Character/KnightGold/` | Armadura dourada, [visual]. |
| Archer | **Hunter** | `ninja/Actor/Character/Hunter/` | Nome sugere caçador. Não verificado se tem arco. |
| Sorcerer | **SorcererBlack** ou **SorcererOrange** | `ninja/Actor/Character/SorcererBlack/` | Nome. Cores diferentes entre as duas. |
| Druid | **Shaman** | `ninja/Actor/Character/Shaman/` | Visual tan e verde. Alternativa: `ShamanLion`. |

Não há sprite de druida explícito. Shaman é a melhor aproximação. Confirme por inspeção antes de usar.

### 3.3 NPCs e townsfolk (candidatos) [inferido pelo nome]

Nenhum NPC foi identificado como lojista, sacerdote ou guarda pelo nome. Estes são candidatos a conferir:

| Papel sugerido | Pasta | Observação |
|---|---|---|
| Aldeão | `Villager`, `Villager2` a `Villager6` | 6 variantes |
| Velho | `OldMan`, `OldMan2`, `OldMan3` | |
| Mulher | `Woman`, `OldWoman` | `OldWoman` tem 2 arquivos a menos no disco |
| Nobre | `Noble` | |
| Princesa | `Princess` | |
| Sultão | `Sultan`, `Sultan2` | |
| Criança | `Child`, `Boy` | |
| Monge (possível sacerdote) | `Monk`, `Monk2` | Não confirmado |
| Mestre (possível ancião) | `Master` | Não confirmado |
| Guarda (possível) | `Inspector`, `GladiatorBlue`, `RedGladiator` | Não confirmado |

Todas em `ninja/Actor/Character/<Nome>/SpriteSheet.png` com layout da seção 3.1.

## 4. Personagens animados (Actor/CharacterAnimated) [inferido]

- `ninja/Actor/CharacterAnimated/NinjaGreen/SpriteSheet.png`: 256x544. Se o frame for 32x32, são 8 x 17 frames.
- `ninja/Actor/CharacterAnimated/NinjaGreen/Separate/`: `Attack` 128x128, `Walk` 128x128, `Idle` 128x128, `Swim` 128x128, `Push` 128x128, `Climb` 32x128, `Dead` 32x64, `Item` 32x64, `Pickup` 32x64, `Hit` 128x64, `Roll` 128x96, `Jump` 96x128. Frame 32x32 é inferido, não confirmado.
- `ninja/Actor/CharacterAnimated/Weapon/`: `Axe.png`, `Hammer.png`, `Katana.png`, `Net.png`, `Pickaxe.png`, todos 256x256. Frame não confirmado.

## 5. Monstros (Actor/Monster) [verificado em dimensões; layout inferido]

Quase todos os monstros têm `SpriteSheet.png` (ou `<Nome>.png`) de **64x64**, e isso dá **4 x 4 frames de 16x16**. O layout (quais linhas são direção e quais são frames) não foi confirmado pelo código, porque o código Godot de monstros não está no pack. Visualmente, cada linha parece ser uma variação ou direção, com 4 frames de animação em colunas.

Cada monstro também tem `Faceset.png` de 38x38.

Sugestões por tipo (**[visual] + nome**):

| Sugestão | Pasta | Observação |
|---|---|---|
| **Slime** | `Slime`, `Slime2`, `Slime3`, `Slime4` | Verde, bom para o slime. |
| **Rato** | `Mouse`, `MouseBlack` | |
| **Morcego** | `BlueBat`, `YellowsBat` | Bat azul e amarelo. |
| **Cobra** | `Snake`, `Snake2`, `Snake3`, `Snake4` | |
| **Aranha** | `SpiderRed`, `SpiderYellow` | |
| **Esqueleto** | `Skull`, `SkullBlue` | Crânio. Não é esqueleto completo. |
| **Fantasma** | `Spirit`, `Spirit2` | |
| **Lagarto / réptil** | `Lizard`, `Lizard2`, `Reptile`, `Reptile2`, `TRex` | |
| **Lobo / goblin** | — | Não há. Mais próximo: `Racoon`, `GoldRacoon`, `Beast`, `Beast2`. |
| **Urso** | `Bear` | |
| **Porco-espinho / toupeira** | `Mole`, `Mole2` | |
| **Cogumelo** | `Mushroom`, `Mushroom2` | |
| **Larva** | `Larva`, `Larva2` | |
| **Coruja** | `Owl`, `Owl2` | |
| **Borboleta** | `Butterfly`, `ButterflyBlue` | |
| **Ciclope** | `Cyclope`, `Cyclope2`, `CatCyclop` (Animal) | |
| **Olho** | `Eye`, `Eye2` | |
| **Polvo / lula** | `Octopus`, `Octopus2`, `RedOctopus`, `GreenOctopus` | |
| **Peixe** | `Fish`, `FishRed` | |
| **Axolote** | `Axolot`, `AxolotBlue` | |
| **Kappa** | `KappaGreen`, `KappaRed` | |
| **Lanterna** | `LanternGreen`, `LanternRed` | |
| **Chama / fogo** | `Flam`, `Flam2` | |
| **Panda** | `Panda` | |
| **Dragão** | `Dragon`, `DragonYellow` | Sprite 64x64. Não confundir com os dragões-segmento de Boss. |
| **Coração** | `HeartRed`, `HeartGreen` | Monstro-coração. |
| **Bambu** | `Bamboo`, `BambooYellow` | |
| **Espírito / ghost** | `Spirit`, `Spirit2` | Já listado. |
| **Gato / cachorro (animal)** | ver `Actor/Animal` | |

Sem pasta de monstro: wolf, goblin, rat com nome próprio, zumbi, mago inimigo.

## 6. Chefes (Actor/Boss) [verificado em dimensões; frames inferidos]

Sprites de chefe são **tiras horizontais**. Frame quadrado igual à altura da tira é o padrão. A largura do frame foi inferida quando a tira é múltiplo inteiro da altura. Confirme antes de fatiar.

| Chefe | Arquivos (tamanho) | Frames inferidos |
|---|---|---|
| **DemonCyclop** / **DemonCyclop2** | `Idle.png` 250x50, `Walk.png` 300x50, `Hit.png` 150x50, `Sprite.png` 37x33 | Idle 5 x 50x50, Walk 6 x 50x50, Hit 3 x 50x50 |
| **GiantSpirit** | `Idle.png` 250x50, `Hit.png` 150x50 | Idle 5, Hit 3 (50x50) |
| **GiantFlam** | `Idle.png` 250x50, `Hit.png` 150x50 | Idle 5, Hit 3 (50x50) |
| **GiantSlime** / **GiantSlime2** | `Idle.png` 310x52, `Hit.png` 310x52, `Jump.png` 806x52 | Idle 5 x 62x52, Jump 13 x 62x52 |
| **GiantFrog** / **GiantFrog2** | `Idle40x40.png` 200x40 (ou `Idle.png` 200x40), `Attack.png` 120x40, `Charge.png` 280x40, `Hit.png` 120x40, `Jump.png` 240x40 | 40x40: Idle 5, Attack 3, Charge 7, Jump 6, Hit 3 |
| **GiantRacoon** / **GiantRacoonGold** | `Idle.png` 360x60, `Attack.png` 240x60, `Charge.png` 120x60, `Jump.png` 300x60, `Sprite.png` 55x50 (ou 43x48 no Gold) | 60x60: Idle 6, Attack 4, Charge 2, Jump 5 |
| **GiantBamboo** / **GiantBamboo2** | `Idle.png` 372x62, `Walk.png` 744x62, `Attack.png` 310x62, `Charge.png` 186x62, `Hit.png` 248x62 | 62x62: Idle 6, Walk 12, Attack 5, Charge 3, Hit 4 |
| **GiantBlueSamurai** / **GiantRedSamurai** | `Idle.png` 576x48, `Walk.png` 576x48, `Hit.png` 384x48, `AttackLeft/Right.png` 384x96, `ChargeLeft/Right.png` 288x96 | 96x48: Idle 6, Walk 6, Hit 4. 96x96: Attack 4, Charge 3 (visualmente 6 frames na tira de Idle) |
| **SquidGreen** / **SquidRed** | `Idle.png` 304x79, `Walk.png` 304x79, `Hit.png` 304x79, `AttackLoop.png` 304x79, `Attack.png` 456x79, `Shoot.png` 380x79 | 76x79: Idle/Walk/Hit/AttackLoop 4, Attack 6, Shoot 5 |
| **TenguBlue** / **TenguRed** | `Idle.png` 408x68 (Blue) ou 492x82 (Red), `Walk.png` 820x82, `Attack.png` 1230x82, `Hit.png` 544x68 (Blue) ou 656x82 (Red), `Trans.png` 748x68 (Blue) ou 902x82 (Red) | Não fechado com precisão; use altura da tira como lado do frame |
| **DragonBlue** / **DragonGreen** | Partes: `Head.png` 44x46, `Body1.png` 31x27, `Body2.png` 31x27, `BodyEnd.png` 29x40, `Wing.png` 57x57. `Preview.png` 636x290 | Não são frames únicos. Montados em segmentos. |

Faceset de cada chefe: `Faceset.png` 38x38.

**Não identificado no chefe:** nenhum sprite de boss de "wolf", "goblin" ou "skeleton" completo.

## 7. Animais (Actor/Animal) [verificado em dimensões]

Padrão: sheets de 32x16 com **2 frames de 16x16** (`hframes = 2`, como `pig.png` no pack antigo). Algumas usam outras larguras (ex.: `Cow/SpriteSheetWhiteSide.png` 48x16 com 3 frames; `Lion/SpriteSheetOrange.png` 32x23).

Exemplos: `Cat`, `CatBlack`, `CatOrange`, `CatWhite`, `Chicken`, `Cow`, `Dog`, `DogBlack`, `DogYellow`, `Donkey`, `Fish`, `Frog`, `Hamster`, `Horse`, `Hyena`, `Lion`, `LionCub`, `Lioness`, `Monkey`, `Parrot`, `Pig`, `Racoon`, `WildBoar`. Todas em `ninja/Actor/Animal/<Nome>/SpriteSheet*.png` com um `Faceset*.png` de 38x38.

## 8. Tilesets e cenários (Backgrounds/Tilesets)

Tamanhos em tiles de 16x16. Conteúdo verificado visualmente nas sheets marcadas.

| Arquivo | Pixels | Tiles | Conteúdo |
|---|---|---|---|
| `TilesetNature.png` | 384x336 | 24 x 21 | **Natureza** [visual]: árvores, arbustos, pedras, flores, troncos, plantas. |
| `TilesetRelief.png` | 320x192 | 20 x 12 | **Relevo** [visual]: cercas e paredões de pedra e madeira. |
| `TilesetReliefDetail.png` | 192x192 | 12 x 12 | Detalhes de relevo [inferido]. |
| `TilesetWater.png` | 448x272 | 28 x 17 | **Água** [visual]: lagos e contornos de praia. |
| `TilesetDesert.png` | 320x192 | 20 x 12 | **Deserto** [visual]: prédios de areia, palmeiras, piscina. |
| `TilesetHouse.png` | 528x368 | 33 x 23 | **Casas** [visual]: casas, lojas, dojo, iglus, cercas, objetos de vila. |
| `TilesetTowers.png` | 384x96 | 24 x 6 | Torres e figuras [visual, baixa confiança]. |
| `TilesetField.png` | 80x240 | 5 x 15 | Campo: blocos de grama, terra, cor [visual]. |
| `TilesetDungeon.png` | 192x64 | 12 x 4 | Masmorra [visual, pequeno]. |
| `TilesetFloor.png` | 352x417 | 22 x 26,06 | Chão: grama, terra, caminho, pedra, neve, água [visual]. **Altura não é múltiplo de 16.** |
| `TilesetFloorB.png` | 176x112 | 11 x 7 | Chão alternativo [inferido]. |
| `TilesetFloorDetail.png` | 256x80 | 16 x 5 | Detalhes de chão [inferido]. |
| `TilesetHole.png` | 176x80 | 11 x 5 | Buracos [inferido]. |
| `TilesetElement.png` | 256x240 | 16 x 15 | Elementos (gelo, fogo, planta?) [inferido]. |
| `TilesetLogic.png` | 128x160 | 8 x 10 | Colisão ou lógica [inferido]. |
| `TilesetVillageAbandoned.png` | 320x192 | 20 x 12 | Vila abandonada [inferido]. |
| `TilesetInterior.png` | 256x320 | 16 x 20 | Interior: móveis e paredes [inferido]. |
| `Interior/TilesetInteriorFloor.png` | 352x272 | 22 x 17 | Piso de interior [inferido]. |
| `Interior/TilesetWallSimple.png` | 160x176 | 10 x 11 | Paredes simples [inferido]. |
| `Interior/Elements.png` | 144x48 | 9 x 3 | Elementos de interior [inferido]. |
| `Pipes.png` | 240x48 | 15 x 3 | Canos [inferido]. |
| `tileset_bed.png` | 224x192 | 14 x 12 | Camas [inferido]. |
| `tileset_camp.png` | 368x144 | 23 x 9 | Acampamento [inferido]. |

**Lava e neve:** não há tileset de lava. Neve aparece em `TilesetFloor` [visual].

**Autotile:** não há arquivo de configuração de autotile (o pack é Godot). Não é possível dizer se os tilesets são autotile sem o `.tres` do projeto original. Trate como tiles fixos.

### 8.1 Tiles animados (Backgrounds/Animated)

| Arquivo | Pixels | Frames | Conteúdo |
|---|---|---|---|
| `Animated/Water Ripples/SpriteSheet16x16.png` | 64x16 | 4 x 16x16 | Ondas na água |
| `Animated/Water Ripples/SpriteSheetPurple.png` | 64x16 | 4 x 16x16 | Ondas roxas |
| `Animated/Waterfall/TopSheet16x16.png` | 80x16 | 5 x 16x16 | Cachoeira, topo |
| `Animated/Waterfall/MiddleSheet16x16.png` | 80x16 | 5 x 16x16 | Cachoeira, meio |
| `Animated/Waterfall/BottomSheet16x16.png` | 48x16 | 3 x 16x16 | Cachoeira, base |
| `Animated/QuickSand/QuickSand32x32.png` | 256x32 | 8 x 32x32 | Areia movediça |
| `Animated/MillPropeller/MillPropeller_A_64x64.png` | 256x64 | 4 x 64x64 | Hélice de moinho (A) |
| `Animated/MillPropeller/MillPropeller_B_64x64.png` | 256x64 | 4 x 64x64 | Hélice de moinho (B) |
| `Animated/WaterMill/Watermill_A_34x36.png` | 102x36 | 3 x 34x36 | Roda d'água (A) |
| `Animated/WaterMill/Watermill_B_34x36.png` | 102x36 | 3 x 34x36 | Roda d'água (B) |
| `Animated/Flag/Flag<Cor>16x16.png` | 64x16 | 4 x 16x16 | Bandeiras: Black, Blue, Brown, Gray, Green, Red, White, Yellow |
| `Animated/Flower/SpriteSheet16x16.png` | 20x8 | — | Flores [inferido, dimensão não é múltiplo de 16] |
| `Animated/Plant/SpriteSheet16x16.png` | 64x16 | 4 x 16x16 | Planta animada |
| `Animated/Conveyor Belt/{Left,Middle,Right}.png` | 32x16 cada | 2 x 16x16 | Esteira |

### 8.2 Veículos (Backgrounds/Vehicles)

`Boat.png` 80x32, `Crane.png` 33x36, `FishNet.png` 33x25, `FishNetFull.png` 33x25, `Sail.png` 30x43. [inferido pelo nome, sem medição de frame.]

## 9. Itens (Items)

Todas as imagens individuais de item são 16x16, exceto onde indicado. Não há grade única de ícones; cada item é um arquivo.

### 9.1 Armas (Items/Weapons) [verificado em dimensões]

Cada arma tem `Sprite.png` (no chão) e `SpriteInHand.png` (na mão). Tamanhos são irregulares; não usam grade 16x16.

| Arma | Chão | Na mão |
|---|---|---|
| Machado | `Axe/Sprite.png` 11x13 | `Axe/SpriteInHand.png` 11x8 |
| Machado de ferramenta | `AxeTool/Sprite.png` 9x14 | `AxeTool/SpriteInHand.png` 9x9 |
| Espada grande | `BigSword/Sprite.png` 7x16 | `BigSword/SpriteInHand.png` 7x12 |
| Osso | `Bone/Sprite.png` 7x12 | `Bone/SpriteInHand.png` 7x8 |
| Livro | `Book/Sprite.png` 9x9 | `Book/SpriteInHand.png` 12x9 |
| Arco | `Bow/Sprite.png` 15x7, `Bow/Arrow.png` 13x5 | — |
| Arco 2 | `Bow2/Sprite.png` 15x7, `Bow2/Arrow.png` 13x5 | — |
| Clava | `Club/Sprite.png` 8x14 | `Club/SpriteInHand.png` 8x10 |
| Vara de pescar | `Fishing Rod/Sprite.png` 10x14 | — |
| Garfo | `Fork/Sprite.png` 7x16 | `Fork/SpriteInHand.png` 7x12 |
| Martelo | `Hammer/Sprite.png` 9x16 | `Hammer/SpriteInHand.png` 9x9 |
| Katana | `Katana/Sprite.png` 6x14 | `Katana/SpriteInHand.png` 6x10 |
| Lança | `Lance/Sprite.png` 6x23 | `Lance/SpriteInHand.png` 6x16 |
| Lança 2 | `Lance2/Sprite.png` 7x21 | `Lance2/SpriteInHand.png` 7x14 |
| Varinha mágica | `MagicWand/Sprite.png` 5x18 | `MagicWand/SpriteInHand.png` 5x10 |
| Ninjaku | `Ninjaku/Sprite.png` 7x12 | `Ninjaku/SpriteInHand.png` 3x12 |
| Picareta | `Pickaxe/Sprite.png` 11x13 | `Pickaxe/SpriteInHand.png` 11x8 |
| Rapieira | `Rapier/Sprite.png` 10x15 | `Rapier/SpriteInHand.png` 9x11 |
| Sai | `Sai/Sprite.png` 7x13 | `Sai/SpriteInHand.png` 7x8 |
| Graveto | `Stick/Sprite.png` 3x16 | `Stick/SpriteInHand.png` 3x12 |
| Espada | `Sword/Sprite.png` 6x17 | `Sword/SpriteInHand.png` 6x11 |
| Espada 2 | `Sword2/Sprite.png` 6x15 | `Sword2/SpriteInHand.png` 6x11 |
| Chicote | `Whip/Sprite.png` 9x13 | `Whip/SpriteInHand.png` 3x14 |

Arremessáveis (Items/Projectile): `Arrow.png` 16x16, `Bomb.png` 12x13, `Caltrop.png` 16x16, `CrateDynamite.png` 16x16, `Dynamite.png` 16x16, `Kunai.png` 16x16, `Shuriken.png` 15x15.

Projéteis em Ninja e FX: ver seção 10.

### 9.2 Poções e comida [verificado em dimensões]

- Poções (Items/Potion): `EmptyPot.png` 9x11, `LifePot.png` 9x11, `MilkPot.png` 9x11, `WaterPot.png` 9x11, `Heart.png` 9x8, `Medipack.png` 10x10.
- Comida (Items/Food): 24 arquivos, a maioria 16x16 (`Beaf`, `Calamari`, `Fish`, `FortuneCookie`, `Honey`, `Noodle`, `Octopus`, `Onigiri`, `Shrimp`, `Sushi`, `Sushi2`, `TeaLeaf`, `Yakitori`). Menores: `Meat.png` 15x15, `Nut.png` 15x15, `Nut2.png` 15x15, `Seed1..3.png` 8x8, `SeedBig1..3.png` 10x13, `SeedLarge.png` 14x13, `SeedLargeWhite.png` 14x13.

### 9.3 Tesouro, moedas e chaves (Items/Treasure) [verificado]

- Moedas: `GoldCoin.png` 7x7, `SilverCoin.png` 6x6, `Coin2.png` 40x10 (tira, [inferido] 4 frames de 10x10).
- Baús: `LittleTreasureChest.png` 32x16 (2 frames de 16x16 [inferido]), `BigTreasureChest.png` 32x14.
- Copos: `GoldCup.png` 9x11, `SilverCup.png` 9x11.
- Chaves: `GoldKey.png` 12x8, `SilverKey.png` 12x8.

### 9.4 Objetos, ferramentas, recursos, pergaminhos [verificado em dimensões]

- Objetos (Items/Object): `Bag.png`, `Book.png`, `CrateEmpty.png` 16x15, `Dice 4/6/8/20.png`, `Gourd.png` 14x14, `Hourglass.png`, `MoneyBag.png` 14x15, `PanFlute.png`. Tudo 16x16 exceto onde indicado.
- Ferramentas (Items/Tool): `Anvil`, `Axe`, `Hammer`, `Hoe`, `Pickaxe`, `Shovel`, `Sickle`, `WateringCan`. Todas 16x16.
- Recursos (Items/Resource): barras `BarCopper`, `BarGold`, `BarIron`, `BarMithril`, `BarPurple`, `BarSilver` 16x15. Gemas `GemGreen`, `GemPurple` 16x16, `GemRed` 15x15, `GemYellow` 14x14. Também `Branch`, `feather`, `Grass`, `Rock` 16x16, `Water` 14x14.
- Pergaminhos (Items/Scroll): `Scroll` 14x14, `ScrollEmpty`, `ScrollFire`, `ScrollIce`, `ScrollPlant`, `ScrollRock`, `ScrollThunder`, todos 16x16.
- Ações (Items/Action): `Hit.png` 15x15, `Interact.png` 16x16.
- Outros (Items/Other): `Letter.png` 12x9, `Letter2.png` 12x7, `Letter3.png` 12x7, `Stamp.png` 9x9.

**Keys / chaves de porta:** só `GoldKey` e `SilverKey`.

**Sem:** poção de mana, armadura (há `Ui/Skill Icon/Items & Weapon/Armor.png`, ver seção 11), elmo (há `Helmet.png` na mesma pasta).

## 10. Efeitos (FX)

Tamanhos da imagem. **Número de frames e tamanho do frame não são confirmados.** Quando a largura é múltiplo da altura, o frame quadrado é uma hipótese. Confirme antes de fatiar.

### 10.1 Elementais (FX/Elemental)

| Efeito | Arquivo | Pixels | Hipótese de frame |
|---|---|---|---|
| Explosão | `Explosion/SpriteSheet.png` | 360x40 | 9 x 40x40 |
| Fogo (chama) | `Flam/SpriteSheet.png` | 200x30 | não fecha; verificar |
| Gelo | `Ice/SpriteSheet.png` | 320x32 | 10 x 32x32 |
| Gelo (variante B) | `Ice/SpriteSheetB.png` | 288x32 | 9 x 32x32 |
| Gelo (floco) | `Ice/SpriteSheetFlake.png` | 288x32 | 9 x 32x32 |
| Planta | `Plant/SpriteSheet.png` | 240x28 | não fecha; verificar |
| Planta B | `Plant/SpriteSheetB.png` | 210x26 | não fecha; verificar |
| Pedra | `Rock/SpriteSheet.png` | 420x30 | não fecha; verificar |
| Pedra B | `Rock/SpriteSheetB.png` | 420x30 | não fecha; verificar |
| Espinho de pedra | `RockSpike/SpriteSheet.png` | 540x48 | 11 x 48x48 |
| Trovão | `Thunder/SpriteSheet.png` | 160x28 | não fecha; verificar |
| Água | `Water/SpriteSheet.png` | 440x33 | não fecha; verificar |
| Pilar de água | `WaterPillar/SpriteSheet.png` | 270x41 | não fecha; verificar |

### 10.2 Ataques e cortes (FX/Attack e FX/Slash)

| Efeito | Arquivo | Pixels | Hipótese de frame |
|---|---|---|---|
| Corte circular | `Attack/CircularSlash/SpriteSheet.png` | 128x32 | 4 x 32x32 |
| Garra | `Attack/Claw/SpriteSheet.png` | 128x32 | 4 x 32x32 |
| Garra dupla | `Attack/ClawDouble/SpriteSheet.png` | 128x32 | 4 x 32x32 |
| Corte | `Attack/Cut/SpriteSheet.png` | 128x32 | 4 x 32x32 |
| Corte duplo | `Attack/CutDouble/SpriteSheet.png` | 160x32 | 5 x 32x32 |
| Corte X | `Attack/CutX/SpriteSheet.png` | 128x32 | 4 x 32x32 |
| Corte curvo | `Attack/SlashCurved/SpriteSheet.png` | 128x32 | 4 x 32x32 |
| Corte curvo duplo | `Attack/SlashDoubleCurved/SpriteSheet.png` | 128x32 | 4 x 32x32 |
| Arco | `Slash/SpriteSheetArc.png` | 228x34 | não fecha; verificar |
| Circular | `Slash/SpriteSheetCircular.png` | 378x55 | não fecha; verificar |
| Multi | `Slash/SpriteSheetMulti.png` | 270x30 | não fecha; verificar |
| Slash 01 | `Slash/SpriteSheetSlash01.png` | 130x32 | não fecha; verificar |
| Slash 02 | `Slash/SpriteSheetSlash02.png` | 396x50 | não fecha; verificar |
| Slash 03 | `Slash/SpriteSheetSlash03.png` | 228x42 | não fecha; verificar |

### 10.3 Magia (FX/Magic)

| Efeito | Arquivo | Pixels | Hipótese de frame |
|---|---|---|---|
| Aura | `Aura/SpriteSheet.png` | 125x24 | não fecha; verificar |
| Impulso | `Boost/SpriteSheet.png` | 424x35 | não fecha; verificar |
| Círculo laranja | `Circle/SpriteSheetOrange.png` | 128x32 | 4 x 32x32 |
| Círculo faísca | `Circle/SpriteSheetSpark.png` | 192x32 | 6 x 32x32 |
| Círculo faísca 2 | `Circle/SpriteSheetSpark2.png` | 160x32 | 5 x 32x32 |
| Círculo branco | `Circle/SpriteSheetWhite.png` | 128x32 | 4 x 32x32 |
| Escudo azul | `Shield/SpriteSheetBlue.png` | 144x26 | não fecha; verificar |
| Escudo amarelo | `Shield/SpriteSheetYellow.png` | 144x26 | não fecha; verificar |
| Faísca | `Spark/SpriteSheet.png` | 270x35 | não fecha; verificar |
| Espírito | `Spirit/SpriteSheet.png` | 160x32 | 5 x 32x32 |
| Espírito azul | `Spirit/SpriteSheetBlue.png` | 160x32 | 5 x 32x32 |
| Espírito duplo | `Spirit/SpriteSheetDouble.png` | 160x32 | 5 x 32x32 |

Cura: não há sheet explícita de "heal". Os nomes mais próximos são `Spirit` e `Circle`. [inferido]

### 10.4 Fumaça, ambiente e partículas

| Efeito | Arquivo | Pixels | Observação |
|---|---|---|---|
| Fumaça | `Smoke/Smoke/SpriteSheet.png` | 192x32 | 6 x 32x32 [inferido] |
| Fumaça circular | `Smoke/SmokeCircular/SpriteSheet.png` | 240x14 | não fecha; verificar |
| Névoa | `Environment/Fog.png` | 320x180 | imagem única |
| Raio de luz | `Environment/Raylight.png` | 216x102 | imagem única |
| Partículas | `Particle/*.png` | 8 a 96 px de largura, 7 a 16 px de altura | Bamboo 96x15, Clouds 80x36, Fire 96x12, Grass 72x13, Leaf 72x7, LeafPink 72x7, Rain 24x8, RainOnFloor 24x8, Rock 80x16, RockGray 80x16, Snow 56x8, Spark 70x8, Vase 84x14, Wood 96x16 |
| Projéteis | `Projectile/*.png` | 5 a 690 px | `EnergyBall` 64x16, `Fireball` 64x16, `Arrow` 13x5, `BigEnergyBall` 96x24, `IceSpike` 144x10, `Kunai/SpriteSheet.png` 650x59, `Shuriken/SpriteSheet.png` 690x54. Sheets longas têm frame não confirmado. |

## 11. Interface (Ui)

### 11.1 Fontes

- `Ui/Font/NormalFont.ttf`: fonte TrueType "NinjaAdventure Regular", 20.944 bytes. **Licença: "FontStruct Non-Commercial License"** (tabela `name`), conflitando com CC0. Confirmar.
- `Ui/Font/font8x8.png`: 120x64. Fonte bitmap de 8x8. Grade de 15 x 8 glifos [inferido].
- `Ui/Font/font24x30.png`: 360x240. Fonte bitmap de 24x30. Grade de 15 x 8 glifos [inferido].

### 11.2 Diálogo e caixas

- `Dialog/DialogBox.png` 300x58, `Dialog/DialogBoxFaceset.png` 300x58, `Dialog/DialogueBoxSimple.png` 316x60, `Dialog/DialogInfo.png` 80x16, `Dialog/FacesetBox.png` 48x48, `Dialog/ChoiceBox.png` 64x20.
- Botões: `Dialog/YesButton.png` 26x16, `Dialog/NoButton.png` 26x16.

### 11.3 Tema

- `Ui/Theme/Theme Wood/` (tema principal): botões (`button_normal`, `button_hover`, `button_pressed`, `button_disabled`, `button_checked`, `button_unchecked`), checkboxes, radios, sliders (`h_slidder_grabber`, `v_slidder_grabber`, `slider_progress`), tabs, setas, painéis 9-patch (`nine_path_panel`, `nine_path_panel_2`, `nine_path_panel_3`, `nine_path_panel_interior`, `nine_path_bg`, `nine_path_focus`), `inventory_cell.png`.
- `Ui/Theme/Wip/` contém 12 temas em desenvolvimento (Bamboo, Bocal, Bubble, Dark, Map, Metal, Metal2, Metal3, Red, Wood2, Wood3, Wood4). Só `nine_path_panel.png`.
- `Ui/Theme/preview.png`: pré-visualização.

### 11.4 Barras de vida, receptáculos e HUD

- Coração: `Receptacle/Heart.png` 80x16, `Heart2.png` 64x16, `Heart3.png` 64x16, `IconHeart.png` 14x12.
- Barra de vida mini: `Receptacle/LifeBarMiniProgress.png` 18x4, `LifeBarMiniUnder.png` 18x4.
- Receptáculo retangular (`Receptacle/Receptacle Rectangle/`): fundos `BackgroundBag` 42x58, `BackgroundBamboo` 34x56, `BackgroundBottle` 32x63, `BackgroundScroll` 38x66, `BackgroundWood` 34x56; progresso `ProgressHealth` 22x40, `ProgressWhite` 22x40; munição `Ammokunai` 22x10, `AmmoSkill` 22x10, `AmmoSpecial` 11x10.
- Receptáculo esfera (`Receptacle/Receptacle Sphere/`): fundos `BackgroundBamboo`, `BackgroundFlask`, `BackgroundIron`, `BackgroundIron2`, `BackgroundMetal`, `BackgroundRed`, `BackgroundWood` todos 32x32; `Over.png` 32x32; progresso `ProgressBlack`, `ProgressGreen`, `ProgressHealth`, `ProgressMana`, `ProgressPurple`, `ProgressWhite`, `ProgressYellow` todos 22x22.
- Seta: `Arrow.png` 13x13.

### 11.5 Ícones de habilidade (Ui/Skill Icon) [verificado em dimensões]

Todos 24x24. Cada ícone tem versão `...Disabled.png`.

- **Itens e armas:** Amulet, Armor, Arrow, Boot, Guard, Helmet, Hook, Kunai, Money, Ring, Scroll, Shuriken.
- **Trabalho e ação:** Cook, Dish, Harvest, Interact, Mine, Plant, Potion, Punch, Repair, Sing, Talk, Water.
- **Meteorologia:** Moon, Rain, Snow, Sun.
- **Magia:** Alchemy, AttackUpgrade, BookDarkness, BookDeath, BookFire, BookIce, BookLight, BookPlant, BookRock, BookThunder, BookWind, Camouflage, Counter, Cut, Death, DefenseUpgrade, Downgrade, Explosion, Fireball, Heal, LuckUpgrade, MagicWeapon, Mist, Necromancy, OrbDarkness, OrbFire, OrbLight, OrbPlant, OrbWater, Permutation, RockSpike, Upgrade, Vision, WaterCanon.

### 11.6 Emotes, entrada e input

- Emotes (`Ui/Emote/emote1` a `emote30`): 14x13 cada.
- Setas e cursores: `Ui/Arrow.png` 13x13.
- Input (`Ui/Input/`): ícones de teclado (`Keyboard/Key*.png` 13x13 a 33x13), mouse (`Mouse/*.png` 15x20), gamepad (`Gamepad/*.png` 14x5 a 26x9). Pré-visualizações: `Input/Preview.png` 896x210, `Input/Tuto.png` 226x40.

## 12. Áudio (Audio)

Formatos: música em `.ogg`, SFX e jingles em `.wav`. Durações não verificadas.

### 12.1 Músicas (Audio/Musics) [nomes; mapeamento inferido]

Mapeamento sugerido por nome (não ouvido):

| Uso sugerido | Faixa |
|---|---|
| Menu / título | `1 - Adventure Begin.ogg`, `38 - Intro.ogg` |
| Cidade / vila | `4 - Village.ogg`, `36 - Village.ogg`, `33 - Calm Village.ogg`, `26 - Lost Village.ogg` |
| Floresta | `37 - Dark Forest.ogg`, `11 - Clearing.ogg` |
| Caverna / masmorra | `2 - The Cave.ogg`, `21 - Dungeon.ogg`, `10 - Dark Castle.ogg`, `40 - Crypt.ogg`, `30 - Ruins.ogg` |
| Batalha / chefe | `17 - Fight.ogg`, `34  - Fight.ogg` (nota: há espaço duplo no nome), `28 - Tension.ogg` |
| Calmo / exploração | `5 - Peaceful.ogg`, `9 - Quiet.ogg`, `27 - Chill.ogg`, `31 - Sunny.ogg`, `35 - Adventure.ogg` |
| Triste / tensão | `7 - Sad Theme.ogg`, `16 - Melancholia.ogg`, `29 - Lament.ogg` |
| Aquático / barco | `18 - Aquatic.ogg`, `39 - Boat.ogg` |
| Sonho / mágico | `13 - Mystical.ogg`, `22 - Dream.ogg` |
| Final / créditos | `8 - End Theme.ogg`, `25 - End Theme 2.ogg`, `15 - Credit Theme.ogg`, `24 - Final Area.ogg` |
| Outros | `3 - Revelation`, `6 - Story.ogg`, `6 - Story (Short).ogg`, `12 - Temple.ogg`, `14 - Curse.ogg`, `19 - Ascension.ogg`, `20 - Good Time.ogg`, `23 - Road.ogg`, `32 - Manor.ogg` |

Total: 40 faixas em `ninja/Audio/Musics/`.

### 12.2 Jingles (Audio/Jingles)

- Subida de nível: `LevelUp1.wav`, `LevelUp2.wav`, `LevelUp3.wav`.
- Sucesso: `Success1.wav` a `Success4.wav`.
- Fim de jogo / morte (sem SFX de morte dedicado): `GameOver.wav`, `GameOver2.wav`, `GameOver3.wav`, `GameOver4.wav`.
- Segredo: `Secret1.wav` a `Secret4.wav`.

### 12.3 SFX (Audio/Sounds)

| Categoria | Arquivos (exemplos) |
|---|---|
| Golpe e impacto (hit) | `Hit & Impact/Hit1.wav` a `Hit9.wav` (sem Hit4), `Impact.wav`, `Impact2..5.wav` |
| Morte | Não há pasta de morte. Use os jingles `GameOver*`. |
| Moedas e bônus | `Bonus/Coin.wav`, `Coin2.wav`, `Coin3.wav`, `Gold1.wav`, `Gold2.wav`, `Bonus.wav`, `Bonus2.wav`, `Bonus3.wav`, `PowerUp1.wav`, `PowerUp2.wav` |
| Menu | `Menu/Accept.wav` a `Accept9.wav`, `Cancel.wav`, `Cancel2.wav`, `Move1.wav` a `Move8.wav`, `Menu5..12.wav` |
| Magia e habilidade | `Magic & Skill/Magic1.wav` a `Magic5.wav`, `Heal.wav`, `Heal2.wav`, `Heal3.wav`, `Spirit.wav`, `Strange.wav`, `Fx.wav` |
| Fogo e explosão | `Elemental/Fire.wav`, `Fire2.wav`, `Fire3.wav`, `Fireball.wav`, `Fireball2.wav`, `Explosion.wav` a `Explosion6.wav` |
| Água e gelo | `Elemental/Water1.wav` a `Water10.wav`, `WaterDrop.wav`, `Bubble.wav`, `Bubble2.wav` |
| Planta e rocha | `Elemental/Grass.wav`, `Grass2.wav` |
| Corte e movimento | `Whoosh & Slash/Slash.wav` a `Slash5.wav`, `Sword2.wav`, `Whoosh.wav`, `Whoosh2.wav`, `Launch.wav` |
| Pulo e quique | `Jump & Bounce/Jump.wav`, `Jump2.wav`, `Jump3.wav`, `Bounce.wav` a `Bounce5.wav` |
| Alerta | `Alert/Alert.wav` a `Alert6.wav` |
| Ambiente | `Ambient/Rain.wav`, `Rain2.wav`, `Rain3.wav`, `River.wav`, `Storm.wav`, `Wave.wav`, `WaveFar.wav`, `Wind.wav`, `Wind2.wav` |
| Criaturas | `Creature/Bird.wav`, `Dog.wav`, `Duck.wav`, `Wings.wav`, `Wings2.wav` |
| Vozes | `Voice/Voice1.wav` a `Voice10.wav` |

**Não há SFX específicos de:** moeda de ouro isolada (use `Bonus/Coin.wav`), morte de monstro, subida de nível (use `Jingles/LevelUp*`), spell de cada elemento (use `Magic & Skill` e `Elemental`).

## 13. Totais

- PNG: 1.915 arquivos.
- Músicas: 40 `.ogg`.
- SFX e jingles: contagem não feita por pasta. Ordem de grandeza: ~150 `.wav`.
- Fontes: 3 (`NormalFont.ttf` e 2 bitmap).
- Tamanho total: ~109 MB.

## 14. Lacunas e pontos a confirmar

1. **Layout dos monstros** (64x64, 4x4 de 16x16): direção e frame não confirmados.
2. **Frames de chefe e FX**: hipóteses por dimensão. Muitas sheets de FX não fecham em frame quadrado.
3. **Mapeamento de NPCs e classes**: por nome e visual. Shopkeeper, priest e guard não identificados.
4. **Fonte** `NormalFont.ttf`: licença conflita com CC0.
5. **Músicas**: mapeamento por nome, sem escuta.
6. **Morte e cura**: sem SFX dedicado para morte de monstro ou cura.
7. **TilesetFloor**: altura 417 não é múltiplo de 16.
8. **Assets extras do repo antigo** em `ninja-adventure/` continuam no disco e não fazem parte deste catálogo.
