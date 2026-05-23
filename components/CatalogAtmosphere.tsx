"use client";

/* ============================================================================
   CATALOG ATMOSPHERE — capas visuales reutilizables para todas las páginas
   del catálogo (landing, brand showroom, colorway page).
   ----------------------------------------------------------------------------
   Colores base:
     LILAC      #cdb5f0 (fondo principal — pale lavender)
     DARK       #0a0a14 (texto / bordes)
     DARK_DIM   rgba(10,10,20,0.65) (texto ambient)
     YELLOW     #f4dc3f (DICH accent)
     CHROME     iridescent (linear-gradient violet→cyan→pink que rota lento)
   ----------------------------------------------------------------------------
   Componentes:
     <BgLayers fixed?>          → lila + dots + aurora drift
     <Scanlines />              → líneas horizontales 1px (textura CRT)
     <CornerBrackets />         → 4 marcas L grandes en las esquinas viewport
     <CursorGlow />             → halo lila que sigue al mouse
     <HoloBorder />             → borde animado iridescente (children inside)
   ============================================================================ */

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

export const LILAC = "#cdb5f0";
export const DARK = "#0a0a14";
export const DARK_DIM = "rgba(10,10,20,0.65)";
export const YELLOW = "#f4dc3f";

/* ============================================================================
   BgLayers — bg base lilac + dots + atmospheric drifts
   ============================================================================ */
export function BgLayers({ fixed = false }: { fixed?: boolean }) {
  const pos = fixed ? "fixed" : "absolute";
  return (
    <>
      {/* Base lilac solid */}
      <div
        aria-hidden
        style={{
          position: pos,
          inset: 0,
          background: LILAC,
          zIndex: 0,
        }}
      />
      {/* Dotted grid pattern (clásico DICH) */}
      <div
        aria-hidden
        style={{
          position: pos,
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(10,10,20,0.18) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Atmospheric pastel highlight drift */}
      <motion.div
        aria-hidden
        animate={{ x: [-40, 40, -40], y: [-25, 25, -25] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: pos,
          inset: -80,
          background:
            "radial-gradient(circle 700px at 30% 40%, rgba(255,240,255,0.32), transparent 60%)",
          filter: "blur(60px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Magenta-rosado accent drift */}
      <motion.div
        aria-hidden
        animate={{ x: [30, -30, 30], y: [20, -20, 20] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: pos,
          inset: -50,
          background:
            "radial-gradient(circle 500px at 70% 60%, rgba(220,140,200,0.32), transparent 65%)",
          filter: "blur(70px)",
          mixBlendMode: "multiply",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}

/* ============================================================================
   Scanlines — líneas horizontales tenues sobre todo el viewport (look CRT)
   ============================================================================ */
export function Scanlines() {
  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(10,10,20,0.045) 0px, rgba(10,10,20,0.045) 1px, transparent 1px, transparent 4px)",
        pointerEvents: "none",
        mixBlendMode: "multiply",
        zIndex: 40,
      }}
    />
  );
}

/* ============================================================================
   CornerBrackets — 4 marcas L grandes en las esquinas del viewport
   ============================================================================ */
export function CornerBrackets({ inset = 18 }: { inset?: number }) {
  const SZ = 28;
  const stroke = `1.5px solid ${DARK}`;
  const corners = [
    { top: inset, left: inset, borderTop: stroke, borderLeft: stroke },
    { top: inset, right: inset, borderTop: stroke, borderRight: stroke },
    { bottom: inset, left: inset, borderBottom: stroke, borderLeft: stroke },
    { bottom: inset, right: inset, borderBottom: stroke, borderRight: stroke },
  ] as React.CSSProperties[];
  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "fixed",
            width: SZ,
            height: SZ,
            pointerEvents: "none",
            zIndex: 35,
            ...c,
          }}
        />
      ))}
    </>
  );
}

/* ============================================================================
   CursorGlow — halo lila claro que sigue al mouse (efecto premium subtle)
   ============================================================================ */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = (e: MouseEvent) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        el.style.transform = `translate3d(${e.clientX - 200}px, ${e.clientY - 200}px, 0)`;
      });
    };
    window.addEventListener("mousemove", update);
    return () => {
      window.removeEventListener("mousemove", update);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 400,
        height: 400,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,240,255,0.10) 35%, transparent 70%)",
        mixBlendMode: "screen",
        pointerEvents: "none",
        zIndex: 5,
        willChange: "transform",
      }}
    />
  );
}

/* ============================================================================
   HoloBorder — borde iridescente animado para wrappear elementos activos.
   Usa una conic-gradient con violet→cyan→pink→yellow→violet que rota.
   Children van adentro de un wrapper, el borde se renderiza con mask.
   ============================================================================ */
export function HoloBorder({
  children,
  size = 2,
  radius = "50%",
  duration = 8,
  active = true,
}: {
  children: React.ReactNode;
  size?: number;
  radius?: string;
  duration?: number;
  active?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      {active && (
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute",
            inset: -size,
            borderRadius: radius,
            background:
              "conic-gradient(from 0deg, #c2a3ff, #6ed5ff, #ffb3e6, #f4dc3f, #c2a3ff)",
            padding: size,
            WebkitMask:
              "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
            zIndex: 0,
            pointerEvents: "none",
            opacity: 0.85,
          }}
        />
      )}
      {children}
    </div>
  );
}
