"use client";

/* ============================================================================
   PANEL DROPS — productos cargados desde el panel (BairesContro), en vivo.
   ----------------------------------------------------------------------------
   Se monta en la brand page y muestra, ARRIBA del archivo estático, los
   productos que se cargaron desde el panel para esa marca. Lee Supabase en el
   cliente (la web es export estático), así que aparecen sin re-buildear.

   Si no hay productos del panel para la marca, no renderiza nada (null) → no
   afecta el layout existente.
   ============================================================================ */

import { useEffect, useState } from "react";
import ColorwayCard from "./ColorwayCard";
import { fetchPanelProducts, type PanelProduct } from "@/data/landingProducts";

const DARK = "#0a0a14";
const YELLOW = "#f4dc3f";

export default function PanelDrops({ brandSlug }: { brandSlug?: string }) {
  const [items, setItems] = useState<PanelProduct[]>([]);

  useEffect(() => {
    let alive = true;
    fetchPanelProducts(brandSlug).then((rows) => {
      if (alive) setItems(rows);
    });
    return () => {
      alive = false;
    };
  }, [brandSlug]);

  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: "2.5rem" }}>
      {/* Encabezado de sección */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          marginBottom: "1.2rem",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.7rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: DARK,
          fontWeight: 700,
        }}
      >
        <span style={{ color: YELLOW, textShadow: "0 0 8px rgba(244,220,63,0.6)" }}>◆</span>
        NUEVOS INGRESOS
        <span style={{ flex: 1, height: 1, background: "rgba(10,10,20,0.2)" }} />
        <span style={{ opacity: 0.6 }}>{items.length}</span>
      </div>

      {/* Grid responsive (mismo encuadre que el catálogo) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1.4rem",
        }}
      >
        {items.map((p) => (
          // El detalle 360 no existe para productos del panel (foto única):
          // la card abre la imagen en grande.
          <ColorwayCard key={p.path} entry={p} href={p.imageUrl} />
        ))}
      </div>
    </section>
  );
}
