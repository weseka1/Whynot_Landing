"use client";

/* ============================================================================
   CARD PRODUCTO — la unidad de la tienda.
   ----------------------------------------------------------------------------
   Decisión: el precio es el protagonista, no la foto. La foto vende el deseo
   pero el precio es lo que la gente vino a buscar — y es lo que hoy la web no
   muestra, teniendo 311 productos con precio cargado en el panel.

   Orden de lectura, de arriba a abajo: qué es → cuánto sale → cómo lo pago →
   qué talle → agregarlo. Nada más. Cada cosa que se agregue acá le compite
   atención al botón.

   El talle es obligatorio antes de agregar (salvo que el producto no tenga
   talles cargados): un pedido sin talle obliga al vendedor a repreguntar, que
   es exactamente la fricción que estamos sacando.
   ============================================================================ */

import { useState } from "react";
import { agregar } from "@/lib/carrito";
import { formatPrecio, type PanelProduct } from "@/data/landingProducts";

export default function CardProducto({ p }: { p: PanelProduct }) {
  const [size, setSize] = useState<string>(p.sizes.length === 1 ? p.sizes[0] : "");
  const [listo, setListo] = useState(false);
  const [pideTalle, setPideTalle] = useState(false);

  const necesitaTalle = p.sizes.length > 0;
  const agotado = p.stock != null && p.stock <= 0;

  function onAgregar() {
    if (agotado) return;
    if (necesitaTalle && !size) {
      setPideTalle(true);
      return;
    }
    agregar({
      id: p.id,
      brand: p.brand,
      model: p.model,
      colorway: p.colorway,
      imageUrl: p.imageUrl,
      size,
      price: p.price,
      transferencia: p.transferencia,
    });
    setListo(true);
    setPideTalle(false);
    window.setTimeout(() => setListo(false), 1600);
  }

  return (
    <article className="card" data-desliza-item>
      <div className="foto">
        <img src={p.imageUrl} alt={`${p.brand} ${p.model} ${p.colorway}`} loading="lazy" decoding="async" />
        {p.badge && <span className="badge">{p.badge}</span>}
        {agotado && <span className="agotado">Sin stock</span>}
      </div>

      <div className="cuerpo">
        <p className="marca">{p.brand}</p>
        <h3 className="modelo">{p.model}</h3>
        {p.colorway && <p className="color">{p.colorway}</p>}

        {p.price != null ? (
          <div className="precios">
            <p className="precio">{formatPrecio(p.price, p.currency)}</p>
            {p.transferencia != null && p.transferencia < p.price && (
              <p className="transf">
                {formatPrecio(p.transferencia, p.currency)} <span>por transferencia</span>
              </p>
            )}
            {p.cuota3 != null && (
              <p className="cuotas">
                3 cuotas de {formatPrecio(p.cuota3, p.currency)}
                {p.cuota6 != null && <> · 6 de {formatPrecio(p.cuota6, p.currency)}</>}
              </p>
            )}
          </div>
        ) : (
          <p className="sinprecio">Consultá el precio</p>
        )}

        {necesitaTalle && (
          <div className="talles">
            <p className={`lbl${pideTalle ? " pide" : ""}`}>
              {pideTalle ? "Elegí un talle" : "Talle"}
            </p>
            <div className="chips">
              {p.sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip${size === s ? " on" : ""}`}
                  onClick={() => {
                    setSize(s);
                    setPideTalle(false);
                  }}
                  aria-pressed={size === s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <button type="button" className={`cta${listo ? " ok" : ""}`} onClick={onAgregar} disabled={agotado}>
          {agotado ? "Sin stock" : listo ? "Agregado ✓" : "Agregar"}
        </button>
      </div>

      <style jsx>{`
        /* Sin backdrop-filter: la grilla vive sobre un fondo plano, no hay
           nada detras que difuminar, y 16 blurs re-sampleando en cada scroll
           era costo puro (se sentia lento en PC). El vidrio de verdad queda
           donde flota sobre contenido: carrito, menu, burbujas, buscador. */
        .card {
          position: relative;
          display: flex;
          flex-direction: column;
          border-radius: 22px;
          overflow: hidden;
          background: rgba(243, 236, 225, 0.055);
          border: 1px solid rgba(243, 236, 225, 0.1);
          box-shadow: 0 18px 44px -26px rgba(0, 0, 0, 0.8),
            inset 0 1px 0 rgba(243, 236, 225, 0.14);
          transition: transform 380ms cubic-bezier(0.16, 1, 0.3, 1),
            box-shadow 380ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .card:hover {
          transform: translateY(-3px);
          box-shadow: 0 26px 56px -26px rgba(0, 0, 0, 0.9),
            inset 0 1px 0 rgba(243, 236, 225, 0.2);
        }

        /* La foto viene del catálogo sobre fondo blanco horneado: le damos un
           lecho claro para que no flote sobre el vidrio oscuro. */
        .foto {
          position: relative;
          aspect-ratio: 1 / 1;
          background: linear-gradient(160deg, #fbfaf8, #eceae6);
          overflow: hidden;
        }
        /* contain, NO cover: son fotos de producto recortadas sobre blanco.
           Con cover el zapato se sale del cuadro y queda cortado arriba y
           abajo. Con contain entra entero y centrado; el padding evita que
           toque los bordes y el aspect-ratio mantiene la grilla pareja. */
        .foto img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          padding: 9%;
          display: block;
        }
        .badge,
        .agotado {
          position: absolute;
          top: 10px;
          left: 10px;
          padding: 5px 10px;
          border-radius: 999px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.58rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          background: rgba(10, 9, 8, 0.72);
          color: var(--color-fg, #f3ece1);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .agotado {
          left: auto;
          right: 10px;
          background: rgba(10, 9, 8, 0.85);
          color: #d9cfc2;
        }

        /* flex:1 + el .cta con margin-top:auto alinean los botones de toda la
           fila aunque un producto tenga 10 talles y el de al lado 4. Sin esto
           la grilla queda escalonada. */
        .cuerpo {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 16px 16px 18px;
          min-width: 0;
        }
        .marca {
          margin: 0;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.6rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-muted, #6e6155);
        }
        .modelo {
          margin: 0;
          font-size: 1.02rem;
          font-weight: 600;
          line-height: 1.2;
          letter-spacing: -0.01em;
          color: var(--color-fg, #f3ece1);
          /* nombres largos no rompen la grilla */
          overflow-wrap: anywhere;
        }
        .color {
          margin: 0;
          font-size: 0.82rem;
          color: var(--color-muted, #6e6155);
          overflow-wrap: anywhere;
        }

        .precios {
          margin-top: 4px;
          display: grid;
          gap: 2px;
        }
        .precio {
          margin: 0;
          font-size: 1.32rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
          color: var(--color-fg, #f3ece1);
        }
        .transf {
          margin: 0;
          font-size: 0.84rem;
          font-variant-numeric: tabular-nums;
          color: var(--color-gold-soft, #c9ad6b);
        }
        .transf span {
          font-size: 0.72rem;
          color: var(--color-muted, #6e6155);
        }
        .cuotas {
          margin: 0;
          font-size: 0.74rem;
          font-variant-numeric: tabular-nums;
          color: var(--color-muted, #6e6155);
        }
        .sinprecio {
          margin: 4px 0 0;
          font-size: 0.88rem;
          color: var(--color-muted, #6e6155);
        }

        .talles {
          margin-top: 4px;
        }
        .lbl {
          margin: 0 0 6px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.58rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-muted, #6e6155);
          transition: color 200ms;
        }
        .lbl.pide {
          color: var(--color-gold-soft, #c9ad6b);
        }
        /* Una sola linea con scroll lateral: 10 talles envueltos hacian una
           card el doble de alta que la de al lado. Scrollbar oculta, con el
           talle siguiente asomando para que se note que corre. */
        .chips {
          display: flex;
          gap: 6px;
          overflow-x: auto;
          overscroll-behavior-x: contain;
          scroll-snap-type: x proximity;
          -ms-overflow-style: none;
          scrollbar-width: none;
          padding-bottom: 2px;
        }
        .chips::-webkit-scrollbar {
          display: none;
        }
        .chip {
          flex: 0 0 auto;
          scroll-snap-align: start;
          min-width: 44px;
          min-height: 34px;
          padding: 0 10px;
          border-radius: 10px;
          border: 1px solid rgba(243, 236, 225, 0.16);
          background: rgba(243, 236, 225, 0.05);
          color: var(--color-fg, #f3ece1);
          font-size: 0.8rem;
          font-variant-numeric: tabular-nums;
          cursor: pointer;
          transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .chip:hover {
          border-color: rgba(243, 236, 225, 0.34);
        }
        .chip.on {
          background: var(--color-fg, #f3ece1);
          color: #0a0908;
          border-color: transparent;
          font-weight: 600;
        }
        .chip:focus-visible {
          outline: 2px solid var(--color-gold-soft, #c9ad6b);
          outline-offset: 2px;
        }

        .cta {
          /* auto: empuja el boton al fondo y alinea toda la fila */
          margin-top: auto;
          padding-top: 0;
          min-height: 46px;
          border-radius: 12px;
          border: 1px solid rgba(243, 236, 225, 0.2);
          background: var(--color-fg, #f3ece1);
          color: #0a0908;
          font-size: 0.9rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          cursor: pointer;
          transition: all 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cta:hover:not(:disabled) {
          transform: translateY(-1px);
        }
        .cta.ok {
          background: var(--color-gold-soft, #c9ad6b);
        }
        .cta:disabled {
          opacity: 0.42;
          cursor: not-allowed;
        }
        .cta:focus-visible {
          outline: 2px solid var(--color-gold-soft, #c9ad6b);
          outline-offset: 2px;
        }

        @media (prefers-reduced-motion: reduce) {
          .card,
          .cta,
          .chip {
            transition: none;
          }
          .card:hover,
          .cta:hover:not(:disabled) {
            transform: none;
          }
        }
      `}</style>
    </article>
  );
}
