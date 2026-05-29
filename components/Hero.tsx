"use client";

/* ============================================================================
   HERO
   - Fondo: cielo PNG full-bleed.
   - Centerpiece: <model-viewer> GLB Mono 3D.
     • Sigue al mouse en eje X con rango ACOTADO (no rota libremente).
     • Empieza centrado (de frente) y vuelve al centro si el mouse sale.
     • Lerp para movimiento suave.
   - Marquee superior con PNG de "WHYNOT AMK EXCLUSIVE".
   - Botón Discover circular abajo a la derecha.
   - 4 corner frames decorativos.

   Tunear el seguimiento del mouse (constantes abajo en useEffect):
     - MAX_ANGLE → cuántos grados se permite hacia cada lado
     - POLAR     → ángulo vertical fijo (88 ≈ horizontal directo)
     - RADIUS    → distancia de cámara fija
     - LERP      → suavidad (0.05 muy amortiguado, 0.2 muy rápido)
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import { site } from "@/data/site";
import FrameBorder from "./FrameBorder";
import DiscoverButton from "./DiscoverButton";
import MarqueeBanner from "./MarqueeBanner";
import { mobileGLB } from "@/lib/mobileGLB";
import { useIsMobile } from "./useIsMobile";

export default function Hero() {
  const isMobile = useIsMobile();
  const modelRef = useRef<HTMLElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  /* mounted-gate: NO renderizamos el <model-viewer> en SSR. Solo en client,
     y ahi resolvemos la variant correcta (desktop vs mobile) en un solo
     fetch. Evita el patron de doble-download (cargar desktop primero,
     despues cancelar y cargar mobile). Costo: ~50ms de delay del model
     respecto al primer paint del Hero — el resto del Hero (sky bg, marquee,
     UI) ya esta visible para entonces, asi que se nota poco.            */
  const [glbSrc, setGlbSrc] = useState<string | null>(null);
  useEffect(() => {
    setGlbSrc(mobileGLB(site.hero.model));
  }, []);

  useEffect(() => {
    const MAX_ANGLE = 22;       // grados a cada lado (rango acotado)
    const POLAR     = 88;       // ángulo vertical (88 ≈ mirando de frente)
    const RADIUS    = "55%";    // distancia de cámara
    const LERP      = 0.08;     // suavidad del seguimiento

    let targetAngle  = 0;
    let currentAngle = 0;
    let raf = 0;
    let visible = true; // hero en viewport
    let hidden  = false; // tab oculta

    const updateFromX = (clientX: number) => {
      if (!visible || hidden) return;
      // Normalizamos clientX a [-1, 1] sobre el ancho del viewport.
      // Signo NEGADO: mouse/dedo a la izq → mono mira a la izq (sigue al cursor).
      const normalized = (clientX / window.innerWidth) * 2 - 1;
      targetAngle = -normalized * MAX_ANGLE;
    };

    const onMove = (e: MouseEvent) => updateFromX(e.clientX);

    /* Mobile: touch-driven. El usuario pidio que el mono responda al dedo
       de la misma forma que al mouse en desktop. Usamos el primer touch
       activo en touchmove (drag). En touchstart tambien actualizamos para
       que apenas tocas la pantalla el mono mire ahi, sin tener que mover
       el dedo primero. passive:true porque solo leemos clientX — no
       prevenimos el scroll vertical de la pagina.                          */
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      updateFromX(e.touches[0].clientX);
    };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return;
      updateFromX(e.touches[0].clientX);
    };

    // Si el mouse sale de la ventana / dedo se levanta, vuelve al centro
    const onLeave = () => { targetAngle = 0; };

    const loop = () => {
      currentAngle += (targetAngle - currentAngle) * LERP;
      const el = modelRef.current as any;
      if (el) {
        el.cameraOrbit = `${currentAngle.toFixed(2)}deg ${POLAR}deg ${RADIUS}`;
      }
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
    };

    /* IntersectionObserver: pausa el rAF cuando el Hero sale del viewport
       (el usuario ya esta scrolleando otras secciones). Reanuda al volver. */
    let io: IntersectionObserver | null = null;
    if (sectionRef.current && typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(
        ([entry]) => {
          visible = entry.isIntersecting;
          if (visible && !hidden) start();
          else stop();
        },
        { rootMargin: "100px" }
      );
      io.observe(sectionRef.current);
    }

    /* Visibility API: pausa cuando la tab esta oculta (background). */
    const onVis = () => {
      hidden = document.hidden;
      if (visible && !hidden) start();
      else stop();
    };
    document.addEventListener("visibilitychange", onVis);

    window.addEventListener("mousemove",  onMove,      { passive: true });
    window.addEventListener("mouseleave", onLeave,     { passive: true });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove",  onTouchMove, { passive: true });
    window.addEventListener("touchend",   onLeave,     { passive: true });
    window.addEventListener("touchcancel",onLeave,     { passive: true });
    start();

    return () => {
      window.removeEventListener("mousemove",   onMove);
      window.removeEventListener("mouseleave",  onLeave);
      window.removeEventListener("touchstart",  onTouchStart);
      window.removeEventListener("touchmove",   onTouchMove);
      window.removeEventListener("touchend",    onLeave);
      window.removeEventListener("touchcancel", onLeave);
      document.removeEventListener("visibilitychange", onVis);
      io?.disconnect();
      stop();
    };
  }, []);

  return (
    <section
      id="hero"
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        /* Hero queda FUERA del color sweep DICH (pedido del usuario):
           el efecto arranca desde Collections (Golden Goose) en adelante.
           Aca usamos el bg original solido — el sky-background image
           va por encima como div absolute interno, asi que el color de
           fondo casi no se ve.                                            */
        background: "var(--color-bg)",
      }}
    >
      {/* — Fondo cielo — */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${site.hero.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          opacity: 0.85,
          filter: "saturate(0.95) contrast(1.05)",
        }}
      />
      {/* — Viñeta — */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, var(--color-bg) 100%)",
          opacity: 0.5,
        }}
      />

      {/* — Marco completo: 4 esquinas + 4 lineas laterales — */}
      <FrameBorder color="var(--color-accent)" inset={14} corner={40} gap={10} />

      {/* — MARQUEE —
           Desktop: top -10vh, imageHeight clamp(5rem, 18vw, 18rem). Antes
           el imageHeight desktop era clamp(9rem, 38vw, 32rem) — en viewports
           anchos (1600px+) se renderizaba a ~608px de alto y las letras
           gigantes tapaban media pantalla. Bajamos a la mitad para que el
           WHYNOT se vea como cinta horizontal y no como mural. Mobile sigue
           con 16vh (~107px en 667vh, ya estaba bien proporcionado).        */}
      <div
        style={{
          position: "absolute",
          top: isMobile ? "-8vh" : "-10vh",
          left: 0,
          right: 0,
          zIndex: 2,
        }}
      >
        <MarqueeBanner
          image="/assets/marquee/whynot-text.webp"
          imageHeight={isMobile ? "16vh" : "clamp(5rem, 18vw, 18rem)"}
        />
      </div>

      {/* — Modelo 3D (mouse-driven) — */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: "8vh",
          zIndex: 3,
        }}
      >
        {glbSrc !== null && (
        /* @ts-ignore — web component */
        <model-viewer
          ref={modelRef}
          src={glbSrc}
          alt="3D centerpiece"
          disable-zoom
          shadow-intensity="0.5"
          shadow-softness="1"
          exposure="1.15"
          camera-orbit="0deg 88deg 55%"
          camera-target="0m 0.45m 0m"
          field-of-view="26deg"
          interaction-prompt="none"
          loading="eager"
          /* Draco decoder local — evita depender de gstatic CDN (que a veces
             no responde en redes mobile flojas y deja el modelo sin cargar). */
          draco-decoder-location="/draco/"
          style={{
            width:  "100%",
            height: "100%",
            background: "transparent",
          }}
        />
        )}
      </div>

      {/* — UI superpuesta — */}
      <div
        className="container-full"
        style={{
          position: "relative",
          zIndex: 4,
          minHeight: "100vh",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          paddingBlock: "calc(var(--space-xl) + 20px) var(--space-md)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
          }}
        >
          <span className="system-text" style={{ pointerEvents: "auto" }}>
            {site.hero.eyebrow}
          </span>
          <span className="system-text" style={{ pointerEvents: "auto" }}>
            {site.hero.metaRight}
          </span>
        </div>

        <div />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "end",
            gap: "var(--space-md)",
          }}
        >
          <p
            className="system-text"
            style={{
              maxWidth: 320,
              pointerEvents: "auto",
              color: "var(--color-fg)",
            }}
          >
            {site.hero.sub}
          </p>

          <div style={{ pointerEvents: "auto" }}>
            <DiscoverButton label={site.hero.discover} href="#section-collections" />
          </div>
        </div>
      </div>
    </section>
  );
}
