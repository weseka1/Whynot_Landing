"use client";

/* ============================================================================
   BackButton — botón de "atrás" que usa router.back() cuando hay history
   ----------------------------------------------------------------------------
   ¿Por qué router.back()?
   El browser restaura scroll position de forma nativa al hacer back/forward.
   Si usáramos <Link href={...}>, Next scrollearía al top de la nueva ruta
   y el usuario perdería el contexto (donde estaba scrolleado en la brand
   page antes de abrir un colorway).

   Fallback: si window.history.length === 1 (tab nueva, no hay back posible),
   navegamos a fallbackHref con router.push.
   ============================================================================ */

import { useRouter } from "next/navigation";

export default function BackButton({
  fallbackHref,
  label = "← BACK",
  style,
}: {
  fallbackHref: string;
  label?: string;
  style?: React.CSSProperties;
}) {
  const router = useRouter();

  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        color: "inherit",
        font: "inherit",
        padding: 0,
        margin: 0,
        textTransform: "uppercase",
        letterSpacing: "0.22em",
        ...style,
      }}
    >
      {label}
    </button>
  );
}
