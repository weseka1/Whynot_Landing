"use client";

/* ============================================================================
   PRELOADER — cinematic gold graffiti reveal.
   - Loading logic intacta: assets ponderados, MIN/MAX time, evento
     `whynot:preloader-hidden`, mobile GLB re-mapping.
   - Visual: matte black + canvas particles + SVG "WHY NOT" tag de grafitti
     que se dibuja letra por letra sincronizado con el % (pathLength=100 +
     stroke-dashoffset). feTurbulence + feDisplacementMap simulan spray,
     feGaussianBlur agrega bloom dorado detras. Particulas de overspray
     se emiten desde la punta del trazo en vivo (getPointAtLength del path
     activo, transformado al espacio de pantalla con getScreenCTM).
   - HUD: barra dorada con ticks + % gigante + scanline + logs de boot.
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import { HERO_SPECS } from "@/data/catalog";
import CornerFrame from "./CornerFrame";
import { mobileGLB, detectMobileTier } from "@/lib/mobileGLB";

const MIN_TIME = 600;
/* MAX_TIME subido a 20s: ahora precargamos los 15 videos 360 de PastDrop
   (~6.7MB extra). En 4G urbana 2-4s, en 3G hasta 15s — el cap de 20s
   garantiza que nadie se quede mirando el preloader infinito.            */
const MAX_TIME = 20000;

/* ----------------------------- ASSETS / WEIGHTS -------------------------- */
type Asset = { url: string; kind: "image" | "fetch"; weight: number };

/* Pesos reales (en KB redondeados) de los 15 videos 360 de PastDrop.
   Map separado para keep-clean del array principal. Si cambia un video,
   actualizar aca para que el progreso del preloader sume correcto.       */
const PAST_DROP_VIDEO_WEIGHTS: Record<string, number> = {
  "/videos-360/LUISVOUITTON.mp4": 549,
  "/videos-360/adidasbape.mp4": 420,
  "/videos-360/amiri.mp4": 453,
  "/videos-360/asicsgel-kayano.mp4": 729,
  "/videos-360/balenciaga.mp4": 397,
  "/videos-360/bape.mp4": 464,
  "/videos-360/jordan3blackcat.mp4": 409,
  "/videos-360/jordanpatentgold.mp4": 687,
  "/videos-360/lanvin.mp4": 373,
  "/videos-360/nikeairforce1triplewhite.mp4": 343,
  "/videos-360/nikejordantatum.mp4": 419,
  "/videos-360/offwhitebe-right-4x-RIFE-RIFE3.1-16fps.mp4": 590,
  "/videos-360/pumared.mp4": 546,
  "/videos-360/sbdunkverdy.mp4": 391,
  "/videos-360/timberland6-InchBoot.mp4": 449,
};

/* Genera asset entries para los 15 videos 360 a partir de HERO_SPECS.
   Asi si se agrega/quita un video del catalog, el preloader se ajusta
   automaticamente (siempre y cuando este el peso en el map de arriba). */
const PAST_DROP_VIDEO_ASSETS: Asset[] = HERO_SPECS.map((hs) => ({
  url: hs.src,
  kind: "fetch" as const,
  weight: PAST_DROP_VIDEO_WEIGHTS[hs.src] ?? 450, // fallback ~450KB
}));

const CRITICAL_ASSETS: Asset[] = [
  { url: "/assets/hero/sky-background.webp",       kind: "image", weight: 40  },
  { url: "/assets/marquee/whynot-text.webp",       kind: "image", weight: 30  },
  { url: "/assets/3d/mono.glb",                    kind: "fetch", weight: 1060 },
  { url: "/nuves/cloud-center.webp",               kind: "image", weight: 110 },
  { url: "/nuves/cloud-2.webp",                    kind: "image", weight: 36  },
  { url: "/nuves/cloud-center-bottom.webp",        kind: "image", weight: 19  },
  { url: "/assets/hero/golden-goose-white-black.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-silver-star.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-gold-star.webp",   kind: "image", weight: 10 },
  { url: "/assets/hero/extra.webp",                    kind: "image", weight: 180 },
  { url: "/assets/hero/golden-goose-white-black.webm", kind: "fetch", weight: 360 },
  { url: "/assets/hero/golden-goose-silver-star.webm", kind: "fetch", weight: 360 },
  { url: "/assets/hero/golden-goose-gold-star.webm",   kind: "fetch", weight: 360 },
  { url: "/assets/3d/mono-dorado.glb",             kind: "fetch", weight: 810 },
  { url: "/assets/3d/mono-rigged.glb",             kind: "fetch", weight: 706 },
  { url: "/assets/3d/mono-blanco-dorado.glb",      kind: "fetch", weight: 1084 },
  { url: "/assets/3d/mono-blanco.glb",             kind: "fetch", weight: 737 },
  { url: "/assets/3d/mono-louis.glb",              kind: "fetch", weight: 463 },
  { url: "/assets/3d/gotila-esenssial.glb",        kind: "fetch", weight: 521 },
  { url: "/assets/3d/balenciaga-3xl.glb",          kind: "fetch", weight: 394 },
  { url: "/assets/past-drop/drop-title.webp",      kind: "image", weight: 62 },
  { url: "/assets/futuristic-fashion/man-01.webp",   kind: "image", weight: 82 },
  { url: "/assets/futuristic-fashion/man-02.webp",   kind: "image", weight: 102 },
  { url: "/assets/futuristic-fashion/man-03.webp",   kind: "image", weight: 79 },
  { url: "/assets/futuristic-fashion/man-04.webp",   kind: "image", weight: 101 },
  { url: "/assets/futuristic-fashion/man-05.webp",   kind: "image", weight: 118 },
  { url: "/assets/futuristic-fashion/woman-01.webp", kind: "image", weight: 103 },
  { url: "/assets/futuristic-fashion/woman-02.webp", kind: "image", weight: 88 },
  /* Videos 360 de PastDrop (~6.7MB total). Antes se cargaban on-demand
     cuando el usuario llegaba a la seccion → primer scroll trababa
     hasta que cada video bufferaba. Ahora caen al cache del browser
     durante el preloader y PastDrop los toma instantaneo desde cache.   */
  ...PAST_DROP_VIDEO_ASSETS,
];

const LAZY_CHUNKS = [
  () => import("@/components/Collections"),
  () => import("@/components/PastDrop"),
  () => import("@/components/FuturisticGallery"),
  () => import("@/components/IdeaForm"),
  () => import("@/components/WhyNotEnd"),
  () => import("@/components/Footer"),
  () => import("@/components/LiquidCursor"),
];

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

/* ----------------------------- GRAFFITI LETTERS --------------------------- */
/* viewBox 0 0 1200 320 — "WHY NOT" tagueado de izq a der.
   Cada letra es un path independiente con pathLength=100 -> stroke-dashoffset
   trabaja en escala 0..100 sin importar la longitud real del path.
   start/end son los rangos de % donde se dibuja la letra. La suma deja
   "respiros" entre letras (el pen lift natural del tagger).             */
type LetterDef = {
  d: string;
  start: number;
  end: number;
  /* drips opcionales — chorretones que caen del path despues de completarse */
  drips?: { x: number; y: number; len: number; appearAt: number; dur: number; w?: number }[];
};
const LETTERS: LetterDef[] = [
  // W
  {
    d: "M 60 70 L 110 270 L 165 130 L 215 270 L 265 70",
    start: 3, end: 16,
    drips: [
      { x: 112, y: 268, len: 28, appearAt: 17, dur: 8 },
    ],
  },
  // H (multi-subpath: vertical izq -> crossbar -> vertical der)
  {
    d: "M 320 70 L 320 270 M 320 168 L 432 168 M 432 70 L 432 270",
    start: 17, end: 32,
    drips: [
      { x: 320, y: 268, len: 22, appearAt: 33, dur: 7 },
    ],
  },
  // Y (V superior + bajada central)
  {
    d: "M 480 70 L 545 175 L 610 70 M 545 175 L 545 270",
    start: 33, end: 47,
    drips: [
      { x: 545, y: 268, len: 38, appearAt: 48, dur: 9, w: 6 },
    ],
  },
  // N
  {
    d: "M 700 270 L 700 70 L 800 270 L 800 70",
    start: 53, end: 67,
    drips: [
      { x: 800, y: 268, len: 24, appearAt: 68, dur: 7 },
    ],
  },
  // O (ellipse aproximada con dos cubicas)
  {
    d: "M 875 70 C 815 70 815 270 875 270 C 935 270 935 70 875 70 Z",
    start: 67, end: 82,
  },
  // T (horizontal + vertical)
  {
    d: "M 970 70 L 1160 70 M 1065 70 L 1065 270",
    start: 82, end: 97,
    drips: [
      { x: 1065, y: 268, len: 30, appearAt: 96, dur: 4, w: 6 },
    ],
  },
];

/* Underline final — trazo dramatico que cruza debajo de "WHY NOT" al cierre. */
const UNDERLINE = {
  d: "M 70 305 Q 600 322 1160 300",
  start: 90, end: 100,
};

/* Map del % al stroke-dashoffset normalizado (pathLength=100). */
function dashOffsetFor(pct: number, start: number, end: number): number {
  if (pct <= start) return 100;
  if (pct >= end) return 0;
  return 100 - ((pct - start) / (end - start)) * 100;
}

/* ============================================================================
   COMPONENT
   ============================================================================ */
export default function Preloader() {
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(true);
  const pctRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);

  /* ---------------------------- LOADING EFFECT --------------------------- */
  useEffect(() => {
    const start = performance.now();
    const FONTS_WEIGHT = 50;
    const CHUNK_WEIGHT = 40;

    const isMobileForWeights = detectMobileTier();
    const assets = CRITICAL_ASSETS.map((a) => {
      if (a.kind !== "fetch" || !a.url.endsWith(".glb")) return a;
      const targetUrl = mobileGLB(a.url);
      if (targetUrl === a.url) return a;
      return { ...a, url: targetUrl, weight: Math.round(a.weight * 0.5) };
    });

    const totalWeight =
      assets.reduce((s, a) => s + a.weight, 0) +
      FONTS_WEIGHT +
      LAZY_CHUNKS.length * CHUNK_WEIGHT;

    let doneWeight = 0;
    let cancelled = false;
    let displayPct = 0;

    const tick = () => {
      if (cancelled) return;
      const target = Math.min(100, (doneWeight / totalWeight) * 100);
      displayPct += (target - displayPct) * 0.18;
      pctRef.current = displayPct;
      setPct(displayPct);
      if (displayPct < 99.5 || target < 100) {
        requestAnimationFrame(tick);
      } else {
        pctRef.current = 100;
        setPct(100);
      }
    };
    requestAnimationFrame(tick);

    const close = () => {
      if (cancelled) return;
      doneWeight = totalWeight;
      setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        setTimeout(() => {
          if (cancelled) return;
          window.dispatchEvent(new CustomEvent("whynot:preloader-hidden"));
        }, 700);
      }, 380);
    };

    const jobs: Promise<void>[] = assets.map((a) => {
      const p = a.kind === "image" ? loadImage(a.url) : fetchAsset(a.url);
      return p.then(() => {
        if (!cancelled) doneWeight += a.weight;
      });
    });
    jobs.push(
      fontsReady().then(() => {
        if (!cancelled) doneWeight += FONTS_WEIGHT;
      })
    );
    for (const load of LAZY_CHUNKS) {
      jobs.push(
        load()
          .catch(() => {})
          .then(() => {
            if (!cancelled) doneWeight += CHUNK_WEIGHT;
          })
      );
    }

    Promise.all(jobs).then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_TIME - elapsed);
      setTimeout(close, wait);
    });

    const hard = setTimeout(close, MAX_TIME);

    return () => {
      cancelled = true;
      clearTimeout(hard);
    };
  }, []);

  /* ---------------------------- CANVAS PARTICLES ------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let lastSpark = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type Ambient = { x:number; y:number; vx:number; vy:number; r:number; a:number; gold:boolean };
    const ambient: Ambient[] = Array.from({ length: 80 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.18,
      vy: -Math.random() * 0.28 - 0.04,
      r: Math.random() * 1.3 + 0.25,
      a: Math.random() * 0.45 + 0.08,
      gold: Math.random() < 0.72,
    }));

    type Spark = { x:number; y:number; vx:number; vy:number; life:number; max:number; r:number; gold:boolean };
    const sparks: Spark[] = [];

    const loop = (t: number) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      /* Ambient: pequenios dots dorados/blancos derivando hacia arriba */
      for (const p of ambient) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.beginPath();
        ctx.fillStyle = p.gold
          ? `rgba(220,178,98,${p.a})`
          : `rgba(255,247,222,${p.a * 0.55})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }

      /* Overspray emitido desde la punta del trazo activo.
         Localizamos la letra cuyo rango incluye al pct actual,
         pedimos getPointAtLength en su path y transformamos al
         espacio de pantalla con getScreenCTM.                 */
      const pctNow = pctRef.current;
      const activeIdx = LETTERS.findIndex(l => pctNow >= l.start && pctNow <= l.end);
      if (activeIdx >= 0) {
        const path = pathRefs.current[activeIdx];
        if (path) {
          try {
            const L = path.getTotalLength();
            const tt = Math.max(0, Math.min(1,
              (pctNow - LETTERS[activeIdx].start) /
              Math.max(0.0001, LETTERS[activeIdx].end - LETTERS[activeIdx].start)
            ));
            const pt = path.getPointAtLength(L * tt);
            const ctm = path.getScreenCTM();
            if (ctm) {
              const x = ctm.a * pt.x + ctm.c * pt.y + ctm.e;
              const y = ctm.b * pt.x + ctm.d * pt.y + ctm.f;
              if (t - lastSpark > 14) {
                lastSpark = t;
                const burst = 5;
                for (let i = 0; i < burst; i++) {
                  sparks.push({
                    x: x + (Math.random() - 0.5) * 6,
                    y: y + (Math.random() - 0.5) * 6,
                    vx: (Math.random() - 0.5) * 2.6,
                    vy: (Math.random() - 0.5) * 2.6 + 0.5,
                    life: 0,
                    max: 45 + Math.random() * 50,
                    r: Math.random() * 1.7 + 0.4,
                    gold: Math.random() < 0.85,
                  });
                }
              }
            }
          } catch {}
        }
      }

      /* Spark render + integracion (gravedad + drag) */
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life++;
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.05;
        s.vx *= 0.985;
        const lt = 1 - s.life / s.max;
        if (lt <= 0) { sparks.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.fillStyle = s.gold
          ? `rgba(232,196,108,${lt * 0.75})`
          : `rgba(255,250,236,${lt * 0.45})`;
        ctx.arc(s.x, s.y, s.r * lt, 0, Math.PI * 2);
        ctx.fill();
      }

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  /* ---------------------------- TEMPLATE --------------------------------- */
  const logs = [
    site.preloader.label,
    site.preloader.decrypt,
    site.preloader.granted,
    site.preloader.decrypted,
  ];
  const activeLog = Math.min(Math.floor((pct / 100) * logs.length), logs.length - 1);
  const finalFlash = pct >= 99;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{
            opacity: 0,
            filter: "blur(10px)",
            transition: { duration: 0.7, ease: [0.7, 0, 0.2, 1] },
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "#050505",
            overflow: "hidden",
            fontKerning: "normal",
          }}
        >
          {/* --- LAYER 0: matte black background + radial gold glow --------- */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(60% 50% at 50% 38%, rgba(184,135,53,0.10) 0%, rgba(70,46,12,0.04) 35%, transparent 70%), #050505",
            }}
          />

          {/* --- LAYER 1: film grain ---------------------------------------- */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.5,
              mixBlendMode: "overlay",
              backgroundImage:
                'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22240%22 height=%22240%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%221.8%22 numOctaves=%222%22 stitchTiles=%22stitch%22/><feColorMatrix values=%220 0 0 0 0.85 0 0 0 0 0.7 0 0 0 0 0.4 0 0 0 0.6 0%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22 opacity=%220.55%22/></svg>")',
              backgroundSize: "240px 240px",
              pointerEvents: "none",
            }}
          />

          {/* --- LAYER 2: HUD grid ticks ------------------------------------ */}
          <div
            className="pl-grid"
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.08,
              backgroundImage:
                "linear-gradient(to right, rgba(232,196,108,0.5) 1px, transparent 1px), linear-gradient(to bottom, rgba(232,196,108,0.5) 1px, transparent 1px)",
              backgroundSize: "80px 80px",
              maskImage:
                "radial-gradient(60% 60% at 50% 50%, black 30%, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(60% 60% at 50% 50%, black 30%, transparent 80%)",
              pointerEvents: "none",
            }}
          />

          {/* --- LAYER 3: scanline (gold tint) ------------------------------ */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 0%, rgba(232,196,108,0.06) 50%, transparent 100%)",
              height: "28%",
              animation: "scan 3.2s linear infinite",
              pointerEvents: "none",
            }}
          />

          {/* --- LAYER 4: PARTICLE CANVAS ----------------------------------- */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              mixBlendMode: "screen",
            }}
          />

          {/* --- LAYER 5: CORNERS ------------------------------------------- */}
          <CornerFrame position="top-left"     size={48} />
          <CornerFrame position="top-right"    size={48} />
          <CornerFrame position="bottom-left"  size={48} />
          <CornerFrame position="bottom-right" size={48} />

          {/* --- LAYER 6: TOP SYSTEM TAGS ----------------------------------- */}
          <div
            style={{
              position: "absolute",
              top: "calc(var(--space-md) + 4px)",
              left: "var(--container-pad)",
              right: "var(--container-pad)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              pointerEvents: "none",
            }}
          >
            <span className="system-text" style={{ color: "rgba(232,196,108,0.9)", letterSpacing: "0.18em" }}>
              {site.brand.name} // BOOT SEQUENCE
            </span>
            <span className="system-text" style={{ color: "rgba(232,196,108,0.55)", letterSpacing: "0.18em" }}>
              v02.6 / AU.999
            </span>
          </div>

          {/* --- LAYER 7: CENTER STACK -------------------------------------- */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: "var(--container-pad)",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: "clamp(28px, 5vh, 56px)",
                justifyItems: "center",
                width: "min(92vw, 1180px)",
              }}
            >
              {/* === GRAFFITI "WHY NOT" === */}
              <div
                style={{
                  width: "100%",
                  position: "relative",
                  filter: finalFlash ? "drop-shadow(0 0 36px rgba(247,229,168,0.55))" : "none",
                  transition: "filter 0.6s ease",
                }}
              >
                <svg
                  viewBox="0 0 1230 340"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ width: "100%", height: "auto", display: "block" }}
                  aria-hidden="true"
                >
                  <defs>
                    {/* Gold metallic vertical gradient (luz-sombra-luz para
                        simular un cilindro reflectivo de oro liquido). */}
                    <linearGradient id="pl-gold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#f9e9b2" />
                      <stop offset="22%"  stopColor="#e8c46d" />
                      <stop offset="46%"  stopColor="#7a4f15" />
                      <stop offset="58%"  stopColor="#a4751e" />
                      <stop offset="78%"  stopColor="#f0d27a" />
                      <stop offset="100%" stopColor="#c79438" />
                    </linearGradient>

                    {/* Spray displacement — agita los bordes para parecer pintura
                        aerosol, sin destruir la legibilidad. */}
                    <filter id="pl-spray" x="-10%" y="-10%" width="120%" height="120%">
                      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="t" />
                      <feDisplacementMap in="SourceGraphic" in2="t" scale="3.2" />
                    </filter>

                    {/* Bloom dorado — duplicate borroso atras para halo cinematico. */}
                    <filter id="pl-bloom" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="10" />
                    </filter>

                    {/* Highlight diagonal (no animado, ahorra GPU). */}
                    <linearGradient id="pl-sheen" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                      <stop offset="45%" stopColor="rgba(255,255,255,0.5)" />
                      <stop offset="55%" stopColor="rgba(255,255,255,0.5)" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                  </defs>

                  {/* Bloom layer detras (mismas paths con blur fuerte y opacidad baja). */}
                  <g filter="url(#pl-bloom)" opacity={finalFlash ? 0.95 : 0.6} style={{ transition: "opacity 0.5s ease" }}>
                    {LETTERS.map((l, i) => (
                      <path
                        key={`bloom-${i}`}
                        d={l.d}
                        stroke="#e8c46d"
                        strokeWidth={26}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        pathLength={100}
                        strokeDasharray={100}
                        strokeDashoffset={dashOffsetFor(pct, l.start, l.end)}
                        style={{ transition: "stroke-dashoffset 0.18s linear" }}
                      />
                    ))}
                    <path
                      d={UNDERLINE.d}
                      stroke="#f7e5a8"
                      strokeWidth={14}
                      fill="none"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={dashOffsetFor(pct, UNDERLINE.start, UNDERLINE.end)}
                      style={{ transition: "stroke-dashoffset 0.18s linear" }}
                    />
                  </g>

                  {/* Spray layer principal — el "trazo" real con bordes desplazados. */}
                  <g filter="url(#pl-spray)">
                    {LETTERS.map((l, i) => (
                      <g key={`main-${i}`}>
                        <path
                          ref={(el) => { pathRefs.current[i] = el; }}
                          d={l.d}
                          stroke="url(#pl-gold)"
                          strokeWidth={20}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pathLength={100}
                          strokeDasharray={100}
                          strokeDashoffset={dashOffsetFor(pct, l.start, l.end)}
                          style={{ transition: "stroke-dashoffset 0.18s linear" }}
                        />
                        {/* Highlight delgado al centro del stroke — reflejo metalico */}
                        <path
                          d={l.d}
                          stroke="url(#pl-sheen)"
                          strokeWidth={6}
                          fill="none"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          pathLength={100}
                          strokeDasharray={100}
                          strokeDashoffset={dashOffsetFor(pct, l.start, l.end)}
                          opacity={0.45}
                          style={{ transition: "stroke-dashoffset 0.18s linear", mixBlendMode: "screen" }}
                        />
                        {/* Drips de la letra (dripping post-trazo). */}
                        {l.drips?.map((dr, j) => {
                          const dripD = `M ${dr.x} ${dr.y} L ${dr.x} ${dr.y + dr.len}`;
                          return (
                            <path
                              key={`drip-${i}-${j}`}
                              d={dripD}
                              stroke="url(#pl-gold)"
                              strokeWidth={dr.w ?? 5}
                              fill="none"
                              strokeLinecap="round"
                              pathLength={100}
                              strokeDasharray={100}
                              strokeDashoffset={dashOffsetFor(pct, dr.appearAt, dr.appearAt + dr.dur)}
                              style={{ transition: "stroke-dashoffset 0.25s linear" }}
                            />
                          );
                        })}
                      </g>
                    ))}

                    {/* Underline final dramatico */}
                    <path
                      d={UNDERLINE.d}
                      stroke="url(#pl-gold)"
                      strokeWidth={10}
                      fill="none"
                      strokeLinecap="round"
                      pathLength={100}
                      strokeDasharray={100}
                      strokeDashoffset={dashOffsetFor(pct, UNDERLINE.start, UNDERLINE.end)}
                      style={{ transition: "stroke-dashoffset 0.2s linear" }}
                    />
                  </g>
                </svg>

                {/* Etiqueta minima debajo del tag, fade-in con el progreso */}
                <div
                  className="system-text"
                  style={{
                    position: "absolute",
                    bottom: -8,
                    right: 4,
                    color: "rgba(232,196,108,0.7)",
                    letterSpacing: "0.22em",
                    opacity: pct > 50 ? 1 : 0,
                    transition: "opacity 0.6s ease",
                  }}
                >
                  — TAG #001 / AU.24K
                </div>
              </div>

              {/* === HUD: % gigante + barra + ticks === */}
              <div style={{ display: "grid", gap: 18, justifyItems: "center", width: "min(72vw, 720px)" }}>
                <div
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(3.6rem, 9vw, 7.2rem)",
                    lineHeight: 1,
                    background: "linear-gradient(180deg, #f9e9b2 0%, #e8c46d 50%, #a4751e 100%)",
                    WebkitBackgroundClip: "text",
                    backgroundClip: "text",
                    color: "transparent",
                    letterSpacing: "0.04em",
                    textShadow: "0 0 40px rgba(232,196,108,0.18)",
                    animation: finalFlash ? "pl-flicker 1.4s steps(1) infinite" : "none",
                  }}
                >
                  {Math.floor(pct).toString().padStart(3, "0")}
                  <span style={{ fontSize: "0.45em", marginLeft: 4, color: "#c79438" }}>%</span>
                </div>

                {/* Barra dorada delgada con ticks y dot luminoso al final */}
                <div style={{ position: "relative", width: "100%", height: 22 }}>
                  {/* Track */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0, right: 0, top: "50%",
                      transform: "translateY(-50%)",
                      height: 1,
                      background: "rgba(232,196,108,0.18)",
                    }}
                  />
                  {/* Fill */}
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      top: "50%",
                      transform: "translateY(-50%)",
                      height: 1,
                      width: `${pct}%`,
                      background: "linear-gradient(90deg, rgba(232,196,108,0.1), #e8c46d 35%, #f9e9b2 100%)",
                      boxShadow: "0 0 16px rgba(232,196,108,0.55), 0 0 4px rgba(247,229,168,0.9)",
                      transition: "width 0.15s linear",
                    }}
                  />
                  {/* Dot luminoso al final del fill */}
                  <div
                    style={{
                      position: "absolute",
                      left: `${pct}%`,
                      top: "50%",
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: "#f9e9b2",
                      boxShadow: "0 0 18px 4px rgba(232,196,108,0.85), 0 0 40px 10px rgba(232,196,108,0.25)",
                      transform: "translate(-50%, -50%)",
                      transition: "left 0.15s linear",
                    }}
                  />
                  {/* Ticks 0/25/50/75/100 */}
                  {[0, 25, 50, 75, 100].map((t) => (
                    <div key={t} style={{
                      position: "absolute",
                      left: `${t}%`,
                      top: 0,
                      width: 1,
                      height: "100%",
                      transform: "translateX(-0.5px)",
                      background: pct >= t ? "rgba(232,196,108,0.9)" : "rgba(232,196,108,0.22)",
                      boxShadow: pct >= t ? "0 0 8px rgba(232,196,108,0.7)" : "none",
                      transition: "background 0.3s ease",
                    }} />
                  ))}
                  {/* Tick labels */}
                  <div
                    className="system-text"
                    style={{
                      position: "absolute",
                      left: 0, right: 0,
                      top: "calc(100% + 8px)",
                      display: "flex",
                      justifyContent: "space-between",
                      color: "rgba(232,196,108,0.45)",
                      letterSpacing: "0.18em",
                      fontSize: "0.65rem",
                    }}
                  >
                    <span>000</span>
                    <span>025</span>
                    <span>050</span>
                    <span>075</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Logs */}
                <div style={{ display: "grid", gap: 4, justifyContent: "center", marginTop: 18 }}>
                  {logs.map((l, i) => (
                    <span
                      key={l}
                      className="system-text"
                      style={{
                        opacity: i <= activeLog ? 1 : 0.18,
                        color: i === logs.length - 1 && i <= activeLog
                          ? "#f9e9b2"
                          : "rgba(232,196,108,0.85)",
                        letterSpacing: "0.18em",
                        transition: "opacity 0.4s ease, color 0.4s ease",
                      }}
                    >
                      › <span className={i === activeLog ? "caret" : ""}>{l}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* --- LAYER 8: BOTTOM SYSTEM TAGS -------------------------------- */}
          <div
            style={{
              position: "absolute",
              bottom: "calc(var(--space-md) + 4px)",
              left: "var(--container-pad)",
              right: "var(--container-pad)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              pointerEvents: "none",
            }}
          >
            <span className="system-text" style={{ color: "rgba(232,196,108,0.55)", letterSpacing: "0.18em" }}>
              GRAFFITI.RENDER / LIVE
            </span>
            <span className="system-text" style={{ color: "rgba(232,196,108,0.55)", letterSpacing: "0.18em" }}>
              {finalFlash ? "ACCESS GRANTED" : "STREAMING ASSETS…"}
            </span>
          </div>

          {/* Local keyframes — flicker dramatico al llegar al 100%. */}
          <style>{`
            @keyframes pl-flicker {
              0%, 92%, 100% { opacity: 1; }
              93% { opacity: 0.4; }
              95% { opacity: 1; }
              96% { opacity: 0.6; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
