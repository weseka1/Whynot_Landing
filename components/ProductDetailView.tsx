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
     · CTA WhatsApp + CTA Instagram + Share (Web Share API)
     · Related products strip (otros colorways del mismo modelo)
   ============================================================================ */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Frame360Viewer from "@/components/Frame360Viewer";
import {
  buildWhatsAppUrl,
  buildProductMessage,
  handleInstagramClick,
} from "@/lib/contact";
import type { CatalogEntry } from "@/data/catalog";
import { posterUrl } from "@/data/catalog";
import type { ProductMeta, Badge } from "@/lib/productMeta";
import { WhatsAppIcon, InstagramIcon } from "@/components/icons/SocialIcons";

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
  meta: ProductMeta;
};

export default function ProductDetailView({ entry, related, meta }: Props) {
  const router = useRouter();
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [igFeedback, setIgFeedback] = useState<string>("");
  const [canShare, setCanShare] = useState(false);

  const outOfStock = meta.stock === 0;
  const sizeAvailable = (s: string) => meta.sizes.includes(s);

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

  function onIgClick() {
    void handleInstagramClick(entry, selectedSize || undefined, (msg) => {
      setIgFeedback(msg);
      setTimeout(() => setIgFeedback(""), 5000);
    });
  }

  async function onShare() {
    try {
      await navigator.share({
        text: buildProductMessage(entry, selectedSize || undefined),
      });
    } catch {
      /* user cancelled */
    }
  }

  function onBack() {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push(`/catalog/${entry.slug.brand}`);
  }

  const waUrl = buildWhatsAppUrl(entry, selectedSize || undefined);

  return (
    <div style={pageStyle}>
      <style>{LOCAL_CSS}</style>

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
          {meta.badge && (
            <span
              style={{
                ...badgeBase,
                background: BADGE_MAP[meta.badge].bg,
                color: BADGE_MAP[meta.badge].fg,
              }}
            >
              {BADGE_MAP[meta.badge].label}
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
          <StockIndicator stock={meta.stock} />
        </div>

        {/* Categoría */}
        <div style={metaRowStyle}>
          <span style={metaLabelStyle}>Categoría</span>
          <span style={metaValueStyle}>{meta.category}</span>
        </div>

        <div style={dividerStyle} />

        {/* Talles */}
        <div style={sizeBlockStyle}>
          <div style={sizeHeaderStyle}>
            <span style={metaLabelStyle}>Talle</span>
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
                  onClick={() => setSelectedSize(active ? "" : s)}
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

        {/* CTA WhatsApp */}
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`pd-wa-btn${outOfStock ? " is-secondary" : ""}`}
          aria-label={`Pedir ${entry.brand} ${entry.model} por WhatsApp`}
        >
          <WhatsAppIcon size={20} />
          {outOfStock ? "Consultar reposición" : "Pedir por WhatsApp"}
        </a>

        {/* CTA Instagram */}
        <button
          type="button"
          onClick={onIgClick}
          className="pd-ig-btn"
          aria-label={`Pedir ${entry.brand} ${entry.model} por Instagram`}
        >
          <InstagramIcon size={18} />
          Pedir por Instagram
        </button>

        {igFeedback && (
          <p className="pd-ig-feedback" role="status" aria-live="polite">
            {igFeedback}
          </p>
        )}

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
                  <img
                    src={posterUrl(p)}
                    alt={`${p.brand} ${p.model} ${p.colorway}`}
                    loading="lazy"
                  />
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
function StockIndicator({ stock }: { stock: number }) {
  if (stock === 0)
    return <span style={{ ...stockBase, color: "#d33b3b" }}>● Sin stock</span>;
  if (stock < 5)
    return (
      <span style={{ ...stockBase, color: "#c47800" }}>
        ● Últimas {stock} unidades
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

  .pd-ig-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    padding: 13px 16px;
    border-radius: 14px;
    background: transparent;
    border: 1px solid rgba(193, 53, 132, .45);
    color: rgba(193, 53, 132, .92);
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all .2s ease;
    margin-top: 8px;
    font-family: inherit;
  }
  .pd-ig-btn:hover {
    background: linear-gradient(135deg, rgba(193, 53, 132, .12), rgba(131, 58, 180, .08));
    border-color: rgba(193, 53, 132, .85);
    color: #c13584;
    transform: translateY(-1px);
  }
  .pd-ig-btn:focus-visible {
    outline: 2px solid rgba(193, 53, 132, .7);
    outline-offset: 2px;
  }

  .pd-ig-feedback {
    font-size: 13px;
    color: rgba(193, 53, 132, .95);
    background: rgba(193, 53, 132, .08);
    border: 1px solid rgba(193, 53, 132, .25);
    border-radius: 10px;
    padding: 10px 14px;
    margin-top: 8px;
    text-align: center;
    animation: pd-fade-in .2s ease;
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
  .pd-related-strip {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 12px;
    scrollbar-width: thin;
    scrollbar-color: ${DARK} rgba(10,10,20,0.08);
  }
  .pd-related-strip::-webkit-scrollbar { height: 5px; }
  .pd-related-strip::-webkit-scrollbar-track {
    background: rgba(10,10,20,0.08);
    border-radius: 4px;
  }
  .pd-related-strip::-webkit-scrollbar-thumb {
    background: ${DARK};
    border-radius: 4px;
  }

  .pd-related-item {
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    background: ${PEARL};
    border: 1px solid ${DARK_SOFT};
    border-radius: 14px;
    cursor: pointer;
    padding: 10px 8px 8px;
    width: 100px;
    transition: all .2s ease;
    text-decoration: none;
    color: ${DARK};
  }
  .pd-related-item:hover {
    border-color: ${DARK};
    transform: translateY(-3px);
    background: ${PEARL_HI};
    box-shadow: 0 8px 20px rgba(10,10,20,0.12);
  }

  .pd-related-thumb {
    width: 80px;
    height: 80px;
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
    padding: 4px;
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
  .pd-related-color {
    font-size: 0.7rem;
    color: ${DARK};
    text-align: center;
    line-height: 1.3;
    width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    padding: 0 2px;
    font-weight: 600;
  }
`;
