"use client";

/* ============================================================================
   useSectionColor — el color del fondo lo manda la sección que estás mirando.

   Cada <section data-bg-color="..."> (y opcional data-text-color) define el
   color del body mientras es la sección "activa". Activa = la que cruza el
   CENTRO del viewport. El body interpola con `transition: 700ms`, así el
   cambio se ve como un sweep y no como un salto.

   ── Por qué no IntersectionObserver con threshold 0.5 (4-sep-2026) ────────
   Era la implementación anterior y tenía un agujero: una sección MÁS ALTA que
   el viewport nunca alcanza intersectionRatio 0.5, así que nunca disparaba.
   Con la home nueva, "Nuevos ingresos" y "Cómo comprar" son de ese tipo: al
   subir desde el lila del PastDrop el fondo se quedaba lila — "cuando bajo y
   vuelvo a subir no vuelven los colores" (Juani). Además el observer se
   montaba con un setTimeout de 500 ms para alcanzar las secciones dynamic():
   si tardaban más, quedaban sin observar para siempre.

   El criterio "cruza el centro" no depende del alto de la sección ni de
   cuándo se montó: la lista se recalcula en cada scroll (querySelectorAll es
   barato) y se resuelve con getBoundingClientRect.

   No causa re-renders de React: sólo escribe CSS vars, con el trabajo
   limitado por rAF, y sólo cuando el color CAMBIA.
   ============================================================================ */

import { useEffect } from "react";

export function useSectionColor(rootRef?: React.RefObject<HTMLElement>) {
  useEffect(() => {
    const root = (rootRef?.current ?? document) as Document | HTMLElement;
    let raf = 0;
    let ultimoBg = "";
    let ultimoFg = "";

    const aplicar = () => {
      raf = 0;
      const secciones = root.querySelectorAll<HTMLElement>("[data-bg-color]");
      if (secciones.length === 0) return;

      const centro = window.innerHeight / 2;
      let elegida: HTMLElement | null = null;
      /* Si dos se solapan gana la última en el documento, que es la que está
         pintada encima. */
      secciones.forEach((s) => {
        const r = s.getBoundingClientRect();
        if (r.top <= centro && r.bottom >= centro) elegida = s;
      });

      /* Ninguna cruza el centro (huecos entre secciones, o arriba de todo):
         nos quedamos con la más cercana por arriba, así el fondo nunca queda
         colgado del color de una sección que ya pasó. */
      if (!elegida) {
        let mejor = -Infinity;
        secciones.forEach((s) => {
          const r = s.getBoundingClientRect();
          if (r.top <= centro && r.top > mejor) {
            mejor = r.top;
            elegida = s;
          }
        });
      }
      if (!elegida) return;

      const el = elegida as HTMLElement;
      const bg = el.dataset.bgColor;
      const fg = el.dataset.textColor;
      if (bg && bg !== ultimoBg) {
        ultimoBg = bg;
        document.documentElement.style.setProperty("--page-bg", bg);
      }
      if (fg && fg !== ultimoFg) {
        ultimoFg = fg;
        document.documentElement.style.setProperty("--page-fg", fg);
      }
    };

    const pedir = () => {
      if (!raf) raf = requestAnimationFrame(aplicar);
    };

    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    /* Las secciones dynamic() aparecen después: en vez de adivinar con un
       setTimeout, escuchamos el DOM hasta que la home terminó de montar. */
    const mo = new MutationObserver(pedir);
    mo.observe(document.body, { childList: true, subtree: true });

    pedir();

    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      mo.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rootRef]);
}
