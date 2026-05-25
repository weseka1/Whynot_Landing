"use client";

/* ============================================================================
   useSectionColor — DICH-style section-driven color sweep.

   Cada <section> que tenga `data-bg-color` (y opcionalmente `data-text-color`)
   es observada por un IntersectionObserver con threshold 0.5. Cuando una
   seccion cruza el 50% del viewport, sus colores se aplican como CSS vars
   en :root (`--page-bg` y `--page-fg`). El body usa esas vars con
   `transition: 700ms` asi el cambio se ve como un sweep gradual mientras
   scrolleas — no es un blend interpolado entre dos colores, es snap +
   CSS transition del browser.

   Importante: el hook NO causa re-renders de React. Solo muta CSS vars
   directamente via `style.setProperty`. Cero cost de reconciliacion.
   ============================================================================ */

import { useEffect } from "react";

export function useSectionColor(rootRef?: React.RefObject<HTMLElement>) {
  useEffect(() => {
    /* Pequeno delay para que el hook se monte despues de que los
       componentes lazy-loaded de page.tsx hayan renderizado sus
       secciones. Sin esto, IntersectionObserver solo captura las
       secciones above-the-fold y las dynamic() quedan sin observar. */
    const setup = () => {
      const root = (rootRef?.current ?? document) as Document | HTMLElement;
      const sections = root.querySelectorAll<HTMLElement>("[data-bg-color]");
      if (sections.length === 0) return null;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
              const el = entry.target as HTMLElement;
              const bg = el.dataset.bgColor;
              const fg = el.dataset.textColor;
              if (bg) document.documentElement.style.setProperty("--page-bg", bg);
              if (fg) document.documentElement.style.setProperty("--page-fg", fg);
            }
          }
        },
        { threshold: 0.5 }
      );

      sections.forEach((s) => observer.observe(s));
      return observer;
    };

    /* Intentamos un setup inmediato y otro despues de 500ms para cubrir
       las secciones que se montan via dynamic() (Collections, PastDrop,
       FuturisticGallery, IdeaForm, WhyNotEnd). El observer inicial
       captura las above-the-fold; el segundo captura el resto cuando
       ya cargaron sus chunks. */
    const obs1 = setup();
    let obs2: IntersectionObserver | null = null;
    const timer = window.setTimeout(() => {
      obs2 = setup();
    }, 500);

    return () => {
      window.clearTimeout(timer);
      obs1?.disconnect();
      obs2?.disconnect();
    };
  }, [rootRef]);
}
