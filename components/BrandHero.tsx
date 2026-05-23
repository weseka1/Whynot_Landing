"use client";

/* ============================================================================
   BRAND HERO — encabezado editorial gigante de la brand page
   Marca como título italic gigante + counters técnicos en lila DICH.
   ============================================================================ */

import { motion } from "framer-motion";
import MonoMascot from "./MonoMascot";

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

      {/* Brand title — flow normal, ocupa todo el ancho del padre.
          El MonoMascot se posiciona ABSOLUTO a la derecha (ver más abajo)
          para no robarle ancho al título.                                 */}
      <motion.h1
        initial={{ opacity: 0, y: 30, filter: "blur(20px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        style={{
          fontFamily: "var(--font-marquee)",
          fontSize: "clamp(3rem, 10vw, 10rem)",
          lineHeight: 0.88,
          letterSpacing: "0.02em",
          color: DARK,
          margin: 0,
          /* paddingRight reserva espacio horizontal por si el título es muy
             largo (e.g. LOUIS VUITTON) y queremos que no se solape con el
             mascot. ~600px = 540 ancho del mono + un poco de aire.         */
          paddingRight: "clamp(0px, 34vw, 600px)",
          fontWeight: 700,
          textTransform: "uppercase",
          overflowWrap: "anywhere",
        }}
      >
        {brandName}
      </motion.h1>

      {/* Mono mascot 3D — portrait (540x830 ≈ 30% más grande que 416x650).
          top -10rem para que el body bottom termine justo en el divider line
          bajo el counter strip (DISPLAYING ...) — no sigue hacia abajo dentro
          del grid de cards.
          En mobile pasa a position static + tamaño reducido vía media.        */}
      <motion.div
        className="brand-mascot"
        initial={{ opacity: 0, scale: 0.85, x: 24 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "absolute",
          top: "-10rem",
          right: "2.5rem",
          zIndex: 6,
        }}
      >
        <MonoMascot width={540} height={830} radius="110%" />
      </motion.div>

      <style jsx>{`
        @media (max-width: 768px) {
          .brand-mascot {
            position: static !important;
            margin: 1.5rem auto 0;
            display: block !important;
          }
          .brand-mascot > div {
            width: 340px !important;
            height: 520px !important;
          }
        }
      `}</style>

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
