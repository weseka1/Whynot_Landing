"use client";

/* ============================================================================
   useScrollVelocity — publica la velocidad del scroll como CSS vars globales.
   ----------------------------------------------------------------------------
   Juani, 4-sep-2026: "que tenga algún efecto de deslizamiento el scrolling así
   no parece que está tildado cuando vamos bajando, que haga algún efecto de
   distorsionamiento temporal, que se estire todo y cambie".

   La sensación de "tildado" al scrollear no siempre es falta de FPS: es que
   nada acusa recibo del gesto. Cuando el contenido se estira mientras corrés
   y se acomoda al frenar, el ojo lee fluidez aunque los frames sean los
   mismos. Es el truco de las listas de iOS.

   Cómo funciona: en cada frame se mide cuánto se movió el scroll, se suaviza
   (lerp) y se escriben dos vars en <html>:
     --v      -1..1  velocidad con signo (negativo = subiendo)
     --v-abs   0..1  magnitud, para escalar deformaciones

   Deliberadamente NO toca React: cero renders. Cada componente decide qué
   hacer con esas vars (estirar en Y, desplazar, bajar opacidad).

   Respeta prefers-reduced-motion: si está activo, las vars quedan en 0 y no
   se anima nada.
   ============================================================================ */

import { useEffect } from "react";

/** Arriba de esta velocidad (px por frame) la deformación llega al máximo. */
const MAX_PX_FRAME = 55;
/** Cuánto se suaviza: más bajo = más elástico y tarda más en volver a 0. */
const LERP = 0.16;

export function useScrollVelocity() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const raiz = document.documentElement;
    let anterior = window.scrollY;
    let suave = 0;
    let raf = 0;
    let quieto = 0;

    const frame = () => {
      const y = window.scrollY;
      const delta = y - anterior;
      anterior = y;

      const objetivo = Math.max(-1, Math.min(1, delta / MAX_PX_FRAME));
      suave += (objetivo - suave) * LERP;

      /* Cuando ya no se mueve y el suavizado volvió a cero, cortamos el rAF:
         un bucle infinito con la página quieta es exactamente el costo que
         estamos tratando de sacar. Se despierta con el próximo scroll. */
      if (Math.abs(suave) < 0.001 && delta === 0) {
        if (++quieto > 6) {
          suave = 0;
          raiz.style.setProperty("--v", "0");
          raiz.style.setProperty("--v-abs", "0");
          raf = 0;
          return;
        }
      } else {
        quieto = 0;
      }

      raiz.style.setProperty("--v", suave.toFixed(4));
      raiz.style.setProperty("--v-abs", Math.abs(suave).toFixed(4));
      raf = requestAnimationFrame(frame);
    };

    const despertar = () => {
      quieto = 0;
      if (!raf) raf = requestAnimationFrame(frame);
    };

    window.addEventListener("scroll", despertar, { passive: true });
    return () => {
      window.removeEventListener("scroll", despertar);
      if (raf) cancelAnimationFrame(raf);
      raiz.style.setProperty("--v", "0");
      raiz.style.setProperty("--v-abs", "0");
    };
  }, []);
}
