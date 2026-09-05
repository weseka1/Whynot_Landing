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
import PanelDrops from "@/components/PanelDrops";
import BackButton from "@/components/BackButton";
import AvisoCarrito from "@/components/tienda/AvisoCarrito";
import BarraPedido from "@/components/tienda/BarraPedido";
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
  if (!brandName) return { title: "Marca no encontrada" };
  return {
    title: `${brandName} — Catálogo`,
    description: `Catálogo de ${brandName} en WHYNOT EXCLUSIVE con vista 360°. Sneakers exclusivos, envíos a todo el país y pago al recibir en CABA y GBA. Consultas por WhatsApp.`,
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
      {/* Preload del GLB del MonoMascot (BrandHero). Crucial en mobile:
          sin esto el browser solo descarga el GLB cuando MonoMascot monta
          via IntersectionObserver — perdemos 5-8s en 3G. Con preload el
          fetch arranca en paralelo con el JS bundle y el GLB ya esta en
          cache cuando el componente se hidrata.
          Next 14 hoistea automaticamente <link> a <head>. */}
      <link
        rel="preload"
        as="fetch"
        crossOrigin=""
        href="/assets/3d/mono-cuerpo-completo.glb"
        // @ts-ignore fetchpriority no esta en types aun
        fetchpriority="high"
      />

      {/* ============ BACKGROUND LAYERS ============ */}
      <BgLayers fixed />
      <CursorGlow />
      <CornerBrackets />

      {/* ============ TOP HUD ============ */}
      {/* CSS responsive: en mobile (<720px) ocultamos los segmentos secundarios
          del breadcrumb (D://DATA_CORE y el separador) y compactamos el padding.
          El BackButton sigue visible — es el escape garantizado para volver.   */}
      <style>{`
        .brand-hud { padding: 1.4rem 2.5rem; }
        .brand-hud-extras { display: inline; }
        @media (max-width: 720px) {
          .brand-hud { padding: 1rem 1rem; gap: 0.5rem; }
          .brand-hud-extras { display: none; }
        }
      `}</style>
      <div
        className="brand-hud"
        style={{
          position: "sticky",
          top: 0,
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
        <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", minWidth: 0 }}>
          <span
            style={{
              color: "#ff5436",
              textShadow: "0 0 8px rgba(255,84,54,0.6)",
              fontSize: "0.6rem",
              flexShrink: 0,
            }}
          >
            ●
          </span>
          <span className="brand-hud-extras">CATÁLOGO</span>
          <span className="brand-hud-extras" style={{ opacity: 0.4 }}>•</span>
          <span
            style={{
              color: DARK,
              fontWeight: 600,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {brandName}
          </span>
        </div>
        <BackButton
          fallbackHref="/#section-past-drop"
          label="← VOLVER"
          style={{ color: DARK_DIM, fontWeight: 600, flexShrink: 0 }}
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
        {/* Productos cargados desde el panel para esta marca (en vivo). */}
        <PanelDrops brandSlug={brandSlug} />
        <PaginatedColorways entries={sorted} brandSlug={brandSlug} />
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
            FIN DEL CATÁLOGO DE {brandName}
          </span>
        </div>
        {/* Acá decía "126 PRODUCTOS · 120 CON VISTA 360°". Fuera: contaba
            las fotos del catálogo, no el stock, y le hacía parecer chica a
            la tienda (Fabri, 4-sep). El CTA sirve más que el número. */}
        <div style={{ display: "flex", gap: "1rem" }}>
          <span>WHYNOT EXCLUSIVE / CATÁLOGO</span>
          <span style={{ opacity: 0.4 }}>//</span>
          <span style={{ color: DARK, fontWeight: 600 }}>
            ¿NO ENCONTRÁS TU PAR? ESCRIBINOS
          </span>
        </div>
      </div>

      {/* ── Acá también se compra (5-sep-2026) ────────────────────────
          Medido: en toda la página de marca no había NINGÚN carrito montado
          — ni el botón flotante ni el aviso. O sea que se podía agregar
          desde el visor de "Nuevos ingresos" y no había dónde verlo ni
          desde dónde mandar el pedido. Es el camino por el que entra la
          gente desde el menú. */}
      <AvisoCarrito />
      <BarraPedido />

      {/* Scanlines arriba de todo (look CRT) */}
      <Scanlines />
    </main>
  );
}
