"use client";

/* ============================================================================
   PAST DROP — DICH ARCHIVE / SPECIMEN MODE
   ----------------------------------------------------------------------------
   Cinematic premium-futurism showroom para los videos 360 con fondo blanco.
   Cada zapa = "specimen" en una cápsula glassmórfica con marcadores técnicos
   y scan line. La capa blanca del video se vuelve la plataforma de exhibición.

   Layers (z bottom → top):
     0  BackgroundAurora  — gradientes radiales animados (violeta + magenta + ámbar)
     0  BackgroundGrid    — grid técnico tenue con mask radial
     1  BackgroundParticles — 22 puntos flotantes ámbar
     1  Giant brand text  — nombre de la marca activa, serif italic, opacity 0.08
     4  Title             — "Past Drop" + eyebrow
     5  Capsule carousel  — cápsulas con tilt 3D reactivo al cursor
     8  Metadata panel    — BRAND/YEAR/MATERIAL/CODE/STATUS/LUM live
    10  HUD top+bottom    — SPEC_NNN, pulse dot, coords X//Y reactivas
   ============================================================================ */

import { useRef, useEffect, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
  AnimatePresence,
  MotionValue,
} from "framer-motion";
import { site } from "@/data/site";

/* ---------------- METADATA ---------------- */
type Spec = {
  src: string;
  label: string;
  brand: string;
  year: string;
  material: string;
  code: string;
  spec: string;
};

const SPECS: Spec[] = [
  { src: "/videos-360/LUISVOUITTON.mp4", label: "LV TRAINER",
    brand: "LOUIS VUITTON", year: "2024", material: "MONOGRAM DENIM",
    code: "LV.TR.001", spec: "AW-024-LV" },
  { src: "/videos-360/adidasbape.mp4", label: "ADIDAS × BAPE",
    brand: "ADIDAS × BAPE", year: "2023", material: "CAMO LEATHER",
    code: "AB.CM.002", spec: "FW-023-AB" },
  { src: "/videos-360/amiri.mp4", label: "AMIRI STADIUM",
    brand: "AMIRI", year: "2024", material: "DISTRESSED CANVAS",
    code: "AM.ST.003", spec: "SS-024-AM" },
  { src: "/videos-360/asicsgel-kayano.mp4", label: "GEL-KAYANO 14",
    brand: "ASICS", year: "2023", material: "MESH × GEL",
    code: "AS.GK.004", spec: "TR-023-AS" },
  { src: "/videos-360/balenciaga.mp4", label: "TRACK",
    brand: "BALENCIAGA", year: "2022", material: "MULTI-PANEL",
    code: "BL.TR.005", spec: "AW-022-BL" },
  { src: "/videos-360/bape.mp4", label: "BAPE STA",
    brand: "BAPE", year: "2024", material: "PATENT LEATHER",
    code: "BP.ST.006", spec: "SS-024-BP" },
  { src: "/videos-360/jordan3blackcat.mp4", label: "JORDAN III BLACK CAT",
    brand: "JORDAN", year: "2023", material: "BLACK NUBUCK",
    code: "JD.III.007", spec: "RT-023-JD" },
  { src: "/videos-360/jordanpatentgold.mp4", label: "JORDAN PATENT",
    brand: "JORDAN", year: "2023", material: "PATENT × GOLD",
    code: "JD.PT.008", spec: "AW-023-JD" },
  { src: "/videos-360/lanvin.mp4", label: "LANVIN CURB",
    brand: "LANVIN", year: "2024", material: "SUEDE × CALFSKIN",
    code: "LN.CB.009", spec: "SS-024-LN" },
  { src: "/videos-360/nikeairforce1triplewhite.mp4", label: "AF1 TRIPLE WHITE",
    brand: "NIKE", year: "2023", material: "TUMBLED LEATHER",
    code: "NK.AF.010", spec: "CO-023-NK" },
  { src: "/videos-360/nikejordantatum.mp4", label: "JORDAN TATUM",
    brand: "JORDAN", year: "2024", material: "TECH MESH",
    code: "JD.TA.011", spec: "PE-024-JD" },
  { src: "/videos-360/offwhitebe-right-4x-RIFE-RIFE3.1-16fps.mp4", label: "OFF-WHITE BE RIGHT",
    brand: "OFF-WHITE", year: "2022", material: "MIXED MEDIA",
    code: "OW.BR.012", spec: "AW-022-OW" },
  { src: "/videos-360/pumared.mp4", label: "PUMA SUEDE",
    brand: "PUMA", year: "2024", material: "SUEDE",
    code: "PM.SD.013", spec: "SS-024-PM" },
  { src: "/videos-360/sbdunkverdy.mp4", label: "SB DUNK VERDY",
    brand: "NIKE SB", year: "2024", material: "PREMIUM SUEDE",
    code: "SB.DK.014", spec: "AR-024-SB" },
  { src: "/videos-360/timberland6-InchBoot.mp4", label: "TIMBERLAND 6\"",
    brand: "TIMBERLAND", year: "2023", material: "PREMIUM NUBUCK",
    code: "TB.06.015", spec: "WI-023-TB" },
];

const N = SPECS.length;

/* ---------------- LAYOUT ---------------- */
const SIZE_W = 540;       // cápsula activa: ancho (px)
const SIZE_H = 360;       // cápsula activa: alto (px) — aspect 3:2
const SPACING = 460;      // distancia entre centros — overlap suave
const SIDE_SCALE = 0.52;  // off=±1 — bastante más chicas (deja respirar al activo)
const OUTER_SCALE = 0.36; // off=±2
const FADE_START = 1.7;
const FADE_END = 2.6;

const GOLD = "#e8c468";   // ámbar pálido — el accent del sistema
const GOLD_DIM = "rgba(232,196,104,0.55)";

/* ---------------- HELPERS ---------------- */
function wrapOffset(raw: number, total: number) {
  let o = raw % total;
  if (o > total / 2) o -= total;
  if (o < -total / 2) o += total;
  return o;
}
function scaleForOffset(off: number) {
  const a = Math.abs(off);
  if (a <= 1) return 1 - (1 - SIDE_SCALE) * a;
  if (a <= 2) return SIDE_SCALE - (SIDE_SCALE - OUTER_SCALE) * (a - 1);
  return OUTER_SCALE;
}
function opacityForOffset(off: number) {
  const a = Math.abs(off);
  if (a <= FADE_START) return 1;
  if (a >= FADE_END) return 0;
  return 1 - (a - FADE_START) / (FADE_END - FADE_START);
}

/* ============================================================================ */
export default function PastDrop() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  /* ---------- Scroll → posición continua ---------- */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const scrollPosition = useTransform(scrollYProgress, [0, 1], [0, N]);

  /* ---------- Drag offset ---------- */
  const dragOffset = useMotionValue(0);

  /* ---------- Posición combinada ---------- */
  const targetPosition = useMotionValue(0);
  useMotionValueEvent(scrollPosition, "change", (v) => {
    targetPosition.set(v + dragOffset.get());
  });
  useMotionValueEvent(dragOffset, "change", (v) => {
    targetPosition.set(scrollPosition.get() + v);
  });
  const position = useSpring(targetPosition, {
    stiffness: 78, damping: 26, mass: 1,
  });

  /* ---------- Active index ---------- */
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIdxRef = useRef(0);
  useMotionValueEvent(position, "change", (v) => {
    const idx = ((Math.round(v) % N) + N) % N;
    if (idx !== lastIdxRef.current) {
      lastIdxRef.current = idx;
      setActiveIndex(idx);
    }
  });

  /* ---------- Mouse tilt (3D parallax sobre la cápsula activa) ---------- */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const mouseXSpring = useSpring(mouseX, { stiffness: 55, damping: 14 });
  const mouseYSpring = useSpring(mouseY, { stiffness: 55, damping: 14 });
  const tiltX = useTransform(mouseYSpring, [-0.5, 0.5], [7, -7]);   // pitch
  const tiltY = useTransform(mouseXSpring, [-0.5, 0.5], [-11, 11]); // yaw

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [mouseX, mouseY]);
  const onMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  /* ---------- Drag handlers ---------- */
  const dragRef = useRef<{ startX: number; baseOffset: number } | null>(null);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, baseOffset: dragOffset.get() };
  }, [dragOffset]);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    dragOffset.set(dragRef.current.baseOffset - dx / SPACING);
  }, [dragOffset]);
  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    dragRef.current = null;
  }, []);

  /* ---------- Video play/pause ---------- */
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIndex) v.play().catch(() => {});
      else v.pause();
    });
  }, [activeIndex]);
  const onLoadedMetadata = (el: HTMLVideoElement | null) => {
    if (el && el.currentTime === 0) el.currentTime = 0.05;
  };

  /* ---------- HUD live data ---------- */
  const coordX = useTransform(position, (p) => {
    const n = Math.abs(Math.round(p * 137)) % 10000;
    return `X.${String(n).padStart(4, "0")}`;
  });
  const coordY = useTransform(position, (p) => {
    const n = Math.abs(Math.round(p * 89 + 353)) % 10000;
    return `Y.${String(n).padStart(4, "0")}`;
  });
  const luminosity = useTransform(position, (p) => {
    return (0.5 + Math.sin(p * 0.7) * 0.499).toFixed(3);
  });

  const active = SPECS[activeIndex];

  return (
    <section
      id="section-past-drop"
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "260vh",
        background: "#050510",
        color: "#e9e2d4",
        overflow: "hidden",
      }}
    >
      {/* ============ STICKY STAGE ============ */}
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* ----- BACKGROUND LAYERS ----- */}
        <BackgroundAurora />
        <BackgroundGrid />
        <BackgroundParticles />

        {/* ----- GIANT BRAND TEXT BEHIND ----- */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.brand}
            initial={{ opacity: 0, y: 28, filter: "blur(28px)" }}
            animate={{ opacity: 0.08, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -28, filter: "blur(28px)" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              left: 0, right: 0,
              top: "30%",
              textAlign: "center",
              fontFamily: "var(--font-display, serif)",
              fontStyle: "italic",
              fontSize: "clamp(6rem, 20vw, 20rem)",
              letterSpacing: "-0.04em",
              lineHeight: 0.85,
              color: "#fff",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 1,
              userSelect: "none",
              mixBlendMode: "screen",
            }}
          >
            {active.brand}
          </motion.div>
        </AnimatePresence>

        {/* ----- TOP HUD ----- */}
        <HudTop active={active} activeIndex={activeIndex} />

        {/* ----- TITLE + EYEBROW ----- */}
        <div
          style={{
            position: "absolute",
            top: "9%",
            left: 0, right: 0,
            textAlign: "center",
            zIndex: 4,
            padding: "0 var(--container-pad)",
            pointerEvents: "none",
          }}
        >
          <div
            className="system-text"
            style={{
              color: GOLD_DIM,
              marginBottom: "0.6rem",
              fontSize: "0.72rem",
              letterSpacing: "0.3em",
            }}
          >
            {site.pastDrop.eyebrow}
          </div>
          <h2
            className="display"
            style={{
              fontSize: "clamp(2.2rem, 5.5vw, 4.5rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              color: "#fff",
              margin: 0,
              textShadow: "0 4px 30px rgba(0,0,0,0.7)",
            }}
          >
            {site.pastDrop.title}
          </h2>
        </div>

        {/* ----- CAPSULE CAROUSEL STAGE ----- */}
        <div
          ref={stageRef}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute",
            inset: 0,
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
            perspective: "1600px",
            zIndex: 5,
          }}
        >
          {SPECS.map((spec, i) => (
            <Capsule
              key={spec.src}
              index={i}
              position={position}
              spec={spec}
              tiltX={tiltX}
              tiltY={tiltY}
              registerRef={(el) => { videoRefs.current[i] = el; }}
              onLoadedMetadata={onLoadedMetadata}
            />
          ))}
        </div>

        {/* ----- METADATA PANEL (left) ----- */}
        <MetadataPanel active={active} activeIndex={activeIndex} luminosity={luminosity} />

        {/* ----- BOTTOM HUD ----- */}
        <HudBottom active={active} coordX={coordX} coordY={coordY} />
      </div>
    </section>
  );
}

/* ============================================================================
   BACKGROUND LAYERS
   ============================================================================ */
function BackgroundAurora() {
  return (
    <>
      {/* Atmospheric base — multi-stop radial cosmos */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 18% 28%, rgba(120,40,180,0.42), transparent 60%),
            radial-gradient(ellipse 70% 50% at 82% 72%, rgba(220,30,120,0.32), transparent 60%),
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(40,15,80,0.55), transparent 70%),
            linear-gradient(180deg, #0a0a14 0%, #1a0b2a 50%, #050510 100%)
          `,
          zIndex: 0,
        }}
      />
      {/* Slow drifting amber aurora */}
      <motion.div
        aria-hidden
        animate={{ x: [-40, 40, -40], y: [-25, 25, -25] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -80,
          background: "radial-gradient(circle 700px at 30% 40%, rgba(232,196,104,0.22), transparent 60%)",
          filter: "blur(50px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Magenta accent drift (counter direction) */}
      <motion.div
        aria-hidden
        animate={{ x: [30, -30, 30], y: [20, -20, 20] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -50,
          background: "radial-gradient(circle 500px at 70% 60%, rgba(220,30,120,0.20), transparent 65%)",
          filter: "blur(60px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Vignette */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}

function BackgroundGrid() {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(232,196,104,0.05) 1px, transparent 1px),
          linear-gradient(90deg, rgba(232,196,104,0.05) 1px, transparent 1px)
        `,
        backgroundSize: "52px 52px",
        WebkitMaskImage:
          "radial-gradient(circle at center, black 22%, transparent 78%)",
        maskImage:
          "radial-gradient(circle at center, black 22%, transparent 78%)",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function BackgroundParticles() {
  /* Deterministic spread → mismo render en SSR y CSR */
  const items = Array.from({ length: 22 }).map((_, i) => ({
    left: ((i * 37) % 97) + 1,
    top: ((i * 23) % 95) + 2,
    size: 1 + (i % 3),
    dur: 14 + (i % 9) * 1.8,
    delay: (i % 5) * 0.7,
  }));
  return (
    <>
      {items.map((p, i) => (
        <motion.div
          key={i}
          animate={{
            y: [-14, 14, -14],
            opacity: [0.15, 0.55, 0.15],
          }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "rgba(232,196,104,0.7)",
            boxShadow: "0 0 8px rgba(232,196,104,0.5)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      ))}
    </>
  );
}

/* ============================================================================
   HUD
   ============================================================================ */
function HudTop({ active, activeIndex }: { active: Spec; activeIndex: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "var(--space-md) var(--container-pad) 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
        color: GOLD_DIM,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.7rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: "1.2rem", alignItems: "center" }}>
        <motion.span
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{
            color: "#ff5436",
            fontSize: "0.6rem",
            textShadow: "0 0 8px rgba(255,84,54,0.6)",
          }}
        >
          ●
        </motion.span>
        <span>D://DATA_CORE / ARCHIVE</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span style={{ color: GOLD }}>
          SPEC_{String(activeIndex + 1).padStart(3, "0")}
        </span>
      </div>
      <div style={{ display: "flex", gap: "1.2rem", alignItems: "center" }}>
        <span style={{ opacity: 0.5 }}>{active.spec}</span>
        <span style={{ color: GOLD }}>
          [{String(activeIndex + 1).padStart(2, "0")}/{String(N).padStart(2, "0")}]
        </span>
      </div>
    </div>
  );
}

function HudBottom({
  active,
  coordX,
  coordY,
}: {
  active: Spec;
  coordX: MotionValue<string>;
  coordY: MotionValue<string>;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "0 var(--container-pad) var(--space-md)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.7rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
        <span style={{ color: GOLD }}>▸</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={active.label}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.45 }}
            style={{ color: "#e9e2d4", letterSpacing: "0.2em" }}
          >
            {active.label}
          </motion.span>
        </AnimatePresence>
      </div>
      <div style={{ display: "flex", gap: "1rem", color: GOLD_DIM }}>
        <motion.span>{coordX}</motion.span>
        <span>//</span>
        <motion.span>{coordY}</motion.span>
      </div>
    </div>
  );
}

/* ============================================================================
   METADATA PANEL — sidebar inferior izquierda, crossfade en cada cambio
   ============================================================================ */
function MetadataPanel({
  active,
  activeIndex,
  luminosity,
}: {
  active: Spec;
  activeIndex: number;
  luminosity: MotionValue<string>;
}) {
  const rows = [
    { label: "BRAND", value: active.brand },
    { label: "YEAR", value: active.year },
    { label: "MATERIAL", value: active.material },
    { label: "DROP CODE", value: active.code },
    { label: "STATUS", value: "ARCHIVED" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: "var(--container-pad)",
        bottom: "14%",
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 1,
          height: 32,
          background:
            "linear-gradient(to bottom, transparent, rgba(232,196,104,0.7))",
          marginBottom: "1rem",
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.72rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                gap: "0.8rem",
                marginBottom: "0.45rem",
              }}
            >
              <span
                style={{
                  width: 92,
                  color: GOLD_DIM,
                  whiteSpace: "nowrap",
                }}
              >
                {r.label}
              </span>
              <span style={{ color: "#e9e2d4" }}>{r.value}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              gap: "0.8rem",
              marginTop: "1rem",
              paddingTop: "0.8rem",
              borderTop: "1px solid rgba(232,196,104,0.18)",
            }}
          >
            <span style={{ width: 92, color: GOLD_DIM }}>LUM</span>
            <motion.span style={{ color: GOLD }}>{luminosity}</motion.span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ============================================================================
   CAPSULE — un specimen del carrusel
   ============================================================================ */
type CapsuleProps = {
  index: number;
  position: MotionValue<number>;
  spec: Spec;
  tiltX: MotionValue<number>;
  tiltY: MotionValue<number>;
  registerRef: (el: HTMLVideoElement | null) => void;
  onLoadedMetadata: (el: HTMLVideoElement | null) => void;
};

function Capsule({
  index,
  position,
  spec,
  tiltX,
  tiltY,
  registerRef,
  onLoadedMetadata,
}: CapsuleProps) {
  /* Offset continuo del item respecto al centro (wrap a [-N/2, N/2)). */
  const offset = useTransform(position, (p) => wrapOffset(index - p, N));
  const x = useTransform(offset, (o) => o * SPACING);
  const s = useTransform(offset, scaleForOffset);
  const opacity = useTransform(offset, opacityForOffset);
  const zIndex = useTransform(offset, (o) =>
    Math.round(100 - Math.abs(o) * 10)
  );

  /* "isActive" continuo: 1 cuando offset ≈ 0, 0 cuando se aleja.
     Manija para el tilt (solo el activo se mueve con el mouse) y para
     mostrar/ocultar los marcadores técnicos de la cápsula activa.       */
  const isActive = useTransform(offset, (o) => {
    const a = Math.abs(o);
    return a < 0.35 ? 1 : Math.max(0, 1 - (a - 0.35) * 2.5);
  });

  /* Tilt aplicado solo al activo: rotate × isActive */
  const ax = useTransform([tiltX, isActive] as MotionValue<number>[], (vs) => {
    const arr = vs as unknown as number[];
    return arr[0] * arr[1];
  });
  const ay = useTransform([tiltY, isActive] as MotionValue<number>[], (vs) => {
    const arr = vs as unknown as number[];
    return arr[0] * arr[1];
  });

  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: SIZE_W,
        height: SIZE_H,
        marginLeft: -SIZE_W / 2,
        marginTop: -SIZE_H / 2,
        x,
        scaleX: s,
        scaleY: s,
        opacity,
        zIndex,
        rotateX: ax,
        rotateY: ay,
        transformStyle: "preserve-3d",
        willChange: "transform, opacity",
      }}
    >
      {/* ===== Outer glass frame (capsule) ===== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 28,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(232,196,104,0.35)",
          boxShadow: `
            0 0 70px rgba(120,40,180,0.28),
            0 0 40px rgba(232,196,104,0.18),
            0 35px 70px rgba(0,0,0,0.55),
            inset 0 1px 1px rgba(255,255,255,0.18),
            inset 0 -1px 1px rgba(0,0,0,0.45)
          `,
          overflow: "hidden",
        }}
      >
        {/* ===== Inner white platform (where the shoe lives) ===== */}
        <div
          style={{
            position: "absolute",
            inset: 12,
            borderRadius: 20,
            background:
              "linear-gradient(180deg, #ffffff 0%, #f4f4f0 100%)",
            overflow: "hidden",
            boxShadow: "inset 0 -25px 50px rgba(0,0,0,0.06)",
          }}
        >
          <video
            ref={registerRef}
            src={spec.src}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              transform: "scale(0.86)",
              transformOrigin: "center",
              pointerEvents: "none",
              display: "block",
            }}
          />
          {/* Contact shadow bajo la zapa */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: "11%",
              left: "22%",
              right: "22%",
              height: 12,
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.22), transparent 70%)",
              filter: "blur(5px)",
              pointerEvents: "none",
            }}
          />
          {/* Scan line vertical que recorre el activo */}
          <motion.div
            aria-hidden
            animate={{ y: ["-30%", "130%"] }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              height: 60,
              background:
                "linear-gradient(180deg, transparent, rgba(232,196,104,0.14), transparent)",
              pointerEvents: "none",
              opacity: isActive,
            }}
          />
        </div>

        {/* ===== Corner technical markers (siempre visibles, finos) ===== */}
        <CornerMarker pos="tl" />
        <CornerMarker pos="tr" />
        <CornerMarker pos="bl" />
        <CornerMarker pos="br" />

        {/* ===== Floating spec readouts (solo en activa) ===== */}
        <motion.div
          style={{
            position: "absolute",
            bottom: 14,
            left: 18,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.58rem",
            letterSpacing: "0.28em",
            color: GOLD,
            opacity: isActive,
            pointerEvents: "none",
          }}
        >
          {spec.code}
        </motion.div>
        <motion.div
          style={{
            position: "absolute",
            top: 14,
            right: 18,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.58rem",
            letterSpacing: "0.28em",
            color: "rgba(232,196,104,0.55)",
            opacity: isActive,
            pointerEvents: "none",
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <motion.span
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ color: "#ff5436" }}
          >
            ●
          </motion.span>
          REC
        </motion.div>
        <motion.div
          style={{
            position: "absolute",
            top: 14,
            left: 18,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.58rem",
            letterSpacing: "0.28em",
            color: GOLD_DIM,
            opacity: isActive,
            pointerEvents: "none",
          }}
        >
          {spec.year}
        </motion.div>
        <motion.div
          style={{
            position: "absolute",
            bottom: 14,
            right: 18,
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.58rem",
            letterSpacing: "0.28em",
            color: GOLD_DIM,
            opacity: isActive,
            pointerEvents: "none",
          }}
        >
          {spec.spec}
        </motion.div>
      </div>
    </motion.div>
  );
}

function CornerMarker({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const SIZE = 14;
  const base: React.CSSProperties = {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    pointerEvents: "none",
  };
  const stroke = `1px solid ${GOLD_DIM}`;
  const styleByPos: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 8, left: 8, borderTop: stroke, borderLeft: stroke },
    tr: { top: 8, right: 8, borderTop: stroke, borderRight: stroke },
    bl: { bottom: 8, left: 8, borderBottom: stroke, borderLeft: stroke },
    br: { bottom: 8, right: 8, borderBottom: stroke, borderRight: stroke },
  };
  return <div aria-hidden style={{ ...base, ...styleByPos[pos] }} />;
}
