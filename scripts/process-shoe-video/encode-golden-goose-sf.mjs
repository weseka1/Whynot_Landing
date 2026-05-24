#!/usr/bin/env node
/**
 * encode-golden-goose-sf.mjs
 *
 * Reensambla las 3 carpetas de PNGs RGBA (Golden goose - SF) como WebM VP9
 * con alpha real (yuva420p) y genera un poster .webp por variante, listos
 * para reemplazar los assets en public/assets/hero/.
 *
 * Las nuevas PNGs ya vienen sin fondo (alpha horneado), asi que NO pasamos
 * por rembg. Solo: PNG seq -> WebM alpha + WebP poster (frame 1).
 */
import ffmpegStatic from "ffmpeg-static";
import sharp from "sharp";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIR, "..", "..");

/* Prefiere v3 (isnet+VITMatte+erode 2px+despill), luego v2, v1, raw. */
const REFINED_V3_ROOT = path.join(PROJECT_ROOT, "Golden goose - SF refined v3");
const REFINED_V2_ROOT = path.join(PROJECT_ROOT, "Golden goose - SF refined v2");
const REFINED_ROOT    = path.join(PROJECT_ROOT, "Golden goose - SF refined");
const RAW_ROOT        = path.join(PROJECT_ROOT, "Golden goose - SF", "Golden goose - SF");
const SRC_ROOT = existsSync(REFINED_V3_ROOT) ? REFINED_V3_ROOT
               : existsSync(REFINED_V2_ROOT) ? REFINED_V2_ROOT
               : existsSync(REFINED_ROOT)    ? REFINED_ROOT
               : RAW_ROOT;
const OUT_DIR = path.join(PROJECT_ROOT, "public", "assets", "hero");

const VARIANTS = [
  { folder: "White Black",  slug: "golden-goose-white-black"  },
  { folder: "Silver Star",  slug: "golden-goose-silver-star"  },
  { folder: "Gold Star",    slug: "golden-goose-gold-star"    },
];

const FPS = 30;

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`))));
  });
}

async function encodeVariant({ folder, slug }) {
  const srcDir = path.join(SRC_ROOT, folder);
  if (!existsSync(srcDir)) throw new Error(`no encontre ${srcDir}`);

  const frames = readdirSync(srcDir).filter((f) => /^\d+\.png$/i.test(f)).sort();
  if (frames.length === 0) throw new Error(`sin PNGs en ${srcDir}`);

  /* ffmpeg con secuencia numerada arranca en -start_number y usa %08d.
     Los archivos van 00000001..00000144 → patron %08d con start 1.        */
  const pattern = path.join(srcDir, "%08d.png");
  const webmOut = path.join(OUT_DIR, `${slug}.webm`);
  const webpOut = path.join(OUT_DIR, `${slug}.webp`);

  console.log(`\n=== ${folder} (${frames.length} frames) → ${slug}.webm ===`);

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  /* VP9 con alpha (yuva420p). CRF 30 = look bueno para producto en circulo
     pequeño. row-mt y cpu-used 2 = balance calidad/tiempo en CPU.          */
  await run(ffmpegStatic, [
    "-y",
    "-framerate", String(FPS),
    "-start_number", "1",
    "-i", pattern,
    "-c:v", "libvpx-vp9",
    "-pix_fmt", "yuva420p",
    "-crf", "30",
    "-b:v", "0",
    "-row-mt", "1",
    "-deadline", "good",
    "-cpu-used", "2",
    "-an",
    "-metadata:s:v:0", "alpha_mode=1",
    webmOut,
  ]);

  const webmSize = statSync(webmOut).size;
  console.log(`  webm: ${(webmSize / 1024).toFixed(0)} KB → ${webmOut}`);

  /* Poster .webp = frame 1 a la misma resolucion, con alpha. */
  await sharp(path.join(srcDir, frames[0]))
    .webp({ quality: 88, alphaQuality: 90, effort: 6 })
    .toFile(webpOut);
  const webpSize = statSync(webpOut).size;
  console.log(`  webp: ${(webpSize / 1024).toFixed(0)} KB → ${webpOut}`);
}

async function main() {
  console.log(`ffmpeg : ${ffmpegStatic}`);
  console.log(`output : ${OUT_DIR}`);
  for (const v of VARIANTS) {
    await encodeVariant(v);
  }
  console.log("\n=== DONE ===");
}

main().catch((e) => {
  console.error("\nFAIL:", e.message);
  process.exit(1);
});
