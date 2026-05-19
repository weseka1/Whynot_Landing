#!/usr/bin/env node
/**
 * optimize-assets.mjs
 *
 * Convierte los PNG pesados del Hero/Marquee/Collections a WebP.
 * Mantiene el PNG original al lado (no destructivo) — el commit de limpieza
 * los borra mas tarde si todo va bien.
 *
 * Uso:  npm run optimize:assets
 */
import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();

const TARGETS = [
  { in: "public/assets/hero/sky-background.png", alpha: false, quality: 80 },
  { in: "public/assets/hero/character.png",      alpha: true,  quality: 86 },
  { in: "public/assets/hero/extra.png",          alpha: true,  quality: 86 },
  { in: "public/assets/marquee/whynot-text.png", alpha: true,  quality: 88 },
];

function fmtBytes(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  if (n > 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

let totalIn = 0;
let totalOut = 0;

for (const t of TARGETS) {
  const inPath = path.join(root, t.in);
  const outPath = inPath.replace(/\.png$/i, ".webp");

  try {
    const inStat = await fs.stat(inPath);
    totalIn += inStat.size;

    await sharp(inPath)
      .webp({ quality: t.quality, alphaQuality: t.alpha ? 90 : 80, effort: 6 })
      .toFile(outPath);

    const outStat = await fs.stat(outPath);
    totalOut += outStat.size;

    const ratio = ((1 - outStat.size / inStat.size) * 100).toFixed(0);
    console.log(
      `OK  ${t.in.padEnd(45)} ${fmtBytes(inStat.size).padStart(10)} -> ${fmtBytes(outStat.size).padStart(10)}  (-${ratio}%)`
    );
  } catch (err) {
    console.error(`ERR ${t.in}: ${err.message}`);
    process.exitCode = 1;
  }
}

console.log("");
console.log(`TOTAL  ${fmtBytes(totalIn)} -> ${fmtBytes(totalOut)}  (-${((1 - totalOut / totalIn) * 100).toFixed(0)}%)`);
