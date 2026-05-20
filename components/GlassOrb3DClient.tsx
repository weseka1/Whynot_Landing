"use client";

/* Wrapper para GlassOrb3D:
   - dynamic ssr:false → three+drei no se renderizan en server
   - useInViewport → no se descargan ni montan hasta que la seccion entra
     al viewport (rootMargin 300px), igual que Mission y Meteorite     */

import dynamic from "next/dynamic";
import { useInViewport } from "./useInViewport";

const GlassOrb3D = dynamic(() => import("./GlassOrb3D"), {
  ssr: false,
  loading: () => null,
});

interface Props {
  productImage: string;
  chromaKey?: string | null;
  /* PNG sequence fallback para Safari cuando productImage es .webm con
     alpha (Safari no soporta VP9 alpha). El GlassOrb3D detecta capability
     y switchea automatico.                                              */
  pngSequence?: { base: string; count: number; fps?: number };
}

export default function GlassOrb3DClient({ productImage, chromaKey = null, pngSequence }: Props) {
  const { ref, hasBeenInView, isInView } = useInViewport<HTMLDivElement>({
    rootMargin: "300px",
  });

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    >
      {hasBeenInView && (
        <GlassOrb3D
          productImage={productImage}
          chromaKey={chromaKey}
          pngSequence={pngSequence}
          isInView={isInView}
        />
      )}
    </div>
  );
}
