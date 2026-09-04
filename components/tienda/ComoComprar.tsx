"use client";

/* ============================================================================
   CÓMO COMPRAR — la sección que existe por un motivo medido.
   ----------------------------------------------------------------------------
   Juani, 4-sep-2026: "la gente pregunta cómo utilizarla". Y la cuenta de ads
   gastó ARS 859.897 con UNA conversación respondida. El visitante llegaba,
   veía un viaje espacial y no entendía que podía comprar.

   Tres pasos, sin vueltas. El contenido NO es inventado: sale de los pilares
   de `data/site.ts` (envíos CABA/GBA en el día con pago al recibir, interior
   por OCA y Correo Argentino en 2-3 días hábiles, excepto Tierra del Fuego).
   ============================================================================ */

import { WHATSAPP } from "@/lib/carrito";

const PASOS = [
  {
    n: "01",
    titulo: "Elegí tu par",
    texto:
      "Buscá por marca o mirá los destacados. Elegí el talle y agregalo al carrito. Podés sumar todos los pares que quieras.",
  },
  {
    n: "02",
    titulo: "Mandá el pedido",
    texto:
      "Tocás “Pedir por WhatsApp” y el mensaje ya te sale escrito, con los productos, los talles y el total. No tenés que explicar nada.",
  },
  {
    n: "03",
    titulo: "Coordinamos y listo",
    texto:
      "Te confirmamos stock y coordinamos la entrega. En CABA y GBA los envíos son en el día y podés abonar al recibir.",
  },
];

const ENVIOS = [
  { zona: "CABA y GBA", detalle: "Envíos en el día · podés abonar al recibir" },
  { zona: "Todo el país", detalle: "OCA y Correo Argentino · 2 a 3 días hábiles" },
  { zona: "Tierra del Fuego", detalle: "5 a 7 días hábiles" },
];

export default function ComoComprar() {
  return (
    <section id="section-como-comprar" className="sec" data-bg-color="#0a0908" data-text-color="#f3ece1">
      <header className="head" data-desliza>
        <p className="eyebrow">Cómo comprar</p>
        <h2 className="titulo">Tres pasos y es tuyo</h2>
        <p className="bajada">
          No hay carrito con tarjeta ni formularios largos. Elegís, mandás el pedido por WhatsApp y lo
          coordinamos con vos.
        </p>
      </header>

      <ol className="pasos">
        {PASOS.map((p) => (
          <li key={p.n} className="paso">
            <span className="n">{p.n}</span>
            <h3 className="pt">{p.titulo}</h3>
            <p className="px">{p.texto}</p>
          </li>
        ))}
      </ol>

      <div className="envios">
        {ENVIOS.map((e) => (
          <div key={e.zona} className="envio">
            <p className="ez">{e.zona}</p>
            <p className="ed">{e.detalle}</p>
          </div>
        ))}
      </div>

      <a className="cta" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
        Escribinos por WhatsApp
      </a>

      <style jsx>{`
        .sec {
          padding: clamp(48px, 9vw, 96px) clamp(16px, 5vw, 56px);
        }
        .head {
          max-width: 58ch;
          margin-bottom: clamp(28px, 5vw, 48px);
        }
        .eyebrow {
          margin: 0 0 10px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.62rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-gold-soft, #c9ad6b);
        }
        .titulo {
          margin: 0;
          font-size: clamp(1.75rem, 6.4vw, 3.1rem);
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.03em;
          color: var(--color-fg, #f3ece1);
        }
        .bajada {
          margin: 14px 0 0;
          font-size: clamp(0.94rem, 2.4vw, 1.05rem);
          line-height: 1.6;
          color: var(--color-muted, #6e6155);
        }

        .pasos {
          list-style: none;
          margin: 0 0 clamp(24px, 4vw, 40px);
          padding: 0;
          display: grid;
          gap: clamp(12px, 2.4vw, 20px);
          grid-template-columns: 1fr;
        }
        @media (min-width: 760px) {
          .pasos {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .paso {
          padding: clamp(20px, 3.4vw, 28px);
          border-radius: 22px;
          /* fondo plano detras: sin backdrop-filter (ver CardProducto) */
          background: rgba(243, 236, 225, 0.055);
          border: 1px solid rgba(243, 236, 225, 0.1);
          box-shadow: inset 0 1px 0 rgba(243, 236, 225, 0.14);
        }
        .n {
          display: block;
          margin-bottom: 14px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.72rem;
          letter-spacing: 0.2em;
          font-variant-numeric: tabular-nums;
          color: var(--color-gold-soft, #c9ad6b);
        }
        .pt {
          margin: 0 0 8px;
          font-size: 1.14rem;
          font-weight: 700;
          letter-spacing: -0.015em;
          color: var(--color-fg, #f3ece1);
        }
        .px {
          margin: 0;
          font-size: 0.92rem;
          line-height: 1.6;
          color: var(--color-muted, #6e6155);
        }

        .envios {
          display: grid;
          gap: 1px;
          background: rgba(243, 236, 225, 0.1);
          border: 1px solid rgba(243, 236, 225, 0.1);
          border-radius: 18px;
          overflow: hidden;
        }
        @media (min-width: 760px) {
          .envios {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        .envio {
          padding: 18px 20px;
          background: rgba(19, 16, 13, 0.5);
        }
        .ez {
          margin: 0 0 4px;
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--color-fg, #f3ece1);
        }
        .ed {
          margin: 0;
          font-size: 0.82rem;
          line-height: 1.5;
          color: var(--color-muted, #6e6155);
        }

        .cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: clamp(24px, 4vw, 38px);
          min-height: 52px;
          padding: 0 30px;
          border-radius: 999px;
          background: var(--color-fg, #f3ece1);
          color: #0a0908;
          font-size: 1rem;
          font-weight: 700;
          text-decoration: none;
          transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .cta:hover {
          transform: translateY(-2px);
        }
        .cta:focus-visible {
          outline: 2px solid var(--color-gold-soft, #c9ad6b);
          outline-offset: 3px;
        }

        @media (prefers-reduced-motion: reduce) {
          .cta {
            transition: none;
          }
          .cta:hover {
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
