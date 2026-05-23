"use client";

/* ============================================================================
   MISSION — 4 pilares con texto alternando lado, ESTRELLA DE 4 CAJAS 3D
   en lugar de la zapatilla.

   Layout:
     - Título arriba (eyebrow + "Our Mission")
     - 4 pilares stack vertical, cada uno 100vh:
         · .001 Source   → texto IZQ, cajas DER
         · .002 Build    → texto DER, cajas IZQ
         · .003 Release  → texto IZQ, cajas DER
         · .004 Archive  → texto DER, cajas IZQ
     - Estrella de cajas: sticky overlay, motion-driven X/scale/opacity.
       Rotación interna (Y axis del grupo + ejes propios de cada caja) la
       maneja MissionBoxes leyendo el smoothProgress.

   Fase 1 — POC: SIN drop-off (4 cajas siempre, formando estrella).
   ============================================================================ */

import { useRef } from "react";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { site } from "@/data/site";
import XDecoration from "./XDecoration";
import MissionBoxesClient from "./MissionBoxesClient";
import { useInViewport } from "./useInViewport";

export default function Mission() {
  const sectionRef = useRef<HTMLElement>(null);
  /* Lazy mount: hasta que la seccion no entra al viewport (con 400px de
     margen para precargar), no instanciamos el Canvas R3F. Eso evita
     descargar three+drei en el bundle inicial.                          */
  const { ref: viewportRef, hasBeenInView } = useInViewport<HTMLDivElement>({
    rootMargin: "400px",
  });

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });

  // Suavizamos el scroll-progress con spring → animaciones interpolan frames
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 80,
    damping: 22,
    mass: 0.9,
    restDelta: 0.0005,
  });

  /* El canvas ocupa el 100% del viewport: la alternancia izq/der y el
     drop-off de cada caja se manejan dentro del canvas (MissionBoxes),
     leyendo `smoothProgress` por frame. Acá solo aplicamos opacity fade
     al entrar/salir de la sección.                                       */
  const modelOpacity = useTransform(
    smoothProgress,
    [0, 0.08, 0.92, 1],
    [0, 1, 1, 0]
  );

  return (
    <section
      id="section-mission"
      ref={sectionRef}
      style={{
        position: "relative",
        background: "#cdb5f0", // pale lavender — match PastDrop / catalog pages
        color: "#0a0a14",      // texto dark para legibilidad sobre lavender
        /* SIN overflow:hidden — rompe el sticky */
      }}
    >
      <XDecoration seed={7} count={20} />

      {/* ============ STICKY 3D BOXES — overlay sobre toda la sección ============ */}
      <div
        ref={viewportRef}
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            height: "100vh",
            width: "100%",
          }}
        >
          <motion.div
            data-boxes-wrapper
            style={{
              position: "absolute",
              inset: 0,
              opacity: modelOpacity,
              willChange: "opacity",
            }}
          >
            {/* Lazy mount: hasta que la seccion no entra al viewport, no
                instanciamos el Canvas (evita descargar three+drei eager).
                scrollYProgress raw — MissionBoxes hace su propio smoothing
                temporal (POSITION_DAMP/OPACITY_DAMP). Usar smoothProgress acá
                era doble suavizado: la caja anclada se quedaba visible más
                tiempo del esperado.                                          */}
            {hasBeenInView && <MissionBoxesClient progress={scrollYProgress} />}
          </motion.div>
        </div>
      </div>

      {/* ============ CONTENIDO: título + 4 pilares alternados ============ */}
      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Título arriba */}
        <div
          style={{
            padding: "var(--space-2xl) var(--container-pad) var(--space-md)",
            maxWidth: "50%",
          }}
        >
          <span className="system-text">{site.mission.eyebrow}</span>
          <h2
            className="display"
            style={{
              fontSize: "clamp(3rem, 9vw, 8rem)",
              marginTop: "var(--space-sm)",
              color: "var(--color-accent)",
            }}
          >
            {site.mission.title}
          </h2>
        </div>

        {/* 4 pilares: cada uno 100vh, texto SIEMPRE a la izquierda — el
            mono mascot ocupa el lado derecho fijo (ver MissionMascot que
            tiene pillarSign devolviendo +1 para todos los pilares). */}
        {site.mission.pillars.map((p) => {
          const isRight = false;
          return (
            <motion.div
              key={p.id}
              data-pillar
              initial={{ opacity: 0, y: 60 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.35 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              style={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                paddingInline: "var(--container-pad)",
                justifyContent: isRight ? "flex-end" : "flex-start",
                borderTop: "1px solid var(--color-line)",
              }}
            >
              <div
                data-pillar-inner
                style={{
                  maxWidth: "42%",
                  textAlign: isRight ? "right" : "left",
                }}
              >
                <span
                  className="system-text"
                  style={{
                    color: "var(--color-accent)",
                    marginBottom: "var(--space-sm)",
                    fontSize: "1.4rem",
                    display: "block",
                  }}
                >
                  {p.id}
                </span>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "clamp(2.5rem, 6vw, 5rem)",
                    lineHeight: 0.95,
                    marginBottom: "var(--space-md)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {p.label}
                </h3>
                <p
                  style={{
                    fontSize: "1.1rem",
                    lineHeight: 1.55,
                    color: "var(--color-muted)",
                    maxWidth: 460,
                    marginLeft: isRight ? "auto" : 0,
                  }}
                >
                  {p.copy}
                </p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
