"use client";

/* ============================================================================
   AVISO DE CARRITO — qué acabás de agregar, y qué llevás.
   ----------------------------------------------------------------------------
   Juani, 5-sep-2026: "cuando agrego pares al carrito, que vaya saltando cómo
   está el carrito de compras, qué zapatillas tengo ahí dentro y el talle".

   Antes, agregar sólo cambiaba el texto del botón a "✓ Agregado · 10 pares".
   Ese número es el total del carrito, así que decía CUÁNTO llevás pero nunca
   QUÉ — y en una tienda donde se elige por talle, "10 pares" sin saber de
   cuáles no confirma nada. Peor: en la ficha de producto ni siquiera había un
   carrito a la vista donde ir a mirar.

   Ahora, cada vez que entra algo, salta este panel con las últimas zapas y su
   talle. Se va solo a los 5 segundos — es una confirmación, no una pantalla
   más que haya que cerrar.

   Material: el mismo vidrio claro del menú y de la lámina de entrada (relleno
   en padding-box + gradiente de borde en border-box). Una sola familia de
   vidrio en toda la web.
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import { useCarrito, useTotales, linkPedido } from "@/lib/carrito";

/** Cuánto se queda en pantalla desde el último agregado. */
const VISIBLE_MS = 5000;

/** Cuántas zapas se listan. Más que esto y el panel tapa media pantalla. */
const MAX_ITEMS = 3;

export default function AvisoCarrito() {
  const items = useCarrito();
  const { unidades } = useTotales();
  const [visible, setVisible] = useState(false);
  /* Arranca en null y no en 0: así el primer render, que ya puede traer un
     carrito con cosas de una visita anterior, no dispara el aviso. Sólo se
     muestra cuando el número SUBE estando la página abierta. */
  const previas = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const antes = previas.current;
    previas.current = unidades;
    if (antes === null || unidades <= antes) return;

    setVisible(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setVisible(false), VISIBLE_MS);
  }, [unidades]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  if (!visible || items.length === 0) return null;

  /* Los últimos que entraron van arriba: es lo que el visitante acaba de
     hacer y lo que está buscando confirmar. */
  const ultimos = [...items].reverse().slice(0, MAX_ITEMS);
  const resto = items.length - ultimos.length;

  return (
    <div className="aviso" role="status" aria-live="polite">
      <div className="cab">
        <span className="tit">
          {unidades === 1 ? "1 par en tu pedido" : `${unidades} pares en tu pedido`}
        </span>
        <button
          type="button"
          className="cerrar"
          onClick={() => setVisible(false)}
          aria-label="Cerrar aviso"
        >
          ✕
        </button>
      </div>

      <ul className="lista">
        {ultimos.map((i) => (
          <li key={i.key}>
            <img src={i.imageUrl} alt="" aria-hidden="true" loading="lazy" />
            <span className="datos">
              <span className="marca">{i.brand}</span>
              <span className="modelo">{i.model}</span>
            </span>
            <span className="talle">
              {i.size ? `Talle ${i.size}` : "Sin talle"}
              {i.qty > 1 && <em>×{i.qty}</em>}
            </span>
          </li>
        ))}
      </ul>

      {resto > 0 && (
        <p className="resto">
          y {resto} {resto === 1 ? "par más" : "pares más"}
        </p>
      )}

      <a className="wa" href={linkPedido(items)} target="_blank" rel="noopener noreferrer">
        Pedir por WhatsApp
      </a>

      <style jsx>{`
        .aviso {
          position: fixed;
          left: 12px;
          right: 12px;
          /* Abajo y no arriba: es donde está el pulgar y donde vive el botón
             del carrito. Y por encima del safe-area del iPhone. */
          bottom: calc(16px + env(safe-area-inset-bottom));
          z-index: 70;
          max-width: 460px;
          margin: 0 auto;
          display: grid;
          gap: 10px;
          padding: 14px 14px 12px;
          border: 1px solid transparent;
          border-radius: 22px;
          background:
            linear-gradient(
                168deg,
                rgba(255, 253, 250, 0.92),
                rgba(240, 232, 252, 0.78)
              )
              padding-box,
            linear-gradient(
                140deg,
                rgba(255, 255, 255, 0.95),
                rgba(255, 255, 255, 0.2) 38%,
                rgba(255, 255, 255, 0.08) 64%,
                rgba(126, 88, 190, 0.42)
              )
              border-box;
          backdrop-filter: blur(26px) saturate(180%);
          -webkit-backdrop-filter: blur(26px) saturate(180%);
          box-shadow:
            0 30px 70px -24px rgba(38, 20, 66, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          color: #17121f;
          /* El salto: entra desde abajo con un rebote corto. Es la parte que
             hace que se sienta que ALGO entró al carrito. */
          animation: saltar 460ms cubic-bezier(0.22, 1.2, 0.36, 1) both;
        }
        @keyframes saltar {
          from {
            opacity: 0;
            transform: translateY(26px) scale(0.96);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .cab {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }
        .tit {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.66rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(38, 20, 66, 0.62);
        }
        .cerrar {
          border: 0;
          background: none;
          color: rgba(38, 20, 66, 0.45);
          font: inherit;
          cursor: pointer;
          padding: 2px 4px;
          line-height: 1;
        }

        .lista {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          gap: 8px;
        }
        .lista li {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .lista img {
          width: 44px;
          height: 44px;
          flex: 0 0 auto;
          border-radius: 11px;
          object-fit: contain;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.9);
        }
        .datos {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 1px;
        }
        .marca {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.58rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(38, 20, 66, 0.55);
        }
        .modelo {
          font-size: 0.88rem;
          font-weight: 700;
          line-height: 1.2;
          /* Los nombres largos no pueden empujar al talle fuera de la
             tarjeta: se cortan con puntos suspensivos. */
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .talle {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.9);
          font-size: 0.74rem;
          font-weight: 700;
          white-space: nowrap;
        }
        .talle em {
          font-style: normal;
          color: rgba(38, 20, 66, 0.55);
        }

        .resto {
          margin: 0 2px;
          font-size: 0.74rem;
          color: rgba(38, 20, 66, 0.55);
        }

        .wa {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          border-radius: 14px;
          background: #1d1230;
          color: #f6f2ff;
          font-weight: 700;
          font-size: 0.9rem;
          text-decoration: none;
          box-shadow: 0 10px 24px -10px rgba(29, 18, 48, 0.7);
        }
        .wa:focus-visible {
          outline: 2px solid #7e58be;
          outline-offset: 3px;
        }

        @media (prefers-reduced-motion: reduce) {
          .aviso {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}
