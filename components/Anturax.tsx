"use client";

/* ============================================================================
   ANTURAX
   Sección con toggle DARK / LIGHT que invierte el tema localmente.
   Editar texto en data/site.ts → anturax.
   ============================================================================ */

import { useState } from "react";
import { motion } from "framer-motion";
import { site } from "@/data/site";
import CornerFrame from "./CornerFrame";

export default function Anturax() {
  const [on, setOn] = useState(false);

  // Estilo dinámico según el toggle — paleta DICH (peach / lavender)
  const themed = on
    ? { bg: "#d9d3ff",                  fg: "var(--color-peach-fg)", muted: "rgba(7,7,7,0.6)" }  // lavender (DICH anturax)
    : { bg: "var(--color-peach-bg)",    fg: "var(--color-peach-fg)", muted: "rgba(7,7,7,0.6)" }; // peach base

  return (
    <section
      id="section-anturax"
      className="section"
      style={{
        position: "relative",
        backgroundColor: themed.bg,
        backgroundImage: "var(--dots-pink-100)",
        backgroundSize: "var(--dots-pink-100-size)",
        color: themed.fg,
        transition: "background-color var(--speed-base), color var(--speed-base)",
      }}
    >
      <CornerFrame position="top-left"     size={48} color={themed.fg} />
      <CornerFrame position="top-right"    size={48} color={themed.fg} />
      <CornerFrame position="bottom-left"  size={48} color={themed.fg} />
      <CornerFrame position="bottom-right" size={48} color={themed.fg} />

      <div
        className="container-full anturax-content"
        style={{
          position: "relative",
          textAlign: "center",
          display: "grid",
          gap: "var(--space-md)",
        }}
      >
        <span className="system-text" style={{ color: themed.muted }}>
          {site.anturax.eyebrow}
        </span>

        <motion.h2
          className="display"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8 }}
          style={{ fontSize: "clamp(5rem, 18vw, 16rem)", lineHeight: 0.9 }}
        >
          {site.anturax.title}
        </motion.h2>

        <p style={{ color: themed.muted, maxWidth: 420, margin: "0 auto" }}>
          {site.anturax.copy}
        </p>

        {/* Toggle switch grande */}
        <button
          onClick={() => setOn(!on)}
          aria-pressed={on}
          aria-label="Toggle theme"
          style={{
            margin: "var(--space-md) auto 0",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
            padding: "10px 16px",
            border: `1px solid ${themed.fg}`,
            borderRadius: "var(--radius-pill)",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ opacity: on ? 0.4 : 1 }}>{site.anturax.toggle.off}</span>
          <span
            style={{
              width: 42,
              height: 22,
              borderRadius: "var(--radius-pill)",
              background: themed.fg,
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 2,
                left: on ? 22 : 2,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: themed.bg,
                transition: "left var(--speed-fast)",
              }}
            />
          </span>
          <span style={{ opacity: on ? 1 : 0.4 }}>{site.anturax.toggle.on}</span>
        </button>
      </div>
    </section>
  );
}
