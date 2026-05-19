"use client";

/* ============================================================================
   useInViewport — hook con IntersectionObserver para lazy-mount secciones
   pesadas (Three.js, canvas 2D, etc.) hasta que se acercan al viewport.

   Devuelve:
     - ref: poner en el contenedor de la seccion
     - isInView: true MIENTRAS la seccion esta intersectando
     - hasBeenInView: true UNA VEZ que entro al viewport, no se vuelve false
       (evita remount al hacer scroll fuera-y-volver, costoso para R3F)

   Opciones:
     - rootMargin: cuanto antes activar (default "200px" → precarga ~1 vp).
     - threshold: porcentaje visible (default 0).
   ============================================================================ */

import { useEffect, useRef, useState } from "react";

interface Options {
  rootMargin?: string;
  threshold?: number | number[];
}

export function useInViewport<T extends Element = HTMLDivElement>(
  options: Options = {}
) {
  const { rootMargin = "200px", threshold = 0 } = options;
  const ref = useRef<T | null>(null);
  const [isInView, setIsInView]           = useState(false);
  const [hasBeenInView, setHasBeenInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // SSR/old browser fallback: si no hay IntersectionObserver, asumimos visible.
    if (typeof IntersectionObserver === "undefined") {
      setIsInView(true);
      setHasBeenInView(true);
      return;
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          setHasBeenInView(true);
        } else {
          setIsInView(false);
        }
      },
      { rootMargin, threshold }
    );

    obs.observe(el);
    return () => obs.disconnect();
  }, [rootMargin, threshold]);

  return { ref, isInView, hasBeenInView };
}
