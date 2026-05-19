#!/usr/bin/env node
/**
 * index.mjs — Orquestador del pipeline de background removal.
 *
 *   1) Extrae frames del MP4 input con ffmpeg
 *   2) Llama al worker Python (remove-bg.py) para sacar el fondo con rembg
 *   3) Reensambla los frames RGBA como WebM con alpha real (VP9 yuva420p)
 *   4) Copia 30 frames decimados como PNG sequence (Safari fallback)
 *   5) Limpia tmp/
 *
 * Uso:
 *   node scripts/process-shoe-video/index.mjs <input.mp4> [--model birefnet-general]
 *   o
 *   npm run bg:process -- public/assets/hero/golden-goose.mp4
 */
import ffmpegStatic from "ffmpeg-static";
import { spawn, spawnSync } from "node:child_process";
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
const TMP_DIR = path.join(SCRIPT_DIR, "tmp");
const FRAMES_IN = path.join(TMP_DIR, "frames");
const FRAMES_OUT = path.join(TMP_DIR, "frames-alpha");

/* -------- argumentos -------- */
const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith("--")) {
  console.error("uso: node index.mjs <input.mp4> [--model birefnet-general] [--fps 30] [--png-sequence-stride 4]");
  process.exit(1);
}
const inputArg = args[0];
const modelIdx = args.indexOf("--model");
const model = modelIdx >= 0 ? args[modelIdx + 1] : "birefnet-general";
const fpsIdx = args.indexOf("--fps");
const fps = fpsIdx >= 0 ? args[fpsIdx + 1] : "30";
const strideIdx = args.indexOf("--png-sequence-stride");
const pngStride = strideIdx >= 0 ? parseInt(args[strideIdx + 1], 10) : 4;

const INPUT_VIDEO = path.isAbsolute(inputArg) ? inputArg : path.resolve(PROJECT_ROOT, inputArg);
if (!existsSync(INPUT_VIDEO)) {
  console.error(`no encontre el video: ${INPUT_VIDEO}`);
  process.exit(1);
}

const baseName = path.basename(INPUT_VIDEO, path.extname(INPUT_VIDEO));
const outputDir = path.dirname(INPUT_VIDEO);
const OUTPUT_WEBM = path.join(outputDir, `${baseName}-alpha.webm`);
const OUTPUT_PNG_DIR = path.join(outputDir, `${baseName}-frames`);

console.log("=== process-shoe-video ===");
console.log("input  :", INPUT_VIDEO);
console.log("model  :", model);
console.log("fps    :", fps);
console.log("output webm:", OUTPUT_WEBM);
console.log("output png :", OUTPUT_PNG_DIR);
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
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} salio con code ${code}`));
    });
  });
}

function pickPython() {
  // Preferimos py -3.11 (mejores wheels para onnxruntime)
  const candidates = [
    ["py", ["-3.11"]],
    ["py", ["-3"]],
    ["python", []],
    ["python3", []],
  ];
  for (const [cmd, baseArgs] of candidates) {
    const r = spawnSync(cmd, [...baseArgs, "--version"], { encoding: "utf-8" });
    if (r.status === 0) return { cmd, baseArgs };
  }
  throw new Error("no encontre Python ejecutable en el sistema");
}

/* -------- main -------- */

async function main() {
  // 1) Limpiar tmp/
  ensureDir(FRAMES_IN);
  ensureDir(FRAMES_OUT);

  // 2) Extract frames con ffmpeg
  console.log(`[1/4] extrayendo frames a ${fps}fps...`);
  await run(ffmpegStatic, [
    "-y",
    "-i", INPUT_VIDEO,
    "-vf", `fps=${fps}`,
    path.join(FRAMES_IN, "in_%04d.png"),
  ]);
  const frameCount = readdirSync(FRAMES_IN).filter((f) => f.endsWith(".png")).length;
  console.log(`[1/4] OK — ${frameCount} frames extraidos\n`);

  // 3) Llamar Python worker
  console.log(`[2/4] background removal con rembg (modelo: ${model})...`);
  const { cmd: pyCmd, baseArgs: pyArgs } = pickPython();
  await run(pyCmd, [
    ...pyArgs,
    path.join(SCRIPT_DIR, "remove-bg.py"),
    "--input", FRAMES_IN,
    "--output", FRAMES_OUT,
    "--model", model,
  ]);
  console.log(`[2/4] OK — alpha mate generado\n`);

  // 4) Reassemble como WebM con alpha real
  console.log(`[3/4] reensamblando como WebM con alpha (VP9 yuva420p)...`);
  await run(ffmpegStatic, [
    "-y",
    "-framerate", fps,
    "-i", path.join(FRAMES_OUT, "out_%04d.png"),
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-crf", "32",
    "-b:v", "0",
    "-row-mt", "1",
    "-an", // sin audio
    OUTPUT_WEBM,
  ]);
  const webmSize = statSync(OUTPUT_WEBM).size;
  console.log(`[3/4] OK — ${OUTPUT_WEBM} (${(webmSize / 1024).toFixed(0)} KB)\n`);

  // 5) PNG sequence decimada para fallback Safari
  console.log(`[4/4] copiando PNG sequence (stride ${pngStride}) para fallback Safari...`);
  ensureDir(OUTPUT_PNG_DIR);
  const allFrames = readdirSync(FRAMES_OUT)
    .filter((f) => f.startsWith("out_") && f.endsWith(".png"))
    .sort();
  let copied = 0;
  for (let i = 0; i < allFrames.length; i += pngStride) {
    const src = path.join(FRAMES_OUT, allFrames[i]);
    const dst = path.join(OUTPUT_PNG_DIR, `frame_${String(copied).padStart(4, "0")}.png`);
    copyFileSync(src, dst);
    copied++;
  }
  console.log(`[4/4] OK — ${copied} PNGs en ${OUTPUT_PNG_DIR}\n`);

  // 6) Cleanup tmp/
  console.log("limpiando tmp/...");
  rmSync(TMP_DIR, { recursive: true, force: true });

  console.log("");
  console.log("=== DONE ===");
  console.log("WebM alpha :", OUTPUT_WEBM);
  console.log("PNG seq    :", OUTPUT_PNG_DIR, `(${copied} frames)`);
  console.log("");
  console.log("Siguiente paso: actualizar data/site.ts con los nuevos paths.");
}

main().catch((e) => {
  console.error("");
  console.error("FAIL:", e.message);
  process.exit(1);
});
