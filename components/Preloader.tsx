"use client";

/* ============================================================================
   PRELOADER — version REAL + FULL PAGE.
   - Espera a que carguen TODOS los assets criticos visibles en el primer
     scroll (Hero, CloudBand, Collections, Mission monos, etc.) + fonts.
   - Progreso ponderado por peso de archivo: archivos pesados aportan mas
     a la barra para que el % refleje la realidad (no llega a 90% y se traba
     5s cargando el ultimo GLB).
   - MIN_TIME: minimo 600ms en pantalla (evita flash si la red es muy rapida).
   - MAX_TIME: hard timeout 10s (si la red esta saturada igual liberamos UI).
   - Conserva el look: corners SVG, scanline, % grande, logs de boot.
   ============================================================================ */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import CornerFrame from "./CornerFrame";

const MIN_TIME = 600;
const MAX_TIME = 10000;

/* Lista de assets criticos para que la pagina se vea fluida en el primer
   scroll. Cada entrada tiene un `weight` aproximado (KB) para que el %
   refleje el progreso real (un GLB de 1MB aporta mas que una webp de 30KB).
   --------------------------------------------------------------------------
   Si agregas/cambias assets pesados en Hero, CloudBand, Collections o
   Mission, sumalos aca para que sigan apareciendo dentro del preloader. */
type Asset = { url: string; kind: "image" | "fetch"; weight: number };

const CRITICAL_ASSETS: Asset[] = [
  /* HERO ------------------------------------------------------------- */
  { url: "/assets/hero/sky-background.webp",       kind: "image", weight: 40  },
  { url: "/assets/marquee/whynot-text.webp",       kind: "image", weight: 30  },
  { url: "/assets/3d/mono.glb",                    kind: "fetch", weight: 1060 },

  /* CLOUDBAND -------------------------------------------------------- */
  { url: "/nuves/cloud-center.webp",               kind: "image", weight: 110 },
  { url: "/nuves/cloud-2.webp",                    kind: "image", weight: 36  },
  { url: "/nuves/cloud-center-bottom.webp",        kind: "image", weight: 19  },

  /* COLLECTIONS ------------------------------------------------------ */
  { url: "/assets/hero/golden-goose-white-black.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-silver-star.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-gold-star.webp",   kind: "image", weight: 10 },
  { url: "/assets/hero/extra.webp",                    kind: "image", weight: 180 },

  /* MISSION (mono dorado = mascota repetida a la derecha en cada pilar
     + el rigged que cae arriba). Los demas se cargan on-demand cuando
     el pilar entra al viewport — no entran al preloader.              */
  { url: "/assets/3d/mono-dorado.glb",             kind: "fetch", weight: 1170 },
  { url: "/assets/3d/mono-rigged.glb",             kind: "fetch", weight: 925  },
];

/* Helpers de precarga — cada uno resuelve cuando el asset esta listo. */
function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

function fetchAsset(src: string): Promise<void> {
  return new Promise((resolve) => {
    fetch(src, { cache: "force-cache" })
      .then((r) => r.blob())
      .then(() => resolve())
      .catch(() => resolve());
  });
}

function fontsReady(): Promise<void> {
  if (typeof document !== "undefined" && (document as any).fonts?.ready) {
    return (document as any).fonts.ready.then(() => undefined);
  }
  return Promise.resolve();
}

export default function Preloader() {
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();

    /* Peso "virtual" para fonts — sin esto un MAX_TIME largo se ve mal
       porque la barra se queda en 99% mientras se espera al fonts ready. */
    const FONTS_WEIGHT = 50;
    const totalWeight =
      CRITICAL_ASSETS.reduce((s, a) => s + a.weight, 0) + FONTS_WEIGHT;

    let doneWeight = 0;
    let cancelled = false;

    /* Animacion suave hacia el target — evita saltos bruscos del numero. */
    let displayPct = 0;
    const tick = () => {
      if (cancelled) return;
      const target = Math.min(100, (doneWeight / totalWeight) * 100);
      displayPct += (target - displayPct) * 0.18;
      setPct(displayPct);
      if (displayPct < 99.5 || target < 100) {
        requestAnimationFrame(tick);
      } else {
        setPct(100);
      }
    };
    requestAnimationFrame(tick);

    /* Cierre: cuando todos terminaron Y paso MIN_TIME. */
    const close = () => {
      if (cancelled) return;
      doneWeight = totalWeight;
      setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        /* 500ms = duracion del exit fade del AnimatePresence de abajo. */
        setTimeout(() => {
          if (cancelled) return;
          window.dispatchEvent(new CustomEvent("whynot:preloader-hidden"));
        }, 500);
      }, 280);
    };

    /* Disparar todos los fetchs en paralelo — cada uno aporta su weight
       al doneWeight cuando termina. */
    const jobs: Promise<void>[] = CRITICAL_ASSETS.map((a) => {
      const p = a.kind === "image" ? loadImage(a.url) : fetchAsset(a.url);
      return p.then(() => {
        if (!cancelled) doneWeight += a.weight;
      });
    });

    /* Fonts ready cuenta como un job mas. */
    jobs.push(
      fontsReady().then(() => {
        if (!cancelled) doneWeight += FONTS_WEIGHT;
      })
    );

    /* Cuando todo termino + MIN_TIME -> cerrar. */
    Promise.all(jobs).then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_TIME - elapsed);
      setTimeout(close, wait);
    });

    /* Hard timeout: si la red tarda demasiado, cerramos igual. */
    const hard = setTimeout(close, MAX_TIME);

    return () => {
      cancelled = true;
      clearTimeout(hard);
    };
  }, []);

  const logs = [
    site.preloader.label,
    site.preloader.decrypt,
    site.preloader.granted,
    site.preloader.decrypted,
  ];

  // qué línea está activa según el progreso
  const activeLog = Math.min(Math.floor((pct / 100) * logs.length), logs.length - 1);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "var(--color-bg)",
            overflow: "hidden",
          }}
        >
          {/* Corners */}
          <CornerFrame position="top-left"     size={48} />
          <CornerFrame position="top-right"    size={48} />
          <CornerFrame position="bottom-left"  size={48} />
          <CornerFrame position="bottom-right" size={48} />

          {/* Scanline */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 0%, rgba(244,169,130,0.06) 50%, transparent 100%)",
              height: "30%",
              animation: "scan 2.4s linear infinite",
            }}
          />

          {/* Contenido central */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: "var(--container-pad)",
            }}
          >
            <div style={{ textAlign: "center", display: "grid", gap: "var(--space-md)" }}>
              <span className="system-text">{site.brand.name} / BOOT SEQUENCE</span>

              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(4rem, 14vw, 12rem)",
                  lineHeight: 1,
                  color: "var(--color-accent)",
                }}
              >
                {Math.floor(pct).toString().padStart(3, "0")}%
              </div>

              <div style={{ display: "grid", gap: 4, justifyContent: "center" }}>
                {logs.map((l, i) => (
                  <span
                    key={l}
                    className="system-text"
                    style={{
                      opacity: i <= activeLog ? 1 : 0.2,
                      color:
                        i === logs.length - 1 && i <= activeLog
                          ? "var(--color-accent)"
                          : "var(--color-fg)",
                    }}
                  >
                    › <span className={i === activeLog ? "caret" : ""}>{l}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
