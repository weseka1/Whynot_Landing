"use client";

/* ============================================================================
   HERO
   - Fondo: cielo WebP full-bleed.
   - Centerpiece: <video> autoplay+loop+muted+playsInline con golden-goose.mp4.
     Reemplaza al modelo GLB anterior (mono.glb 2.7MB → video 307KB, -89%).
     Sin mouse-tracking (los <video> nativos no orbitan), pero a cambio:
       * arranca a reproducir antes de descargar todo
       * sin parser 3D ni shaders en el main thread
       * cero JS adicional vs <model-viewer> 3.5
   - Marquee superior con PNG/WebP de "WHYNOT AMK EXCLUSIVE".
   - Botón Discover circular abajo a la derecha.
   - 4 corner frames decorativos.
   ============================================================================ */

import { useRef } from "react";
import { site } from "@/data/site";
import FrameBorder from "./FrameBorder";
import DiscoverButton from "./DiscoverButton";
import MarqueeBanner from "./MarqueeBanner";

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      id="hero"
      ref={sectionRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "var(--color-bg)",
      }}
    >
      {/* — Fondo cielo — */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url(${site.hero.bgImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
          opacity: 0.85,
          filter: "saturate(0.95) contrast(1.05)",
        }}
      />
      {/* — Viñeta — */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(ellipse at center, transparent 40%, var(--color-bg) 100%)",
          opacity: 0.5,
        }}
      />

      {/* — Marco completo: 4 esquinas + 4 lineas laterales — */}
      <FrameBorder color="var(--color-accent)" inset={14} corner={40} gap={10} />

      {/* — MARQUEE — */}
      <div
        style={{
          position: "absolute",
          top: "-22vh",
          left: 0,
          right: 0,
          zIndex: 2,
        }}
      >
        <MarqueeBanner
          image="/assets/marquee/whynot-text.webp"
          imageHeight="clamp(9rem, 38vw, 32rem)"
        />
      </div>

      {/* — Video centerpiece — */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingTop: "8vh",
          zIndex: 3,
          display: "grid",
          placeItems: "center",
          pointerEvents: "none",
        }}
      >
        <video
          src={site.hero.video}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          aria-hidden
          style={{
            width: "min(80vh, 80vw)",
            height: "auto",
            maxHeight: "80vh",
            objectFit: "contain",
            background: "transparent",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* — UI superpuesta — */}
      <div
        className="container-full"
        style={{
          position: "relative",
          zIndex: 4,
          minHeight: "100vh",
          display: "grid",
          gridTemplateRows: "auto 1fr auto",
          paddingBlock: "calc(var(--space-xl) + 20px) var(--space-md)",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
          }}
        >
          <span className="system-text" style={{ pointerEvents: "auto" }}>
            {site.hero.eyebrow}
          </span>
          <span className="system-text" style={{ pointerEvents: "auto" }}>
            {site.hero.metaRight}
          </span>
        </div>

        <div />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "end",
            gap: "var(--space-md)",
          }}
        >
          <p
            className="system-text"
            style={{
              maxWidth: 320,
              pointerEvents: "auto",
              color: "var(--color-fg)",
            }}
          >
            {site.hero.sub}
          </p>

          <div style={{ pointerEvents: "auto" }}>
            <DiscoverButton label={site.hero.discover} href="#section-collections" />
          </div>
        </div>
      </div>
    </section>
  );
}
