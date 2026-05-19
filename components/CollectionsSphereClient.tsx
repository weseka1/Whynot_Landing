"use client";

/* Wrapper client-only + lazy-mount para CollectionsSphere.
   - dynamic ssr:false → no se renderiza en SSR (R3F necesita browser APIs)
   - useInViewport → solo se monta cuando Collections entra al viewport
     (no descarga three+drei en bundle inicial)                              */

import dynamic from "next/dynamic";
import { useInViewport } from "./useInViewport";

const CollectionsSphere = dynamic(() => import("./CollectionsSphere"), {
  ssr: false,
  loading: () => null,
});

export default function CollectionsSphereClient() {
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
        /* sin borderRadius ni overflow:hidden — queremos que los anillos
           Torus 3D sobresalgan del circulo principal (look planetario). */
      }}
    >
      {hasBeenInView && <CollectionsSphere isInView={isInView} />}
    </div>
  );
}
