"use client";

/* ============================================================================
   COLLECTION BLOCK
   Bloque visual de una colección individual (Oraniths, Anturax, etc).
   Animación: la imagen entra con un fade+scale cuando aparece en viewport.
   ============================================================================ */

import { motion } from "framer-motion";

type CollectionData = {
  id: string;
  index: string;
  name: string;
  tag: string;
  copy: string;
  image: string;
  accent: string;
};

type Props = { data: CollectionData; reverse?: boolean };

export default function CollectionBlock({ data, reverse }: Props) {
  return (
    <article
      id={`collection-${data.id}`}
      className="hairline-top"
      style={{
        padding: "var(--space-lg) var(--container-pad)",
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gap: "var(--space-md)",
        alignItems: "center",
        direction: reverse ? "rtl" : "ltr",
      }}
    >
      {/* Imagen */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{
          gridColumn: "1 / span 7",
          aspectRatio: "4 / 5",
          background: `linear-gradient(135deg, ${data.accent}22, var(--color-line))`,
          backgroundImage: `url(${data.image})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          border: "1px solid var(--color-line)",
          direction: "ltr",
        }}
      />

      {/* Meta lateral */}
      <div
        style={{
          gridColumn: "8 / span 5",
          direction: "ltr",
          display: "grid",
          gap: "var(--space-md)",
        }}
      >
        <div
          className="system-text"
          style={{ display: "flex", justifyContent: "space-between" }}
        >
          <span>COLLECTION / {data.index}</span>
          <span>{data.tag}</span>
        </div>

        <h3
          className="display"
          style={{
            fontSize: "clamp(2.5rem, 6vw, 5rem)",
            color: data.accent,
          }}
        >
          {data.name}
        </h3>

        <p style={{ color: "var(--color-muted)", maxWidth: 360 }}>{data.copy}</p>

        <a
          href={`#collection-${data.id}`}
          className="system-text"
          style={{
            padding: "12px 20px",
            border: "1px solid var(--color-fg)",
            borderRadius: "var(--radius-pill)",
            display: "inline-block",
            width: "fit-content",
            transition: "background var(--speed-fast), color var(--speed-fast)",
          }}
        >
          VIEW DROP ↗
        </a>
      </div>
    </article>
  );
}
