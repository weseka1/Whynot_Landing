#!/usr/bin/env node
/**
 * interpolate-and-encode.mjs — pipeline tipo Flowframes:
 *   1) Toma una carpeta de PNG transparentes (output de rembg)
 *   2) Renombra a numeracion secuencial limpia
 *   3) RIFE (rife-ncnn-vulkan v4.6) interpola N veces los frames
 *      → de 36 a 4x = 141 frames (movimiento suave)
 *   4) ffmpeg encodea como WebM con alpha real (VP9 yuva420p)
 *
 *  Uso:
 *    node scripts/process-shoe-video/interpolate-and-encode.mjs \
 *      "C:/path/to/transparent/" \
 *      --output public/assets/hero/golden-goose-alpha.webm \
 *      --multiplier 4 \
 *      --fps 30 \
 *      --model rife-v4.6
 *
 *  multiplier: 2 (36→71), 4 (36→141), 8 (36→281)
 *  fps:        frames por segundo del video final
 *  model:      rife-v4.6 (mejor calidad), rife-v4, rife-anime, etc.
 */
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  mkdirSync,
  existsSync,
  rmSync,
  readdirSync,
  copyFileSync,
  statSync,
} from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const RIFE_BIN = path.join(PROJECT_ROOT, "tools", "rife", "rife-ncnn-vulkan.exe");
const TMP_DIR = path.join(SCRIPT_DIR, "tmp-interp");
const NUMBERED = path.join(TMP_DIR, "numbered");
const INTERPOLATED = path.join(TMP_DIR, "interpolated");

if (!existsSync(RIFE_BIN)) {
  console.error(`[ERR] no encontre rife-ncnn-vulkan.exe en ${RIFE_BIN}`);
  console.error("    Descarga: https://github.com/nihui/rife-ncnn-vulkan/releases");
  process.exit(1);
}

/* -------- args -------- */
const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith("--")) {
  console.error("uso: node interpolate-and-encode.mjs <input_dir> [--output X] [--multiplier 4] [--fps 30] [--model rife-v4.6]");
  process.exit(1);
}
const inputArg = args[0];
const get = (flag, def) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : def;
};
const INPUT_DIR = path.isAbsolute(inputArg) ? inputArg : path.resolve(PROJECT_ROOT, inputArg);
const multiplier = parseInt(get("--multiplier", "4"), 10);
const fps = get("--fps", "30");
const model = get("--model", "rife-v4.6");
const outputArg = get("--output", path.join(PROJECT_ROOT, "public/assets/hero/golden-goose-alpha.webm"));
const OUTPUT_WEBM = path.isAbsolute(outputArg) ? outputArg : path.resolve(PROJECT_ROOT, outputArg);

if (!existsSync(INPUT_DIR)) {
  console.error(`no encontre carpeta: ${INPUT_DIR}`);
  process.exit(1);
}

console.log("=== interpolate-and-encode ===");
console.log("input  :", INPUT_DIR);
console.log("output :", OUTPUT_WEBM);
console.log("mult   :", multiplier, "x");
console.log("fps    :", fps);
console.log("model  :", model);
console.log("");

/* -------- helpers -------- */

function ensureDir(p) {
  rmSync(p, { recursive: true, force: true });
  mkdirSync(p, { recursive: true });
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", ...opts });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exit ${code}`))));
  });
}

/* -------- main -------- */

async function main() {
  // 1) Renombrar a secuencia limpia (00000001.png ...)
  console.log("[1/3] renombrando frames a secuencia limpia...");
  ensureDir(NUMBERED);
  const inputFrames = readdirSync(INPUT_DIR)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();
  if (inputFrames.length === 0) {
    throw new Error(`no hay PNGs en ${INPUT_DIR}`);
  }
  inputFrames.forEach((f, i) => {
    copyFileSync(
      path.join(INPUT_DIR, f),
      path.join(NUMBERED, `${String(i + 1).padStart(8, "0")}.png`)
    );
  });
  console.log(`[1/3] OK — ${inputFrames.length} frames\n`);

  // 2) RIFE interpolacion
  // rife-ncnn-vulkan -i input_dir -o output_dir -m model -n target_count
  // target_count = (n - 1) * multiplier + 1
  const targetCount = (inputFrames.length - 1) * multiplier + 1;
  console.log(`[2/3] RIFE interpolando con ${model} → ${targetCount} frames...`);
  ensureDir(INTERPOLATED);
  await run(RIFE_BIN, [
    "-i", NUMBERED,
    "-o", INTERPOLATED,
    "-m", path.join(PROJECT_ROOT, "tools", "rife", model),
    "-n", String(targetCount),
    "-f", "%08d.png",
  ]);
  const interpolatedFrames = readdirSync(INTERPOLATED).filter((f) => f.endsWith(".png")).length;
  console.log(`[2/3] OK — ${interpolatedFrames} frames interpolados\n`);

  // 3) ffmpeg encode → WebM VP9 yuva420p (alpha real)
  console.log(`[3/3] ffmpeg encode → WebM VP9 yuva420p @ ${fps}fps...`);
  mkdirSync(path.dirname(OUTPUT_WEBM), { recursive: true });
  await run(ffmpegStatic, [
    "-y",
    "-framerate", fps,
    "-i", path.join(INTERPOLATED, "%08d.png"),
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-crf", "30",
    "-b:v", "0",
    "-row-mt", "1",
    "-deadline", "good",
    "-cpu-used", "2",
    "-an",
    OUTPUT_WEBM,
  ]);
  const size = statSync(OUTPUT_WEBM).size;
  console.log(`[3/3] OK — ${OUTPUT_WEBM} (${(size / 1024).toFixed(0)} KB)\n`);

  // Cleanup
  console.log("limpiando tmp...");
  rmSync(TMP_DIR, { recursive: true, force: true });

  console.log("");
  console.log("=== DONE ===");
  console.log("WebM:", OUTPUT_WEBM);
  console.log(`Duracion: ${(interpolatedFrames / Number(fps)).toFixed(2)}s a ${fps}fps`);
}

main().catch((e) => {
  console.error("");
  console.error("FAIL:", e.message);
  process.exit(1);
});
