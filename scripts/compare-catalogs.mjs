/* Compara los paths del folder ba1res_landing/zapatillas/ y "Las que no estaban/"
   contra el catalog-index.json actual de Whynot v2.
   Output: lista de paths faltantes (formato BRAND/Model/Colorway). */
import fs from "node:fs";
import path from "node:path";

const BA1RES_ROOT = "C:/Users/Yamil/Desktop/Ba1res/ba1res_landing";
const WHYNOT_INDEX = "C:/Users/Yamil/Desktop/Ba1res/WhyNot Landing Page/Whynot v2/data/catalog-index.json";

function listColorways(rootDir) {
  if (!fs.existsSync(rootDir)) return [];
  const results = [];
  const brands = fs.readdirSync(rootDir, { withFileTypes: true })
    .filter((d) => d.isDirectory());
  for (const b of brands) {
    const brandDir = path.join(rootDir, b.name);
    const models = fs.readdirSync(brandDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());
    for (const m of models) {
      const modelDir = path.join(brandDir, m.name);
      const colors = fs.readdirSync(modelDir, { withFileTypes: true })
        .filter((d) => d.isDirectory());
      for (const c of colors) {
        results.push(`${b.name}/${m.name}/${c.name}`);
      }
    }
  }
  return results;
}

function countFramesIn(dir) {
  if (!fs.existsSync(dir)) return { type: "image", frames: 0 };
  const files = fs.readdirSync(dir);
  const framesRe = /^360[_-]?(\d+)\.(jpg|jpeg|png|webp|avif)$/i;
  const frameNums = files
    .map((f) => f.match(framesRe))
    .filter(Boolean)
    .map((m) => parseInt(m[1], 10));
  if (frameNums.length > 0) {
    return { type: "360", frames: Math.max(...frameNums) };
  }
  const hasMain = files.some((f) => /^main\.(jpg|jpeg|png|webp|avif)$/i.test(f));
  return { type: "image", frames: 0, hasMain };
}

const zapatillas = listColorways(path.join(BA1RES_ROOT, "zapatillas"));
const lasQueNo = listColorways(path.join(BA1RES_ROOT, "Las que no estaban"));
const currentIndex = JSON.parse(fs.readFileSync(WHYNOT_INDEX, "utf8"));
const currentKeys = new Set(Object.keys(currentIndex));

console.log(`zapatillas/         : ${zapatillas.length}`);
console.log(`Las que no estaban/ : ${lasQueNo.length}`);
console.log(`catalog-index.json  : ${currentKeys.size}`);

const allFolder = new Set([...zapatillas, ...lasQueNo]);

// Aliases — el folder dice "ADIDAS BAPE" pero el index usa "ADIDAS x BAPE"
const BRAND_ALIAS = {
  "ADIDAS BAPE": "ADIDAS x BAPE",
};

function normalize(p) {
  const [brand, ...rest] = p.split("/");
  const aliased = BRAND_ALIAS[brand] ?? brand;
  return [aliased, ...rest].join("/");
}

const missing = [];
for (const p of allFolder) {
  const norm = normalize(p);
  if (!currentKeys.has(norm)) {
    missing.push({ folderPath: p, normalizedPath: norm });
  }
}

console.log(`\n========== FALTANTES (${missing.length}) ==========`);
for (const m of missing) {
  const inZap = fs.existsSync(path.join(BA1RES_ROOT, "zapatillas", m.folderPath));
  const inLas = fs.existsSync(path.join(BA1RES_ROOT, "Las que no estaban", m.folderPath));
  const src = inZap
    ? path.join(BA1RES_ROOT, "zapatillas", m.folderPath)
    : path.join(BA1RES_ROOT, "Las que no estaban", m.folderPath);
  const meta = countFramesIn(src);
  console.log(JSON.stringify({
    normalizedPath: m.normalizedPath,
    folderPath: m.folderPath,
    source: inZap ? "zapatillas" : "las-que-no-estaban",
    ...meta,
  }));
}
