"use client";

/* ============================================================================
   PAST DROP — Anillo 3D horizontal de zapatillas (videos 360)
   - Carrusel circular tipo "calesita vista de frente"
   - N círculos distribuidos a 360° / N alrededor de un eje vertical (Y)
   - Rotación combinada: scroll-driven (mientras la sección está pinned) + drag
   - Solo el círculo del frente reproduce el video; los demás muestran un
     frame estático (currentTime ≈ 0.05) para que se vean igual.
   - CSS 3D transforms (perspective + transform-style: preserve-3d) — sin R3F.
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

/* Lista de videos 360 servidos desde /public/videos-360 */
const VIDEOS = [
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
].map((f) => {
  const base = f.replace(/\.mp4$/i, "").replace(/-RIFE.*$/, "");
  return {
    src: `/videos-360/${f}`,
    label: base.toUpperCase(),
  };
});

const N = VIDEOS.length;
const STEP = 360 / N;       // ángulo entre círculos
const RADIUS = 520;         // radio del anillo (px)
const SIZE = 200;           // diámetro base de cada círculo (px)
const ACTIVE_SCALE = 1.4;   // qué tanto crece el del centro
const PERSPECTIVE = 2000;   // mayor = menos magnificación de los cercanos

export default function PastDrop() {
  const sectionRef = useRef<HTMLElement>(null);

  /* ---------- Scroll → rotación base ---------- */
  /* offset start/start → end/end = mientras la sección está "pinned" por el
     sticky child, el progreso va de 0→1. Una revolución completa en ese rango. */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const scrollRotation = useTransform(scrollYProgress, [0, 1], [0, 360]);

  /* ---------- Drag offset (aditivo) ---------- */
  const dragOffset = useMotionValue(0);

  /* ---------- Rotación combinada ---------- */
  const targetRotation = useMotionValue(0);
  useMotionValueEvent(scrollRotation, "change", (v) => {
    targetRotation.set(v + dragOffset.get());
  });
  useMotionValueEvent(dragOffset, "change", (v) => {
    targetRotation.set(scrollRotation.get() + v);
  });

  const rotation = useSpring(targetRotation, {
    stiffness: 65,
    damping: 22,
    mass: 1,
  });

  /* ---------- Índice activo (círculo del frente) ---------- */
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIdxRef = useRef(0);

  useMotionValueEvent(rotation, "change", (v) => {
    /* circulo i tiene angulo base = i*STEP; tras rotar el anillo por v,
       su ángulo efectivo es (i*STEP + v) mod 360. Buscamos el i cuyo
       ángulo efectivo está más cerca de 0 → i ≈ -v/STEP                */
    const idx = ((Math.round(-v / STEP) % N) + N) % N;
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
      // sensibilidad: 0.4° por pixel arrastrado
      dragOffset.set(dragRef.current.baseOffset + dx * 0.4);
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

  /* ---------- Video play / pause según activeIndex ---------- */
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

  /* Frame inicial visible aunque el video esté pausado */
  const onLoadedMetadata = (el: HTMLVideoElement | null) => {
    if (el && el.currentTime === 0) el.currentTime = 0.05;
  };

  /* ---------- HUD coordenadas que reaccionan a la rotación ---------- */
  const coordX = useTransform(rotation, (v) => {
    const n = Math.abs(Math.round(v * 10)) % 10000;
    return `X.${String(n).padStart(4, "0")}`;
  });
  const coordY = useTransform(rotation, (v) => {
    const n = Math.abs(Math.round(v * 7 + 353)) % 10000;
    return `Y.${String(n).padStart(4, "0")}`;
  });

  return (
    <section
      id="section-past-drop"
      ref={sectionRef}
      className="bg-dich-peach-flat"
      style={{
        position: "relative",
        minHeight: "260vh", // ~160vh de scroll pinned para 1 revolución
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

        {/* ----- CARRUSEL 3D ----- */}
        <div
          style={{
            flex: 1,
            position: "relative",
            perspective: `${PERSPECTIVE}px`,
            cursor: "grab",
            touchAction: "none",
            userSelect: "none",
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <motion.div
            style={{
              position: "absolute",
              inset: 0,
              transformStyle: "preserve-3d",
              rotateY: rotation,
              willChange: "transform",
            }}
          >
            {VIDEOS.map((v, i) => {
              const angle = i * STEP;
              const isActive = i === activeIndex;
              return (
                <div
                  key={v.src}
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    width: SIZE,
                    height: SIZE,
                    marginLeft: -SIZE / 2,
                    marginTop: -SIZE / 2,
                    transform: `rotateY(${angle}deg) translateZ(${RADIUS}px)`,
                    transformStyle: "preserve-3d",
                  }}
                >
                  {/* Contra-rota para que el video siempre encare la cámara
                      al pasar por adelante (sin esto los videos quedarían
                      "tangentes" al anillo y verías el costado). */}
                  <motion.div
                    animate={{ scale: isActive ? ACTIVE_SCALE : 1 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                      overflow: "hidden",
                      border: "2px solid var(--color-peach-fg)",
                      background: "#0a0a0a",
                      boxShadow: isActive
                        ? "0 40px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,84,54,0.6)"
                        : "0 10px 24px rgba(0,0,0,0.18)",
                      position: "relative",
                    }}
                  >
                    <video
                      ref={(el) => {
                        videoRefs.current[i] = el;
                      }}
                      src={v.src}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget)}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        pointerEvents: "none",
                        display: "block",
                      }}
                    />

                    {/* Marker activo: pequeño punto amarillo arriba a la izq */}
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          top: 10,
                          left: 10,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "var(--color-peach-accent)",
                          boxShadow: "0 0 12px var(--color-peach-accent)",
                        }}
                      />
                    )}
                  </motion.div>
                </div>
              );
            })}
          </motion.div>
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
