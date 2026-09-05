"use client";

/* ============================================================================
   PRODUCT DETAIL VIEW — single-column, mobile-first
   ----------------------------------------------------------------------------
   Estructura inspirada en ba1res_landing/ProductDetail.jsx, retrabajada con la
   estética DICH lilac de Whynot v2:
     · Header (back + brand)
     · Viewer 360° (Frame360Viewer existente)
     · Badges (HOT/NEW/DROP + 360°)
     · Brand · Model · Colorway
     · Stock indicator
     · Categoría
     · Size selector grid
     · CTA WhatsApp + Share (Web Share API)
     · Related products strip (otros colorways del mismo modelo)
   ============================================================================ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Frame360Viewer from "@/components/Frame360Viewer";
import {
  buildWhatsAppUrl,
  buildProductMessage,
} from "@/lib/contact";
import type { CatalogEntry } from "@/data/catalog";
import { posterUrl } from "@/data/catalog";
import type { Badge } from "@/lib/productMeta";
import {
  fetchProductoPorSlug,
  disponibilidadDeTalles,
  type PanelProduct,
} from "@/data/landingProducts";
import { WhatsAppIcon } from "@/components/icons/SocialIcons";
import { agregar, useTotales } from "@/lib/carrito";
import AvisoCarrito from "@/components/tienda/AvisoCarrito";
import { mainUrl } from "@/data/catalog";

const LILAC = "#cdb5f0";
const DARK = "#0a0a14";
const DARK_DIM = "rgba(10,10,20,0.65)";
const DARK_SOFT = "rgba(10,10,20,0.18)";
const YELLOW = "#f4dc3f";
const PEARL = "rgba(255,255,255,0.55)";
const PEARL_HI = "rgba(255,255,255,0.78)";

const BADGE_MAP: Record<
  Exclude<Badge, null>,
  { label: string; bg: string; fg: string }
> = {
  hot: { label: "🔥 HOT", bg: "#ff5436", fg: "#fff" },
  new: { label: "✨ NEW", bg: "#6366f1", fg: "#fff" },
  drop: { label: "🚀 DROP", bg: YELLOW, fg: DARK },
};

const ALL_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

type Props = {
  entry: CatalogEntry;
  related: CatalogEntry[];
};

export default function ProductDetailView({ entry, related }: Props) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [canShare, setCanShare] = useState(false);
  /* Feedback del carrito: el boton confirma en el lugar, sin modal. */
  const [agregado, setAgregado] = useState(false);
  /* Colorways cuya foto no carga: en vez del alt text roto (se veia
     "OFF-WHITE Out Of Office Black &..." dentro de la card) mostramos un
     placeholder con la inicial. Un asset faltante no puede ensuciar la
     grilla — y el bucket es del Supabase de Yamil, no lo arreglamos de acá. */
  const [fotosRotas, setFotosRotas] = useState<Record<string, boolean>>({});
  const [pideTalle, setPideTalle] = useState(false);
  const { unidades } = useTotales();

  /* ── Los talles salen del PANEL, no de un generador (5-sep-2026) ──────
     Hasta hoy venían de lib/productMeta, un archivo que se declara a sí
     mismo "mock data determinístico": inventaba talles, stock y etiqueta a
     partir de un hash del nombre del producto. El cliente veía talles que
     no existían en ningún lado y podía elegir un 42 que no había.

     Ahora se consultan los datos reales de landing_products. La ficha es
     estática (se prerenderiza), así que la consulta va del lado del cliente
     — igual que la tienda de la home. */
  const [panel, setPanel] = useState<PanelProduct | null>(null);
  const [cargandoPanel, setCargandoPanel] = useState(true);
  useEffect(() => {
    let vivo = true;
    fetchProductoPorSlug(entry.slug.brand, entry.slug.model, entry.slug.colorway)
      .then((p) => { if (vivo) setPanel(p); })
      .catch(() => { /* sin panel se cae al comportamiento asumido */ })
      .finally(() => { if (vivo) setCargandoPanel(false); });
    return () => { vivo = false; };
  }, [entry.slug.brand, entry.slug.model, entry.slug.colorway]);

  const { disponibles, asumido } = disponibilidadDeTalles(panel, ALL_SIZES);
  const sizeAvailable = (s: string) => disponibles.includes(s);
  /* El stock del producto entero: null mientras carga o si no está en el
     panel — nunca 0, que se leería como "agotado" sin fundamento. */
  const stockReal = panel?.stock ?? null;
  /* La etiqueta y la categoría también salían del generador. Si el panel
     no tiene el producto, no se muestran: mejor vacío que inventado. */
  const badgePanel: Badge =
    panel?.badge === "hot" || panel?.badge === "new" || panel?.badge === "drop"
      ? panel.badge
      : null;
  const categoriaPanel = panel?.category?.trim() || "Sneakers";
  const outOfStock = stockReal === 0;

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.canShare === "function") {
      try {
        setCanShare(
          navigator.canShare({ text: buildProductMessage(entry, selectedSize || undefined) })
        );
      } catch {
        setCanShare(false);
      }
    }
  }, [entry, selectedSize]);

  async function onShare() {
    try {
      await navigator.share({
        text: buildProductMessage(entry, selectedSize || undefined),
      });
    } catch {
      /* user cancelled */
    }
  }

  /* ── Agregar al carrito desde la ficha (4-sep-2026) ──────────────────
     Antes esto solo existia en la home: el que llegaba a la ficha —el que
     mas cerca esta de comprar— solo podia pedir de a UN par por WhatsApp.
     "Aca en los modelos no tiene para anadir al carrito" (Juani).

     El precio NO vive en el catalogo estatico (esta en landing_products),
     asi que el item entra sin precio: el carrito lo muestra como "A
     consultar" y lo aclara en el mensaje de WhatsApp. Mejor eso que
     inventar un numero. */
  function onAgregar() {
    if (outOfStock) return;
    if (!selectedSize) {
      setPideTalle(true);
      return;
    }
    agregar({
      id: entry.path,
      brand: entry.brand,
      model: entry.model,
      colorway: entry.colorway,
      /* posterUrl y NO mainUrl: main.jpg sólo existe en los productos tipo
         "image". En los de vista 360 la primera foto es 360_01.jpg, así que
         los items agregados desde una ficha 360 entraban al carrito con una
         URL que da 404 — y en el aviso se veía el ícono de imagen rota.
         posterUrl elige la correcta según el tipo; para eso existe. */
      imageUrl: posterUrl(entry),
      size: selectedSize,
      price: null,
      transferencia: null,
    });
    setAgregado(true);
    setPideTalle(false);
    window.setTimeout(() => setAgregado(false), 1800);
  }

  function onBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(`/catalog/${entry.slug.brand}`);
  }

  const waUrl = buildWhatsAppUrl(entry, selectedSize || undefined);

  return (
    <div style={pageStyle}>
      <style>{LOCAL_CSS}</style>

      {/* El aviso del carrito vive acá también: se agrega desde la ficha,
          así que la confirmación tiene que estar donde ocurre la acción.
          Antes el carrito sólo existía en la home — agregabas desde acá y no
          tenías dónde ver qué llevabas. */}
      <AvisoCarrito />

      {/* ── Header ──────────────────────────────────────────────── */}
      <header style={headerStyle}>
        <button onClick={onBack} className="pd-back-btn">
          ← VOLVER
        </button>
        <span style={headerBrandStyle}>{entry.brand}</span>
        <span style={{ width: 70 }} aria-hidden />
      </header>

      {/* ── Viewer ──────────────────────────────────────────────── */}
      <div style={viewerWrapStyle}>
        <div className="pd-viewer-outer">
          <div style={viewerHaloStyle} aria-hidden />
          <div style={viewerBoxStyle}>
            <Frame360Viewer entry={entry} />
          </div>
        </div>
      </div>

      {/* ── Info ────────────────────────────────────────────────── */}
      <div style={infoStyle}>
        {/* Badges */}
        <div style={badgesRowStyle}>
          {badgePanel && (
            <span
              style={{
                ...badgeBase,
                background: BADGE_MAP[badgePanel].bg,
                color: BADGE_MAP[badgePanel].fg,
              }}
            >
              {BADGE_MAP[badgePanel].label}
            </span>
          )}
          {entry.type === "360" && (
            <span
              style={{
                ...badgeBase,
                background: "rgba(10,10,20,0.08)",
                color: DARK,
                border: `1px solid ${DARK_SOFT}`,
              }}
            >
              🔄 Vista 360°
            </span>
          )}
        </div>

        {/* Títulos */}
        <h1 style={brandStyle}>{entry.brand}</h1>
        <h2 style={modelStyle}>{entry.model}</h2>
        <p style={colorwayStyle}>▸ {entry.colorway}</p>

        <div style={dividerStyle} />

        {/* Stock */}
        <div>
          <StockIndicator stock={stockReal} />
        </div>

        {/* Categoría */}
        <div style={metaRowStyle}>
          <span style={metaLabelStyle}>Categoría</span>
          <span style={metaValueStyle}>{categoriaPanel}</span>
        </div>

        <div style={dividerStyle} />

        {/* ── Talles ──────────────────────────────────────────────────────
            Si el producto NO tiene ningún talle cargado, no se muestra la
            grilla. Antes se renderizaban siempre los 10 de ALL_SIZES (36
            al 45) y se deshabilitaban los que no estuvieran en la ficha —
            así que en un producto sin datos el cliente veía diez casilleros
            grises e intocables, o sea "agotado en todos los talles". Y no
            está agotado: nadie cargó los talles todavía.

            Medido contra la base el 5-sep-2026: 169 de 327 productos (el
            52%) están así. Más de la mitad del catálogo le decía al
            visitante que no había nada para él.

            En su lugar va el camino que sí vende: preguntar por WhatsApp,
            que es como trabajan igual. */}
        {disponibles.length === 0 ? (
          <div style={sizeBlockStyle}>
            <div style={sizeHeaderStyle}>
              <span style={metaLabelStyle}>Talles</span>
            </div>
            <a
              className="pd-consultar-talle"
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M4 5.5h16v10H9l-5 4v-14Z" />
              </svg>
              Consultanos tu talle por WhatsApp
            </a>
          </div>
        ) : (
        <div style={sizeBlockStyle}>
          <div style={sizeHeaderStyle}>
            <span style={{ ...metaLabelStyle, color: pideTalle ? "#c9772b" : undefined }}>
              {pideTalle ? "Elegí un talle" : "Talle"}
            </span>
            {selectedSize && (
              <button
                type="button"
                onClick={() => setSelectedSize("")}
                className="pd-size-clear"
              >
                Limpiar
              </button>
            )}
          </div>
          <div style={sizeGridStyle}>
            {ALL_SIZES.map((s) => {
              const available = sizeAvailable(s);
              const active = selectedSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  disabled={!available}
                  onClick={() => {
                    setSelectedSize(active ? "" : s);
                    setPideTalle(false);
                  }}
                  aria-pressed={active}
                  className={`pd-size-chip${active ? " is-active" : ""}${
                    available ? "" : " is-disabled"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        )}

        {/* CTA principal: sumar al pedido y seguir mirando. */}
        {!outOfStock && (
          <button
            type="button"
            onClick={onAgregar}
            className={`pd-cart-btn${agregado ? " is-done" : ""}`}
            aria-label={`Agregar ${entry.brand} ${entry.model} al pedido`}
          >
            {agregado ? (
              /* Sin el total: "Agregado · 10 pares" decía CUÁNTO llevás pero
                 nunca QUÉ, y en una tienda que se elige por talle eso no
                 confirma nada. El detalle lo muestra el AvisoCarrito. */
              <>✓ Agregado</>
            ) : (
              <>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M6 7h12l-1 12H7L6 7Z" />
                  <path d="M9 7a3 3 0 0 1 6 0" />
                </svg>
                Agregar al pedido
              </>
            )}
          </button>
        )}

        {/* Secundario: para el que quiere ese par y nada mas. */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`pd-wa-btn${outOfStock ? "" : " is-secondary"}`}
          aria-label={`Pedir ${entry.brand} ${entry.model} por WhatsApp`}
        >
          <WhatsAppIcon size={20} />
          {outOfStock ? "Consultar reposición" : "Pedir solo este par"}
        </a>

        {/* Share (mobile) */}
        {canShare && (
          <button
            type="button"
            onClick={onShare}
            className="pd-share-btn"
            aria-label="Compartir este producto"
          >
            ↑ Compartir producto
          </button>
        )}

        {outOfStock && (
          <p style={outNoteStyle}>
            Este modelo está agotado. Consultanos y te avisamos cuando vuelva.
          </p>
        )}
      </div>

      {/* ── Relacionados ───────────────────────────────────────── */}
      {related.length > 0 && (
        <section style={relatedStyle}>
          <div style={{ marginBottom: 18 }}>
            <span style={relatedEyebrowStyle}>
              {entry.brand} · {entry.model}
            </span>
            <h3 style={relatedTitleStyle}>Otros colorways</h3>
          </div>
          <div className="pd-related-strip">
            {related.map((p) => (
              <Link
                key={p.slug.full}
                href={`/catalog/${p.slug.brand}/${p.slug.model}/${p.slug.colorway}`}
                className="pd-related-item"
                aria-label={`Ver ${p.brand} ${p.model} ${p.colorway}`}
              >
                <div className="pd-related-thumb">
                  {fotosRotas[p.slug.full] ? (
                    <span className="pd-related-sinfoto" aria-hidden>
                      {p.colorway.trim().charAt(0).toUpperCase() || "?"}
                    </span>
                  ) : (
                    <img
                      src={posterUrl(p)}
                      alt={`${p.brand} ${p.model} ${p.colorway}`}
                      loading="lazy"
                      onError={() =>
                        setFotosRotas((prev) => ({ ...prev, [p.slug.full]: true }))
                      }
                    />
                  )}
                  {p.type === "360" && <span className="pd-related-360">360°</span>}
                </div>
                <span className="pd-related-color">{p.colorway}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================================
   STOCK INDICATOR
   ============================================================================ */
function StockIndicator({ stock }: { stock: number | null }) {
  /* null = todavía no sabemos (está cargando, o el producto no está en el
     panel). No es lo mismo que cero: cero dice "agotado" y sería mentira.
     En la duda no se afirma nada. */
  if (stock == null) return null;
  if (stock === 0)
    return <span style={{ ...stockBase, color: "#d33b3b" }}>● Sin stock</span>;
  if (stock < 5)
    return (
      <span style={{ ...stockBase, color: "#c47800" }}>
        {/* Con stock 1 decía "Últimas 1 unidades" — mal escrito, y salía así
            en 17 fichas. Este contador se queda (es stock real del par y
            genera urgencia; no es el conteo de catálogo que se sacó hoy),
            pero concordando. */}
        ● {stock === 1 ? "Última unidad" : `Últimas ${stock} unidades`}
      </span>
    );
  return <span style={{ ...stockBase, color: "#1d8a47" }}>● En stock</span>;
}

/* ============================================================================
   STYLES (inline + local CSS)
   ============================================================================ */

const pageStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 5,
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "0 0 64px",
  color: DARK,
  fontFamily: "var(--font-body, system-ui), sans-serif",
};

const headerStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "20px 16px 12px",
};

const headerBrandStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  letterSpacing: "0.25em",
  color: DARK,
  fontWeight: 700,
  textTransform: "uppercase",
};

const viewerWrapStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  padding: "0 16px",
  position: "relative",
};

const viewerHaloStyle: React.CSSProperties = {
  position: "absolute",
  inset: -40,
  background:
    "radial-gradient(circle, rgba(255,255,255,0.55) 0%, rgba(244,220,63,0.10) 40%, transparent 70%)",
  filter: "blur(40px)",
  pointerEvents: "none",
  zIndex: 0,
};

const viewerBoxStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  background: PEARL,
  borderRadius: 18,
  border: `1px solid ${DARK_SOFT}`,
  overflow: "hidden",
  backdropFilter: "blur(8px)",
};

const infoStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  padding: "24px 16px 0",
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const badgesRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const badgeBase: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  padding: "4px 10px",
  borderRadius: 20,
  letterSpacing: "0.5px",
};

const brandStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 13,
  letterSpacing: "0.3em",
  color: DARK_DIM,
  fontWeight: 700,
  margin: "8px 0 0",
  textTransform: "uppercase",
};

const modelStyle: React.CSSProperties = {
  fontFamily: "var(--font-marquee, var(--font-body))",
  fontSize: "clamp(1.8rem, 5.5vw, 2.6rem)",
  lineHeight: 1,
  letterSpacing: "0.02em",
  color: DARK,
  fontWeight: 700,
  margin: 0,
  textTransform: "uppercase",
};

const colorwayStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 13,
  letterSpacing: "0.18em",
  color: DARK,
  textTransform: "uppercase",
  margin: "6px 0 0",
  fontWeight: 600,
};

const dividerStyle: React.CSSProperties = {
  height: 1,
  background: DARK_SOFT,
  margin: "12px 0 8px",
};

const stockBase: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.04em",
};

const metaRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  marginTop: 4,
};

const metaLabelStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 11,
  color: DARK_DIM,
  textTransform: "uppercase",
  letterSpacing: "0.18em",
  minWidth: 76,
  fontWeight: 600,
};

const metaValueStyle: React.CSSProperties = {
  fontSize: 13,
  color: DARK,
  fontWeight: 500,
};

const sizeBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  margin: "4px 0",
};

const sizeHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const sizeGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: 6,
};

const outNoteStyle: React.CSSProperties = {
  fontSize: 13,
  color: DARK_DIM,
  textAlign: "center",
  margin: "4px 0 0",
};

const relatedStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 680,
  padding: "32px 16px 16px",
  borderTop: `1px solid ${DARK_SOFT}`,
  marginTop: 16,
};

const relatedEyebrowStyle: React.CSSProperties = {
  fontSize: "0.68rem",
  fontWeight: 700,
  color: DARK_DIM,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  display: "block",
  marginBottom: 4,
};

const relatedTitleStyle: React.CSSProperties = {
  fontFamily: "var(--font-marquee, var(--font-body))",
  fontSize: "1.25rem",
  letterSpacing: "0.08em",
  color: DARK,
  fontWeight: 700,
  margin: 0,
  textTransform: "uppercase",
};

/* ============================================================================
   LOCAL CSS — hover states, scrollbar, animations
   ============================================================================ */
const LOCAL_CSS = `
  /* ── Viewer outer: capa que controla el ancho del visor ── */
  .pd-viewer-outer {
    position: relative;
    width: 100%;
    margin: 0 auto;
  }
  @media (min-width: 720px) {
    .pd-viewer-outer { max-width: 360px; }
  }

  .pd-back-btn {
    background: none;
    border: 1px solid ${DARK_SOFT};
    color: ${DARK};
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-family: var(--font-mono, monospace);
    font-size: 11px;
    letter-spacing: 0.22em;
    font-weight: 700;
    transition: all .2s ease;
  }
  .pd-back-btn:hover {
    border-color: ${DARK};
    background: rgba(255,255,255,0.4);
    transform: translateX(-2px);
  }

  .pd-size-clear {
    background: none;
    border: none;
    color: ${DARK_DIM};
    font-family: var(--font-mono, monospace);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    cursor: pointer;
    padding: 0;
    transition: color .2s;
    font-weight: 600;
  }
  .pd-size-clear:hover { color: ${DARK}; }

  .pd-size-chip {
    background: ${PEARL};
    border: 1px solid ${DARK_SOFT};
    color: ${DARK};
    padding: 10px 0;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    font-family: var(--font-body, system-ui), sans-serif;
    cursor: pointer;
    transition: all .15s ease;
  }
  .pd-size-chip:hover {
    border-color: ${DARK};
    background: ${PEARL_HI};
  }
  .pd-size-chip.is-active {
    border-color: ${DARK};
    background: ${YELLOW};
    color: ${DARK};
    box-shadow: 0 0 0 2px rgba(244,220,63,0.45);
  }
  /* Botón que reemplaza la grilla cuando el producto no tiene talles
     cargados. No es un estado de error: es el camino que ya usan para
     vender, puesto donde el cliente lo necesita. */
  .pd-consultar-talle {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 9px;
    min-height: 48px;
    padding: 0 16px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(10, 10, 20, 0.14);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
    color: #0a0a14;
    font-size: 0.92rem;
    font-weight: 700;
    text-decoration: none;
    transition: background 200ms, transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .pd-consultar-talle:hover {
    background: rgba(255, 255, 255, 0.95);
    transform: translateY(-1px);
  }
  .pd-consultar-talle:focus-visible {
    outline: 2px solid #0a0a14;
    outline-offset: 3px;
  }

  .pd-size-chip.is-disabled {
    cursor: not-allowed;
    opacity: 0.35;
    text-decoration: line-through;
    background: transparent;
  }
  .pd-size-chip.is-disabled:hover {
    border-color: ${DARK_SOFT};
    background: transparent;
  }

  /* Agregar al pedido: el CTA principal de la ficha. Vidrio oscuro sobre el
     lila de la pagina, con el reflejo del borde superior — el mismo material
     del carrito y del menu, para que se lea como la misma familia. */
  .pd-cart-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 17px;
    margin-top: 16px;
    border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.5);
    background: rgba(10,10,20,0.9);
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.03em;
    cursor: pointer;
    box-shadow: 0 14px 34px -16px rgba(10,10,20,0.6),
                inset 0 1px 0 rgba(255,255,255,0.22);
    transition: transform .24s cubic-bezier(.16,1,.3,1), box-shadow .24s ease, background .24s ease;
  }
  .pd-cart-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 20px 40px -18px rgba(10,10,20,0.7),
                inset 0 1px 0 rgba(255,255,255,0.3);
  }
  .pd-cart-btn:active { transform: translateY(0); }
  .pd-cart-btn:focus-visible {
    outline: 3px solid rgba(255,255,255,0.85);
    outline-offset: 3px;
  }
  /* ── El confirmado, en vidrio y no en verde macizo ──────────────────
     Era un bloque #1d7a4a a todo el ancho: sobre el lila de la ficha
     rompía el lenguaje de toda la web, que es vidrio. Juani lo marcó junto
     con "recordá mantener el efecto iPhone liquid glass".

     Ahora confirma con el mismo material, apenas teñido de verde y con el
     tilde en color. El QUÉ agregaste lo cuenta el AvisoCarrito, que para
     eso salta. */
  .pd-cart-btn.is-done {
    background:
      linear-gradient(
          168deg,
          rgba(232, 250, 240, 0.92),
          rgba(214, 240, 226, 0.82)
        )
        padding-box,
      linear-gradient(
          140deg,
          rgba(255, 255, 255, 0.95),
          rgba(255, 255, 255, 0.25) 40%,
          rgba(29, 122, 74, 0.45)
        )
        border-box;
    border: 1px solid transparent;
    color: #12603a;
    box-shadow:
      0 14px 30px -14px rgba(18, 96, 58, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }
  @media (prefers-reduced-motion: reduce) {
    .pd-cart-btn { transition: none; }
    .pd-cart-btn:hover { transform: none; }
  }

  .pd-wa-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 16px;
    background: #25D366;
    color: #fff;
    font-size: 15px;
    font-weight: 700;
    border-radius: 14px;
    text-decoration: none;
    transition: all .2s ease;
    margin-top: 10px;
    letter-spacing: 0.04em;
    border: 1px solid rgba(10,10,20,0.15);
  }
  .pd-wa-btn:hover {
    background: #1ebe5d;
    transform: translateY(-1px);
    box-shadow: 0 6px 18px rgba(37,211,102,0.35);
  }
  .pd-wa-btn.is-secondary {
    background: ${PEARL};
    color: ${DARK};
    border: 1px solid ${DARK_SOFT};
  }
  .pd-wa-btn.is-secondary:hover {
    background: ${PEARL_HI};
    box-shadow: 0 6px 18px rgba(10,10,20,0.12);
  }

  .pd-share-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    padding: 12px 16px;
    border-radius: 12px;
    background: rgba(255,255,255,0.35);
    border: 1px solid ${DARK_SOFT};
    color: ${DARK};
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: all .2s ease;
    margin-top: 10px;
    font-family: inherit;
    letter-spacing: 0.04em;
  }
  .pd-share-btn:hover {
    background: rgba(255,255,255,0.6);
    border-color: ${DARK};
  }

  @keyframes pd-fade-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Related strip ── */
  /* Grilla, no tira que scrollea (4-sep-2026).
     Con overflow-x la ultima card quedaba cortada por la mitad y el nombre
     con ellipsis ("White And Bl..."): "en esos modelos de abajo medio que se
     corta, que quede bien centrado" (Juani). Son 5-8 colorways, entran de
     sobra envolviendo; asi ninguna se corta, la fila queda centrada y los
     nombres se leen enteros. */
  .pd-related-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(104px, 1fr));
    gap: 12px;
    justify-content: center;
    padding-bottom: 4px;
  }
  /* Con pocos colorways no estiramos las cards a todo el ancho: quedan del
     tamano natural y centradas. */
  @media (min-width: 560px) {
    .pd-related-strip {
      grid-template-columns: repeat(auto-fit, 116px);
    }
  }

  .pd-related-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: ${PEARL};
    border: 1px solid ${DARK_SOFT};
    border-radius: 14px;
    cursor: pointer;
    padding: 10px 8px 8px;
    width: 100%;
    min-width: 0;
    transition: transform .24s cubic-bezier(.16,1,.3,1), box-shadow .24s ease, border-color .2s ease, background .2s ease;
    text-decoration: none;
    color: ${DARK};
  }
  .pd-related-item:hover {
    border-color: ${DARK};
    transform: translateY(-3px);
    background: ${PEARL_HI};
    box-shadow: 0 8px 20px rgba(10,10,20,0.12);
  }
  .pd-related-item:focus-visible {
    outline: 2px solid ${DARK};
    outline-offset: 2px;
  }

  /* aspect-ratio en vez de alto fijo: la foto queda siempre centrada y
     cuadrada sin depender del tamano del archivo. */
  .pd-related-thumb {
    width: 100%;
    aspect-ratio: 1 / 1;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255,255,255,0.55);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pd-related-thumb img {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    padding: 8%;
  }
  /* Placeholder cuando la foto del colorway no existe. */
  .pd-related-sinfoto {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    font-size: 1.5rem;
    font-weight: 800;
    color: rgba(10,10,20,0.22);
    background: linear-gradient(160deg, rgba(255,255,255,0.7), rgba(230,226,240,0.7));
    letter-spacing: -0.02em;
  }

  .pd-related-360 {
    position: absolute;
    top: 4px;
    right: 4px;
    background: ${YELLOW};
    color: ${DARK};
    font-size: 8px;
    font-weight: 800;
    padding: 2px 5px;
    border-radius: 6px;
    letter-spacing: 0.5px;
  }
  /* Hasta dos lineas en vez de ellipsis: "White And Black" se leia
     "White And Bl...". Con line-clamp entra entero y las cards quedan
     igual de altas porque min-height reserva las dos lineas. */
  .pd-related-color {
    font-size: 0.7rem;
    color: ${DARK};
    text-align: center;
    line-height: 1.3;
    width: 100%;
    min-height: 1.82rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    overflow-wrap: anywhere;
    padding: 0 2px;
    font-weight: 600;
  }
  @media (prefers-reduced-motion: reduce) {
    .pd-related-item { transition: none; }
    .pd-related-item:hover { transform: none; }
  }
`;
