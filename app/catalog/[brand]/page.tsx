/* ============================================================================
   BRAND SHOWROOM — /catalog/[brand]
   ----------------------------------------------------------------------------
   Catálogo completo de una marca, PAGINADO (24 cards = 3 col × 8 rows).
   Estado de paginación en URL hash → sobrevive back-button del browser.
   Server component. Pre-genera 1 ruta por brand-slug en build.

   Estética: lilac DICH + capas ultra-futuristas (scanlines + corner brackets +
   cursor glow + atmospheric drifts).
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
import {
  BgLayers,
  Scanlines,
  CornerBrackets,
  CursorGlow,
  LILAC,
  DARK,
  DARK_DIM,
} from "@/components/CatalogAtmosphere";

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
        background: LILAC,
        color: DARK,
        overflow: "hidden",
      }}
    >
      {/* ============ BACKGROUND LAYERS ============ */}
      <BgLayers fixed />
      <CursorGlow />
      <CornerBrackets />

      {/* ============ TOP HUD ============ */}
      <div
        style={{
          position: "sticky",
          top: 0,
          padding: "1.4rem 2.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          zIndex: 30,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.7rem",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: DARK_DIM,
          background:
            "linear-gradient(180deg, rgba(205,181,240,0.94) 0%, rgba(205,181,240,0.7) 70%, transparent 100%)",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        {/* Breadcrumb removido — el cliente pidio sacar el dot rojo, el
            "D://DATA_CORE / ARCHIVE" y la repeticion del brand name. Solo
            queda el BackButton para navegacion (info funcional, no data). */}
        <div />
        <BackButton
          fallbackHref="/#section-past-drop"
          label="← BACK TO ARCHIVE"
          style={{ color: DARK_DIM, fontWeight: 600 }}
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
          padding: "1rem 2.5rem 4rem",
        }}
      >
        <PaginatedColorways entries={sorted} brandSlug={brandSlug} />
      </div>

      {/* Bottom HUD removido — "END OF X ARCHIVE", "BA1RES_FOOTWEAR /
          ARCHIVE_v01", "NN SPECIMENS · NN × 360°" eran metadata interna
          que no aporta al consumer. Se quito por pedido del cliente. */}

      {/* Scanlines arriba de todo (look CRT) */}
      <Scanlines />
    </main>
  );
}
