/* ============================================================================
   CATALOG PRODUCT PAGE — /catalog/[brand]/[model]/[colorway]
   ----------------------------------------------------------------------------
   Server component: resuelve entry + related en build time, monta el layout
   con la atmósfera DICH lilac (bg layers + scanlines + corner brackets +
   cursor glow) y delega toda la UI interactiva a <ProductDetailView>.
   ============================================================================ */

import { notFound } from "next/navigation";
import {
  getAllEntries,
  getEntryBySlug,
  type CatalogEntry,
} from "@/data/catalog";
import { getProductMeta } from "@/lib/productMeta";
import ProductDetailView from "@/components/ProductDetailView";
import {
  BgLayers,
  Scanlines,
  CornerBrackets,
  CursorGlow,
  LILAC,
  DARK,
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

/** Otros colorways del mismo brand + model (excluye el actual). */
function getRelated(entry: CatalogEntry): CatalogEntry[] {
  return getAllEntries().filter(
    (e) =>
      e.slug.brand === entry.slug.brand &&
      e.slug.model === entry.slug.model &&
      e.slug.colorway !== entry.slug.colorway
  );
}

export default async function CatalogProductPage({ params }: Params) {
  const { brand, model, colorway } = await params;
  const entry = getEntryBySlug(brand, model, colorway);
  if (!entry) notFound();

  const related = getRelated(entry);
  const meta = getProductMeta(entry);

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
      {/* ============ ATMOSPHERE ============ */}
      <BgLayers fixed />
      <CursorGlow />
      <CornerBrackets />

      {/* ============ CONTENT ============ */}
      <ProductDetailView entry={entry} related={related} meta={meta} />

      <Scanlines />
    </main>
  );
}
