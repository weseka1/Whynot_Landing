"use client";

/* ============================================================================
   FOOTER — cierre de la web + firma de WESEKA.IA.
   ----------------------------------------------------------------------------
   El footer original de la plantilla (nombre gigante, SITE BY / MASTERCLASS /
   AWWWARDS con placeholders TODO) se había vaciado por pedido de Juani y el
   componente quedó devolviendo null.

   Vuelve con otro trabajo: es lo último que ve el visitante, así que cierra
   con la acción (WhatsApp) y no con decoración. Abajo, separada y discreta,
   la firma del estudio que la hizo — pedido de Juani el 4-sep-2026: "metamos
   la firma de WESEKA.IA en la web y que derive a nuestra website".

   Todo el contenido sale de datos reales: el WhatsApp de site.ts y las
   secciones que existen en la home.
   ============================================================================ */

import Link from "next/link";
import { WHATSAPP } from "@/lib/carrito";
import { site } from "@/data/site";

const AÑO = 2026;

export default function Footer() {
  return (
    <footer className="pie" data-bg-color="#0a0908" data-text-color="#f3ece1">
      <div className="halo" aria-hidden="true" />

      <div className="cierre">
        <p className="eyebrow">¿Encontraste tu par?</p>
        <h2 className="titulo">Escribinos y lo coordinamos</h2>
        <p className="bajada">
          Te confirmamos stock y talle, y arreglamos la entrega. En CABA y GBA el envío es en el día y podés
          abonar al recibir.
        </p>
        <a className="wa" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 20l1.4-4A8 8 0 1 1 8 18.6L4 20Z" />
          </svg>
          Escribinos por WhatsApp
        </a>
      </div>

      <nav className="mapa" aria-label="Secciones">
        <Link href="/catalog/">Catálogo</Link>
        <a href="/#tienda">Tienda</a>
        <a href="/#section-como-comprar">Cómo comprar</a>
        <a href="/politicas/">Políticas</a>
      </nav>

      <div className="legal">
        <span>
          © {AÑO} {site.brand.name}
        </span>
        {/* La firma del estudio. Discreta pero presente: es la web de un
            cliente, no la nuestra. */}
        <a className="firma" href="https://wsk.com.ar" target="_blank" rel="noopener noreferrer">
          <span className="fl">Sitio y sistema por</span>
          <span className="fm">
            WESEKA<span className="fp">.IA</span>
          </span>
        </a>
      </div>

      <style jsx>{`
        .pie {
          position: relative;
          overflow: hidden;
          padding: clamp(56px, 9vw, 110px) var(--container-pad) clamp(28px, 4vw, 40px);
          background: var(--color-bg, #0a0908);
          color: var(--color-fg, #f3ece1);
        }
        .halo {
          position: absolute;
          left: 50%;
          top: -30%;
          width: 90vmax;
          height: 60vmax;
          transform: translateX(-50%);
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(201, 173, 107, 0.16) 0%,
            rgba(201, 173, 107, 0.05) 34%,
            transparent 64%
          );
          pointer-events: none;
        }

        .cierre {
          position: relative;
          max-width: 46ch;
          margin: 0 auto clamp(40px, 6vw, 64px);
          text-align: center;
        }
        .eyebrow {
          margin: 0 0 12px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.64rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--color-gold-soft, #c9ad6b);
        }
        .titulo {
          margin: 0;
          font-size: clamp(1.8rem, 5.6vw, 3.2rem);
          font-weight: 700;
          line-height: 1.02;
          letter-spacing: -0.03em;
        }
        .bajada {
          margin: 16px 0 26px;
          font-size: clamp(0.94rem, 2.2vw, 1.05rem);
          line-height: 1.6;
          color: var(--color-muted, #a89a85);
        }
        .wa {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          min-height: 54px;
          padding: 0 30px;
          border-radius: 999px;
          background: var(--color-fg, #f3ece1);
          color: #0a0908;
          font-size: 1rem;
          font-weight: 700;
          text-decoration: none;
          transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .wa:hover {
          transform: translateY(-2px);
        }
        .wa:focus-visible {
          outline: 2px solid var(--color-gold-soft, #c9ad6b);
          outline-offset: 3px;
        }

        .mapa {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 10px 28px;
          padding-bottom: clamp(24px, 4vw, 36px);
          border-bottom: 1px solid rgba(243, 236, 225, 0.1);
        }
        .mapa :global(a) {
          color: var(--color-muted, #a89a85);
          font-size: 0.9rem;
          text-decoration: none;
          transition: color 200ms;
        }
        .mapa :global(a:hover) {
          color: var(--color-fg, #f3ece1);
        }

        .legal {
          position: relative;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 14px;
          margin-top: clamp(18px, 3vw, 26px);
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.66rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--color-muted, #a89a85);
        }

        /* --- la firma ---------------------------------------------------- */
        .firma {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 9px 15px;
          border-radius: 999px;
          background: rgba(243, 236, 225, 0.05);
          backdrop-filter: blur(14px) saturate(160%);
          -webkit-backdrop-filter: blur(14px) saturate(160%);
          border: 1px solid rgba(243, 236, 225, 0.12);
          box-shadow: inset 0 1px 0 rgba(243, 236, 225, 0.14);
          color: var(--color-muted, #a89a85);
          text-decoration: none;
          transition: border-color 240ms, transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .firma:hover {
          border-color: rgba(201, 173, 107, 0.5);
          transform: translateY(-1px);
        }
        .firma:focus-visible {
          outline: 2px solid var(--color-gold-soft, #c9ad6b);
          outline-offset: 3px;
        }
        .fl {
          font-size: 0.6rem;
          letter-spacing: 0.18em;
        }
        .fm {
          font-family: var(--font-body, system-ui, sans-serif);
          font-size: 0.86rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--color-fg, #f3ece1);
          text-transform: none;
        }
        .fp {
          color: var(--color-gold-soft, #c9ad6b);
        }

        @media (prefers-reduced-motion: reduce) {
          .wa,
          .firma {
            transition: none;
          }
          .wa:hover,
          .firma:hover {
            transform: none;
          }
        }
      `}</style>
    </footer>
  );
}
