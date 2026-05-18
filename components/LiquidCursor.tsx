"use client";

/* ============================================================================
   LIQUID CURSOR — versión con trail/halo
   - Una lente principal pequeña que distorsiona el backdrop con
     <feTurbulence> + <feDisplacementMap>.
   - Detrás, una cadena de "trail blobs" más chicos y traslúcidos que la
     siguen con lag creciente → genera la estela / halo.
   - Cadena de lerp: cada blob persigue al anterior, no al cursor.
     Eso produce una estela orgánica que se "estira" al mover rápido y
     se concentra al detenerse.

   Tunear:
     - LEAD_SIZE   → tamaño de la lente principal
     - TRAIL_COUNT → cantidad de blobs de estela
     - LERP_*      → suavidad / largo de la estela
     - scale       → intensidad de la distorsión (feDisplacementMap)
   ============================================================================ */

import { useEffect, useRef, useState } from "react";

const LEAD_SIZE   = 90;
const TRAIL_COUNT = 6;
const LERP_LEAD   = 0.28;   // velocidad con la que la lente principal alcanza al mouse
const LERP_TRAIL  = 0.18;   // velocidad con la que cada blob persigue al anterior

export default function LiquidCursor() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    setEnabled(true);

    let raf = 0;
    let tx = -LEAD_SIZE, ty = -LEAD_SIZE;

    // Posición de cada elemento (lead + trail). Empiezan fuera de pantalla.
    const positions = Array.from(
      { length: TRAIL_COUNT + 1 },
      () => ({ x: -LEAD_SIZE, y: -LEAD_SIZE })
    );

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
    };

    const loop = () => {
      // Lead persigue al mouse
      positions[0].x += (tx - positions[0].x) * LERP_LEAD;
      positions[0].y += (ty - positions[0].y) * LERP_LEAD;

      // Cada trail persigue al anterior con menos velocidad → estela
      for (let i = 1; i < positions.length; i++) {
        positions[i].x += (positions[i - 1].x - positions[i].x) * LERP_TRAIL;
        positions[i].y += (positions[i - 1].y - positions[i].y) * LERP_TRAIL;
      }

      // Aplicar transforms (sin re-render React)
      refs.current.forEach((el, i) => {
        if (!el) return;
        const size = LEAD_SIZE - i * 10;       // cada blob un poco más chico
        el.style.transform = `translate3d(${positions[i].x - size / 2}px, ${positions[i].y - size / 2}px, 0)`;
      });

      raf = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Filtro SVG: ruido + displacement = distorsión líquida */}
      <svg
        width="0"
        height="0"
        style={{ position: "fixed", inset: 0, pointerEvents: "none" }}
        aria-hidden
      >
        <defs>
          <filter id="liquid-lens" x="-30%" y="-30%" width="160%" height="160%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.018"
              numOctaves="2"
              seed="4"
              result="turb"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turb"
              scale="55"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Lead + trail */}
      {Array.from({ length: TRAIL_COUNT + 1 }, (_, i) => {
        const size = LEAD_SIZE - i * 10;
        const opacity = 1 - i * 0.14;
        const isLead = i === 0;

        return (
          <div
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            aria-hidden
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 40 - i,        /* lead encima */
              backdropFilter: "url(#liquid-lens)",
              WebkitBackdropFilter: "url(#liquid-lens)",
              opacity,
              // Halo sólo en la lente principal
              boxShadow: isLead
                ? "0 0 30px 4px rgba(255, 220, 200, 0.18), inset 0 0 0 1px rgba(255,255,255,0.08)"
                : "none",
              willChange: "transform",
              mixBlendMode: "normal",
            }}
          />
        );
      })}
    </>
  );
}
