"use client";

/* ============================================================================
   COLLECTIONS — AR PRODUCT GALLERY (rediseño premium / luxury)
   --------------------------------------------------------------------------
   Estética: AR product scanner, vitrina futurista de zapatillas de lujo.
   Paleta: pearl/perla, cromo/plata, dorado minimo, graphite. SIN neon ni
   tonos crema amarillentos.

   Layout:
     ┌──────────────────────────────────────────────────────────────────┐
     │  +++ WHYNOT // COLLECTIONS                                       │
     │  AR PRODUCT SCAN / LUXURY SNEAKER GALLERY                        │
     │                                                                  │
     │   ┌──────────────────────────────┐  ┌────────────────────────┐   │
     │   │  [tech stats columna]        │  │ thumbs 01 02 03 04     │   │
     │   │                              │  │ eyebrow                │   │
     │   │     ╭─────  CIRCLE  ─────╮   │  │ .01 (index gigante)    │   │
     │   │     │  • orbital rings   │   │  │ Discover (minimal)     │   │
     │   │     │  • scan line       │   │  │ copy editorial         │   │
     │   │     │  • corner brackets │   │  │                        │   │
     │   │     │  • video floating  │   │  │                        │   │
     │   │     │  • reflejo         │   │  │                        │   │
     │   │     ╰────────────────────╯   │  │                        │   │
     │   │   X 0150.11 // Y 0238.77     │  │                        │   │
     │   └──────────────────────────────┘  └────────────────────────┘   │
     └──────────────────────────────────────────────────────────────────┘

   Items siguen en data/site.ts → collections.items. Si el item activo
   tiene `video`, el circulo reproduce <video>; sino renderiza imagen.
   ============================================================================ */

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { site } from "@/data/site";
import HoloFX from "./HoloFX";

/* iOS Safari (y cualquier browser en iOS, porque todos usan WebKit) NO
   respeta el canal alpha de VP9 webm — el video se decodea sin
   transparencia y se ve la zapa sobre un rectangulo opaco del color
   original del fondo procesado. Detectamos iOS y caemos al fallback de
   imagen estatica .webp (que SI tiene alpha real, 512x384 con
   transparencia, verificado con `file`).                                */
function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent;
  // iPhone/iPad/iPod en cualquier browser + iPadOS 13+ (que reporta como Mac
  // pero tiene touch events — heuristica estandar para diferenciarlo).
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes("Mac") && typeof document !== "undefined" && "ontouchend" in document)
  );
}

/* SneakerPlanet (escena WebGL) lazy-loaded para no inflar el bundle inicial.
   ssr:false porque usa WebGL/Canvas (no existe en server).
   Mientras carga, se ve el poster del item activo en background del slot. */
const SneakerPlanet = dynamic(() => import("./SneakerPlanet"), {
  ssr: false,
  loading: () => null,
});

/* Mapeo del id del item activo a la paleta de acento del HoloFX. Los ids
   01/02/03 son las 3 Golden Goose; el 04 (extra capsule) usa el dorado.   */
function accentFor(id: string): "white" | "silver" | "gold" {
  if (id === "01") return "white";
  if (id === "02") return "silver";
  return "gold";
}

/* Stats tecnicos que rodean el circulo (HUD AR scanner). Cambiar libremente. */
const TECH_STATS_LEFT = [
  { k: "AR SCAN MODE",      v: "ACTIVE" },
  { k: "PRECISION VIEW",    v: "1:1 SCALE" },
  { k: "RES.",              v: "4K" },
  { k: "MATERIAL ANALYSIS", v: "RUNNING" },
];

const TECH_STATS_RIGHT = [
  { k: "DROP ID",           v: "COLLECTION 01" },
  { k: "CHANNEL",           v: "ORANITHS" },
  { k: "STATUS",            v: "ACTIVE" },
  { k: "SIGNAL",            v: "STABLE" },
];

export default function Collections() {
  const items = site.collections.items;
  const [active, setActive] = useState(0);
  const current = items[active];

  /* useIOSFallback: en iOS el alpha del webm VP9 no funciona — la zapa
     queda sobre un rectangulo opaco. En lugar de mostrar WebGL roto,
     caemos a la rama motion.img (la misma que se usa para items sin
     video). Detectamos en client side post-mount; en SSR asumimos no-iOS
     para que el primer paint sea optimista (Android/desktop ven WebGL
     directo, iOS hace una transicion suave al fallback en ~50ms).        */
  const [useIOSFallback, setUseIOSFallback] = useState(false);
  useEffect(() => {
    if (isIOS()) setUseIOSFallback(true);
  }, []);

  return (
    <section
      id="section-collections"
      className="bg-ar-gallery"
      data-bg-color="#f4f1ec"
      data-text-color="#2e2a25"
      style={{
        position: "relative",
        padding: "var(--space-2xl) var(--container-pad) var(--space-xl)",
        overflow: "hidden",
        /* background-color inline pisa el de .bg-ar-gallery (var(--color-pearl))
           para que use --page-bg (controlada por useSectionColor). El
           background-image del className se preserva (dots HUD).            */
        backgroundColor: "var(--page-bg)",
      }}
    >
      {/* ============ TITULO Y SUBTITULO EDITORIAL ============ */}
      <header
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          marginBottom: "var(--space-xl)",
        }}
      >
        <span
          className="system-text"
          style={{
            color: "var(--color-platinum)",
            letterSpacing: "0.32em",
          }}
        >
          +++ WHY NOT // COLLECTIONS
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            letterSpacing: "0.42em",
            color: "var(--color-graphite-mute)",
            textTransform: "uppercase",
          }}
        >
          AR Product Scan · Luxury Sneaker Gallery
        </span>
        {/* Linea fina cromada que subraya el header */}
        <span
          aria-hidden
          style={{
            marginTop: 14,
            width: 60,
            height: 1,
            background:
              "linear-gradient(90deg, transparent, var(--color-platinum), transparent)",
          }}
        />
      </header>

      {/* ============ GRID PRINCIPAL: capsula | info ============ */}
      <div
        className="ar-grid"
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
          gap: "clamp(2rem, 5vw, 5rem)",
          alignItems: "start",
        }}
      >
        {/* =================== CAPSULA AR (col izquierda) =================== */}
        <div
          style={{
            position: "relative",
            display: "grid",
            placeItems: "center",
            gap: "var(--space-md)",
          }}
        >
          {/* === Stats laterales izquierda === */}
          <div
            aria-hidden
            className="ar-stats-col ar-stats-left"
            style={{
              position: "absolute",
              top: "10%",
              left: 0,
              display: "grid",
              gap: 14,
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            {TECH_STATS_LEFT.map((s) => (
              <TechRow key={s.k} k={s.k} v={s.v} align="left" />
            ))}
          </div>

          {/* === Stats laterales derecha === */}
          <div
            aria-hidden
            className="ar-stats-col ar-stats-right"
            style={{
              position: "absolute",
              top: "10%",
              right: 0,
              display: "grid",
              gap: 14,
              textAlign: "right",
              zIndex: 3,
              pointerEvents: "none",
            }}
          >
            {TECH_STATS_RIGHT.map((s) => (
              <TechRow key={s.k} k={s.k} v={s.v} align="right" />
            ))}
          </div>

          {/* ============= CIRCULO con sus capas ============= */}
          <div
            className="ar-capsule"
            style={{
              position: "relative",
              width: "min(62vh, 540px)",
              aspectRatio: "1",
            }}
          >
            {/* --- Esquinas tipo viewfinder AR (corners HUD afuera del orb) --- */}
            {(["tl", "tr", "bl", "br"] as const).map((p) => (
              <ArCornerBracket key={p} pos={p} />
            ))}

            {/* --- Sombra al piso debajo del producto (da peso a la esfera) --- */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "18%",
                right: "18%",
                bottom: "-2%",
                height: 28,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse at center, rgba(46,42,37,0.20), transparent 70%)",
                filter: "blur(8px)",
                pointerEvents: "none",
                zIndex: 0,
              }}
            />

            {/* === PRODUCTO 3D — ESCENA WEBGL CINEMATOGRAFICA ===
                SneakerPlanet renderiza:
                  - el webm como video-texture en plane billboarded (siempre
                    de frente y siempre arriba con depthTest:false)
                  - esfera de cristal translucida con transmission/refraccion
                  - 3 anillos tipo Saturno tilteados y contra-rotando
                  - particulas + estrellas + HDRI city
                  - postproc: Bloom selectivo + ChromaticAberration + Vignette
                  - parallax con mouse en la camara
                Items con `video` van por esta via. El 04 (extra) cae al
                <img> estatico de siempre.                                  */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                pointerEvents: "none",
                /* mix-blend overlay sutil para que el bloom se funda con el
                   pearl bg sin sentirse "pegado" como un canvas. */
                isolation: "isolate",
              }}
            >
              <AnimatePresence mode="wait">
                {/* iOS fallback: si detectamos iOS, NO renderizamos
                    SneakerPlanet (el video webm queda sin alpha y se ve
                    el rectangulo opaco). En su lugar, la rama motion.img
                    muestra la imagen .webp con alpha real, igual look
                    que items sin video. Lo demas (Android/desktop) usa
                    WebGL como siempre.                                   */}
                {"video" in current && current.video && !useIOSFallback ? (
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      pointerEvents: "auto",
                    }}
                  >
                    <SneakerPlanet
                      videoSrc={current.video}
                      accent={accentFor(current.id)}
                      posterSrc={current.image}
                    />
                  </motion.div>
                ) : (
                  /* Fallback (iOS + items sin video): envolvemos la imagen
                     en un wrapper circular oscuro tipo porthole, mismo look
                     que el wrapper de SneakerPlanet en Android/desktop. La
                     imagen .webp con alpha real queda flotando dentro del
                     orbe oscuro. Sin este wrapper, la zapa se veia plana
                     sobre el bg crema del Collections, sin la "burbuja".  */
                  <motion.div
                    key={current.id}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    style={{
                      position: "absolute",
                      inset: 0,
                      borderRadius: "50%",
                      overflow: "hidden",
                      background: "#0a0b0f",
                      boxShadow:
                        "inset 0 0 0 1px rgba(255,255,255,0.06), 0 30px 60px -20px rgba(20,18,15,0.35)",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <img
                      src={current.image}
                      alt={current.name}
                      style={{
                        width: "78%",
                        height: "78%",
                        objectFit: "contain",
                        animation: "floatGentle 5.5s ease-in-out infinite",
                        filter:
                          "drop-shadow(0 18px 22px rgba(0,0,0,0.45)) drop-shadow(0 4px 6px rgba(0,0,0,0.35))",
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* --- HoloFX FRONT: scan line sweep que cruza el producto.
                Va por encima del video pero por debajo de los corners. */}
            <HoloFX accent={accentFor(current.id)} layer="front" />
          </div>

          {/* === Coordenadas debajo del circulo === */}
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              letterSpacing: "0.32em",
              color: "var(--color-graphite-mute)",
              textTransform: "uppercase",
              marginTop: 10,
            }}
          >
            X {(150 + active * 24.37).toFixed(2)} //{" "}
            Y {(238 + active * 17.93).toFixed(2)}
          </div>
        </div>

        {/* =================== PANEL INFO (col derecha) =================== */}
        <div
          style={{
            display: "grid",
            gap: "var(--space-md)",
            paddingTop: "clamp(40px, 5vw, 80px)",
          }}
        >
          {/* === Thumbs 01-04 === */}
          <div
            style={{
              display: "flex",
              gap: "var(--space-xs)",
              flexWrap: "wrap",
            }}
          >
            {items.map((it, i) => (
              <div
                key={it.id}
                style={{
                  position: "relative",
                  display: "inline-block",
                  lineHeight: 0,
                }}
              >
                <button
                  onClick={() => setActive(i)}
                  aria-label={`Show ${it.name}`}
                  className="ar-thumb"
                  data-active={i === active ? "true" : "false"}
                  style={{
                    display: "block",
                    width: "clamp(48px, 5vw, 76px)",
                    aspectRatio: "3 / 4",
                    borderRadius: 4,
                    background: "#fff",
                    backgroundImage: `url(${it.image})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    border:
                      i === active
                        ? "1px solid var(--color-graphite)"
                        : "1px solid var(--color-platinum-2)",
                    cursor: "pointer",
                    transition:
                      "transform var(--speed-fast) var(--ease-out), border-color var(--speed-fast), box-shadow var(--speed-base)",
                    transform: i === active ? "translateY(-3px)" : "translateY(0)",
                    boxShadow:
                      i === active
                        ? "0 6px 18px -6px rgba(46,42,37,0.35), 0 0 0 1px rgba(255,255,255,0.6)"
                        : "0 2px 6px -3px rgba(46,42,37,0.18)",
                    padding: 0,
                    margin: 0,
                  }}
                />

                <span
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.58rem",
                    fontWeight: 600,
                    background: "rgba(255,255,255,0.92)",
                    color: "var(--color-graphite)",
                    padding: "2px 5px",
                    letterSpacing: "0.12em",
                    borderRadius: 2,
                    lineHeight: 1,
                    pointerEvents: "none",
                    zIndex: 2,
                    border: "1px solid var(--color-platinum-3)",
                  }}
                >
                  0{i + 1}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "0.7rem",
              letterSpacing: "0.32em",
              color: "var(--color-graphite-mute)",
              textTransform: "uppercase",
            }}
          >
            {site.collections.eyebrow}
          </div>

          {/* === Index gigante === */}
          <div
            style={{
              fontFamily: "var(--font-marquee)",
              fontWeight: 900,
              fontSize: "clamp(4rem, 9vw, 8rem)",
              lineHeight: 0.85,
              letterSpacing: "-0.04em",
              color: "var(--color-graphite)",
            }}
          >
            .{current.id}
          </div>

          {/* === Discover button minimalista === */}
          <a
            href={`#collection-${current.id}`}
            className="ar-discover"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 28px",
              border: "1px solid var(--color-graphite)",
              borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.8rem",
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              color: "var(--color-graphite)",
              background: "transparent",
              transition:
                "background var(--speed-base), color var(--speed-base), box-shadow var(--speed-base), transform var(--speed-fast)",
              width: "fit-content",
            }}
          >
            <span>Discover</span>
            <svg
              width="20"
              height="10"
              viewBox="0 0 20 10"
              aria-hidden
              style={{ display: "block" }}
            >
              {[0, 6, 12].map((x) => (
                <path
                  key={x}
                  d={`M ${x} 1 L ${x + 4} 5 L ${x} 9`}
                  stroke="currentColor"
                  strokeWidth="1.4"
                  fill="none"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          </a>

          {/* === Copy === */}
          <p
            style={{
              maxWidth: 360,
              fontSize: "0.95rem",
              lineHeight: 1.6,
              color: "var(--color-graphite)",
              marginTop: "var(--space-xs)",
            }}
          >
            {current.caption}. Limited capsule release — engineered silhouettes
            from recycled tech-fibers, documented and versioned for the wearer.
          </p>
        </div>
      </div>

      {/* ============ FOOTER: nombre de coleccion en plata ============ */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          marginTop: "var(--space-xl)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "end",
          paddingTop: "var(--space-md)",
          borderTop: "1px solid var(--color-platinum-3)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.7rem",
            letterSpacing: "0.32em",
            color: "var(--color-graphite-mute)",
            textTransform: "uppercase",
          }}
        >
          GALLERY · ZONE 01 · {String(items.length).padStart(2, "0")} CAPSULES
        </span>

        <h2
          style={{
            fontFamily: "var(--font-marquee)",
            fontWeight: 900,
            fontSize: "clamp(1.6rem, 4vw, 4rem)",
            lineHeight: 0.85,
            letterSpacing: "-0.02em",
            color: "var(--color-platinum)",
            margin: 0,
          }}
        >
          {site.collections.title.toUpperCase()}
        </h2>
      </div>

      {/* ============ Styles JSX scoped (hover del discover + thumbs) ============ */}
      <style jsx>{`
        @keyframes floatGentle {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50%      { transform: translateY(-10px) rotate(0.4deg); }
        }
        .ar-discover:hover {
          background: var(--color-graphite);
          color: var(--color-pearl);
          box-shadow:
            0 0 0 4px rgba(46,42,37,0.06),
            0 0 24px rgba(201,173,107,0.18);
        }
        .ar-thumb:hover {
          transform: translateY(-2px) !important;
          box-shadow:
            0 6px 18px -6px rgba(46,42,37,0.30),
            0 0 0 1px var(--color-platinum) !important;
        }
        /* Responsive: en mobile colapsamos a 1 columna y movemos los
           stats tecnicos para que no se solapen con el circulo.        */
        @media (max-width: 900px) {
          :global(.ar-grid) {
            grid-template-columns: 1fr !important;
          }
          :global(.ar-stats-col) {
            position: static !important;
            grid-template-columns: 1fr 1fr;
            text-align: left !important;
            margin-bottom: var(--space-sm);
            opacity: 0.7;
          }
          :global(.ar-stats-right) {
            text-align: left !important;
          }
        }
        @media (max-width: 600px) {
          :global(.ar-stats-col) {
            display: none !important;
          }
        }
      `}</style>
    </section>
  );
}

/* ============================================================================
   Subcomponentes auxiliares
   ============================================================================ */

/* Fila tecnica HUD — label fina + valor mas marcado */
function TechRow({
  k,
  v,
  align,
}: {
  k: string;
  v: string;
  align: "left" | "right";
}) {
  return (
    <div style={{ display: "grid", gap: 2, textAlign: align }}>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.6rem",
          letterSpacing: "0.32em",
          color: "var(--color-platinum)",
          textTransform: "uppercase",
        }}
      >
        {k}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.72rem",
          letterSpacing: "0.18em",
          color: "var(--color-graphite)",
          textTransform: "uppercase",
        }}
      >
        {v}
      </span>
    </div>
  );
}

/* Esquina tipo viewfinder AR: 2 trazos en "L" posicionados en una esquina
   del contenedor padre (que es position:relative). Los 4 brackets juntos
   dan el look "encuadre de escaneo".                                       */
function ArCornerBracket({
  pos,
}: {
  pos: "tl" | "tr" | "bl" | "br";
}) {
  const SIZE = 28;
  const STROKE = "var(--color-graphite)";
  const W = 1.2;

  const wrapStyle: React.CSSProperties = {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    pointerEvents: "none",
    zIndex: 5,
  };
  if (pos === "tl") { wrapStyle.top = -6;    wrapStyle.left = -6; }
  if (pos === "tr") { wrapStyle.top = -6;    wrapStyle.right = -6;  wrapStyle.transform = "scaleX(-1)"; }
  if (pos === "bl") { wrapStyle.bottom = -6; wrapStyle.left = -6;   wrapStyle.transform = "scaleY(-1)"; }
  if (pos === "br") { wrapStyle.bottom = -6; wrapStyle.right = -6;  wrapStyle.transform = "scale(-1)"; }

  return (
    <svg viewBox="0 0 28 28" style={wrapStyle} aria-hidden>
      <path d={`M 0 1 L 12 1`} stroke={STROKE} strokeWidth={W} fill="none" />
      <path d={`M 1 0 L 1 12`} stroke={STROKE} strokeWidth={W} fill="none" />
    </svg>
  );
}
