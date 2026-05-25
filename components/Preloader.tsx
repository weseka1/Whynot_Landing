"use client";

/* ============================================================================
   PRELOADER — version REAL + FULL PAGE.
   - Espera a que carguen TODOS los assets de la pagina (Hero, CloudBand,
     Collections, Mission monos, Meteorite GLB, PastDrop, FuturisticGallery)
     + fonts + bundles JS de las secciones lazy.
   - Progreso ponderado por peso de archivo: archivos pesados aportan mas
     a la barra para que el % refleje la realidad (no llega a 90% y se traba
     5s cargando el ultimo GLB).
   - MIN_TIME: minimo 600ms en pantalla (evita flash si la red es muy rapida).
   - MAX_TIME: hard timeout 14s (deja que termine la carga real en redes 3G/4G;
     si igual no termino, liberamos UI para no bloquear al usuario).
   - Conserva el look: corners SVG, scanline, % grande, logs de boot.
   ============================================================================ */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import CornerFrame from "./CornerFrame";

const MIN_TIME = 600;
const MAX_TIME = 14000;

/* Lista de assets de TODA la pagina home. Cada entrada tiene un `weight`
   aproximado (KB) para que el % refleje el progreso real (un GLB de 1MB
   aporta mas que una webp de 30KB).
   --------------------------------------------------------------------------
   Si agregas/cambias assets pesados en cualquier seccion de la home,
   sumalos aca para que sigan apareciendo dentro del preloader. */
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

  /* COLLECTIONS — thumbs + videos webm que aparecen al activar cada
     colorway en el "planeta" central. Precargar los webm evita el delay
     de 1-2s la primera vez que el usuario cambia de colorway.          */
  { url: "/assets/hero/golden-goose-white-black.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-silver-star.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-gold-star.webp",   kind: "image", weight: 10 },
  { url: "/assets/hero/extra.webp",                    kind: "image", weight: 180 },
  { url: "/assets/hero/golden-goose-white-black.webm", kind: "fetch", weight: 360 },
  { url: "/assets/hero/golden-goose-silver-star.webm", kind: "fetch", weight: 360 },
  { url: "/assets/hero/golden-goose-gold-star.webm",   kind: "fetch", weight: 360 },

  /* MISSION — los 5 monos que se montan al entrar cada pilar al viewport.
     Precargarlos en el HTTP cache evita el pop-in al scrollear.        */
  { url: "/assets/3d/mono-dorado.glb",             kind: "fetch", weight: 810 },
  { url: "/assets/3d/mono-rigged.glb",             kind: "fetch", weight: 706 },
  { url: "/assets/3d/mono-blanco-dorado.glb",      kind: "fetch", weight: 1707 },
  { url: "/assets/3d/mono-blanco.glb",             kind: "fetch", weight: 737 },
  { url: "/assets/3d/mono-louis.glb",              kind: "fetch", weight: 463 },
  { url: "/assets/3d/gotila-esenssial.glb",        kind: "fetch", weight: 521 },

  /* METEORITE — artifact Balenciaga 3XL que orbita al final de la pagina. */
  { url: "/assets/3d/balenciaga-3xl.glb",          kind: "fetch", weight: 394 },

  /* PAST DROP -------------------------------------------------------- */
  { url: "/assets/past-drop/drop-title.webp",      kind: "image", weight: 62 },

  /* FUTURISTIC GALLERY — 7 webps de la grilla editorial. */
  { url: "/assets/futuristic-fashion/man-01.webp",   kind: "image", weight: 82 },
  { url: "/assets/futuristic-fashion/man-02.webp",   kind: "image", weight: 102 },
  { url: "/assets/futuristic-fashion/man-03.webp",   kind: "image", weight: 79 },
  { url: "/assets/futuristic-fashion/man-04.webp",   kind: "image", weight: 101 },
  { url: "/assets/futuristic-fashion/man-05.webp",   kind: "image", weight: 118 },
  { url: "/assets/futuristic-fashion/woman-01.webp", kind: "image", weight: 103 },
  { url: "/assets/futuristic-fashion/woman-02.webp", kind: "image", weight: 88 },
];

/* Bundles JS de secciones below-the-fold (cargadas con next/dynamic en
   app/page.tsx). Las dispamos como import() durante el preloader para que
   sus chunks esten calientes en cache cuando el usuario scrollee.
   ----
   Sin esto: el chunk se descarga recien cuando React intenta montar la
   seccion -> el skeleton de 60-100vh queda visible mientras baja el JS.
   Cada import() devuelve una Promise que cuenta como un job mas del % .  */
const LAZY_CHUNKS = [
  () => import("@/components/Collections"),
  () => import("@/components/PastDrop"),
  () => import("@/components/FuturisticGallery"),
  () => import("@/components/IdeaForm"),
  () => import("@/components/WhyNotEnd"),
  () => import("@/components/Footer"),
  () => import("@/components/LiquidCursor"),
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

    /* Peso "virtual" para fonts y para cada chunk JS — sin esto un
       MAX_TIME largo se ve mal porque la barra se queda en 99% mientras
       se espera al fonts ready o a un chunk lento. */
    const FONTS_WEIGHT = 50;
    const CHUNK_WEIGHT = 40; // ~30-50KB gzipped por chunk dinamico
    const totalWeight =
      CRITICAL_ASSETS.reduce((s, a) => s + a.weight, 0) +
      FONTS_WEIGHT +
      LAZY_CHUNKS.length * CHUNK_WEIGHT;

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

    /* Chunks JS de las secciones lazy — los importamos durante el preloader
       para que el bundle baje YA y este caliente en cache cuando React
       intente montar la seccion al scrollear. .catch garantiza que un
       chunk roto no traba la barra (igual sumamos el peso). */
    for (const load of LAZY_CHUNKS) {
      jobs.push(
        load()
          .catch(() => {})
          .then(() => {
            if (!cancelled) doneWeight += CHUNK_WEIGHT;
          })
      );
    }

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
