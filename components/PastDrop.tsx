"use client";

/* ============================================================================
   PAST DROP  (Sirius)
   - Card destacada con imagen + nombre del drop + coordenadas astronómicas.
   - Grid de "badges" (estrellitas) tipo telemetría.
   Editar en data/site.ts → pastDrop.
   ============================================================================ */

import { motion } from "framer-motion";
import { site } from "@/data/site";
import CornerFrame from "./CornerFrame";
import XDecoration from "./XDecoration";

export default function PastDrop() {
  const { drop, badgeCount, eyebrow, title } = site.pastDrop;

  return (
    <section
      id="section-past-drop"
      className="section bg-dich-peach-flat"
      style={{ position: "relative" }}
    >
      <XDecoration seed={11} count={18} color="var(--color-peach-line)" />

      <div className="container-full" style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            marginBottom: "var(--space-lg)",
            flexWrap: "wrap",
            gap: "var(--space-md)",
          }}
        >
          <div>
            <span className="system-text">{eyebrow}</span>
            <h2
              className="display"
              style={{ fontSize: "clamp(3rem, 10vw, 9rem)", marginTop: "var(--space-sm)" }}
            >
              {title}
            </h2>
          </div>
        </div>

        {/* Card destacada del drop */}
        <motion.article
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8 }}
          style={{
            position: "relative",
            background: "var(--color-bg-2)",
            border: "1px solid var(--color-line)",
            padding: "var(--space-lg)",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "var(--space-md)",
            alignItems: "center",
          }}
        >
          <CornerFrame position="top-left"     size={28} />
          <CornerFrame position="top-right"    size={28} />
          <CornerFrame position="bottom-left"  size={28} />
          <CornerFrame position="bottom-right" size={28} />

          {/* Imagen del drop */}
          <div
            style={{
              gridColumn: "1 / span 5",
              aspectRatio: "1",
              background: "var(--color-bg)",
              backgroundImage: `url(${drop.image})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: "1px solid var(--color-line)",
              filter: "saturate(0.85)",
            }}
          />

          {/* Meta del drop */}
          <div style={{ gridColumn: "7 / span 6", display: "grid", gap: "var(--space-md)" }}>
            <div className="system-text" style={{ color: "var(--color-accent)" }}>
              FEATURED DROP · {drop.season}
            </div>
            <h3
              className="display"
              style={{
                fontSize: "clamp(3rem, 8vw, 7rem)",
                color: "var(--color-accent)",
              }}
            >
              {drop.name}
            </h3>
            <p className="system-text">
              COORD · {drop.coordinates}
            </p>
            <p style={{ color: "var(--color-muted)", maxWidth: 380 }}>{drop.copy}</p>
          </div>
        </motion.article>

        {/* Grid de badges */}
        <div
          aria-hidden
          style={{
            marginTop: "var(--space-lg)",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(80px, 1fr))",
            gap: "var(--space-sm)",
          }}
        >
          {Array.from({ length: badgeCount }, (_, i) => (
            <div
              key={i}
              style={{
                aspectRatio: "1",
                border: "1px solid var(--color-line)",
                display: "grid",
                placeItems: "center",
                color: "var(--color-accent)",
                fontFamily: "var(--font-mono)",
                fontSize: "0.7rem",
                background: "var(--color-bg-2)",
                animation: `floaty 4s ease-in-out ${i * 0.2}s infinite`,
              }}
            >
              ✦
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
