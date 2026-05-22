/* ============================================================================
   CATALOG PRODUCT PAGE — /catalog/[brand]/[model]/[colorway]
   ----------------------------------------------------------------------------
   Server-rendered: layout + metadata + bg layers (server component).
   Client: <Frame360Viewer> (interacciones drag/wheel/keyboard).
   Estética: lilac DICH + atmósfera ultra-futurista (scanlines, brackets, glow).
   ============================================================================ */

import { notFound } from "next/navigation";
import { getAllEntries, getEntryBySlug } from "@/data/catalog";
import Frame360Viewer from "@/components/Frame360Viewer";
import BackButton from "@/components/BackButton";
import {
  BgLayers,
  Scanlines,
  CornerBrackets,
  CursorGlow,
  LILAC,
  DARK,
  DARK_DIM,
  YELLOW,
} from "@/components/CatalogAtmosphere";

type Params = {
  params: Promise<{
    brand: string;
    model: string;
    colorway: string;
  }>;
};

/* Pre-genera todas las rutas válidas del catálogo en build time. */
export async function generateStaticParams() {
  return getAllEntries().map((e) => ({
    brand: e.slug.brand,
    model: e.slug.model,
    colorway: e.slug.colorway,
  }));
}

export async function generateMetadata({ params }: Params) {
  const { brand, model, colorway } = await params;
  const entry = getEntryBySlug(brand, model, colorway);
  if (!entry) return { title: "Specimen not found" };
  return {
    title: `${entry.brand} · ${entry.model} · ${entry.colorway} — Archive`,
    description: `${entry.brand} ${entry.model} ${entry.colorway} — interactive 360° specimen.`,
  };
}

export default async function CatalogProductPage({ params }: Params) {
  const { brand, model, colorway } = await params;
  const entry = getEntryBySlug(brand, model, colorway);
  if (!entry) notFound();

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: LILAC,
        color: DARK,
        overflow: "hidden",
      }}
    >
      {/* ============ BACKGROUND ============ */}
      <BgLayers fixed />
      <CursorGlow />
      <CornerBrackets />

      {/* ============ TOP HUD ============ */}
      <div
        style={{
          position: "relative",
          padding: "1.5rem 2.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.7rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: DARK_DIM,
        }}
      >
        <div style={{ display: "flex", gap: "1.2rem", alignItems: "center" }}>
          <span
            style={{
              color: "#ff5436",
              textShadow: "0 0 8px rgba(255,84,54,0.6)",
              fontSize: "0.6rem",
            }}
          >
            ●
          </span>
          <span>D://DATA_CORE / ARCHIVE</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ color: DARK, fontWeight: 600 }}>{entry.brand}</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: DARK }}>{entry.model}</span>
        </div>
        <BackButton
          fallbackHref={`/catalog/${entry.slug.brand}`}
          label={`← BACK TO ${entry.brand}`}
          style={{ color: DARK_DIM, fontWeight: 600 }}
        />
      </div>

      {/* ============ STAGE ============ */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          display: "grid",
          gridTemplateColumns: "minmax(280px, 360px) 1fr minmax(280px, 360px)",
          gap: "2rem",
          alignItems: "center",
          padding: "0 2.5rem 4rem",
          minHeight: "78vh",
        }}
      >
        {/* ----- LEFT SIDEBAR: brand + huge editorial title ----- */}
        <div style={{ position: "relative" }}>
          {/* Vertical accent line */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -16,
              left: -22,
              width: 1,
              height: 60,
              background:
                "linear-gradient(to bottom, transparent, rgba(10,10,20,0.7))",
            }}
          />
          <div
            className="system-text"
            style={{
              color: DARK_DIM,
              marginBottom: "0.6rem",
              letterSpacing: "0.3em",
              fontSize: "0.7rem",
              fontWeight: 600,
            }}
          >
            {entry.brand}
          </div>
          <h1
            style={{
              fontFamily: "var(--font-marquee)",
              fontSize: "clamp(2.2rem, 4.5vw, 4rem)",
              lineHeight: 0.95,
              letterSpacing: "0.03em",
              margin: "0 0 1.2rem",
              color: DARK,
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {entry.model}
          </h1>
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.78rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: DARK,
              fontWeight: 600,
            }}
          >
            ▸ {entry.colorway}
          </div>
        </div>

        {/* ----- CENTER: 360 VIEWER ----- */}
        <div style={{ position: "relative" }}>
          {/* Soft halo background */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -50,
              background:
                "radial-gradient(circle, rgba(255,255,255,0.45) 0%, rgba(244,220,63,0.10) 40%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <div
            style={{
              position: "relative",
              zIndex: 1,
              maxWidth: 720,
              margin: "0 auto",
            }}
          >
            <Frame360Viewer entry={entry} />
          </div>
        </div>

        {/* ----- RIGHT SIDEBAR: metadata ----- */}
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.72rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
            }}
          >
            <MetaRow label="BRAND" value={entry.brand} />
            <MetaRow label="MODEL" value={entry.model} />
            <MetaRow label="COLORWAY" value={entry.colorway} accent />
            <MetaRow
              label="TYPE"
              value={entry.type === "360" ? "360° INTERACTIVE" : "STATIC PREVIEW"}
            />
            <MetaRow
              label="FRAMES"
              value={entry.type === "360" ? String(entry.frames) : "—"}
            />
            <MetaRow label="STATUS" value="ARCHIVED" />

            <div
              style={{
                marginTop: "1.5rem",
                paddingTop: "1rem",
                borderTop: `1px solid rgba(10,10,20,0.2)`,
                color: DARK_DIM,
                fontSize: "0.62rem",
                letterSpacing: "0.2em",
                lineHeight: 1.6,
              }}
            >
              SPECIMEN INDEXED FROM
              <br />
              <span style={{ color: DARK, fontWeight: 600 }}>
                BA1RES_FOOTWEAR/ARCHIVE_v01
              </span>
              <br />
              <span style={{ opacity: 0.55 }}>{entry.path}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============ BOTTOM HUD ============ */}
      <div
        style={{
          position: "relative",
          zIndex: 10,
          padding: "0 2.5rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.66rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: DARK_DIM,
        }}
      >
        <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
          <span style={{ color: DARK }}>▸</span>
          <span style={{ color: DARK, fontWeight: 600 }}>
            {entry.brand} · {entry.colorway}
          </span>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span>DRAG · WHEEL · ← →</span>
          <span style={{ opacity: 0.4 }}>//</span>
          <span style={{ color: DARK, fontWeight: 600 }}>
            {entry.type === "360" ? "360° INTERACTIVE" : "STATIC"}
          </span>
        </div>
      </div>

      <Scanlines />
    </main>
  );
}

function MetaRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "0.8rem",
        marginBottom: "0.55rem",
      }}
    >
      <span
        style={{
          width: 96,
          color: DARK_DIM,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent ? DARK : DARK,
          fontWeight: accent ? 700 : 500,
          textShadow: accent ? `0 0 8px ${YELLOW}40` : "none",
        }}
      >
        {value}
      </span>
    </div>
  );
}
