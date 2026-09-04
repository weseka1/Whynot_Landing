"use client";

/* ============================================================================
   CATÁLOGO ÍNDICE — buscador de marcas + grilla en vidrio.
   ----------------------------------------------------------------------------
   Juani, 4-sep: "más fácil de encontrar, para ir al buscador de marcas, el
   catálogo básicamente... flow iPhone LIQUID GLASS cuando se abre".

   Una sola pregunta al visitante: ¿qué marca buscás? El input filtra la
   grilla al toque; cada marca es una tarjeta de vidrio con su foto real, cuántos
   modelos tiene y cuántos con 360°. Tocar = entrar a /catalog/<marca>/.

   Todos los números son del catálogo (catalog-index.json). Ninguno inventado.
   ============================================================================ */

import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import BackButton from "@/components/BackButton";
import { WHATSAPP } from "@/lib/carrito";

export type MarcaResumen = {
  slug: string;
  nombre: string;
  total: number;
  total360: number;
  modelos: number;
  portada: string;
};

const GRANO_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function CatalogoIndice({ marcas, totalPares }: { marcas: MarcaResumen[]; totalPares: number }) {
  const [q, setQ] = useState("");
  /* deferred: en un celu flojo, tipear no traba el input esperando el filtro */
  const qd = useDeferredValue(q);

  const visibles = useMemo(() => {
    const n = normalizar(qd);
    if (!n) return marcas;
    return marcas.filter((m) => normalizar(m.nombre).includes(n) || normalizar(m.slug).includes(n));
  }, [marcas, qd]);

  return (
    <main className="cat">
      <div className="fondo" aria-hidden="true" />
      <div className="halo" aria-hidden="true" />
      <div className="grano" style={{ backgroundImage: GRANO_SVG }} aria-hidden="true" />

      <div className="contenido">
        <div className="volver">
          <BackButton fallbackHref="/" label="← Inicio" />
        </div>

        <header className="head">
          <p className="eyebrow">Catálogo</p>
          <h1 className="titulo">Comprá por marca</h1>
          <p className="bajada">
            {totalPares} pares de {marcas.length} marcas. Tocá una marca para ver todos sus modelos — la mayoría con
            vista 360°.
          </p>
        </header>

        <label className="buscador">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscá una marca: Jordan, Louis Vuitton, Nike…"
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Buscar marca"
          />
          {q && (
            <button type="button" className="limpiar" onClick={() => setQ("")} aria-label="Borrar búsqueda">
              ✕
            </button>
          )}
        </label>

        {visibles.length > 0 ? (
          <ul className="grilla" aria-label="Marcas">
            {visibles.map((m, i) => (
              <li key={m.slug} style={{ ["--i" as string]: i }}>
                <Link href={`/catalog/${m.slug}/`} className="marca">
                  <span className="foto">
                    {m.portada && <img src={m.portada} alt="" loading="lazy" decoding="async" />}
                  </span>
                  <span className="datos">
                    <span className="nombre">{m.nombre}</span>
                    <span className="meta">
                      {m.modelos} {m.modelos === 1 ? "modelo" : "modelos"} · {m.total} {m.total === 1 ? "par" : "pares"}
                      {m.total360 > 0 && <> · {m.total360} en 360°</>}
                    </span>
                  </span>
                  <span className="flecha" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="vacio">
            <p className="vt">No tenemos esa marca en el catálogo todavía.</p>
            <p className="vc">Si la buscás, escribinos: conseguimos pares a pedido.</p>
            <a
              className="wa"
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola! Busco zapatillas ${q.trim()}, ¿las consiguen?`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Preguntar por WhatsApp
            </a>
          </div>
        )}
      </div>

      <style jsx>{`
        .cat {
          --tinta: #0a0a14;
          --tinta-2: rgba(10, 10, 20, 0.64);
          position: relative;
          min-height: 100svh;
          color: var(--tinta);
          overflow-x: clip;
        }
        .fondo {
          position: fixed;
          inset: 0;
          z-index: 0;
          background: linear-gradient(180deg, #e6dafb 0%, #cdb5f0 55%, #b596e8 100%);
        }
        .halo {
          position: fixed;
          left: 50%;
          top: 18%;
          z-index: 0;
          width: 90vmax;
          height: 60vmax;
          border-radius: 50%;
          transform: translateX(-50%);
          background: radial-gradient(circle, rgba(255, 214, 168, 0.55) 0%, rgba(255, 190, 150, 0.16) 40%, transparent 66%);
          filter: blur(40px);
          pointer-events: none;
        }
        .grano {
          position: fixed;
          inset: 0;
          z-index: 0;
          opacity: 0.05;
          mix-blend-mode: multiply;
          pointer-events: none;
        }
        .contenido {
          position: relative;
          z-index: 1;
          max-width: 1180px;
          margin: 0 auto;
          padding: calc(84px + env(safe-area-inset-top)) var(--container-pad) 80px;
        }
        .volver {
          margin-bottom: clamp(18px, 3vw, 28px);
        }

        .head {
          max-width: 60ch;
          margin-bottom: clamp(20px, 3.4vw, 32px);
        }
        .eyebrow {
          margin: 0 0 10px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.64rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--tinta-2);
        }
        .titulo {
          margin: 0;
          font-family: var(--font-marquee);
          font-weight: 900;
          font-size: clamp(2.1rem, 7vw, 4.6rem);
          line-height: 0.95;
          letter-spacing: -0.035em;
          text-transform: uppercase;
        }
        .bajada {
          margin: 14px 0 0;
          font-size: clamp(0.98rem, 1.5vw, 1.12rem);
          line-height: 1.55;
          color: var(--tinta-2);
          font-variant-numeric: tabular-nums;
        }

        /* --- buscador: la única pregunta ------------------------------- */
        .buscador {
          position: sticky;
          top: calc(12px + env(safe-area-inset-top));
          z-index: 5;
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 0 clamp(20px, 3.4vw, 32px);
          padding: 0 14px 0 18px;
          min-height: 58px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.42);
          backdrop-filter: blur(20px) saturate(170%);
          -webkit-backdrop-filter: blur(20px) saturate(170%);
          border: 1px solid rgba(255, 255, 255, 0.62);
          box-shadow: 0 18px 44px -20px rgba(40, 20, 70, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.8);
          color: var(--tinta-2);
          transition: box-shadow 240ms;
        }
        .buscador:focus-within {
          box-shadow: 0 18px 44px -18px rgba(40, 20, 70, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.8),
            0 0 0 3px rgba(255, 255, 255, 0.55);
        }
        .buscador input {
          flex: 1;
          min-width: 0;
          border: none;
          background: transparent;
          outline: none;
          color: var(--tinta);
          /* 16px minimo: con menos, iOS Safari zoomea la pagina al enfocar */
          font-size: 1rem;
          padding: 14px 0;
        }
        .buscador input::placeholder {
          color: rgba(10, 10, 20, 0.42);
        }
        .buscador input::-webkit-search-cancel-button {
          display: none;
        }
        .limpiar {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          border: none;
          background: rgba(10, 10, 20, 0.08);
          color: var(--tinta);
          font-size: 0.8rem;
          cursor: pointer;
        }

        /* --- marcas ----------------------------------------------------- */
        .grilla {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(10px, 2vw, 16px);
        }
        @media (min-width: 720px) {
          .grilla {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }
        @media (min-width: 1080px) {
          .grilla {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }
        .grilla li {
          opacity: 0;
          animation: entrar 560ms cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: calc(var(--i) * 45ms);
        }
        @keyframes entrar {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* :global: <Link> es un componente y styled-jsx puede no ponerle la
           clase scoped (paso en el menu). Dentro de .grilla, que si esta
           scoped, aplica siempre. */
        .grilla :global(.marca) {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 100%;
          padding: 14px 14px 16px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.32);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.58);
          box-shadow: 0 16px 40px -22px rgba(40, 20, 70, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.75);
          color: var(--tinta);
          text-decoration: none;
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .grilla :global(.marca:hover) {
          transform: translateY(-3px);
          box-shadow: 0 24px 50px -22px rgba(40, 20, 70, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.85);
        }
        .grilla :global(.marca:focus-visible) {
          outline: 3px solid rgba(255, 255, 255, 0.8);
          outline-offset: 2px;
        }
        .foto {
          display: block;
          aspect-ratio: 4 / 3;
          border-radius: 14px;
          background: linear-gradient(160deg, #fbfaf8, #eceae6);
          overflow: hidden;
        }
        .foto img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 8%;
          display: block;
        }
        .datos {
          display: grid;
          gap: 4px;
          min-width: 0;
          /* lugar para la flecha absoluta: sin esto, cuando el meta hace dos
             líneas en el celu la flecha cae sobre el número y parece tachado */
          padding-right: 30px;
        }
        .nombre {
          font-family: var(--font-marquee);
          font-weight: 900;
          font-size: clamp(1rem, 2.4vw, 1.25rem);
          line-height: 1.05;
          letter-spacing: -0.02em;
          text-transform: uppercase;
          overflow-wrap: anywhere;
        }
        .meta {
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--tinta-2);
          font-variant-numeric: tabular-nums;
        }
        .flecha {
          position: absolute;
          right: 16px;
          bottom: 16px;
          font-size: 1rem;
          color: var(--tinta-2);
          transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .grilla :global(.marca:hover) .flecha {
          transform: translateX(4px);
        }

        /* --- sin resultados --------------------------------------------- */
        .vacio {
          max-width: 46ch;
          padding: clamp(24px, 4vw, 40px);
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.32);
          backdrop-filter: blur(18px) saturate(160%);
          -webkit-backdrop-filter: blur(18px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.58);
        }
        .vt {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 700;
        }
        .vc {
          margin: 8px 0 18px;
          color: var(--tinta-2);
          line-height: 1.5;
        }
        .wa {
          display: inline-flex;
          align-items: center;
          min-height: 48px;
          padding: 0 22px;
          border-radius: 999px;
          background: var(--tinta);
          color: #fff;
          font-weight: 700;
          text-decoration: none;
        }

        @media (prefers-reduced-motion: reduce) {
          .grilla li {
            animation: none;
            opacity: 1;
          }
          .grilla :global(.marca),
          .flecha {
            transition: none;
          }
          .grilla :global(.marca:hover) {
            transform: none;
          }
        }
      `}</style>
    </main>
  );
}
