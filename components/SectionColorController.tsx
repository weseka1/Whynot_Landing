"use client";

/* ============================================================================
   SectionColorController — monta el hook useSectionColor una sola vez.

   Client component sin UI propia. Va incluido en app/page.tsx (o layout).
   El hook observa todos los <section data-bg-color="..."> de la pagina y
   actualiza --page-bg / --page-fg en :root segun cual cruza el viewport.

   Por que no es solo el hook directo en page.tsx: page.tsx es server
   component (no puede usar useEffect). Este wrapper hace el bridge.
   ============================================================================ */

import { useSectionColor } from "@/hooks/useSectionColor";
import { useScrollVelocity } from "@/hooks/useScrollVelocity";

/* Monta los dos hooks globales de scroll: el color por seccion y la
   velocidad (--v / --v-abs) que usan las deformaciones. Ninguno renderiza. */
export default function SectionColorController() {
  useSectionColor();
  useScrollVelocity();
  return null;
}
