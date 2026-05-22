/* ============================================================================
   BRAND SHOWROOM — /catalog/[brand]
   ----------------------------------------------------------------------------
   Catálogo completo de una marca, PAGINADO (24 cards = 3 col × 8 rows).
   Estado de paginación en URL hash → sobrevive back-button del browser.
   Server component. Pre-genera 1 ruta por brand-slug en build.
   ============================================================================ */

import { notFound } from "next/navigation";
import {
  brandNameFromSlug,
  getEntriesByBrandSlug,
  getAllBrandSlugs,
} from "@/data/catalog";
import BrandHero from "@/components/BrandHero";
import PaginatedColorways from "@/components/PaginatedColorways";
import BackButton from "@/components/BackButton";

type Params = {
  params: Promise<{ brand: string }>;
};

export async function generateStaticParams() {
  return getAllBrandSlugs().map((brand) => ({ brand }));
}

export async function generateMetadata({ params }: Params) {
  const { brand } = await params;
  const brandName = brandNameFromSlug(brand);
  if (!brandName) return { title: "Brand not found" };
  return {
    title: `${brandName} — Archive`,
    description: `${brandName} full archive — interactive 360° specimens.`,
  };
}

const GOLD = "#e8c468";
const GOLD_DIM = "rgba(232,196,104,0.55)";

export default async function BrandPage({ params }: Params) {
  const { brand: brandSlug } = await params;
  const brandName = brandNameFromSlug(brandSlug);
  if (!brandName) notFound();

  const entries = getEntriesByBrandSlug(brandSlug);
  /* Orden estable para paginación: por modelo, luego por colorway. */
  const sorted = [...entries].sort((a, b) => {
    const m = a.model.localeCompare(b.model);
    return m !== 0 ? m : a.colorway.localeCompare(b.colorway);
  });

  const total = sorted.length;
  const total360 = sorted.filter((e) => e.type === "360").length;
  const totalModels = new Set(sorted.map((e) => e.slug.model)).size;

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
      <BackgroundLayers />

      {/* ============ TOP HUD ============ */}
      <div
        style={{
          position: "sticky",
          top: 0,
          padding: "1.4rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 30,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.7rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: GOLD_DIM,
          background:
            "linear-gradient(180deg, rgba(5,5,16,0.92) 0%, rgba(5,5,16,0.7) 70%, transparent 100%)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
        }}
      >
        <div style={{ display: "flex", gap: "1.2rem", alignItems: "center" }}>
          <span
            style={{
              color: "#ff5436",
              textShadow: "0 0 8px rgba(255,84,54,0.6)",
            }}
          >
            ●
          </span>
          <span>D://DATA_CORE / ARCHIVE</span>
          <span style={{ opacity: 0.4 }}>•</span>
          <span style={{ color: GOLD }}>{brandName}</span>
        </div>
        <BackButton
          fallbackHref="/#section-past-drop"
          label="← BACK TO ARCHIVE"
          style={{ color: GOLD_DIM }}
        />
      </div>

      {/* ============ BRAND HERO ============ */}
      <BrandHero
        brandName={brandName}
        totalModels={totalModels}
        totalColorways={total}
        total360={total360}
      />

      {/* ============ PAGINATED GRID ============ */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          padding: "1rem 2rem 4rem",
        }}
      >
        <PaginatedColorways entries={sorted} brandSlug={brandSlug} />
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
          <span style={{ color: "#e9e2d4" }}>END OF {brandName} ARCHIVE</span>
        </div>
        <div style={{ display: "flex", gap: "1rem" }}>
          <span>BA1RES_FOOTWEAR / ARCHIVE_v01</span>
          <span style={{ opacity: 0.4 }}>//</span>
          <span style={{ color: GOLD }}>
            {total} SPECIMENS · {total360} × 360°
          </span>
        </div>
      </div>
    </main>
  );
}

function BackgroundLayers() {
  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background: `
            radial-gradient(ellipse 80% 60% at 18% 28%, rgba(120,40,180,0.40), transparent 60%),
            radial-gradient(ellipse 70% 50% at 82% 72%, rgba(220,30,120,0.30), transparent 60%),
            radial-gradient(ellipse 60% 50% at 50% 50%, rgba(40,15,80,0.50), transparent 70%),
            linear-gradient(180deg, #0a0a14 0%, #1a0b2a 50%, #050510 100%)
          `,
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
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
          zIndex: 0,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}
