#!/usr/bin/env node
/**
 * optimize-glb.mjs
 *
 * Optimiza un GLB con gltf-transform: dedup + weld + simplify + prune +
 * Draco mesh compression + WebP texture compression + resize a 1024px max.
 *
 * En el modelo del mono cuerpo completo: 23.92MB → 1.18MB (95% reduccion).
 *
 * Uso:  node scripts/optimize-glb.mjs <input.glb> [output.glb]
 * Si no se pasa output, escribe a <input>.opt.glb
 *
 * Bajo el capó usa la CLI de @gltf-transform/cli (devDep).
 */
import { spawn } from "node:child_process";
import { existsSync, statSync, renameSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args.length < 1) {
  console.error("Usage: node scripts/optimize-glb.mjs <input.glb> [output.glb]");
  process.exit(1);
}

const input = path.resolve(args[0]);
if (!existsSync(input)) {
  console.error(`Input not found: ${input}`);
  process.exit(1);
}
const output =
  args[1] !== undefined
    ? path.resolve(args[1])
    : input.replace(/\.glb$/i, ".opt.glb");

const cli = path.resolve("node_modules/@gltf-transform/cli/bin/cli.js");

/* Settings actuales (2026-05): Draco + 512px textures + simplify ratio 0.4
   bajan los GLBs del site ~50% sin perdida visual notable a la distancia
   de visualizacion del Hero/Mission. Para modelos rigged hay que pasar
   --rigged true al script para evitar flatten/join que rompe el skinning. */
const RIGGED = process.argv.includes("--rigged");

const flags = [
  "optimize",
  input,
  output,
  "--compress", "draco",
  "--texture-compress", "webp",
  "--texture-size", "512",
  "--simplify-ratio", RIGGED ? "0.5" : "0.4",
  "--simplify-error", RIGGED ? "0.004" : "0.003",
  "--palette", "false",
];
if (RIGGED) flags.push("--join", "false", "--flatten", "false");

console.log(`▸ optimize ${path.basename(input)}`);

const child = spawn("node", [cli, ...flags], { stdio: "inherit" });
child.on("close", (code) => {
  if (code !== 0) process.exit(code ?? 1);
  const before = statSync(input).size;
  const after = statSync(output).size;
  const fmt = (n) =>
    n > 1024 * 1024
      ? (n / 1024 / 1024).toFixed(2) + " MB"
      : (n / 1024).toFixed(1) + " KB";
  console.log(
    `✓ ${fmt(before)} → ${fmt(after)}  (${(((before - after) / before) * 100).toFixed(1)}% smaller)`
  );
});
