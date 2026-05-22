"use client";

/* ============================================================================
   BRAND HERO — encabezado editorial gigante de la brand page
   Marca como título italic gigante + counters técnicos en lila DICH.
   ============================================================================ */

import { motion } from "framer-motion";

const DARK = "#0a0a14";
const DARK_DIM = "rgba(10,10,20,0.65)";
const YELLOW = "#f4dc3f";

type Props = {
  brandName: string;
  totalModels: number;
  totalColorways: number;
  total360: number;
};

export default function BrandHero({
  brandName,
  totalModels,
  totalColorways,
  total360,
}: Props) {
  return (
    <div
      style={{
        position: "relative",
        padding: "5rem 2.5rem 3rem",
        zIndex: 5,
      }}
    >
      {/* Vertical accent line a la izq */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: "5rem",
          left: "2.5rem",
          width: 1,
          height: 48,
          background:
            "linear-gradient(to bottom, transparent, rgba(10,10,20,0.7))",
        }}
      />

      {/* Eyebrow */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.7rem",
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: DARK_DIM,
          marginBottom: "0.8rem",
          marginLeft: "1.5rem",
          fontWeight: 600,
        }}
      >
        BRAND_ARCHIVE · {String(totalModels).padStart(2, "0")} MODELS ·{" "}
        {String(totalColorways).padStart(2, "0")} COLORWAYS
      </motion.div>

      {/* Brand title — huge editorial italic */}
      <motion.h1
        initial={{ opacity: 0, y: 30, filter: "blur(20px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="display"
        style={{
          fontStyle: "italic",
          fontSize: "clamp(3rem, 11vw, 11rem)",
          lineHeight: 0.88,
          letterSpacing: "-0.04em",
          color: DARK,
          margin: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {brandName}
      </motion.h1>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.3 }}
        style={{
          marginTop: "1.4rem",
          display: "flex",
          gap: "2.2rem",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.66rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: DARK_DIM,
        }}
      >
        <StatBlock label="SPECIMENS" value={String(totalColorways).padStart(3, "0")} accent />
        <StatBlock label="360° READY" value={String(total360).padStart(3, "0")} />
        <StatBlock label="STATIC" value={String(totalColorways - total360).padStart(3, "0")} />
        <StatBlock label="STATUS" value="ARCHIVED" />
      </motion.div>
    </div>
  );
}

function StatBlock({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span>{label}</span>
      <span
        style={{
          color: DARK,
          fontSize: "1.1rem",
          letterSpacing: "0.1em",
          fontWeight: accent ? 700 : 600,
          textShadow: accent ? `0 0 12px ${YELLOW}50` : "none",
        }}
      >
        {value}
      </span>
    </div>
  );
}
