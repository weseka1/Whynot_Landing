"use client";

/* Wrapper client-only para cargar MeteoriteSection sin SSR
   (Three.js usa APIs del browser y no funciona durante el render server). */

import dynamic from "next/dynamic";

const MeteoriteSection = dynamic(() => import("./MeteoriteSection"), {
  ssr: false,
  loading: () => (
    <section
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
      }}
    >
      LOADING METEOR…
    </section>
  ),
});

export default MeteoriteSection;
