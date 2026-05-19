"use client";

/* ============================================================================
   COLLECTIONS — Oraniths
   Sección con paleta INVERTIDA (peach claro + negro). Layout 3-columnas:

     ┌─────────────────────────────────────────────────────────────┐
     │  META            ┌──────────┐         INDEX  .01            │
     │  // CHANNEL      │          │         ┌────────┐            │
     │  STATUS: ACTIVE  │  ACTIVE  │         │DISCOVER│            │
     │  (system text)   │  CIRCLE  │         └────────┘            │
     │                  │          │         description…          │
     │                  └──────────┘                                │
     │                                                              │
     │  ORANITHS (big rotated)            [card] [card] [card] [card]
     └─────────────────────────────────────────────────────────────┘

   - El círculo central muestra la imagen del item activo.
   - Las 4 miniaturas abajo a la derecha funcionan como navegador
     (click → cambia el item activo).
   - Background con dot-grid sutil.
   - FrameBorder alrededor.
   - X scatter difuso.

   Editar items: data/site.ts → collections.items.
   ============================================================================ */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { site } from "@/data/site";
import FrameBorder from "./FrameBorder";
import XDecoration from "./XDecoration";
import DiscoverButton from "./DiscoverButton";

/* Etiquetas de meta-texto genéricas — categorías de "campos del sistema",
   tipo dashboard cyberpunk. Cambiar libremente. */
const LEFT_META = [
  { label: "// CHANNEL",   value: "ORANITHS" },
  { label: "STATUS",       value: "ACTIVE" },
  { label: "MODE",         value: "DISPLAY" },
  { label: "SIGNAL",       value: "STABLE" },
];

const CENTER_META = [
  { label: "CLASS",        value: "CAPSULE" },
  { label: "PALETTE",      value: "PEACH" },
  { label: "MATERIAL",     value: "TECH FIBER" },
  { label: "RELEASE",      value: "AW / 01" },
];

export default function Collections() {
  const items  = site.collections.items;
  const [active, setActive] = useState(0);
  const current = items[active];

  return (
    <section
      id="section-collections"
      className="bg-dich-peach"
      style={{
        position: "relative",
        padding: "var(--space-2xl) var(--container-pad) var(--space-lg)",
        overflow: "hidden",
      }}
    >

      {/* X decorations difusas */}
      <XDecoration seed={3} count={16} color="var(--color-peach-line)" />

      {/* Frame de la sección */}
      <FrameBorder
        color="var(--color-peach-line)"
        inset={16}
        corner={48}
        gap={12}
      />

      {/* Thumbnails en esquina superior derecha — navegador de items */}
      <div
        style={{
          position: "absolute",
          top: "calc(var(--space-md) + 16px)",
          right: "calc(var(--container-pad) + 16px)",
          display: "flex",
          gap: "var(--space-xs)",
          zIndex: 3,
        }}
      >
        {items.map((it, i) => (
          <div
            key={it.id}
            style={{
              position: "relative",
              display: "inline-block",
              lineHeight: 0,
            }}
          >
            <button
              onClick={() => setActive(i)}
              aria-label={`Show ${it.name}`}
              style={{
                display: "block",
                width: "clamp(48px, 5vw, 76px)",
                aspectRatio: "3 / 4",
                borderRadius: 4,
                background: "var(--color-bg)",
                backgroundImage: `url(${it.image})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                border:
                  i === active
                    ? "2px solid var(--color-peach-fg)"
                    : "1px solid var(--color-peach-line)",
                cursor: "pointer",
                transition: "transform var(--speed-fast), border-color var(--speed-fast)",
                transform: i === active ? "translateY(-3px)" : "translateY(0)",
                padding: 0,
                margin: 0,
              }}
            />

            <span
              style={{
                position: "absolute",
                bottom: 4,
                right: 4,
                fontFamily: "var(--font-mono)",
                fontSize: "0.6rem",
                fontWeight: 700,
                background: "var(--color-peach-fg)",
                color: "var(--color-peach-bg)",
                padding: "2px 5px",
                letterSpacing: "0.08em",
                borderRadius: 2,
                lineHeight: 1,
                pointerEvents: "none",
                zIndex: 2,
              }}
            >
              0{i + 1}
            </span>
          </div>
        ))}
      </div>

      {/* ============= GRID PRINCIPAL ============= */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "1fr 1.6fr 1fr",
          gap: "var(--space-md)",
          alignItems: "start",
          minHeight: "70vh",
        }}
      >
        {/* ----- COLUMNA IZQUIERDA: meta tipo código ----- */}
        <div style={{ display: "grid", gap: "var(--space-md)" }}>
          {LEFT_META.map((m) => (
            <div key={m.label}>
              <div
                className="system-text"
                style={{ color: "var(--color-peach-mute)" }}
              >
                {m.label}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.85rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 4,
                }}
              >
                {m.value}
              </div>
            </div>
          ))}

          {/* Bloque de "código" compacto en el medio */}
          <pre
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.72rem",
              color: "var(--color-peach-fg)",
              lineHeight: 1.7,
              letterSpacing: "0.02em",
              marginTop: "var(--space-md)",
            }}
          >
{`<section.collection
  index="${current.id}"
  channel="oraniths"
  status="active"
  release="aw/01"
/>`}
          </pre>
        </div>

        {/* ----- COLUMNA CENTRO: círculo negro con item activo ----- */}
        <div
          style={{
            position: "relative",
            display: "grid",
            placeItems: "center",
          }}
        >
          {/* Meta superior del círculo */}
          <div
            className="system-text"
            style={{
              color: "var(--color-peach-mute)",
              marginBottom: "var(--space-sm)",
              alignSelf: "start",
            }}
          >
            +++ DICH // COLLECTIONS
          </div>

          {/* CÍRCULO */}
          <div
            style={{
              position: "relative",
              width: "min(70vh, 600px)",
              aspectRatio: "1",
              borderRadius: "50%",
              background: "var(--color-bg)",
              border: "1px solid var(--color-peach-line)",
              overflow: "hidden",
              boxShadow: "0 30px 80px -20px rgba(0,0,0,0.4)",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundImage: `url(${current.image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  filter: "saturate(1.05)",
                }}
              />
            </AnimatePresence>

            {/* Línea ecuatorial decorativa muy sutil */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0, right: 0, top: "50%",
                height: 1,
                background: "rgba(244,169,130,0.25)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Coordenadas debajo del círculo */}
          <div
            className="system-text"
            style={{
              marginTop: "var(--space-sm)",
              color: "var(--color-peach-mute)",
            }}
          >
            X.{(active * 75).toString().padStart(4, "0")}  //  Y.{(active * 119).toString().padStart(4, "0")}
          </div>
        </div>

        {/* ----- COLUMNA DERECHA: index + CTA + copy ----- */}
        <div
          style={{
            display: "grid",
            gap: "var(--space-md)",
            /* Padding-top ~4cm para bajar todo el bloque (eyebrow + index
               + Discover + copy) por debajo de la altura de los thumbs y
               dar respiracion vertical con el circulo central.            */
            paddingTop: "clamp(80px, 12vw, 150px)",
          }}
        >
          <div className="system-text" style={{ color: "var(--color-peach-mute)" }}>
            {site.collections.eyebrow}
          </div>

          {/* Index grande */}
          <div
            style={{
              fontFamily: "var(--font-marquee)",
              fontWeight: 900,
              fontSize: "clamp(4rem, 9vw, 8rem)",
              lineHeight: 0.85,
              letterSpacing: "-0.04em",
              color: "var(--color-peach-fg)",
            }}
          >
            .{current.id}
          </div>

          {/* CTA Discover */}
          <DiscoverButton label="Discover" href={`#collection-${current.id}`} />

          {/* Description */}
          <p
            style={{
              maxWidth: 320,
              fontSize: "0.95rem",
              lineHeight: 1.5,
              color: "var(--color-peach-fg)",
              marginTop: "var(--space-sm)",
            }}
          >
            {site.collections.items[active].caption}. Limited capsule release —
            engineered silhouettes from recycled tech-fibers, documented and
            versioned for the wearer.
          </p>
        </div>
      </div>

      {/* ============= FOOTER DE LA SECCIÓN: solo título rotado ============= */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          marginTop: "var(--space-xl)",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "end",
        }}
      >
        {/* Título "Oraniths" rotado 180° */}
        <h2
          style={{
            fontFamily: "var(--font-marquee)",
            fontWeight: 900,
            fontSize: "clamp(2.5rem, 7vw, 7rem)",
            lineHeight: 0.85,
            letterSpacing: "-0.04em",
            transform: "rotate(180deg)",
            color: "var(--color-peach-fg)",
            margin: 0,
          }}
        >
          {site.collections.title.toUpperCase()}
        </h2>
      </div>
    </section>
  );
}
