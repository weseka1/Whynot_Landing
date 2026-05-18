"use client";

/* ============================================================================
   useIsMobile — hook que detecta si el cliente es mobile/touch para
   degradar gracefully animaciones pesadas (Three.js, canvas effects, etc.)

   Criterios (combinados):
     - matchMedia: viewport <= 768px
     - touch-device: solo punteros gruesos (no mouse)
     - Reducción si prefers-reduced-motion: reduce
   ============================================================================ */

import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mqWidth   = window.matchMedia("(max-width: 768px)");
    const mqTouch   = window.matchMedia("(hover: none) and (pointer: coarse)");
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");

    const update = () => {
      setIsMobile(mqWidth.matches || mqTouch.matches || mqReduced.matches);
    };
    update();

    mqWidth.addEventListener("change", update);
    mqTouch.addEventListener("change", update);
    mqReduced.addEventListener("change", update);

    return () => {
      mqWidth.removeEventListener("change", update);
      mqTouch.removeEventListener("change", update);
      mqReduced.removeEventListener("change", update);
    };
  }, []);

  return isMobile;
}

/* Variante: detección estricta solo por touch (sin matchMedia de width) */
export function useIsTouch(): boolean {
  const [isTouch, setIsTouch] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isTouch;
}
