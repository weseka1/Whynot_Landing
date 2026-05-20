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
    // shell:true wraps en cmd.exe lo que evita issues con stdout pipe de rife-ncnn-vulkan
    // (que crashea con exit 3221225477 si los pipes no estan disponibles correctamente).
    // Comillas dobles alrededor de cada arg para que paths con espacios anden.
    const quote = (s) => /[ \t]/.test(s) ? `"${s}"` : s;
    const fullCmd = [quote(cmd), ...args.map(quote)].join(" ");
    const child = spawn(fullCmd, [], { stdio: "inherit", shell: true, ...opts });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${path.basename(cmd)} exit ${code}`))));
  });
}

/* -------- main -------- */

async function main() {
  // 1) Renombrar + SPLITEAR RGBA → 2 secuencias (RGB premul + alpha grayscale).
  //    RIFE no soporta PNG con alpha (crashea). Truco: interpolar las 2 secuencias
  //    por separado y combinar al final. El RGB ya viene premultiplied (compose_rgba
  //    del v7) → los bordes interpolan suave sin halo.
  console.log("[1/4] renombrando + spliteando RGBA → RGB + alpha...");
  const NUMBERED_RGB   = path.join(TMP_DIR, "numbered-rgb");
  const NUMBERED_ALPHA = path.join(TMP_DIR, "numbered-alpha");
  ensureDir(NUMBERED_RGB);
  ensureDir(NUMBERED_ALPHA);

  const inputFrames = readdirSync(INPUT_DIR)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort();
  if (inputFrames.length === 0) {
    throw new Error(`no hay PNGs en ${INPUT_DIR}`);
  }

  // Usar sharp para splittear cada PNG RGBA en 2 archivos PNG sin alpha
  const sharp = (await import("sharp")).default;
  for (let i = 0; i < inputFrames.length; i++) {
    const src = path.join(INPUT_DIR, inputFrames[i]);
    const name = String(i + 1).padStart(8, "0") + ".png";

    // RGB sin alpha (premultiplied ya viene del v7)
    await sharp(src).removeAlpha().toFile(path.join(NUMBERED_RGB, name));

    // Alpha → grayscale 3-canal (RIFE necesita 3 canales). Replico el alpha
    // en R, G y B.
    const alphaRaw = await sharp(src).extractChannel("alpha").raw().toBuffer({ resolveWithObject: true });
    const { width, height } = alphaRaw.info;
    const rgb3 = Buffer.alloc(width * height * 3);
    for (let p = 0; p < width * height; p++) {
      const a = alphaRaw.data[p];
      rgb3[p * 3] = a;
      rgb3[p * 3 + 1] = a;
      rgb3[p * 3 + 2] = a;
    }
    await sharp(rgb3, { raw: { width, height, channels: 3 } })
      .png({ compressionLevel: 6 })
      .toFile(path.join(NUMBERED_ALPHA, name));
  }
  console.log(`[1/4] OK — ${inputFrames.length} frames spliteados\n`);

  // 2) RIFE interpolacion en AMBAS secuencias
  const targetCount = (inputFrames.length - 1) * multiplier + 1;
  const INTERP_RGB   = path.join(TMP_DIR, "interp-rgb");
  const INTERP_ALPHA = path.join(TMP_DIR, "interp-alpha");
  ensureDir(INTERP_RGB);
  ensureDir(INTERP_ALPHA);
  const modelDir = path.join(PROJECT_ROOT, "tools", "rife", model);

  console.log(`[2/4] RIFE en RGB con ${model} → ${targetCount} frames...`);
  await run(RIFE_BIN, [
    "-i", NUMBERED_RGB, "-o", INTERP_RGB,
    "-m", modelDir, "-n", String(targetCount),
    "-g", "-1", "-j", "1:1:1",
    "-f", "%08d.png",
  ]);

  console.log(`[3/4] RIFE en alpha con ${model} → ${targetCount} frames...`);
  await run(RIFE_BIN, [
    "-i", NUMBERED_ALPHA, "-o", INTERP_ALPHA,
    "-m", modelDir, "-n", String(targetCount),
    "-g", "-1", "-j", "1:1:1",
    "-f", "%08d.png",
  ]);

  // 3) Recombinar RGB + alpha frame por frame
  console.log("[3.5/4] recombinando RGB + alpha → RGBA...");
  ensureDir(INTERPOLATED);
  const interpRgbFrames = readdirSync(INTERP_RGB).filter((f) => f.endsWith(".png")).sort();
  for (const f of interpRgbFrames) {
    const rgbPath = path.join(INTERP_RGB, f);
    const alphaPath = path.join(INTERP_ALPHA, f);
    if (!existsSync(alphaPath)) continue;
    const rgbBuf = await sharp(rgbPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaBuf = await sharp(alphaPath).extractChannel(0).raw().toBuffer();
    // Combinar: RGB (3 canales) + alpha (1 canal) → RGBA (4 canales)
    const out = path.join(INTERPOLATED, f);
    const { width, height } = rgbBuf.info;
    const rgba = Buffer.alloc(width * height * 4);
    for (let p = 0; p < width * height; p++) {
      rgba[p * 4]     = rgbBuf.data[p * 3];
      rgba[p * 4 + 1] = rgbBuf.data[p * 3 + 1];
      rgba[p * 4 + 2] = rgbBuf.data[p * 3 + 2];
      rgba[p * 4 + 3] = alphaBuf[p];
    }
    await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 6 })
      .toFile(out);
  }
  const interpolatedFrames = readdirSync(INTERPOLATED).filter((f) => f.endsWith(".png")).length;
  console.log(`[3.5/4] OK — ${interpolatedFrames} frames RGBA recombinados\n`);

  // 4) ffmpeg encode → WebM VP9 yuva420p (alpha real)
  console.log(`[4/4] ffmpeg encode → WebM VP9 yuva420p @ ${fps}fps...`);
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
