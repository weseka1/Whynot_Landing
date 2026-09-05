"use client";

/* ============================================================================
   BARRA DE PEDIDO — cómo se compra acá, siempre a la vista.
   ----------------------------------------------------------------------------
   Juani, 5-sep-2026: "el WhatsApp debe quedar como foco principal, igual que
   canal de WhatsApp + la info de compra, y que sea APB — a prueba de boludos,
   muy fácil de entender". Y Fabri, el dueño, no entendió que había que
   scrollear para seguir viendo.

   ── El problema medido ────────────────────────────────────────────────────
   Toda la promesa comercial de la tienda —que se compra por WhatsApp, que se
   paga al recibir, que hay envíos a todo el país— vivía en la microcopy del
   hero: 9,6 a 11,5 px, en gris apagado sobre un cielo rosa, y dos de sus tres
   piezas quedaban DEBAJO de elementos fijos (el header y la guía de scroll).
   O sea: estaba en el DOM y no se leía.

   Y la página mide 13,3 pantallas. Quien entra y no scrollea no se entera de
   nada; quien scrollea, se entera tarde: "Cómo comprar" es la CUARTA sección.

   ── Qué hace esto ─────────────────────────────────────────────────────────
   Una barra fija abajo que dice las dos cosas que hay que saber, sin
   scrollear: se pide por WhatsApp, y se paga al recibir. Con el carrito
   vacío —que es el 100% de las primeras visitas— invita a escribir. Con algo
   adentro, se convierte en el botón de mandar el pedido.

   No compite con el carrito: lo reemplaza cuando está vacío y lo completa
   cuando no. Y se esconde sola donde estorbaría (con el menú abierto, o
   cuando el aviso de carrito está en pantalla).
   ============================================================================ */

import { useEffect, useState } from "react";
import { WHATSAPP, useTotales, useCarrito, linkPedido } from "@/lib/carrito";

/* Mensaje de arranque para quien todavía no eligió nada. Corto y con la
   pregunta hecha: el vendedor recibe algo a lo que responder. */
const CONSULTA = "Hola! Vi la web y quiero consultar por un par 👟";

export default function BarraPedido() {
  const { unidades } = useTotales();
  const items = useCarrito();
  const [oculta, setOculta] = useState(false);

  /* Se esconde con el menú abierto: ahí la pantalla ya es del menú. El menú
     bloquea el scroll del body, así que eso alcanza como señal. */
  useEffect(() => {
    const mirar = () => setOculta(document.body.style.overflow === "hidden");
    mirar();
    const obs = new MutationObserver(mirar);
    obs.observe(document.body, { attributes: true, attributeFilter: ["style"] });
    return () => obs.disconnect();
  }, []);

  if (oculta) return null;

  const conPedido = unidades > 0;
  const href = conPedido
    ? linkPedido(items)
    : `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(CONSULTA)}`;

  return (
    <a
      className="barra"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={conPedido ? "Mandar el pedido por WhatsApp" : "Consultar por WhatsApp"}
    >
      <span className="icono" aria-hidden="true">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.5 14.4c-.3-.2-1.8-.9-2-1-.3-.1-.5-.2-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-1.6-.8-2.7-1.5-3.8-3.4-.3-.5.3-.5.8-1.4.1-.2 0-.4 0-.5 0-.2-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5 1.9.8 2.6.9 3.5.7.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4Z" />
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z" />
        </svg>
      </span>

      <span className="texto">
        <strong>{conPedido ? `Mandar el pedido · ${unidades}` : "Pedí por WhatsApp"}</strong>
        {/* La segunda línea es la que hace el trabajo APB: dice cómo se paga
            sin que haya que buscar nada. */}
        <span className="sub">Pagás al recibir · Envíos a todo el país</span>
      </span>

      <span className="flecha" aria-hidden="true">→</span>

      <style jsx>{`
        .barra {
          position: fixed;
          left: 12px;
          right: 12px;
          bottom: calc(12px + env(safe-area-inset-bottom));
          z-index: 55;
          max-width: 460px;
          margin: 0 auto;
          display: flex;
          align-items: center;
          gap: 12px;
          /* 58px: el pulgar llega sin estirarse y las dos líneas entran. */
          min-height: 58px;
          padding: 0 16px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          /* Oscuro y no vidrio claro: esto tiene que GANARLE al fondo, sea
             el cielo rosa del hero o el lila del catálogo. El vidrio claro es
             para lo que flota sobre contenido; esto es la acción principal y
             se sostiene sola. */
          background: linear-gradient(168deg, #1d1230, #140d22);
          box-shadow:
            0 18px 44px -18px rgba(20, 13, 34, 0.75),
            inset 0 1px 0 rgba(255, 255, 255, 0.12);
          color: #f6f2ff;
          text-decoration: none;
          transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .barra:active {
          transform: scale(0.985);
        }
        .barra:focus-visible {
          outline: 2px solid #a888e6;
          outline-offset: 3px;
        }

        .icono {
          flex: 0 0 auto;
          display: grid;
          place-items: center;
          width: 34px;
          height: 34px;
          border-radius: 11px;
          background: #25d366;
          color: #0b1f14;
        }

        .texto {
          flex: 1;
          min-width: 0;
          display: grid;
          gap: 1px;
        }
        .texto strong {
          font-size: 0.94rem;
          font-weight: 700;
          line-height: 1.15;
          /* Un pedido de muchos pares no puede empujar la flecha afuera. */
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sub {
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(246, 242, 255, 0.62);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .flecha {
          flex: 0 0 auto;
          color: rgba(246, 242, 255, 0.5);
          font-size: 1.05rem;
        }

        /* En pantallas anchas no se estira de borde a borde: queda como una
           pastilla centrada, que es como se lee en desktop. */
        @media (min-width: 768px) {
          .barra {
            left: auto;
            right: 24px;
            bottom: 24px;
            max-width: 340px;
          }
        }
      `}</style>
    </a>
  );
}
