"use client";

/* ============================================================================
   FUTURISTIC GALLERY — homenaje al "DICH // GALLERY" del moodboard del
   cliente. Carrusel horizontal infinito de modelos con outfits "MODA Y
   ROPA FUTURISTA" (los renders neon que ya estan en la carpeta /MODA Y
   ROPA FUTURISTA/, post-procesados con rembg → WebP en /public/assets/
   futuristic-fashion/).

   UX:
     - Loop horizontal continuo (marquee CSS de translateX 0 → -50%).
     - Toggle abajo "WOMEN / MEN" → cambia el set. Solo hay 2 mujeres y 5
       hombres en la carpeta, asi que duplicamos el array hasta tener al
       menos 10 items en cada modo: el track tiene ancho parejo y el loop
       no muestra huecos.
     - Mouse coords X/Y live en el footer (look HUD).
     - prefers-reduced-motion: el track se detiene (sin animation) pero
       sigue siendo scrollable manual con drag.

   Lo "futurista":
     - Fondo dark + grid de puntos
     - Corner brackets en las 4 esquinas
     - Mid-rule horizontal con marker en cada borde
     - Big back-title "WHYNOT" con outline holografico
     - Toggle pill con accent yellow (paleta T-012 del proyecto)
     - Scanlines suaves overlay
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";

const WOMEN = [
  "/assets/futuristic-fashion/woman-01.webp",
  "/assets/futuristic-fashion/woman-02.webp",
];
const MEN = [
  "/assets/futuristic-fashion/man-01.webp",
  "/assets/futuristic-fashion/man-02.webp",
  "/assets/futuristic-fashion/man-03.webp",
  "/assets/futuristic-fashion/man-04.webp",
  "/assets/futuristic-fashion/man-05.webp",
];

const MIN_ITEMS_FOR_LOOP = 10;

type Mode = "women" | "men";

function buildLoopList(list: string[]): string[] {
  if (list.length === 0) return [];
  const repeats = Math.max(1, Math.ceil(MIN_ITEMS_FOR_LOOP / list.length));
  const padded: string[] = [];
  for (let i = 0; i < repeats; i++) padded.push(...list);
  /* Duplicamos otra vez al final asi el `translateX(-50%)` del marquee
     vuelve exacto al estado inicial y el loop es seamless.            */
  return [...padded, ...padded];
}

export default function FuturisticGallery() {
  const [mode, setMode] = useState<Mode>("women");
  const list = mode === "women" ? WOMEN : MEN;
  const loop = useMemo(() => buildLoopList(list), [list]);

  /* Mouse-tracked coords HUD. Solo se actualizan cuando el cursor esta
     sobre el contenedor de la galeria (no global → no estorba a otros
     componentes con sus propios listeners de pointer).                 */
  const sectionRef = useRef<HTMLElement>(null);
  const [coords, setCoords] = useState({ x: 0.0, y: 0.0 });
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      setCoords({ x: Math.max(0, Math.min(1, nx)), y: Math.max(0, Math.min(1, ny)) });
    };
    el.addEventListener("pointermove", onMove);
    return () => el.removeEventListener("pointermove", onMove);
  }, []);

  const fmtCoord = (n: number) => n.toFixed(4).slice(2); // ".XXXX" → "XXXX"

  return (
    <section
      id="section-futuristic-gallery"
      ref={sectionRef}
      style={{
        position: "relative",
        background: "#1a1a1c",
        color: "#f3ece1",
        padding: "var(--space-md) var(--space-md)",
        borderTop: "1px solid var(--color-line)",
        borderBottom: "1px solid var(--color-line)",
        overflow: "hidden",
      }}
    >
      {/* Grid de puntos (fondo DICH-like). Position absolute para que no
          empuje el layout y mix-blend-mode screen lo deja sutil.        */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(circle, rgba(243,236,225,0.10) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          pointerEvents: "none",
        }}
      />

      {/* Scanlines */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "repeating-linear-gradient(0deg, rgba(244,169,130,0.04) 0px, rgba(244,169,130,0.04) 1px, transparent 1px, transparent 4px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
        }}
      />

      {/* 4 corner brackets de la SECTION entera */}
      {[
        { top: 14, left: 14, borderTop: 1, borderLeft: 1 },
        { top: 14, right: 14, borderTop: 1, borderRight: 1 },
        { bottom: 14, left: 14, borderBottom: 1, borderLeft: 1 },
        { bottom: 14, right: 14, borderBottom: 1, borderRight: 1 },
      ].map((p, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            width: 24,
            height: 24,
            pointerEvents: "none",
            zIndex: 3,
            ...(p as React.CSSProperties),
            borderTopWidth: p.borderTop ? 1 : 0,
            borderBottomWidth: p.borderBottom ? 1 : 0,
            borderLeftWidth: p.borderLeft ? 1 : 0,
            borderRightWidth: p.borderRight ? 1 : 0,
            borderStyle: "solid",
            borderColor: "rgba(243,236,225,0.45)",
          }}
        />
      ))}

      {/* TOP BAR — sparkline ECG (CSS) · titulo · indicador */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          padding: "0 1rem",
          minHeight: 28,
          zIndex: 2,
        }}
      >
        <span
          className="system-text"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "rgba(243,236,225,0.75)",
          }}
        >
          <svg width="44" height="14" viewBox="0 0 44 14" aria-hidden>
            <polyline
              points="0,7 6,7 9,2 12,12 15,7 21,7 24,4 27,10 30,7 44,7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
          </svg>
          ON
        </span>

        <span
          className="system-text"
          style={{
            letterSpacing: "0.3em",
            color: "rgba(243,236,225,0.85)",
          }}
        >
          WHYNOT // GALLERY
        </span>

        <span
          className="system-text"
          style={{ color: "rgba(243,236,225,0.55)" }}
        >
          {mode === "women" ? "FEM_SET" : "MAS_SET"}
        </span>
      </div>

      {/* MID HORIZONTAL RULE con plus markers a los lados — look planos
          tecnicos DICH                                                  */}
      <div
        style={{
          position: "relative",
          height: 1,
          margin: "1.2rem 1rem 0",
          background: "rgba(243,236,225,0.20)",
          zIndex: 2,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -6,
            left: -6,
            color: "rgba(243,236,225,0.55)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          +
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            color: "rgba(243,236,225,0.55)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          +
        </span>
      </div>

      {/* CARRUSEL — track ancho infinito con animation marquee.
          key={mode} fuerza re-mount al cambiar genero → animation reinicia
          desde 0 sin "jump" feo en el medio del loop.                   */}
      <div
        style={{
          position: "relative",
          width: "100%",
          padding: "var(--space-lg) 0 var(--space-md)",
          zIndex: 2,
        }}
      >
        <div
          key={mode}
          className="futuristic-gallery-track"
          style={{
            display: "flex",
            width: "max-content",
            alignItems: "flex-end",
            gap: "clamp(2rem, 6vw, 6rem)",
            paddingLeft: "clamp(2rem, 6vw, 6rem)",
            animation: `futuristic-gallery-marquee ${
              mode === "women" ? 28 : 60
            }s linear infinite`,
          }}
        >
          {loop.map((src, i) => {
            const idx = (i % list.length) + 1;
            const tag = `${mode === "women" ? "F" : "M"}_${String(idx).padStart(2, "0")}`;
            return (
              <figure
                key={`${src}-${i}`}
                style={{
                  margin: 0,
                  position: "relative",
                  flex: "0 0 auto",
                }}
              >
                <img
                  src={src}
                  alt={`Futuristic outfit ${tag}`}
                  loading="lazy"
                  draggable={false}
                  style={{
                    display: "block",
                    height: "clamp(360px, 60vh, 640px)",
                    width: "auto",
                    objectFit: "contain",
                    filter:
                      "drop-shadow(0 30px 40px rgba(0,0,0,0.45)) drop-shadow(0 0 18px rgba(255,40,40,0.08))",
                    userSelect: "none",
                  }}
                />
                <figcaption
                  className="system-text"
                  style={{
                    position: "absolute",
                    bottom: -22,
                    left: 0,
                    color: "rgba(243,236,225,0.55)",
                    letterSpacing: "0.3em",
                    fontSize: "0.55rem",
                  }}
                >
                  // {tag}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>

      {/* MID HORIZONTAL RULE inferior */}
      <div
        style={{
          position: "relative",
          height: 1,
          margin: "0 1rem 1.6rem",
          background: "rgba(243,236,225,0.20)",
          zIndex: 2,
        }}
      >
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -6,
            left: -6,
            color: "rgba(243,236,225,0.55)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          +
        </span>
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            color: "rgba(243,236,225,0.55)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          +
        </span>
      </div>

      {/* BIG BACK-TITLE WHYNOT (outline mode, sutil) */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          fontFamily: "var(--font-marquee)",
          fontSize: "clamp(3rem, 12vw, 9rem)",
          letterSpacing: "0.05em",
          lineHeight: 1,
          color: "rgba(243,236,225,0.85)",
          textTransform: "uppercase",
          zIndex: 2,
        }}
      >
        WHYNOT
      </div>

      {/* TOGGLE pill — switch entre women/men. Estética T-012 del proyecto:
          accent yellow (--color-accent-2) sobre fondo oscuro.            */}
      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          gap: "var(--space-md)",
          alignItems: "center",
          margin: "var(--space-md) 1rem 0",
          zIndex: 2,
        }}
      >
        <span
          className="system-text"
          style={{ color: "rgba(243,236,225,0.55)", justifySelf: "start" }}
        >
          BODY {"{"}
        </span>

        <button
          type="button"
          onClick={() => setMode((m) => (m === "women" ? "men" : "women"))}
          aria-pressed={mode === "men"}
          aria-label="Toggle between women and men gallery"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "8px 12px",
            background: "#0a0a0a",
            border: "1px solid rgba(243,236,225,0.25)",
            borderRadius: "var(--radius-pill, 999px)",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: "rgba(243,236,225,0.85)",
            transition: "border-color var(--speed-fast, 0.15s)",
          }}
        >
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: mode === "women" ? "var(--color-accent-2, #ffd166)" : "transparent",
              color: mode === "women" ? "#0a0a0a" : "rgba(243,236,225,0.55)",
              border:
                mode === "women" ? "none" : "1px solid rgba(243,236,225,0.30)",
              fontWeight: 700,
              transition: "background var(--speed-fast, 0.15s), color var(--speed-fast, 0.15s)",
            }}
          >
            F
          </span>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: mode === "men" ? "var(--color-accent-2, #ffd166)" : "transparent",
              color: mode === "men" ? "#0a0a0a" : "rgba(243,236,225,0.55)",
              border:
                mode === "men" ? "none" : "1px solid rgba(243,236,225,0.30)",
              fontWeight: 700,
              transition: "background var(--speed-fast, 0.15s), color var(--speed-fast, 0.15s)",
            }}
          >
            M
          </span>
        </button>

        <span
          className="system-text"
          style={{ color: "rgba(243,236,225,0.55)", justifySelf: "end" }}
        >
          {"}"} STYLE
        </span>
      </div>

      {/* FOOTER coords */}
      <div
        style={{
          position: "relative",
          textAlign: "center",
          marginTop: "var(--space-md)",
          paddingBottom: "0.5rem",
          fontFamily: "var(--font-mono)",
          fontSize: "0.65rem",
          letterSpacing: "0.3em",
          color: "rgba(243,236,225,0.45)",
          textTransform: "uppercase",
          zIndex: 2,
        }}
      >
        X.{fmtCoord(coords.x)} // Y.{fmtCoord(coords.y)}
      </div>

      {/* Keyframes locales del marquee + soporte reduced-motion. */}
      <style jsx>{`
        @keyframes futuristic-gallery-marquee {
          from { transform: translate3d(0, 0, 0); }
          to   { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .futuristic-gallery-track {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}
