/**
 * recombine-and-encode.mjs — combina interp-rgb/* + interp-alpha/* → RGBA → webm
 * Usa los frames ya generados por RIFE en CPU mode.
 */
import ffmpegStatic from "ffmpeg-static";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdirSync, readdirSync, existsSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const TMP_DIR = path.join(SCRIPT_DIR, "tmp-interp");
const INTERP_RGB   = path.join(TMP_DIR, "interp-rgb");
const INTERP_ALPHA = path.join(TMP_DIR, "interp-alpha");
const INTERPOLATED = path.join(TMP_DIR, "interpolated");
const OUTPUT_WEBM = path.join(PROJECT_ROOT, "public", "assets", "hero", "golden-goose-alpha.webm");

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on("error", reject);
  });
}

const quote = (s) => /[ \t]/.test(s) ? `"${s}"` : s;

async function main() {
  rmSync(INTERPOLATED, { recursive: true, force: true });
  mkdirSync(INTERPOLATED, { recursive: true });

  const rgbFrames = readdirSync(INTERP_RGB).filter((f) => f.endsWith(".png")).sort();
  console.log(`[1/2] recombinando ${rgbFrames.length} frames RGB + alpha → RGBA...`);

  let combined = 0;
  for (const f of rgbFrames) {
    const rgbPath = path.join(INTERP_RGB, f);
    const alphaPath = path.join(INTERP_ALPHA, f);
    if (!existsSync(alphaPath)) continue;

    const rgbRaw = await sharp(rgbPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const alphaRaw = await sharp(alphaPath).extractChannel(0).raw().toBuffer();
    const { width, height } = rgbRaw.info;
    const rgba = Buffer.alloc(width * height * 4);
    for (let p = 0; p < width * height; p++) {
      rgba[p * 4]     = rgbRaw.data[p * 3];
      rgba[p * 4 + 1] = rgbRaw.data[p * 3 + 1];
      rgba[p * 4 + 2] = rgbRaw.data[p * 3 + 2];
      rgba[p * 4 + 3] = alphaRaw[p];
    }
    // Renumerar 00000001.png... para que ffmpeg pueda usar la secuencia
    const outName = `${String(combined + 1).padStart(8, "0")}.png`;
    await sharp(rgba, { raw: { width, height, channels: 4 } })
      .png({ compressionLevel: 6 })
      .toFile(path.join(INTERPOLATED, outName));
    combined++;
  }
  console.log(`[1/2] OK — ${combined} RGBA frames\n`);

  console.log(`[2/2] ffmpeg encode WebM VP9 yuva420p @ 30fps...`);
  mkdirSync(path.dirname(OUTPUT_WEBM), { recursive: true });
  await run(quote(ffmpegStatic), [
    "-y",
    "-framerate", "30",
    "-i", quote(path.join(INTERPOLATED, "%08d.png")),
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-crf", "30",
    "-b:v", "0",
    "-row-mt", "1",
    "-deadline", "good",
    "-cpu-used", "2",
    "-an",
    quote(OUTPUT_WEBM),
  ]);

  const size = statSync(OUTPUT_WEBM).size;
  console.log(`\n=== DONE ===\nWebM: ${OUTPUT_WEBM} (${(size / 1024).toFixed(0)} KB)`);
  console.log(`Duracion: ${(combined / 30).toFixed(2)}s a 30fps`);
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });
