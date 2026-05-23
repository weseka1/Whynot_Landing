"use client";

/* ============================================================================
   MISSION — 4 pilares con texto a la izquierda y un MONO 3D embedded a la
   derecha de cada pilar.

   Layout:
     - Título arriba: 100vh, "Our Mission"
     - 4 pilares 100vh stack vertical:
         · texto a la izquierda
         · mono 3D a la derecha (in-DOM, NO sticky)
     - Cada mono dispara su animacion una vez al entrar al viewport.
       Cuando el pilar sale del viewport por arriba, el mono se va con el.

   El approach sticky-overlay anterior se descarto — el usuario queria que
   el mono se DESPLACE con el pilar (parte del DOM, no fixed al viewport).
   ============================================================================ */

import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { site } from "@/data/site";
import XDecoration from "./XDecoration";

/* MissionPillarMonkey: 1 canvas R3F por pilar, dispara animacion al entrar
   al viewport (>= 30% visible). Cargado lazy + SSR off porque three.js
   solo corre en el browser. */
const MissionPillarMonkey = dynamic(() => import("./MissionPillarMonkey"), {
  ssr: false,
  loading: () => null,
});

export default function Mission() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      id="section-mission"
      ref={sectionRef}
      style={{
        position: "relative",
        background: "#cdb5f0",
        color: "#0a0a14",
      }}
    >
      <XDecoration seed={7} count={20} />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Título arriba — minHeight 100vh, vertical-centrado. */}
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "var(--space-md) var(--container-pad)",
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
          {site.mission.subtitle && (
            <p
              style={{
                marginTop: "var(--space-md)",
                maxWidth: 520,
                fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
                lineHeight: 1.5,
                color: "rgba(10,10,20,0.7)",
              }}
            >
              {site.mission.subtitle}
            </p>
          )}
        </div>

        {/* 4 pilares: texto a la izquierda (50%), mono 3D a la derecha (50%).
            Cada pilar se autoanima al entrar al viewport. Layout flex
            two-column con vertical-center del texto. */}
        {site.mission.pillars.map((p) => (
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
              alignItems: "stretch",
              borderTop: "1px solid var(--color-line)",
            }}
          >
            {/* COLUMNA IZQUIERDA — texto del pilar (vertical-centered). */}
            <div
              data-pillar-text
              style={{
                flex: "1 1 50%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingInline: "var(--container-pad)",
                textAlign: "left",
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
                  maxWidth: 600,
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
                }}
              >
                {p.copy}
              </p>
            </div>

            {/* COLUMNA DERECHA — mono 3D embedded en el pilar. Se desplaza
                con el scroll (no es sticky); cada instancia dispara su
                animacion cuando este pilar entra al viewport. */}
            <div
              data-pillar-monkey
              style={{
                flex: "1 1 50%",
                position: "relative",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <MissionPillarMonkey />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
