"use client";

/* ============================================================================
   PAST DROP — Carrusel horizontal de zapatillas (videos 360)
   - NO es anillo 3D: los círculos no rotan, mantienen forma circular siempre.
   - Cada item tiene una posición continua respecto al centro (offset).
     · offset = 0  → centro, más grande, video reproduce
     · offset = ±1 → vecinos, un poco más chicos
     · offset = ±2 → siguientes, aún más chicos, fade
     · |offset| > 2.5 → fuera de pantalla (opacity 0)
   - Loop infinito: el offset se "envuelve" usando módulo N.
   - Rotación combinada: scroll-driven (mientras la sección está pinned) + drag.
   - Solo el círculo del frente reproduce su video; los demás muestran el
     primer frame (currentTime ≈ 0.05).
   ============================================================================ */

import { useRef, useEffect, useState, useCallback } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
} from "framer-motion";
import { site } from "@/data/site";
import XDecoration from "./XDecoration";

const VIDEO_FILES = [
  "LUISVOUITTON.mp4",
  "adidasbape.mp4",
  "amiri.mp4",
  "asicsgel-kayano.mp4",
  "balenciaga.mp4",
  "bape.mp4",
  "jordan3blackcat.mp4",
  "jordanpatentgold.mp4",
  "lanvin.mp4",
  "nikeairforce1triplewhite.mp4",
  "nikejordantatum.mp4",
  "offwhitebe-right-4x-RIFE-RIFE3.1-16fps.mp4",
  "pumared.mp4",
  "sbdunkverdy.mp4",
  "timberland6-InchBoot.mp4",
];

const VIDEOS = VIDEO_FILES.map((f) => ({
  src: `/videos-360/${f}`,
  label: f.replace(/\.mp4$/i, "").replace(/-RIFE.*$/, "").toUpperCase(),
}));

const N = VIDEOS.length;
const SIZE = 340;        // diámetro base (el del centro, scale 1)
const SPACING = 360;     // separación horizontal entre centros (px)
const SIDE_SCALE = 0.62; // tamaño de los vecinos (off = ±1) — bien más chicos
const OUTER_SCALE = 0.35;// tamaño de los exteriores (off = ±2) — apenas se ven
const FADE_START = 1.2;  // empieza a desvanecer apenas pasa el lateral visible
const FADE_END = 1.95;   // |offset| al que llega a opacity 0

/* Wrap del offset a [-N/2, N/2) para que el carrusel sea infinito y cada
   item tome el camino corto (no se "teletransporte" cuando hace loop). */
function wrapOffset(raw: number, total: number) {
  let o = raw % total;
  if (o > total / 2) o -= total;
  if (o < -total / 2) o += total;
  return o;
}

/* Escala por offset: 1 en el centro, SIDE_SCALE en ±1, OUTER_SCALE en ±2,
   interpola linealmente entre esos puntos.                                  */
function scaleForOffset(off: number) {
  const a = Math.abs(off);
  if (a <= 1) return 1 - (1 - SIDE_SCALE) * a;
  if (a <= 2) return SIDE_SCALE - (SIDE_SCALE - OUTER_SCALE) * (a - 1);
  return OUTER_SCALE;
}

/* Opacity: 1 hasta FADE_START, fade lineal hasta FADE_END, 0 más allá. */
function opacityForOffset(off: number) {
  const a = Math.abs(off);
  if (a <= FADE_START) return 1;
  if (a >= FADE_END) return 0;
  return 1 - (a - FADE_START) / (FADE_END - FADE_START);
}

export default function PastDrop() {
  const sectionRef = useRef<HTMLElement>(null);

  /* ---------- Scroll → posición base ----------
     Una "posición" entera = un item al frente. Scroll 0→1 avanza N items
     (1 ciclo completo del carrusel) mientras la sección está pinned.       */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const scrollPosition = useTransform(scrollYProgress, [0, 1], [0, N]);

  /* ---------- Drag offset (aditivo, mismas unidades: "items") ---------- */
  const dragOffset = useMotionValue(0);

  /* ---------- Posición combinada (scroll + drag) ---------- */
  const targetPosition = useMotionValue(0);
  useMotionValueEvent(scrollPosition, "change", (v) => {
    targetPosition.set(v + dragOffset.get());
  });
  useMotionValueEvent(dragOffset, "change", (v) => {
    targetPosition.set(scrollPosition.get() + v);
  });

  const position = useSpring(targetPosition, {
    stiffness: 80,
    damping: 24,
    mass: 0.9,
  });

  /* ---------- Índice activo ---------- */
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIdxRef = useRef(0);

  useMotionValueEvent(position, "change", (v) => {
    const idx = ((Math.round(v) % N) + N) % N;
    if (idx !== lastIdxRef.current) {
      lastIdxRef.current = idx;
      setActiveIndex(idx);
    }
  });

  /* ---------- Drag handlers ---------- */
  const dragRef = useRef<{ startX: number; baseOffset: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = { startX: e.clientX, baseOffset: dragOffset.get() };
    },
    [dragOffset]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      // sensibilidad: arrastrar SPACING px = avanzar 1 item, con factor -1
      // para que arrastrar a la derecha traiga el item de la izquierda al centro.
      dragOffset.set(dragRef.current.baseOffset - dx / SPACING);
    },
    [dragOffset]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    dragRef.current = null;
  }, []);

  /* ---------- Video play/pause según activeIndex ---------- */
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIndex) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }, [activeIndex]);

  const onLoadedMetadata = (el: HTMLVideoElement | null) => {
    if (el && el.currentTime === 0) el.currentTime = 0.05;
  };

  /* ---------- HUD coords reactivas ---------- */
  const coordX = useTransform(position, (p) => {
    const n = Math.abs(Math.round(p * 137)) % 10000;
    return `X.${String(n).padStart(4, "0")}`;
  });
  const coordY = useTransform(position, (p) => {
    const n = Math.abs(Math.round(p * 89 + 353)) % 10000;
    return `Y.${String(n).padStart(4, "0")}`;
  });

  return (
    <section
      id="section-past-drop"
      ref={sectionRef}
      className="bg-dich-peach-flat"
      style={{
        position: "relative",
        minHeight: "260vh", // ~160vh de scroll pinned para 1 ciclo completo
      }}
    >
      <XDecoration seed={11} count={18} color="var(--color-peach-line)" />

      {/* ============ STAGE STICKY ============ */}
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ----- TOP HUD ----- */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "var(--space-md) var(--container-pad) 0",
            color: "var(--color-peach-fg)",
            zIndex: 3,
          }}
        >
          <span className="system-text">{site.pastDrop.eyebrow}</span>
          <span className="system-text" style={{ letterSpacing: "0.15em" }}>
            PAST_DROP · {String(activeIndex + 1).padStart(2, "0")} /{" "}
            {String(N).padStart(2, "0")}
          </span>
        </div>

        {/* ----- TÍTULO ----- */}
        <div
          style={{
            position: "relative",
            padding: "var(--space-sm) var(--container-pad) 0",
            textAlign: "center",
            zIndex: 2,
          }}
        >
          <h2
            className="display"
            style={{
              fontSize: "clamp(2.2rem, 6vw, 5rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              color: "var(--color-peach-fg)",
              margin: 0,
            }}
          >
            {site.pastDrop.title}
          </h2>
        </div>

        {/* ----- CARRUSEL HORIZONTAL ----- */}
        <div
          style={{
            flex: 1,
            position: "relative",
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {VIDEOS.map((v, i) => (
            <CarouselItem
              key={v.src}
              index={i}
              position={position}
              src={v.src}
              registerRef={(el) => {
                videoRefs.current[i] = el;
              }}
              onLoadedMetadata={onLoadedMetadata}
            />
          ))}
        </div>

        {/* ----- BOTTOM HUD ----- */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0 var(--container-pad) var(--space-md)",
            color: "var(--color-peach-fg)",
            zIndex: 3,
          }}
        >
          <span className="system-text" style={{ letterSpacing: "0.15em" }}>
            ▸ {VIDEOS[activeIndex].label}
          </span>
          <span
            className="system-text"
            style={{ display: "flex", gap: "1rem", opacity: 0.8 }}
          >
            <motion.span>{coordX}</motion.span>
            <span>//</span>
            <motion.span>{coordY}</motion.span>
          </span>
        </div>
      </div>
    </section>
  );
}

/* ============================================================================
   CarouselItem — un círculo del carrusel.
   Calcula su transform en cada frame a partir de su posición continua
   relativa al centro (offset). Usa motion values (sin re-render React).
   ============================================================================ */
function CarouselItem({
  index,
  position,
  src,
  registerRef,
  onLoadedMetadata,
}: {
  index: number;
  position: ReturnType<typeof useMotionValue<number>> | any;
  src: string;
  registerRef: (el: HTMLVideoElement | null) => void;
  onLoadedMetadata: (el: HTMLVideoElement | null) => void;
}) {
  /* offset del item respecto al centro del carrusel (continuo, con wrap). */
  const offset = useTransform(position, (p: number) =>
    wrapOffset(index - p, N)
  );
  const x = useTransform(offset, (o) => o * SPACING);
  /* scaleX y scaleY bindeados al MISMO motion value para garantizar uniformidad
     (algunas versiones de framer-motion son finicky con `scale` único). */
  const s = useTransform(offset, scaleForOffset);
  const opacity = useTransform(offset, opacityForOffset);
  /* zIndex: el del centro arriba, los de afuera abajo */
  const zIndex = useTransform(offset, (o) => Math.round(100 - Math.abs(o) * 10));

  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%",
        /* Alineación por BASE: todos los círculos sientan su borde inferior
           en la misma línea horizontal. transformOrigin "50% 100%" hace que
           el scale los achique HACIA ABAJO (queda fijo el borde inferior),
           entonces los más chicos no quedan "flotando" arriba — siguen
           apoyados en la misma línea base. Eso elimina el efecto arco/anillo. */
        bottom: "12%",
        width: SIZE,
        height: SIZE,
        aspectRatio: "1 / 1",
        marginLeft: -SIZE / 2,
        x,
        scaleX: s,
        scaleY: s,
        opacity,
        zIndex,
        borderRadius: "50%",
        overflow: "hidden",
        border: "2px solid var(--color-peach-fg)",
        background: "#ffffff",
        boxShadow: "0 18px 40px rgba(0,0,0,0.22)",
        willChange: "transform, opacity",
        transformOrigin: "50% 100%",
      }}
    >
      <video
        ref={registerRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget)}
        style={{
          width: "100%",
          height: "100%",
          /* contain: el video entra entero (sin recortes); scale: aire
             extra alrededor para que no toque el borde del círculo. */
          objectFit: "contain",
          transform: "scale(0.85)",
          transformOrigin: "center",
          pointerEvents: "none",
          display: "block",
        }}
      />
    </motion.div>
  );
}
