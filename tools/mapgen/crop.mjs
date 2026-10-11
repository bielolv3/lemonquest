// usage: node tools/mapgen/crop.mjs x y w h [up=1] [src=assets/maps/preview.png] -> tools/mapgen/_v/crop.png
import { cropPng } from './lib.mjs';
const [x, y, w, h, up = 1, src = 'assets/maps/preview.png'] = process.argv.slice(2);
cropPng(src, 'tools/mapgen/_v/crop.png', +x, +y, +w, +h, +up);
