"use client";

/* ============================================================================
   PANEL DROPS — productos cargados desde el panel (BairesContro), en vivo.
   ----------------------------------------------------------------------------
   Se monta en la brand page y muestra, ARRIBA del archivo estático, los
   productos que se cargaron desde el panel para esa marca. Lee Supabase en el
   cliente (la web es export estático), así que aparecen sin re-buildear.

   Si no hay productos del panel para la marca, no renderiza nada (null) → no
   afecta el layout existente.
   ============================================================================ */

import { useEffect, useState } from "react";
import ColorwayCard from "./ColorwayCard";
import Frame360Viewer from "./Frame360Viewer";
import { fetchPanelProducts, type PanelProduct } from "@/data/landingProducts";
import { agregar } from "@/lib/carrito";

const DARK = "#0a0a14";
const YELLOW = "#f4dc3f";

export default function PanelDrops({ brandSlug }: { brandSlug?: string }) {
  const [items, setItems] = useState<PanelProduct[]>([]);
  const [abierto, setAbierto] = useState<PanelProduct | null>(null);

  useEffect(() => {
    let alive = true;
    fetchPanelProducts(brandSlug).then((rows) => {
      if (alive) setItems(rows);
    });
    return () => {
      alive = false;
    };
  }, [brandSlug]);

  if (items.length === 0) return null;

  return (
    <section style={{ marginBottom: "2.5rem" }}>
      {/* Encabezado de sección */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          marginBottom: "1.2rem",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.7rem",
          letterSpacing: "0.28em",
          textTransform: "uppercase",
          color: DARK,
          fontWeight: 700,
        }}
      >
        <span style={{ color: YELLOW, textShadow: "0 0 8px rgba(244,220,63,0.6)" }}>◆</span>
        NUEVOS INGRESOS
        <span style={{ flex: 1, height: 1, background: "rgba(10,10,20,0.2)" }} />
        <span style={{ opacity: 0.6 }}>{items.length}</span>
      </div>

      {/* Grid responsive (mismo encuadre que el catálogo) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1.4rem",
        }}
      >
        {items.map((p) => (
          <div key={p.path} style={{ position: "relative" }}>
            {/* Estos productos no tienen ruta estática generada, así que la
                card abre el visor 360 en un modal en vez de navegar. */}
            <ColorwayCard entry={p} onClick={() => setAbierto(p)} />
            {p.badge && <BadgeTag badge={p.badge} />}
            {(p.sizes.length > 0 || p.stock !== null) && (
              <MetaStrip sizes={p.sizes} stock={p.stock} />
            )}
          </div>
        ))}
      </div>

      {abierto && <VisorModal producto={abierto} onClose={() => setAbierto(null)} />}
    </section>
  );
}

/** Modal con el visor 360 (o la foto grande si el producto no tiene 360). */
function VisorModal({ producto, onClose }: { producto: PanelProduct; onClose: () => void }) {
  /* ── Ahora se puede COMPRAR desde acá (5-sep-2026) ────────────────────
     Este modal era un visor y nada más: se giraba la zapatilla y se cerraba.
     Para 89 de los 91 productos de "NUEVOS INGRESOS" —los que no tienen
     ficha propia en el sitio estático— ERA la tienda, y era un callejón sin
     salida. Fabri entró por el menú a una marca, tocó lo primero que vio, y
     ese es exactamente el camino. */
  const [size, setSize] = useState<string>(
    producto.sizes.length === 1 ? producto.sizes[0] : "",
  );
  const [listo, setListo] = useState(false);
  const [pideTalle, setPideTalle] = useState(false);

  const necesitaTalle = producto.sizes.length > 0;
  const agotado = producto.stock != null && producto.stock <= 0;

  function onAgregar() {
    if (agotado) return;
    if (necesitaTalle && !size) {
      setPideTalle(true);
      return;
    }
    agregar({
      /* id por PATH y no por el uuid de la fila: la ficha estática agrega
         con entry.path, así que si acá usáramos otro identificador el mismo
         par entraría al carrito dos veces según por dónde se agregó. Hoy no
         se solapan (estos 89 no tienen ficha), pero se solaparían en cuanto
         el catálogo se re-buildee con ellos adentro. */
      id: producto.path,
      brand: producto.brand,
      model: producto.model,
      colorway: producto.colorway,
      imageUrl: producto.imageUrl,
      size,
      price: producto.price,
      transferencia: producto.transferencia,
    });
    setListo(true);
    setPideTalle(false);
    /* Se cierra al agregar. El aviso del carrito vive en z-index 70 y este
       modal en 100: si quedara abierto, taparía la confirmación — el mismo
       defecto de "la función está pero no se ve". Y volver a la grilla es
       mejor: se sigue eligiendo. */
    window.setTimeout(() => {
      setListo(false);
      onClose();
    }, 850);
  }

  // Cerrar con Escape y bloquear el scroll del fondo mientras está abierto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const is360 = producto.type === "360" && producto.frames > 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(10,10,20,0.82)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.2rem",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          background: "#fff",
          borderRadius: 18,
          border: `2px solid ${DARK}`,
          maxWidth: 620,
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            zIndex: 5,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: `1px solid ${DARK}`,
            background: "rgba(255,255,255,0.9)",
            color: DARK,
            fontSize: "1.1rem",
            lineHeight: 1,
            cursor: "pointer",
          }}
        >
          ×
        </button>

        {is360 ? (
          <Frame360Viewer entry={producto} aspectRatio={1} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={producto.imageUrl}
            alt={`${producto.brand} ${producto.model} ${producto.colorway}`}
            referrerPolicy="no-referrer"
            style={{ width: "100%", aspectRatio: "1", objectFit: "contain", display: "block" }}
          />
        )}

        <div style={{ padding: "1rem 1.2rem 1.2rem", background: "rgba(10,10,20,0.94)" }}>
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.55rem",
              letterSpacing: "0.3em",
              color: "rgba(244,220,63,0.75)",
              marginBottom: "0.35rem",
            }}
          >
            ▸ {producto.brand}
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "#fff", lineHeight: 1.25 }}>
            {producto.model}
          </div>
          <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
            {producto.colorway}
          </div>

          {necesitaTalle && (
            <div style={{ marginTop: "0.9rem" }}>
              {pideTalle && (
                <p
                  style={{
                    margin: "0 0 6px",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.6rem",
                    letterSpacing: "0.18em",
                    textTransform: "uppercase",
                    color: "#ffb37a",
                  }}
                >
                  Elegí un talle
                </p>
              )}
              <SizeStrip
                sizes={producto.sizes}
                dark
                value={size}
                onSelect={(s) => {
                  setSize(s);
                  setPideTalle(false);
                }}
              />
            </div>
          )}

          <button
            type="button"
            onClick={onAgregar}
            disabled={agotado}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              width: "100%",
              minHeight: 52,
              marginTop: "1rem",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.22)",
              background: agotado
                ? "rgba(255,255,255,0.08)"
                : listo
                  ? "rgba(29,122,74,0.9)"
                  : "#fff",
              color: agotado ? "rgba(255,255,255,0.45)" : listo ? "#fff" : DARK,
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: agotado ? "not-allowed" : "pointer",
              transition: "background 200ms, color 200ms",
            }}
          >
            {agotado ? "Sin stock" : listo ? "✓ Agregado" : "Agregar al pedido"}
          </button>

          <div
            style={{
              marginTop: "0.9rem",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.55rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: YELLOW,
              fontWeight: 700,
            }}
          >
            {is360 ? `${producto.frames} frames · arrastrá para girar` : "Foto única"}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Etiquetas promocionales — mismas que en el panel y en Ba1res. */
const BADGES: Record<string, { label: string; bg: string; fg: string }> = {
  hot:             { label: "🔥 MÁS VENDIDO",      bg: "#E53935", fg: "#fff" },
  new:             { label: "✨ NEW",               bg: "#f4dc3f", fg: "#0a0a14" },
  nuevo:           { label: "✨ NUEVO LANZAMIENTO", bg: "#f4dc3f", fg: "#0a0a14" },
  drop:            { label: "🚀 ÚLTIMOS DROPS",     bg: "#6200EA", fg: "#fff" },
  "ultimos-pares": { label: "⚡ ÚLTIMOS PARES",     bg: "#FF6D00", fg: "#fff" },
  exclusivo:       { label: "👑 EXCLUSIVO",         bg: "#0a0a14", fg: "#f4dc3f" },
  oferta:          { label: "💰 OFERTA",            bg: "#00C853", fg: "#fff" },
  preventa:        { label: "📦 PREVENTA",          bg: "#0091EA", fg: "#fff" },
  restock:         { label: "🔄 VUELVE EL CLÁSICO", bg: "#00838F", fg: "#fff" },
};

function BadgeTag({ badge }: { badge: string }) {
  const b = BADGES[badge];
  if (!b) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: 10,
        left: 10,
        zIndex: 3,
        background: b.bg,
        color: b.fg,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.5rem",
        fontWeight: 800,
        letterSpacing: "0.14em",
        padding: "4px 8px",
        borderRadius: 4,
        pointerEvents: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      }}
    >
      {b.label}
    </div>
  );
}

/** Talles y stock debajo de la card. */
function MetaStrip({ sizes, stock }: { sizes: string[]; stock: number | null }) {
  const agotado = stock === 0;
  const pocos = stock !== null && stock > 0 && stock < 5;

  return (
    <div style={{ marginTop: 8 }}>
      {(agotado || pocos) && (
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.55rem",
            fontWeight: 700,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: agotado ? "rgba(10,10,20,0.45)" : "#FF6D00",
            marginBottom: 5,
          }}
        >
          {agotado
            ? "◦ Agotado"
            : stock === 1
              ? "⚡ Última unidad"
              : `⚡ Últimas ${stock} unidades`}
        </div>
      )}
      {sizes.length > 0 && <SizeStrip sizes={sizes} />}
    </div>
  );
}

/** Talles disponibles. `dark` = sobre fondo oscuro (modal). */
/** Los talles vienen DESORDENADOS de la base — medido: "35 37 36 38" en
    Louis Vuitton, "38 40 41 42 46 45 39" en Balenciaga. Ordenar es lo mínimo
    para que se puedan leer de un vistazo. */
function ordenarTalles(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));
}

/**
 * Los talles. Con `onSelect` son BOTONES que se pueden elegir; sin él,
 * etiquetas de sólo lectura (así los sigue usando la card de la grilla).
 *
 * ── Por qué esto cambió (5-sep-2026) ──────────────────────────────────
 * Fabri: "no hay para añadir zapatilla ni talle al carrito cuando entro
 * desde el catálogo de marcas". Medido: el modal del visor tenía UN SOLO
 * elemento interactivo — el botón de cerrar — y los talles eran <span>.
 * Se podía girar la zapatilla y cerrar. Nada más.
 *
 * Y ese es el camino por el que entra la gente: la grilla de arriba, la que
 * el sitio pone primero y etiqueta como lo nuevo, son 91 productos y 89 de
 * ellos NO tienen ficha propia en el sitio estático. O sea que para casi
 * todo lo nuevo, ese modal ERA la tienda.
 */
function SizeStrip({
  sizes,
  dark = false,
  value,
  onSelect,
}: {
  sizes: string[];
  dark?: boolean;
  value?: string;
  onSelect?: (s: string) => void;
}) {
  const labelColor = dark ? "rgba(255,255,255,0.5)" : "rgba(10,10,20,0.55)";
  const chipColor  = dark ? "#fff" : DARK;
  const chipBorder = dark ? "rgba(255,255,255,0.3)" : "rgba(10,10,20,0.28)";
  const chipBg     = dark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.55)";

  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.5rem",
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: labelColor,
          marginRight: 2,
        }}
      >
        Talles
      </span>
      {ordenarTalles(sizes).map((s) => {
        const activo = value === s;
        const base: React.CSSProperties = {
          fontFamily: "var(--font-mono, monospace)",
          fontWeight: 700,
          color: activo ? (dark ? "#0a0a14" : "#fff") : chipColor,
          border: `1px solid ${activo ? (dark ? "#fff" : DARK) : chipBorder}`,
          borderRadius: onSelect ? 9 : 4,
          background: activo ? (dark ? "#fff" : DARK) : chipBg,
        };
        if (!onSelect) {
          return (
            <span key={s} style={{ ...base, fontSize: "0.6rem", padding: "2px 6px" }}>
              {s}
            </span>
          );
        }
        return (
          <button
            key={s}
            type="button"
            aria-pressed={activo}
            onClick={() => onSelect(s)}
            style={{
              ...base,
              /* 44px de lado: es el mínimo táctil de iOS. Los chips de 2px de
                 padding se leían pero no se podían tocar bien con el pulgar
                 — y elegir talle es el paso obligatorio antes de comprar. */
              minWidth: 44,
              minHeight: 44,
              fontSize: "0.82rem",
              cursor: "pointer",
              transition: "background 160ms, color 160ms, border-color 160ms",
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}
