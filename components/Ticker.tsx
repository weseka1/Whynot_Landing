"use client";

/* ============================================================================
   TICKER (legacy — el ticker principal ahora vive dentro de Collections).
   Mantenido por compatibilidad. No se monta en page.tsx por defecto.
   ============================================================================ */

import { site } from "@/data/site";

export default function Ticker() {
  const words = [
    site.collections.ticker,
    site.collections.ticker,
    site.collections.ticker,
  ];

  return (
    <section
      aria-hidden
      className="hairline-bottom"
      style={{
        padding: "var(--space-md) 0",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "var(--space-lg)",
          width: "max-content",
          animation: `marquee var(--speed-ticker) linear infinite`,
        }}
      >
        {words.map((w, i) => (
          <span
            key={i}
            className="display"
            style={{
              fontSize: "clamp(2rem, 6vw, 5rem)",
              whiteSpace: "nowrap",
              color: i % 2 === 0 ? "var(--color-fg)" : "var(--color-accent)",
            }}
          >
            {w} ✦
          </span>
        ))}
      </div>
    </section>
  );
}
