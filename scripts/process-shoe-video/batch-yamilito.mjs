#!/usr/bin/env node
/**
 * batch-yamilito.mjs — itera todas las subcarpetas con zapatillas
 * dentro de "Yamilito el mejor del mundo/" y procesa cada una con v10
 * (vitmatte-base + tiling 1024). Skip carpetas que ya tienen transparent/
 * completa para resume.
 *
 * Output por cada zapatilla:
 *   <carpeta>/transparent/  (RGBA PNG)
 *   <carpeta>/masks/        (grayscale PNG)
 */
import { spawn } from "node:child_process";
import { readdirSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = "C:/Users/Yamil/Desktop/Ba1res/WhyNot Landing Page/Whynot v2/Yamilito el mejor del mundo";

const folders = readdirSync(ROOT)
  .map((f) => path.join(ROOT, f))
  .filter((p) => {
    try { return statSync(p).isDirectory(); } catch { return false; }
  })
  .sort();

console.log(`=== batch-yamilito ===`);
console.log(`carpetas: ${folders.length}\n`);

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))));
    child.on("error", reject);
  });
}

async function main() {
  const t0 = Date.now();
  for (let i = 0; i < folders.length; i++) {
    const folder = folders[i];
    const name = path.basename(folder);
    const transparentDir = path.join(folder, "transparent");
    const masksDir = path.join(folder, "masks");

    // Contar inputs y outputs
    const inputs = readdirSync(folder).filter((f) =>
      /\.(jpg|jpeg|png|webp|bmp)$/i.test(f) && !["transparent", "masks"].includes(f)
    );
    const done = existsSync(transparentDir)
      ? readdirSync(transparentDir).filter((f) => f.endsWith(".png")).length
      : 0;

    console.log(`\n[${i + 1}/${folders.length}] ${name}  (${done}/${inputs.length} done)`);

    if (done >= inputs.length && inputs.length > 0) {
      console.log(`  → skip (ya completa)`);
      continue;
    }

    try {
      await run("py", [
        "-3.11",
        "scripts/process-shoe-video/remove-bg-v10.py",
        `"${folder}"`,
      ]);
    } catch (e) {
      console.error(`  → FAIL ${name}: ${e.message}`);
      // Continue con la proxima carpeta
    }
    const dt = (Date.now() - t0) / 1000;
    console.log(`  → tiempo total acumulado: ${(dt / 60).toFixed(1)} min`);
  }
  const total = (Date.now() - t0) / 1000;
  console.log(`\n=== DONE ${folders.length} carpetas en ${(total / 60).toFixed(1)} min ===`);
}

main().catch((e) => { console.error("FATAL:", e); process.exit(1); });
