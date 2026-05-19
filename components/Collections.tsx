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

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { site } from "@/data/site";

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

  return (
    <section
      id="section-collections"
      className="bg-ar-gallery"
      style={{
        position: "relative",
        padding: "var(--space-2xl) var(--container-pad) var(--space-xl)",
        overflow: "hidden",
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
          +++ WHYNOT // COLLECTIONS
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
            {/* --- Anillos planetarios estilo Jupiter/Saturno ---
                Cada anillo es un SVG circle envuelto en un wrapper que
                aplica scaleY (aplasta verticalmente) + rotate de tilt fijo.
                El SVG interno se queda con la animacion de rotacion (gira
                en su plano elipsoidal — efecto de orbita planetaria). */}
            {[
              { inset: "-14%", size: "128%", r: 95, stroke: "var(--color-platinum-2)", strokeWidth: 0.5, dash: undefined,    spin: "ar-orbit 90s linear infinite",     squish: 0.16, tilt: -14 },
              { inset: "-8%",  size: "116%", r: 92, stroke: "var(--color-platinum)",   strokeWidth: 0.4, dash: undefined,    spin: "ar-orbit-rev 120s linear infinite", squish: 0.20, tilt: -14 },
              { inset: "-4%",  size: "108%", r: 88, stroke: "var(--color-platinum-3)", strokeWidth: 0.35, dash: "1 4",        spin: "ar-orbit 70s linear infinite",     squish: 0.24, tilt: -14 },
            ].map((ring, i) => (
              <div
                key={i}
                aria-hidden
                style={{
                  position: "absolute",
                  inset: ring.inset,
                  width: ring.size,
                  height: ring.size,
                  pointerEvents: "none",
                  /* Wrapper: aplasta vertical + tilt → vista de anillo
                     planetario. SVG interno gira en su plano.            */
                  transform: `rotate(${ring.tilt}deg) scaleY(${ring.squish})`,
                  transformOrigin: "center",
                }}
              >
                <svg
                  viewBox="0 0 200 200"
                  style={{
                    width: "100%",
                    height: "100%",
                    animation: ring.spin,
                  }}
                >
                  <circle
                    cx="100" cy="100" r={ring.r}
                    fill="none"
                    stroke={ring.stroke}
                    strokeWidth={ring.strokeWidth}
                    strokeDasharray={ring.dash}
                  />
                  {/* Marcas cardinales solo en el anillo medio */}
                  {i === 1 &&
                    [0, 90, 180, 270].map((deg) => (
                      <line
                        key={deg}
                        x1="100" y1="0" x2="100" y2="6"
                        stroke="var(--color-platinum)"
                        strokeWidth="0.6"
                        transform={`rotate(${deg} 100 100)`}
                      />
                    ))}
                </svg>
              </div>
            ))}

            {/* --- Atmosfera / rim glow externo: anillo de luz alrededor
                de la esfera, como halo planetario. No es un anillo
                planetario (no es plano), es el "aire" alrededor del planeta. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: "-4%",
                borderRadius: "50%",
                pointerEvents: "none",
                background:
                  "radial-gradient(circle at center, transparent 49%, rgba(201,173,107,0.10) 50%, transparent 56%)",
                zIndex: 0,
              }}
            />
            <div
              aria-hidden
              style={{
                position: "absolute",
                inset: "-8%",
                borderRadius: "50%",
                pointerEvents: "none",
                background:
                  "radial-gradient(circle at center, transparent 50%, rgba(169,162,153,0.06) 53%, transparent 60%)",
                zIndex: 0,
              }}
            />

            {/* --- Esquinas tipo viewfinder AR (corners) --- */}
            {(["tl", "tr", "bl", "br"] as const).map((p) => (
              <ArCornerBracket key={p} pos={p} />
            ))}

            {/* --- Reflejo / sombra suave debajo del producto --- */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: "18%",
                right: "18%",
                bottom: "8%",
                height: 30,
                borderRadius: "50%",
                background:
                  "radial-gradient(ellipse at center, rgba(46,42,37,0.18), transparent 70%)",
                filter: "blur(6px)",
                pointerEvents: "none",
                zIndex: 1,
              }}
            />

            {/* --- Esfera principal con shading volumetrico ---
                El truco para que se vea esfera y no circulo: el bg sigue
                siendo casi blanco (el video se funde), pero por encima de
                TODO el contenido (incluso la zapatilla) ponemos capas de
                luz/sombra con radial-gradient direccional. Da sensacion
                de curvatura y luz cenital desde arriba-izquierda.        */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: "#ffffff",
                /* Borde cromado + sombra inset diagonal abajo-derecha →
                   la esfera tiene "terminador" oscuro tipo planeta.      */
                boxShadow:
                  "0 0 0 1px rgba(255,255,255,0.85), 0 0 0 2px var(--color-platinum-3), 0 30px 80px -20px rgba(46,42,37,0.32), 0 0 40px rgba(201,173,107,0.10), inset -40px -50px 100px -30px rgba(46,42,37,0.16), inset 30px 40px 80px -40px rgba(255,255,255,0.9)",
                animation: "ar-chrome-shine 5.5s ease-in-out infinite",
                overflow: "hidden",
              }}
            >
              {/* Highlight radial direccional desde arriba-izquierda
                  → sensacion de luz cenital sobre la esfera (terminador
                  luminoso). zIndex bajo: queda debajo del producto.       */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 28% 22%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0.5) 22%, transparent 55%)",
                  pointerEvents: "none",
                  zIndex: 1,
                }}
              />

              {/* Scan line horizontal (8s loop, atraviesa el circulo) */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 60,
                  background:
                    "linear-gradient(180deg, transparent 0%, rgba(201,173,107,0.18) 45%, rgba(201,173,107,0.42) 50%, rgba(201,173,107,0.18) 55%, transparent 100%)",
                  animation: "ar-scan-line 8s ease-in-out infinite",
                  pointerEvents: "none",
                  zIndex: 4,
                }}
              />

              {/* Crosshair central sutil */}
              <svg
                aria-hidden
                viewBox="0 0 100 100"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  pointerEvents: "none",
                  zIndex: 2,
                  opacity: 0.18,
                }}
              >
                <line x1="46" y1="50" x2="54" y2="50" stroke="var(--color-graphite)" strokeWidth="0.3" />
                <line x1="50" y1="46" x2="50" y2="54" stroke="var(--color-graphite)" strokeWidth="0.3" />
                <circle cx="50" cy="50" r="1" fill="var(--color-graphite)" />
              </svg>

              {/* --- Video / imagen del producto --- */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={current.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "grid",
                    placeItems: "center",
                    zIndex: 3,
                  }}
                >
                  {"video" in current && current.video ? (
                    <video
                      src={current.video}
                      autoPlay
                      loop
                      muted
                      playsInline
                      preload="auto"
                      aria-hidden
                      style={{
                        width: "78%",
                        height: "78%",
                        objectFit: "contain",
                        filter: "saturate(1.05)",
                        animation: "ar-float 6s ease-in-out infinite",
                        /* Mascara radial: el centro (donde esta la zapatilla)
                           se ve 100%, los bordes del rectangulo se desvanecen
                           hacia transparent → el "marco" del video se funde
                           con el bg blanco del circulo y no se nota.        */
                        WebkitMaskImage:
                          "radial-gradient(ellipse 70% 60% at center, #000 55%, transparent 95%)",
                        maskImage:
                          "radial-gradient(ellipse 70% 60% at center, #000 55%, transparent 95%)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "78%",
                        height: "78%",
                        backgroundImage: `url(${current.image})`,
                        backgroundSize: "contain",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        filter: "saturate(1.05)",
                        animation: "ar-float 6s ease-in-out infinite",
                        WebkitMaskImage:
                          "radial-gradient(ellipse 70% 60% at center, #000 55%, transparent 95%)",
                        maskImage:
                          "radial-gradient(ellipse 70% 60% at center, #000 55%, transparent 95%)",
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Penumbra esferica SOBRE el producto: sombra direccional
                  desde abajo-derecha hacia arriba-izquierda, opacity muy
                  baja para no tapar la zapatilla — solo da volumen 3D
                  curvado. mixBlendMode multiply hace que aplique sobre
                  blanco sin oscurecer demasiado el contenido oscuro.    */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "radial-gradient(circle at 78% 82%, rgba(46,42,37,0.22) 0%, rgba(46,42,37,0.10) 28%, transparent 60%)",
                  pointerEvents: "none",
                  zIndex: 4,
                  mixBlendMode: "multiply",
                }}
              />

              {/* Especular brillo concentrado arriba-izquierda → punto de
                  reflejo de luz tipo bola de billar / planeta. zIndex 5,
                  encima de todo, pero MUY chico para no tapar nada.     */}
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: "8%",
                  left: "14%",
                  width: "18%",
                  height: "14%",
                  background:
                    "radial-gradient(ellipse at center, rgba(255,255,255,0.55) 0%, transparent 70%)",
                  pointerEvents: "none",
                  zIndex: 5,
                  filter: "blur(4px)",
                }}
              />
            </div>
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
