"use client";

/* ============================================================================
   SECCIÓN PRODUCTOS — la grilla que se repite (Más vendidos, Nuevos ingresos).
   ----------------------------------------------------------------------------
   Un solo componente para las dos secciones: mismo ritmo, distinto contenido.
   Que se vean iguales no es pereza — es lo que hace que el visitante aprenda
   a leer la página una vez y ya sepa moverse en el resto.

   Carga: pide los datos recién cuando la sección se acerca al viewport
   (IntersectionObserver con rootMargin generoso). Arriba de todo hay un hero
   con 3D; no le vamos a robar ancho de banda a eso por productos que están
   dos pantallas más abajo.

   Si no hay productos, NO renderiza nada. Preferimos que una sección falte
   antes que mostrarla vacía o rellenarla con productos elegidos por nosotros.
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import CardProducto from "./CardProducto";
import { fetchDestacados, fetchNuevos, type PanelProduct } from "@/data/landingProducts";

/* La home es un Server Component y no puede pasarle una funcion a un Client
   Component ("Functions cannot be passed directly to Client Components").
   Por eso viaja el NOMBRE de la fuente y la resolvemos de este lado. */
const FUENTES = {
  destacados: fetchDestacados,
  nuevos: fetchNuevos,
} as const;

export type Fuente = keyof typeof FUENTES;

type Props = {
  id: string;
  eyebrow: string;
  titulo: string;
  bajada?: string;
  /** Qué se muestra. Se pide una sola vez, cuando la sección se acerca. */
  fuente: Fuente;
  /** Cuántos productos traer. */
  limite?: number;
  /** Link opcional al final ("Ver todo el catálogo"). */
  verMas?: { texto: string; href: string };
};

/* ── Cache de sesión ─────────────────────────────────────────────────────
   Al volver de una ficha con "atrás", el browser restaura el scroll en
   píxeles. Si la sección arranca en skeleton y recién después crece con la
   grilla, el contenido se corre debajo de esa posición y el visitante cae
   en otro lado (medido: pedía 844 px y quedaba en 2457). Con el cache, la
   vuelta pinta la grilla en el primer render — mismo layout, mismo lugar —
   y se refresca en background igual. sessionStorage, no localStorage: es
   para esta visita. */
function leerCache(id: string): PanelProduct[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`whynot.sec.${id}`);
    return raw ? (JSON.parse(raw) as PanelProduct[]) : null;
  } catch {
    return null;
  }
}
function guardarCache(id: string, rows: PanelProduct[]) {
  try {
    sessionStorage.setItem(`whynot.sec.${id}`, JSON.stringify(rows));
  } catch {
    /* lleno o bloqueado: sin cache, la sección sigue funcionando */
  }
}

export default function SeccionProductos({
  id,
  eyebrow,
  titulo,
  bajada,
  fuente,
  limite = 8,
  verMas,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  /* null = todavía no sé (skeleton). Con cache, arranca ya con la grilla. */
  const [items, setItems] = useState<PanelProduct[] | null>(() => leerCache(id));

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let vivo = true;
    const pedir = () => {
      FUENTES[fuente](limite)
        .then((rows) => {
          if (!vivo) return;
          guardarCache(id, rows);
          setItems(rows);
        })
        .catch(() => {
          if (vivo && items === null) setItems([]);
        });
    };

    /* Con cache ya hay grilla en pantalla: se refresca sin esperar al IO
       (los datos cambian desde el panel) pero no bloquea nada. */
    if (items !== null) {
      pedir();
      return () => {
        vivo = false;
      };
    }

    /* Sin IntersectionObserver (navegador viejo) pedimos directo: mejor
       cargar de más que dejar la sección vacía para siempre. */
    if (typeof IntersectionObserver !== "function") {
      pedir();
      return () => {
        vivo = false;
      };
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          pedir();
        }
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);

    return () => {
      vivo = false;
      io.disconnect();
    };
    /* La sección pide una sola vez, al acercarse. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Todavía no cargó: reservamos alto para que no salte el layout. */
  const cargando = items === null;
  if (!cargando && items.length === 0) return null;

  return (
    <section ref={ref} id={id} className="sec" data-bg-color="#0a0908" data-text-color="#f3ece1">
      <header className="head" data-desliza>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="titulo">{titulo}</h2>
        {bajada && <p className="bajada">{bajada}</p>}
      </header>

      {cargando ? (
        <div className="grilla" aria-hidden="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="skel" />
          ))}
        </div>
      ) : (
        <div className="grilla">
          {items.map((p) => (
            <CardProducto key={`${p.id}-${p.path}`} p={p} />
          ))}
        </div>
      )}

      {/* Link de Next, no <a>: un <a> pelado recarga la página entera, corre
          el preloader de nuevo y pierde el scroll al volver. */}
      {verMas && !cargando && (
        <Link className="vermas" href={verMas.href}>
          {verMas.texto}
          <span aria-hidden="true">→</span>
        </Link>
      )}

      <style jsx>{`
        .sec {
          padding: clamp(48px, 9vw, 96px) clamp(16px, 5vw, 56px);
        }
        .head {
          max-width: 62ch;
          margin-bottom: clamp(22px, 4vw, 38px);
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
          margin: 12px 0 0;
          font-size: clamp(0.92rem, 2.4vw, 1.02rem);
          line-height: 1.55;
          color: var(--color-muted, #6e6155);
        }

        /* 2 columnas en mobile (una sola card por fila se lee como catálogo
           pobre); 3 y 4 a medida que entra ancho. */
        .grilla {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: clamp(10px, 2.2vw, 20px);
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

        .skel {
          aspect-ratio: 3 / 5;
          border-radius: 22px;
          background: rgba(243, 236, 225, 0.045);
          border: 1px solid rgba(243, 236, 225, 0.07);
          animation: pulso 1.5s ease-in-out infinite;
        }
        @keyframes pulso {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 0.85;
          }
        }

        .sec :global(.vermas) {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          margin-top: clamp(20px, 3.4vw, 32px);
          min-height: 46px;
          padding: 0 22px;
          border-radius: 999px;
          border: 1px solid rgba(243, 236, 225, 0.18);
          background: rgba(243, 236, 225, 0.05);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          color: var(--color-fg, #f3ece1);
          font-size: 0.92rem;
          text-decoration: none;
          transition: all 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .sec :global(.vermas:hover) {
          border-color: rgba(243, 236, 225, 0.36);
          transform: translateY(-1px);
        }
        .sec :global(.vermas:focus-visible) {
          outline: 2px solid var(--color-gold-soft, #c9ad6b);
          outline-offset: 3px;
        }

        @media (prefers-reduced-motion: reduce) {
          .skel {
            animation: none;
          }
          .sec :global(.vermas) {
            transition: none;
          }
          .sec :global(.vermas:hover) {
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}
