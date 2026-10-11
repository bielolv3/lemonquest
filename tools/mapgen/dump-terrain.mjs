// One-off: extracts the Godot terrain (autotile) data for TilesetFloor from the original pack's tileset.tres
// -> tools/mapgen/floor-terrain.json  { "col,row": {terrain, bits:{side:terrain}} }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(here, '../../assets/ninja-adventure/content/map/tileset.tres');
const L = fs.readFileSync(src, 'utf8').split('\n');
let cur = '';
const t = {};
for (const l of L) {
  if (l.startsWith('[sub_resource')) { cur = l; continue; }
  if (!cur.includes('x17xn')) continue;
  const m = l.match(/^(\d+):(\d+)\/0\/(terrain|terrains_peering_bit\/([a-z_]+)) = (-?\d+)/);
  if (!m) continue;
  const k = m[1] + ',' + m[2];
  t[k] ??= { bits: {} };
  if (m[4]) t[k].bits[m[4]] = +m[5]; else t[k].terrain = +m[5];
}
fs.writeFileSync(path.join(here, 'floor-terrain.json'), JSON.stringify(t));
console.log(Object.keys(t).length, 'terrain tiles');
