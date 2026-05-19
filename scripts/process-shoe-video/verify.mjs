#!/usr/bin/env node
/**
 * verify.mjs — chequea que el pipeline tenga todo lo necesario para correr.
 *
 *   - Python: que `py` (Windows) o `python` exista, ejecutable
 *   - rembg + dependencias: importable desde Python
 *   - ffmpeg-static: binario disponible
 *
 * Output: stdout en formato listo para humanos. Exit code 0 si OK, 1 si falta algo.
 */
import ffmpegStatic from "ffmpeg-static";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

let ok = true;

function check(label, fn) {
  process.stdout.write(`  ${label}... `);
  try {
    const result = fn();
    if (result === true || typeof result === "string") {
      process.stdout.write(`OK${typeof result === "string" ? ` (${result})` : ""}\n`);
      return true;
    }
    process.stdout.write(`FAIL\n`);
    ok = false;
    return false;
  } catch (e) {
    process.stdout.write(`FAIL — ${e.message}\n`);
    ok = false;
    return false;
  }
}

console.log("=== process-shoe-video / verify ===\n");

// 1) ffmpeg-static
check("ffmpeg-static binary", () => {
  if (!ffmpegStatic) throw new Error("ffmpeg-static export es null");
  if (!existsSync(ffmpegStatic)) throw new Error(`no existe: ${ffmpegStatic}`);
  const r = spawnSync(ffmpegStatic, ["-version"], { encoding: "utf-8" });
  if (r.status !== 0) throw new Error(r.stderr || "exit != 0");
  return r.stdout.split("\n")[0];
});

// 2) Python disponible — probamos py launcher (Windows), python3, python
const pythonCandidates = [
  ["py", ["-3.11"]], // preferimos 3.11 por wheels de onnxruntime
  ["py", ["-3"]],
  ["python", []],
  ["python3", []],
];

let pythonCmd = null;
let pythonArgs = null;

check("Python ejecutable", () => {
  for (const [cmd, baseArgs] of pythonCandidates) {
    const r = spawnSync(cmd, [...baseArgs, "--version"], { encoding: "utf-8" });
    if (r.status === 0) {
      pythonCmd = cmd;
      pythonArgs = baseArgs;
      return `${cmd} ${baseArgs.join(" ")} → ${r.stdout.trim() || r.stderr.trim()}`;
    }
  }
  throw new Error("no encontre python — ni py -3.11 ni python ni python3");
});

// 3) rembg importable
if (pythonCmd) {
  check("rembg importable", () => {
    const r = spawnSync(
      pythonCmd,
      [...pythonArgs, "-c", "import rembg; print(rembg.__version__)"],
      { encoding: "utf-8" }
    );
    if (r.status !== 0) throw new Error(r.stderr.split("\n").slice(-3).join(" "));
    return `v${r.stdout.trim()}`;
  });

  check("onnxruntime importable", () => {
    const r = spawnSync(
      pythonCmd,
      [...pythonArgs, "-c", "import onnxruntime; print(onnxruntime.__version__)"],
      { encoding: "utf-8" }
    );
    if (r.status !== 0) throw new Error(r.stderr.split("\n").slice(-3).join(" "));
    return `v${r.stdout.trim()}`;
  });

  check("Pillow + OpenCV", () => {
    const r = spawnSync(
      pythonCmd,
      [
        ...pythonArgs,
        "-c",
        "import PIL, cv2, numpy; print(f'PIL {PIL.__version__} | cv2 {cv2.__version__} | numpy {numpy.__version__}')",
      ],
      { encoding: "utf-8" }
    );
    if (r.status !== 0) throw new Error(r.stderr.split("\n").slice(-3).join(" "));
    return r.stdout.trim();
  });
}

console.log("");
if (ok) {
  console.log("✓ Setup completo. Listo para procesar.");
  console.log("");
  console.log("  Uso:");
  console.log("    npm run bg:process -- public/assets/hero/golden-goose.mp4");
  process.exit(0);
} else {
  console.log("✗ Faltan componentes. Instala los que aparecen como FAIL.");
  console.log("");
  console.log("  Si rembg/onnxruntime fallan, probar:");
  console.log("    py -3.11 -m pip install rembg onnxruntime pillow opencv-python");
  console.log("");
  console.log("  (3.11 tiene mas wheels precompilados que 3.14)");
  process.exit(1);
}
