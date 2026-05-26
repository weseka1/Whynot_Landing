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
  /* splitWhyNot: cuando es true Y image esta seteado, recortamos la imagen
     2172x724 que dice "WHYNOT AMK EXCLUSIVE" para mostrar SOLO la parte
     "WHY" y la parte "NOT" como dos chunks separados con gap entre medio,
     descartando " AMK EXCLUSIVE". Asi el marquee dice "WHY  NOT  WHY  NOT"
     sin necesidad de re-exportar el asset.                                 */
  splitWhyNot?: boolean;
};

/* Bounding boxes en la imagen original 2172x724 (medidos a mano sobre
   el WebP). Son los pixeles donde arrancan/terminan las palabras "WHY"
   y "NOT" — el resto (" AMK EXCLUSIVE") queda fuera del crop.            */
const WHY_BOX = { left: 74,  width: 335 };  // x ∈ [74, 409]
const NOT_BOX = { left: 447, width: 313 };  // x ∈ [447, 760]
const IMG_W = 2172;
const IMG_H = 724;
const IMG_AR = IMG_W / IMG_H; // ~3:1

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
  splitWhyNot = false,
}: Props) {

  /* ============================ IMAGE MODE ============================ */
  if (image) {
    /* ===== Split mode: recorta "WHY" y "NOT" de la misma imagen ===== */
    if (splitWhyNot) {
      /* Cada chunk es un <div> con la imagen como background. Calculamos
         su ancho en proporcion al height pedido (mantiene aspect 3:1 de
         la imagen completa) y desplazamos backgroundPosition para que se
         vea solo la parte que queremos. La imagen del background ocupa
         siempre el "ancho virtual completo" (aspect-ratio * height),
         pero el div solo deja ver la porcion correspondiente.            */
      const chunkStyle = (box: { left: number; width: number }): React.CSSProperties => {
        // pct del ancho total que ocupa esta parte
        const widthPct  = (box.width / IMG_W) * 100;
        const leftPct   = (box.left  / IMG_W) * 100;
        return {
          height: imageHeight,
          /* Width = altura * aspect * widthPct/100 → conserva proporciones
             del recorte respecto al height pedido.                        */
          width: `calc(${imageHeight} * ${IMG_AR.toFixed(4)} * ${(widthPct / 100).toFixed(4)})`,
          backgroundImage: `url(${image})`,
          /* Background ocupa el "ancho virtual" completo de la imagen
             (height * aspect). De ese ancho, el div solo "muestra" la
             slice que corresponde via backgroundPosition negativo.        */
          backgroundSize: `calc(${imageHeight} * ${IMG_AR.toFixed(4)}) ${imageHeight}`,
          backgroundPosition: `calc(${imageHeight} * ${IMG_AR.toFixed(4)} * -${(leftPct / 100).toFixed(4)}) 0`,
          backgroundRepeat: "no-repeat",
          flexShrink: 0,
        };
      };

      /* Cada "frase" del marquee = WHY [small gap] NOT [bigger gap antes
         del proximo par]. Repetimos varias frases para llenar el run.    */
      const PHRASES_PER_RUN = 3;
      const run = (key: string) => (
        <div
          key={key}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(2rem, 6vw, 4rem)",          // gap entre frases
            paddingRight: "clamp(2rem, 6vw, 4rem)", // mantener gap antes de la sig run
            flexShrink: 0,
          }}
        >
          {Array.from({ length: PHRASES_PER_RUN }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "clamp(0.6rem, 1.8vw, 1.4rem)", // gap entre WHY y NOT
                flexShrink: 0,
              }}
            >
              <div style={chunkStyle(WHY_BOX)} aria-hidden />
              <div style={chunkStyle(NOT_BOX)} aria-hidden />
            </div>
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

    /* ===== Full image mode (comportamiento original) ===== */
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
            /* La imagen del marquee es UNA SOLA (browser deduplica los 6 imgs
               apuntando al mismo src). Marcar decoding async para no bloquear
               el main thread mientras el browser pinta el Hero.            */
            decoding="async"
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
