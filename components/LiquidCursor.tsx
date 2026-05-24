"use client";

/* ============================================================================
   LIQUID CURSOR v2 — versión optimizada
   - Antes: 7 capas (lead + 6 trail) c/u con backdrop-filter: url(#liquid-lens)
     donde liquid-lens = feTurbulence + feDisplacementMap. Cada capa
     re-procesaba el pixel buffer bajo su área → 7 lecturas/escrituras por
     frame del backbuffer + feTurbulence (de los SVG filters más caros).
     Repintaba sobre TODO el viewport en cada mousemove. GPU choked.
   - Ahora: SOLO el lead lleva backdrop-filter; los trails son halos
     radiales con box-shadow (composite layer, prácticamente gratis).
     feTurbulence simplificado (baseFrequency más alta, numOctaves=1).
     Trail reducido de 6 → 3.
   - Auto-disable si:
     · touch device (hover:none / pointer:coarse)
     · prefers-reduced-motion
     · viewport mobile (< 1024px) — extra guard, además del media query
       de CSS, evita siquiera correr el rAF en tablets/móviles.
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

    /* Guards: solo hover-fine + sin reduced-motion + >= 1024px */
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 1024) return;
    setEnabled(true);

    let raf = 0;
    let tx = -LEAD_SIZE, ty = -LEAD_SIZE;
    let hidden = false;
    let moved = false;
    let lastMove = 0;

    const positions = Array.from(
      { length: TRAIL_COUNT + 1 },
      () => ({ x: -LEAD_SIZE, y: -LEAD_SIZE })
    );

    const onMove = (e: MouseEvent) => {
      tx = e.clientX;
      ty = e.clientY;
      moved = true;
      lastMove = performance.now();
    };

    const loop = () => {
      /* Idle skip: si no hubo movimiento ni el lead llegó al destino,
         seguimos animando hasta converger; luego paramos el rAF.       */
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

      /* Auto-pausa: si pasaron > 250ms sin mousemove y la lead alcanzó al
         target (delta < 0.5px), detenemos el rAF hasta el próximo move. */
      const dx = tx - positions[0].x;
      const dy = ty - positions[0].y;
      const idle = performance.now() - lastMove > 250;
      if (idle && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => { if (!raf && !hidden) raf = requestAnimationFrame(loop); };
    const stop  = () => { if (raf) { cancelAnimationFrame(raf); raf = 0; } };

    const onAnyMove = (e: MouseEvent) => { onMove(e); start(); };

    const onVis = () => {
      hidden = document.hidden;
      hidden ? stop() : start();
    };
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
      {/* Filtro SVG simplificado: numOctaves=1, baseFrequency más alta
          → 2-3x más barato que la versión anterior. Solo se usa en la
          lente principal (no en los trails). */}
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

      {/* Lead — el único con backdrop-filter (caro). */}
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
              // Solo la lead lleva el filtro pesado:
              backdropFilter: isLead ? "url(#liquid-lens)" : "none",
              WebkitBackdropFilter: isLead ? "url(#liquid-lens)" : "none" as any,
              // Los trails son halos radiales gratis (composite layer)
              background: isLead
                ? "transparent"
                : `radial-gradient(circle, rgba(255,220,200,${0.18 - i * 0.04}) 0%, transparent 70%)`,
              boxShadow: isLead
                ? "0 0 30px 4px rgba(255, 220, 200, 0.18), inset 0 0 0 1px rgba(255,255,255,0.08)"
                : "none",
              willChange: "transform",
              contain: "layout paint",
            }}
          />
        );
      })}
    </>
  );
}
