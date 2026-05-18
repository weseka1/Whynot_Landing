"use client";

/* ============================================================================
   MARQUEE BANNER
   Banda horizontal infinita. Soporta dos modos:

     1) TEXT MODE  — prop `text`: render con tipografía del CSS (--font-marquee)
     2) IMAGE MODE — prop `image`: scrolea un PNG (ej: texto pre-renderizado
                     en T-12) repetido para fill infinito

   Ambos modos usan el mismo keyframe `marquee` (0 → -50% translateX) y la
   misma duración (var(--speed-ticker)), así que cambiar de modo NO cambia
   la velocidad ni la posición.

   Props:
     - image       → src del PNG; si está seteado, prioriza modo imagen
     - imageHeight → alto del PNG renderizado (default matchea text mode)
     - text        → string a repetir (modo texto)
     - separator   → caracter entre repeticiones de texto
     - size        → font-size override (modo texto)
     - color       → color del texto (modo texto)
     - opacity     → 0-1, ambos modos
     - direction   → "left" | "right"
   ============================================================================ */

type Props = {
  text?: string;
  image?: string;
  imageHeight?: string;
  separator?: string;
  size?: string;
  color?: string;
  opacity?: number;
  direction?: "left" | "right";
};

export default function MarqueeBanner({
  text = "WHYNOT AMK EXCLUSIVE",
  image,
  /* Alto del PNG. Como la imagen es 2172×724 (ratio ~3:1), 28vw de alto
     = ~84vw de ancho → una frase ocupa casi todo el viewport, igual que
     hacía el text mode con scaleX(1.25). */
  imageHeight = "clamp(7rem, 28vw, 22rem)",
  separator = "✦",
  size = "clamp(3rem, 10.5vw, 9.75rem)",
  color = "var(--color-fg)",
  opacity = 1,
  direction = "left",
}: Props) {

  /* ============================ IMAGE MODE ============================ */
  if (image) {
    /* 3 copias por corrida × 2 corridas = 6 instancias totales.
       Con cada imagen a ~84vw de ancho, una corrida pesa ~260vw → siempre
       mayor que el viewport, así el loop es seamless. */
    const REPEATS_PER_RUN = 3;
    const run = (key: string) => (
      <div
        key={key}
        style={{
          display: "flex",
          gap: "1.5rem",
          paddingRight: "1.5rem",
          flexShrink: 0,
        }}
      >
        {Array.from({ length: REPEATS_PER_RUN }).map((_, i) => (
          <img
            key={i}
            src={image}
            alt=""
            aria-hidden
            style={{
              height: imageHeight,
              width: "auto",
              display: "block",
              flexShrink: 0,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        ))}
      </div>
    );

    return (
      <div
        aria-hidden
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "max-content",
            opacity,
            animation: `marquee var(--speed-ticker) linear infinite ${
              direction === "right" ? "reverse" : "normal"
            }`,
          }}
        >
          {run("a")}
          {run("b")}
        </div>
      </div>
    );
  }

  /* ============================= TEXT MODE ============================ */
  const oneRun = Array.from({ length: 6 }, () => text).join(`  ${separator}  `);

  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        overflow: "hidden",
        width: "100%",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: "1.5ch",
          width: "max-content",
          animation: `marquee var(--speed-ticker) linear infinite ${
            direction === "right" ? "reverse" : "normal"
          }`,
          fontFamily:    "var(--font-marquee)",
          fontWeight:    900,
          fontSize:      size,
          lineHeight:    0.75,
          letterSpacing: "-0.08em",
          textTransform: "uppercase",
          whiteSpace:    "nowrap",
          transform:     "scaleX(1.25)",
          transformOrigin: "left center",
          color,
          opacity,
        }}
      >
        <span style={{ paddingRight: "1.5ch" }}>{oneRun}</span>
        <span style={{ paddingRight: "1.5ch" }}>{oneRun}</span>
      </div>
    </div>
  );
}
