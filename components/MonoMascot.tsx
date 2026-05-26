"use client";

/* ============================================================================
   MONO MASCOT — model-viewer wrapper que reusa /assets/3d/mono.glb
   ----------------------------------------------------------------------------
   - Mira al frente por default
   - Sigue al mouse en eje Y (rota a izq/der según el lado donde está el cursor)
   - Lerp para movimiento suave (LERP 0.08)
   - IntersectionObserver: pausa el rAF cuando el mascot está fuera del viewport
   - Visibility API: pausa cuando la tab está oculta
   - El <script> de model-viewer y el preload del GLB ya están en app/layout.tsx
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import { mobileGLB } from "@/lib/mobileGLB";

/* GLB del MONO CUERPO COMPLETO 3D — ~377KB (optimizado: textures 192x192
   webp + Draco mesh compression + simplify 0.45). Antes pesaba 23.9MB, lo
   bajamos en sucesivas pasadas de gltf-transform. Para acelerar carga
   percibida en mobile:
     1. Lazy mount via IntersectionObserver (este componente).
     2. <link rel="preload"> en app/catalog/[brand]/page.tsx para que el
        browser empiece la descarga en paralelo con el JS bundle.
     3. /assets/* tiene Cache-Control immutable 1 ano en render.yaml. */
const GLB_SRC = "/assets/3d/mono-cuerpo-completo.glb";

type Props = {
  /** Diámetro del visor (cuadrado). Default 240px. Si pasás width/height, ignora. */
  size?: number;
  /** Ancho del visor en px. Override del size. */
  width?: number;
  /** Alto del visor en px. Override del size. Permite contenedores portrait/landscape. */
  height?: number;
  /** Ángulo vertical fijo (90 ≈ horizontal directo, mirando de frente). */
  basePolar?: number;
  /** Distancia de cámara — para body completo necesita más zoom-out. */
  radius?: string;
  /** Punto al que mira la cámara (compensa el centro del modelo). */
  cameraTarget?: string;
  /** Field of view en grados. Para body lleno un FOV mayor cabe mejor. */
  fov?: string;
  /** Rango máximo de rotación horizontal en grados (a cada lado). */
  maxAngle?: number;
  /** Smoothness del seguimiento — 0.05 amortiguado, 0.2 rápido. */
  lerp?: number;
};

export default function MonoMascot({
  size = 240,
  width,
  height,
  basePolar = 90,
  radius = "120%",
  cameraTarget = "0m 0.9m 0m",
  fov = "30deg",
  maxAngle = 55,
  lerp = 0.08,
}: Props) {
  const w = width ?? size;
  const h = height ?? size;
  const modelRef = useRef<HTMLElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let targetAngle = 0;
    let currentAngle = 0;
    let raf = 0;
    let visible = true; // mascot en viewport
    let hidden = false; // tab oculta

    const onMove = (e: MouseEvent) => {
      if (!visible || hidden) return;
      /* Normalizamos clientX a [-1, 1] sobre el ancho del viewport.
         Signo negado: cursor a la derecha → mono mira a la derecha (sigue). */
      const normalized = (e.clientX / window.innerWidth) * 2 - 1;
      targetAngle = -normalized * maxAngle;
    };
    const onLeave = () => {
      targetAngle = 0;
    };

    const loop = () => {
      currentAngle += (targetAngle - currentAngle) * lerp;
      const el = modelRef.current as any;
      if (el) {
        el.cameraOrbit = `${currentAngle.toFixed(2)}deg ${basePolar}deg ${radius}`;
      }
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    let io: IntersectionObserver | null = null;
    if (wrapperRef.current && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !hidden) start();
          else stop();
        },
        { rootMargin: "100px" }
      );
      io.observe(wrapperRef.current);
    }

    const onVis = () => {
      hidden = document.hidden;
      if (visible && !hidden) start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVis);

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave, { passive: true });
    start();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
      stop();
    };
  }, [basePolar, radius, maxAngle, lerp]);

  /* Lazy mount del <model-viewer>: solo cuando el wrapper entra (o ha
     entrado alguna vez) al viewport. Evita pagar la descarga de 23MB en
     brand pages que el usuario nunca llega a ver el mascot.                */
  const [shouldMount, setShouldMount] = useState(false);
  useEffect(() => {
    if (shouldMount) return;
    if (!wrapperRef.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldMount(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(wrapperRef.current);
    return () => io.disconnect();
  }, [shouldMount]);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: w,
        height: h,
        flexShrink: 0,
        position: "relative",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {!shouldMount ? null : (
      /* @ts-ignore — web component declarado en types/model-viewer.d.ts */
      <model-viewer
        ref={modelRef}
        src={mobileGLB(GLB_SRC)}
        alt="WHY NOT mono mascot"
        disable-zoom
        shadow-intensity="0"
        exposure="1.1"
        camera-orbit={`0deg ${basePolar}deg ${radius}`}
        camera-target={cameraTarget}
        field-of-view={fov}
        interaction-prompt="none"
        loading="eager"
        /* Draco decoder local — sin dependencia de gstatic CDN. */
        draco-decoder-location="/draco/"
        style={{
          width: "100%",
          height: "100%",
          background: "transparent",
        }}
      />
      )}
    </div>
  );
}
