/* ============================================================================
   BRAND SHOWROOM — /catalog/[brand]
   ----------------------------------------------------------------------------
   Catálogo COMPLETO de una marca: todos los modelos con todos sus colorways.
   Cada colorway click → /catalog/[brand]/[model]/[colorway] (visor 360).
   Server component. Pre-genera 1 ruta por brand-slug en build.
   ============================================================================ */

import { notFound } from "next/navigation";
import Link from "next/link";
import {
  brandNameFromSlug,
  getEntriesByBrandSlug,
  groupByModel,
  getAllBrandSlugs,
} from "@/data/catalog";
import BrandHero from "@/components/BrandHero";
import ColorwayCard from "@/components/ColorwayCard";

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
  const models = groupByModel(entries);

  const totalColorways = entries.length;
  const total360 = entries.filter((e) => e.type === "360").length;
  const totalModels = models.length;

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
        <Link
          href="/#section-past-drop"
          style={{
            color: GOLD_DIM,
            textDecoration: "none",
          }}
        >
          ← BACK TO ARCHIVE
        </Link>
      </div>

      {/* ============ BRAND HERO ============ */}
      <BrandHero
        brandName={brandName}
        totalModels={totalModels}
        totalColorways={totalColorways}
        total360={total360}
      />

      {/* ============ MODELS GROUPS ============ */}
      <div
        style={{
          position: "relative",
          zIndex: 5,
          padding: "1rem 2rem 6rem",
        }}
      >
        {models.map((mg) => (
          <ModelSection
            key={mg.modelSlug}
            brandSlug={brandSlug}
            modelName={mg.model}
            colorways={mg.colorways}
          />
        ))}
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
            {totalColorways} SPECIMENS · {total360} × 360°
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

function ModelSection({
  brandSlug,
  modelName,
  colorways,
}: {
  brandSlug: string;
  modelName: string;
  colorways: ReturnType<typeof groupByModel>[number]["colorways"];
}) {
  const total = colorways.length;
  const has360 = colorways.filter((c) => c.type === "360").length;
  return (
    <section
      style={{
        marginBottom: "5rem",
        position: "relative",
      }}
    >
      {/* Model header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1.8rem",
          paddingBottom: "0.8rem",
          borderBottom: "1px solid rgba(232,196,104,0.18)",
        }}
      >
        <div>
          <div
            className="system-text"
            style={{
              color: GOLD_DIM,
              fontSize: "0.62rem",
              letterSpacing: "0.3em",
              marginBottom: "0.4rem",
            }}
          >
            MODEL · {String(total).padStart(2, "0")} COLORWAYS
          </div>
          <h2
            className="display"
            style={{
              fontSize: "clamp(1.8rem, 3.5vw, 3rem)",
              lineHeight: 1,
              letterSpacing: "-0.01em",
              color: "#fff",
              margin: 0,
            }}
          >
            {modelName}
          </h2>
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.62rem",
            letterSpacing: "0.25em",
            color: GOLD,
            whiteSpace: "nowrap",
          }}
        >
          {has360 > 0 ? `${has360} × 360°` : "STATIC"}
        </div>
      </div>

      {/* Colorways grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1.4rem",
        }}
      >
        {colorways.map((entry) => (
          <ColorwayCard
            key={entry.path}
            entry={entry}
            href={`/catalog/${brandSlug}/${entry.slug.model}/${entry.slug.colorway}`}
          />
        ))}
      </div>
    </section>
  );
}
