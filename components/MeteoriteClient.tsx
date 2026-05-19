"use client";

/* Wrapper client-only para cargar MeteoriteSection sin SSR + lazy-mount.
   Three.js usa APIs del browser y no funciona durante el render server.
   Ademas: hasta que la seccion no entra al viewport, NO se instancia el
   componente (asi three+drei no se descargan en el bundle inicial).        */

import dynamic from "next/dynamic";
import { useInViewport } from "./useInViewport";

const MeteoriteSection = dynamic(() => import("./MeteoriteSection"), {
  ssr: false,
  loading: () => null,
});

function Placeholder() {
  return (
    <section
      id="section-meteorite"
      style={{
        minHeight: "100vh",
        background: "#070707",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-accent)",
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.2em",
        fontSize: "0.8rem",
        borderTop: "1px solid var(--color-line)",
      }}
    >
      LOADING METEOR…
    </section>
  );
}

export default function MeteoriteClient() {
  const { ref, hasBeenInView } = useInViewport<HTMLDivElement>({
    rootMargin: "300px",
  });

  return (
    <div ref={ref}>
      {hasBeenInView ? <MeteoriteSection /> : <Placeholder />}
    </div>
  );
}
