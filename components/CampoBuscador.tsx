"use client";

/* ============================================================================
   CAMPO BUSCADOR — el buscador que SE VE que es un buscador.
   ----------------------------------------------------------------------------
   Juani, 5-sep-2026, marcando el control en una captura: "hablo de esto y no se
   entiende que es un buscador... agregame un buscador full iPhone desenfocado"
   y "que sea entendible A PRUEBA DE BOLUDOS, pensá que acá compra gente re
   villera".

   ── Qué había ─────────────────────────────────────────────────────────────
   Un círculo de 36×36 con el glifo "⌖" (U+2316, POSITION INDICATOR: una MIRA,
   no una lupa) y ni una palabra al lado. Medido en producción, la fila entera
   decía: "● MODELO 001 ⌖ [01/10]". En toda la página no había una sola lupa.

   Y encima mentía en el primer cuadro: como el sitio es export estático, el
   HTML se genera con isMobile en false, así que publica "⌖ BUSCAR ⌘K" — en un
   celular la palabra BUSCAR se ve un instante y desaparece sola al hidratar.

   Detrás de ese círculo vive el ÚNICO buscador de la web que encuentra por
   modelo sin saber la marca (fuzzy sobre las 279 entradas). O sea: la mejor
   herramienta del sitio, con el cartel peor puesto.

   ── Por qué es un botón y no un input ─────────────────────────────────────
   Esto se ve como campo y se toca como campo, pero abre el buscador de verdad
   (CommandPalette), que enfoca su input solo. Es el patrón de Spotlight y de
   los docs de Algolia: un solo lugar donde se escribe, un solo índice, cero
   chance de dos búsquedas que no coinciden. Con un input acá habría que
   sincronizar dos estados para nada.

   ── Por qué en fila propia y no en la barra de arriba ─────────────────────
   Medido: en la fila del HUD, entre "MODELO 001" y "[01/10]", el hueco libre
   es de 95,5px a 320px. Una pastilla con la palabra BUSCAR entra (90,7px),
   pero un campo que se LEA como campo necesita 157px o más. No entra. Y
   forzarlo no da error: "MODELO 001" no tiene nowrap ni flex-shrink:0, así que
   la fila se parte en dos renglones en silencio.

   ── El material ───────────────────────────────────────────────────────────
   No se inventa: es el mismo vidrio del buscador de /catalog/ (cápsula de
   58px, blur 20 + saturate 170). Cápsula y no radio medio a propósito: iOS
   dibuja curvatura continua y CSS dibuja arco de círculo, y en un rectángulo
   de radio 18-24px la diferencia se nota y delata al clon. En cápsula son
   idénticos.
   ============================================================================ */

import { useEffect, useState } from "react";

export default function CampoBuscador({
  onAbrir,
  texto = "Buscá tu zapatilla",
}: {
  onAbrir: () => void;
  /** Qué dice el campo. Verbo + objeto, en criollo y en minúscula. */
  texto?: string;
}) {
  /* El chip ⌘K sólo tiene sentido donde hay teclado. Se decide después de
     montar —nunca en el render del server— porque este sitio es export
     estático: si se ramificara en el HTML, el celular pintaría la variante de
     escritorio y la borraría al hidratar. Ese parpadeo es exactamente el que
     tiene hoy la palabra BUSCAR en el botón viejo. */
  const [hayTeclado, setHayTeclado] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const ver = () => setHayTeclado(mq.matches);
    ver();
    mq.addEventListener("change", ver);
    return () => mq.removeEventListener("change", ver);
  }, []);

  return (
    <button type="button" className="campo" onClick={onAbrir} aria-label="Buscar zapatillas en el catálogo">
      {/* Lupa de verdad, en SVG y con trazo propio: círculo + mango a 45° hacia
          abajo-derecha. La misma que ya usa el buscador de marcas del menú, así
          que el ícono de buscar es UNO solo en toda la web. */}
      <svg
        className="lupa"
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>

      <span className="texto">{texto}</span>

      {hayTeclado && <span className="atajo" aria-hidden="true">⌘K</span>}

      <style jsx>{`
        .campo {
          width: 100%;
          /* 52px: es el elemento principal de la sección, no un control más.
             Muy por encima del mínimo táctil de 44 que el propio sitio se
             impuso y que el círculo viejo (36×36) incumplía. */
          min-height: 52px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 16px 0 18px;
          /* Cápsula: ver la nota de arriba sobre el radio medio. */
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.62);
          /* Relleno translúcido, NO borde de tinta plena: un borde negro de
             1.5px lee "web brutalista", no iOS. */
          background: rgba(255, 255, 255, 0.42);
          /* saturate junto al blur: sin él queda niebla gris en vez de vidrio.
             Y el -webkit- no es opcional — sin eso, en Safari iOS (el 90% del
             tráfico) el vidrio no existe y no avisa. */
          backdrop-filter: blur(20px) saturate(170%);
          -webkit-backdrop-filter: blur(20px) saturate(170%);
          /* Sombra larga y suave con spread negativo + el brillo de arriba:
             eso es lo que lo vuelve cristal y no un panel esmerilado. */
          box-shadow:
            0 18px 44px -20px rgba(40, 20, 70, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          color: rgba(10, 10, 20, 0.62);
          cursor: pointer;
          text-align: left;
          transition: box-shadow 240ms ease, transform 160ms ease;
        }
        .campo:active {
          transform: scale(0.99);
        }
        .campo:focus-visible {
          outline: 3px solid rgba(255, 255, 255, 0.8);
          outline-offset: 2px;
        }

        .lupa {
          flex: 0 0 auto;
          /* Baseline óptica: centrada a ojo queda medio pixel baja. */
          transform: translateY(-0.5px);
        }

        .texto {
          flex: 1;
          min-width: 0;
          /* Tipografía de sistema, peso normal y tracking CERO. El mono en
             mayúsculas con letter-spacing es el tell que delata al instante
             que no es un campo de iOS — y encima es lo que menos se lee. */
          font-family: inherit;
          /* 16px clavados. Es el texto de un botón y no un input, así que iOS
             no zoomearía igual, pero el campo tiene que MEDIR como el input
             que abre: si el placeholder de adentro salta de tamaño, se nota. */
          font-size: 16px;
          font-weight: 400;
          letter-spacing: 0;
          text-transform: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .atajo {
          flex: 0 0 auto;
          padding: 2px 7px;
          border-radius: 6px;
          border: 1px solid rgba(10, 10, 20, 0.14);
          background: rgba(255, 255, 255, 0.5);
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.62rem;
          letter-spacing: 0.08em;
          color: rgba(10, 10, 20, 0.5);
        }

        @media (prefers-reduced-motion: reduce) {
          .campo {
            transition: none;
          }
        }
      `}</style>
    </button>
  );
}
