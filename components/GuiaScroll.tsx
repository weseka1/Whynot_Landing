"use client";

/* ============================================================================
   GUÍA DE SCROLL — decirle al visitante que la web sigue abajo.
   ----------------------------------------------------------------------------
   Juani, 5-sep-2026: "necesito que el tema del scrolling sea súper guiado,
   Fabri me dice que le costó entender que tenía que scrollear la web para
   seguir viendo".

   Ese es el peor bug posible de una web: el que no entiende que hay más, no
   ve nada. Y le pasó al dueño de la tienda, o sea a alguien que ya sabe qué
   hay del otro lado.

   El hero ocupa la pantalla entera con el mono, el cielo y un botón "VER
   ZAPATILLAS" — que es un CTA, no una señal de que abajo hay contenido. Sin
   nada cortado por el borde inferior, la pantalla se lee como una imagen
   completa, no como el principio de algo.

   Esto aparece si a los 2,2 s el visitante no se movió, y se va apenas
   scrollea. No es un cartel permanente: es una mano que se ofrece sólo si
   hace falta. Si vuelve arriba y se queda quieto otra vez, vuelve a
   ofrecerse.

   Material: el mismo vidrio claro del menú y del aviso de carrito.
   ============================================================================ */

import { useEffect, useState } from "react";

/** Cuánto se espera antes de ofrecer ayuda. */
const ESPERA_MS = 2200;

/** Con menos scroll que esto seguimos considerando que no se movió. */
const UMBRAL_PX = 40;

export default function GuiaScroll() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let timer = 0;
    let mostrada = false;

    const arrancarEspera = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        /* Sólo si sigue arriba: si ya bajó, no hay nada que explicar. */
        if (window.scrollY <= UMBRAL_PX) {
          setVisible(true);
          mostrada = true;
        }
      }, ESPERA_MS);
    };

    const onScroll = () => {
      if (window.scrollY > UMBRAL_PX) {
        setVisible(false);
        window.clearTimeout(timer);
        mostrada = false;
        return;
      }
      /* Volvió arriba: si ya la había visto, se la ofrecemos de nuevo tras
         la espera — puede haber vuelto justamente porque se perdió. */
      if (!mostrada) arrancarEspera();
    };

    arrancarEspera();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  const bajar = () => {
    const destino = document.querySelector("#tienda");
    if (destino) destino.scrollIntoView({ behavior: "smooth", block: "start" });
    else window.scrollBy({ top: window.innerHeight * 0.9, behavior: "smooth" });
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <button type="button" className="guia" onClick={bajar}>
      <span className="txt">Seguí bajando</span>
      <span className="flecha" aria-hidden="true">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M6 13l6 6 6-6" />
        </svg>
      </span>

      <style jsx>{`
        .guia {
          position: fixed;
          left: 50%;
          /* 86px porque abajo esta la barra de WhatsApp: arranca a 12px del
             borde y mide 58 de alto, o sea que su techo queda en 70. Esto
             pasa 16px por encima.
             (Antes este comentario decia que los 86 eran para esquivar el
             boton "Ver zapatillas" del hero. Ese boton se saco el 5-sep y
             la medida NO cambia: la que manda es la barra.) */
          bottom: calc(86px + env(safe-area-inset-bottom));
          transform: translateX(-50%);
          z-index: 45;
          display: flex;
          align-items: center;
          gap: 9px;
          /* 44px de alto mínimo: es un botón de verdad, se puede tocar y
             baja solo. Que además de avisar RESUELVA es la diferencia entre
             una señal y un cartel. */
          min-height: 44px;
          padding: 0 16px;
          border: 1px solid transparent;
          border-radius: 999px;
          background:
            linear-gradient(
                168deg,
                rgba(255, 253, 250, 0.88),
                rgba(240, 232, 252, 0.7)
              )
              padding-box,
            linear-gradient(
                140deg,
                rgba(255, 255, 255, 0.95),
                rgba(255, 255, 255, 0.2) 40%,
                rgba(126, 88, 190, 0.42)
              )
              border-box;
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow:
            0 18px 40px -18px rgba(38, 20, 66, 0.45),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          color: #17121f;
          font-family: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          cursor: pointer;
          animation: aparecer 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }
        @keyframes aparecer {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }

        .txt {
          white-space: nowrap;
        }

        /* La flecha late hacia abajo. Es lo que convierte el cartel en una
           indicación de dirección: el ojo sigue lo que se mueve. */
        .flecha {
          display: grid;
          place-items: center;
          color: #4a2f7a;
          animation: latir 1.8s ease-in-out infinite;
        }
        @keyframes latir {
          0%,
          100% {
            transform: translateY(0);
            opacity: 0.75;
          }
          50% {
            transform: translateY(4px);
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .guia,
          .flecha {
            animation: none;
          }
        }
      `}</style>
    </button>
  );
}
