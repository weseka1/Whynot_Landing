"use client";

/* ============================================================================
   DISCOVER BUTTON (chunky multi-layer)
   Construido con 3 capas CSS para imitar el look "joystick" / botón 3D del
   referente: base (sombra), block (cuerpo), face (etiqueta).

   Layers (de abajo hacia arriba):
     ┌────── base ────────┐   ← sombra/borde inferior, color oscuro
     │ ┌── block ───────┐ │   ← cuerpo principal, accent color
     │ │ ┌─ face ─────┐ │ │   ← cara superior con texto + flecha
     │ │ │ ↗ DISCOVER │ │ │
     │ │ └────────────┘ │ │
     │ └────────────────┘ │
     └────────────────────┘

   Al hover: el block "se hunde" — la sombra desaparece y la face baja
   levemente, sensación de press.
   ============================================================================ */

import { motion } from "framer-motion";

type Props = {
  label: string;
  href: string;
};

export default function DiscoverButton({ label, href }: Props) {
  return (
    <motion.a
      href={href}
      whileTap={{ y: 3 }}
      transition={{ type: "spring", stiffness: 360, damping: 20 }}
      className="discover-btn"
      style={{
        position: "relative",
        display: "inline-block",
        fontFamily: "var(--font-mono)",
        fontSize: "0.85rem",
        letterSpacing: "0.18em",
        textTransform: "uppercase",
      }}
    >
      {/* BASE — sombra inferior (la "patita" del botón) */}
      <span
        className="discover-base"
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          translate: "0 5px",
          borderRadius: "var(--radius-pill)",
          background: "var(--color-bg-2)",
          border: "1px solid var(--color-line)",
          transition: "translate var(--speed-fast) var(--ease-out)",
        }}
      />

      {/* BLOCK — cuerpo amarillo/accent */}
      <span
        className="discover-block"
        style={{
          position: "relative",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.6em",
          padding: "14px 24px",
          borderRadius: "var(--radius-pill)",
          background: "var(--color-accent)",
          color: "var(--color-bg)",
          border: "1px solid var(--color-bg)",
          translate: "0 0",
          transition: "translate var(--speed-fast) var(--ease-out)",
        }}
      >
        {/* FACE — texto + flecha */}
        <span style={{ fontWeight: 700 }}>{label}</span>
        <svg
          width="22" height="14" viewBox="0 0 22 14"
          aria-hidden
          style={{ display: "block" }}
        >
          {/* Triple chevron ››› como el referente */}
          {[0, 7, 14].map((x) => (
            <path
              key={x}
              d={`M ${x} 1 L ${x + 5} 7 L ${x} 13`}
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="square"
            />
          ))}
        </svg>
      </span>

      <style jsx>{`
        .discover-btn:hover :global(.discover-base) {
          translate: 0 1px;
        }
        .discover-btn:hover :global(.discover-block) {
          translate: 0 3px;
        }
      `}</style>
    </motion.a>
  );
}
