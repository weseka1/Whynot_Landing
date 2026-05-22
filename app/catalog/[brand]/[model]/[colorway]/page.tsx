/* ============================================================================
   CATALOG PRODUCT PAGE — /catalog/[brand]/[model]/[colorway]
   ----------------------------------------------------------------------------
   Server-rendered: layout + metadata + bg layers (server component).
   Client: <Frame360Viewer> (interacciones drag/wheel/keyboard).
   ============================================================================ */

import { notFound } from "next/navigation";
import { getAllEntries, getEntryBySlug } from "@/data/catalog";
import Frame360Viewer from "@/components/Frame360Viewer";
import BackButton from "@/components/BackButton";

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

const GOLD = "#e8c468";
const GOLD_DIM = "rgba(232,196,104,0.55)";

export default async function CatalogProductPage({ params }: Params) {
  const { brand, model, colorway } = await params;
  const entry = getEntryBySlug(brand, model, colorway);
  if (!entry) notFound();

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "#050510",
        color: "#e9e2d4",
        overflow: "hidden",
      }}
    >
      {/* ============ BACKGROUND LAYERS ============ */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 18% 28%, rgba(120,40,180,0.40), transparent 60%),
            radial-gradient(ellipse 70% 50% at 82% 72%, rgba(220,30,120,0.30), transparent 60%),
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(40,15,80,0.50), transparent 70%),
            linear-gradient(180deg, #0a0a14 0%, #1a0b2a 50%, #050510 100%)
          `,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(232,196,104,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(232,196,104,0.045) 1px, transparent 1px)
          `,
          backgroundSize: "52px 52px",
          WebkitMaskImage:
            "radial-gradient(circle at center, black 25%, transparent 80%)",
          maskImage:
            "radial-gradient(circle at center, black 25%, transparent 80%)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
        }}
      />

      {/* ============ TOP HUD ============ */}
      <div
        style={{
          position: "relative",
          padding: "1.5rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 10,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.7rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: GOLD_DIM,
        }}
      >
        <div style={{ display: "flex", gap: "1.2rem", alignItems: "center" }}>
          <span style={{ color: "#ff5436", textShadow: "0 0 8px rgba(255,84,54,0.6)" }}>
            ●
          </span>
          <span>D://DATA_CORE / ARCHIVE</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ color: GOLD }}>{entry.brand}</span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: "#e9e2d4" }}>{entry.model}</span>
        </div>
        <BackButton
          fallbackHref={`/catalog/${entry.slug.brand}`}
          label={`← BACK TO ${entry.brand}`}
          style={{ color: GOLD_DIM }}
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
          padding: "0 2rem 4rem",
          minHeight: "78vh",
        }}
      >
        {/* ----- LEFT SIDEBAR: brand + huge editorial title ----- */}
        <div style={{ position: "relative" }}>
          <div
            className="system-text"
            style={{
              color: GOLD_DIM,
              marginBottom: "0.6rem",
              letterSpacing: "0.3em",
              fontSize: "0.7rem",
            }}
          >
            {entry.brand}
          </div>
          <h1
            className="display"
            style={{
              fontSize: "clamp(2.2rem, 4.5vw, 4rem)",
              lineHeight: 0.95,
              letterSpacing: "-0.02em",
              margin: "0 0 1.2rem",
              color: "#fff",
              textShadow: "0 4px 30px rgba(0,0,0,0.7)",
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
              color: GOLD,
            }}
          >
            ▸ {entry.colorway}
          </div>

          {/* Vertical gold accent line */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              top: -16,
              left: -22,
              width: 1,
              height: 60,
              background:
                "linear-gradient(to bottom, transparent, rgba(232,196,104,0.7))",
            }}
          />
        </div>

        {/* ----- CENTER: 360 VIEWER ----- */}
        <div style={{ position: "relative" }}>
          {/* Breathing glow background */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: -60,
              background:
                "radial-gradient(circle, rgba(232,196,104,0.18) 0%, rgba(160,40,200,0.12) 40%, transparent 70%)",
              filter: "blur(40px)",
              pointerEvents: "none",
              zIndex: 0,
            }}
          />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 720, margin: "0 auto" }}>
            <Frame360Viewer entry={entry} />
          </div>
        </div>

        {/* ----- RIGHT SIDEBAR: metadata + actions ----- */}
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
                borderTop: "1px solid rgba(232,196,104,0.18)",
                color: GOLD_DIM,
                fontSize: "0.62rem",
                letterSpacing: "0.2em",
                lineHeight: 1.6,
              }}
            >
              SPECIMEN INDEXED FROM
              <br />
              <span style={{ color: GOLD }}>
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
          padding: "0 2rem 1.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.66rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: GOLD_DIM,
        }}
      >
        <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
          <span style={{ color: GOLD }}>▸</span>
          <span style={{ color: "#e9e2d4" }}>
            {entry.brand} · {entry.colorway}
          </span>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span>DRAG · WHEEL · ← →</span>
          <span style={{ opacity: 0.4 }}>//</span>
          <span style={{ color: GOLD }}>360° INTERACTIVE</span>
        </div>
      </div>
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
          color: GOLD_DIM,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <span style={{ color: accent ? GOLD : "#e9e2d4" }}>{value}</span>
    </div>
  );
}
