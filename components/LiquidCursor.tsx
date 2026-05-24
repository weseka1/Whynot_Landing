"use client";

/* ============================================================================
   LIQUID CURSOR v2 — optimizado, NO toca nada del 3D del sitio.
   - Antes: 7 capas (lead + 6 trail) cada una con backdrop-filter:url(#lens),
     y el filter era feTurbulence(baseFreq=0.018, octaves=2) + feDisplacementMap.
     Resultado: cada capa releia el backbuffer por debajo de cada area de
     lente + procesaba turbulence — multiplica el costo por 7 en cada move.
   - Ahora: solo la LEAD lleva backdrop-filter. Los trails son halos
     radiales (composite layer, sin lectura de backbuffer). feTurbulence
     simplificado (baseFreq=0.04, octaves=1) → 2-3x mas barato.
   - Trail 6 → 3.
   - rAF se auto-pausa cuando el cursor esta quieto > 250ms.
   - Guards: solo si hover:hover + pointer:fine + width>=1024 + no
     prefers-reduced-motion. Mobile/touch nunca instancia el rAF.
   ============================================================================ */

import { useEffect, useRef, useState } from "react";

const LEAD_SIZE   = 80;
const TRAIL_COUNT = 3;
const LERP_LEAD   = 0.32;
const LERP_TRAIL  = 0.20;

export default function LiquidCursor() {
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 1024) return;
    setEnabled(true);

    let raf = 0;
    let tx = -LEAD_SIZE, ty = -LEAD_SIZE;
    let hidden = false;
    let lastMove = 0;

    const positions = Array.from(
      { length: TRAIL_COUNT + 1 },
      () => ({ x: -LEAD_SIZE, y: -LEAD_SIZE })
    );

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      lastMove = performance.now();
    };

    const loop = () => {
      positions[0].x += (tx - positions[0].x) * LERP_LEAD;
      positions[0].y += (ty - positions[0].y) * LERP_LEAD;
      for (let i = 1; i < positions.length; i++) {
        positions[i].x += (positions[i - 1].x - positions[i].x) * LERP_TRAIL;
        positions[i].y += (positions[i - 1].y - positions[i].y) * LERP_TRAIL;
      }
      refs.current.forEach((el, i) => {
        if (!el) return;
        const size = LEAD_SIZE - i * 14;
        el.style.transform = `translate3d(${positions[i].x - size / 2}px, ${positions[i].y - size / 2}px, 0)`;
      });

      /* Auto-pausa si lleva > 250ms sin movimiento y la lente ya converge. */
      const dx = tx - positions[0].x;
      const dy = ty - positions[0].y;
      const idle = performance.now() - lastMove > 250;
      if (idle && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) { raf = 0; return; }
      raf = requestAnimationFrame(loop);
    };

    const start = () => { if (!raf && !hidden) raf = requestAnimationFrame(loop); };
    const stop  = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    const onAnyMove = (e: MouseEvent) => { onMove(e); start(); };

    const onVis = () => { hidden = document.hidden; hidden ? stop() : start(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("mousemove", onAnyMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onAnyMove);
      document.removeEventListener("visibilitychange", onVis);
      stop();
    };
  }, []);

  if (!enabled) return null;

  return (
    <>
      <svg
        width="0"
        height="0"
        style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: -1 }}
        aria-hidden
      >
        <defs>
          <filter id="liquid-lens" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.04"
              numOctaves="1"
              seed="4"
              result="turb"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="turb"
              scale="40"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {Array.from({ length: TRAIL_COUNT + 1 }, (_, i) => {
        const size = LEAD_SIZE - i * 14;
        const isLead = i === 0;
        return (
          <div
            key={i}
            ref={(el) => { refs.current[i] = el; }}
            aria-hidden
            className="liquid-cursor"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: size,
              height: size,
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 40 - i,
              backdropFilter: isLead ? "url(#liquid-lens)" : "none",
              WebkitBackdropFilter: (isLead ? "url(#liquid-lens)" : "none") as any,
              background: isLead
                ? "transparent"
                : `radial-gradient(circle, rgba(255,220,200,${0.18 - i * 0.04}) 0%, transparent 70%)`,
              boxShadow: isLead
                ? "0 0 30px 4px rgba(255, 220, 200, 0.18), inset 0 0 0 1px rgba(255,255,255,0.08)"
                : "none",
              willChange: "transform",
            }}
          />
        );
      })}
    </>
  );
}
