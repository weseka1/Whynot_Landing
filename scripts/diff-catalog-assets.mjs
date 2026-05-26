/* ============================================================================
   diff-catalog-assets.mjs
   ----------------------------------------------------------------------------
   Compara los paths reales en ba1res_landing/zapatillas/<brand>/<model>/<cw>
   contra los entries en data/catalog-index.json. Reporta:
     1. Faltantes EN whynot v2 (carpeta existe en zapatillas, pero no entry).
     2. Sobrantes (entry en whynot v2 sin carpeta — datos huérfanos).
     3. Detecta cuántas fotos hay en cada carpeta faltante (360 vs single img).
   ============================================================================ */

import fs from "node:fs";
import path from "node:path";

const ZAPAS_ROOT  = "C:\\Users\\Yamil\\Desktop\\Ba1res\\ba1res_landing\\zapatillas";
const INDEX_PATH  = path.resolve("data/catalog-index.json");

const index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
const indexPaths = new Set(Object.keys(index));

function listDirs(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name); }
  catch { return []; }
}
function listFiles(p) {
  try { return fs.readdirSync(p, { withFileTypes: true }).filter(d => d.isFile()).map(d => d.name); }
  catch { return []; }
}

const folderPaths = [];
for (const brand of listDirs(ZAPAS_ROOT)) {
  for (const model of listDirs(path.join(ZAPAS_ROOT, brand))) {
    for (const cw of listDirs(path.join(ZAPAS_ROOT, brand, model))) {
      folderPaths.push(`${brand}/${model}/${cw}`);
    }
  }
}

const folderSet = new Set(folderPaths);

const missingInIndex = folderPaths.filter(p => !indexPaths.has(p));
const orphanEntries  = [...indexPaths].filter(p => !folderSet.has(p));

console.log(`\n=== DIFF CATALOG ===`);
console.log(`Carpetas en zapatillas/  : ${folderPaths.length}`);
console.log(`Entries en catalog-index : ${indexPaths.size}`);
console.log(`Faltantes en index       : ${missingInIndex.length}`);
console.log(`Huérfanos en index       : ${orphanEntries.length}`);

console.log(`\n--- FALTANTES (carpeta existe, no hay entry) ---`);
for (const p of missingInIndex) {
  const full = path.join(ZAPAS_ROOT, ...p.split("/"));
  const files = listFiles(full).filter(f => /\.(jpg|jpeg|png|webp|avif)$/i.test(f));
  const has360 = files.some(f => /360_\d+/i.test(f));
  const frameCount = files.filter(f => /360_\d+/i.test(f)).length;
  const type = has360 ? `360 (${frameCount} frames)` : `image (${files.length} files)`;
  console.log(`  + ${p}  → ${type}`);
}

console.log(`\n--- HUÉRFANOS (entry existe, sin carpeta) ---`);
for (const p of orphanEntries) console.log(`  - ${p}`);
