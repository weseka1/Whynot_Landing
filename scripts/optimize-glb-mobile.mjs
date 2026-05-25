#!/usr/bin/env node
/**
 * optimize-glb-mobile.mjs
 *
 * Genera variants ".mobile.glb" mas agresivos de los GLBs mas pesados,
 * pensados para servir a mobile (3G/4G argentino, viewports chicos).
 *
 * Diferencias vs `optimize-glb.mjs`:
 *   - Texturas 256px (vs 512px) → 1/4 del peso de tex
 *   - Simplify ratio 0.25 (vs 0.4) → 60% menos triangulos
 *   - Simplify error 0.005 (vs 0.003) → mas tolerancia
 *   - Tex quality WebP 70 (vs default 80) → -15% por textura
 *
 * Output: <input>.mobile.glb al lado del original.
 *
 * Uso:
 *   node scripts/optimize-glb-mobile.mjs                # todos los TARGETS
 *   node scripts/optimize-glb-mobile.mjs <input.glb>    # uno solo
 *
 * El switcher en runtime (lib/mobileGLB.ts) elige .mobile.glb vs .glb
 * segun useIsMobile().
 */
import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import path from "node:path";

/* Targets default — los GLBs mas pesados. Rigged: true → preservar el
   skinning (no flatten/join). Para modelos no-rigged se permite flatten
   (mejora compresion al colapsar la scene graph).                        */
const TARGETS = [
  { file: "public/assets/3d/mono-blanco-dorado.glb", rigged: true  },
  { file: "public/assets/3d/mono.glb",                rigged: false },
  { file: "public/assets/3d/mono-dorado.glb",         rigged: true  },
  { file: "public/assets/3d/mono-blanco.glb",         rigged: true  },
  { file: "public/assets/3d/mono-rigged.glb",         rigged: true  },
  { file: "public/assets/3d/gotila-esenssial.glb",    rigged: true  },
  { file: "public/assets/3d/mono-louis.glb",          rigged: true  },
];

const cli = path.resolve("node_modules/@gltf-transform/cli/bin/cli.js");

function fmtBytes(n) {
  if (n > 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + " MB";
  if (n > 1024) return (n / 1024).toFixed(1) + " KB";
  return n + " B";
}

async function optimizeOne({ file, rigged }) {
  const input = path.resolve(file);
  if (!existsSync(input)) {
    console.warn(`SKIP  ${file} (not found)`);
    return;
  }
  const output = input.replace(/\.glb$/i, ".mobile.glb");

  const flags = [
    "optimize",
    input,
    output,
    "--compress", "draco",
    "--texture-compress", "webp",
    "--texture-size", "256",
    "--simplify-ratio", rigged ? "0.35" : "0.25",
    "--simplify-error", "0.005",
    "--palette", "false",
  ];
  if (rigged) flags.push("--join", "false", "--flatten", "false");

  console.log(`▸ ${path.basename(input)}  (rigged=${rigged})`);

  await new Promise((resolve, reject) => {
    const child = spawn("node", [cli, ...flags], { stdio: "inherit" });
    child.on("close", (code) => {
      if (code !== 0) return reject(new Error(`exit ${code}`));
      resolve(undefined);
    });
  });

  const before = statSync(input).size;
  const after = statSync(output).size;
  const pct = (((before - after) / before) * 100).toFixed(1);
  console.log(`✓ ${fmtBytes(before)} → ${fmtBytes(after)}  (-${pct}%)\n`);
}

const args = process.argv.slice(2);
const targets =
  args.length > 0
    ? args.map((a) => ({ file: a, rigged: args.includes("--rigged") }))
    : TARGETS;

let totalBefore = 0;
let totalAfter = 0;

for (const t of targets) {
  if (t.file.startsWith("--")) continue;
  const inPath = path.resolve(t.file);
  if (!existsSync(inPath)) continue;
  const bSize = statSync(inPath).size;
  try {
    await optimizeOne(t);
    totalBefore += bSize;
    totalAfter += statSync(inPath.replace(/\.glb$/i, ".mobile.glb")).size;
  } catch (err) {
    console.error(`FAIL ${t.file}:`, err.message);
    process.exitCode = 1;
  }
}

if (totalBefore > 0) {
  const pct = (((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1);
  console.log("══════════════════════════════════════════════════════════");
  console.log(`TOTAL  ${fmtBytes(totalBefore)} → ${fmtBytes(totalAfter)}  (-${pct}%)`);
}
