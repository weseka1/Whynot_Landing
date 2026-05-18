/* ============================================================================
   FRAME BORDER
   Marco decorativo completo de una sección: 4 esquinas en L + 4 líneas
   laterales conectándolas. Sucesor de CornerFrame (que sólo dibuja las L).

   Composición:
       ┌─────────────────┐
       │                 │
       │                 │
       └─────────────────┘

   Las líneas no llegan hasta las esquinas: hay un gap que muestra los
   corners SVG, igual que el referente.

   Props:
     - color    → color de los trazos
     - inset    → distancia del borde del contenedor padre (default 12px)
     - corner   → tamaño de las L de las esquinas (default 36px)
     - gap      → separación entre la L y la línea (default 8px)
   ============================================================================ */

type Props = {
  color?:  string;
  inset?:  number;
  corner?: number;
  gap?:    number;
};

export default function FrameBorder({
  color  = "var(--color-accent)",
  inset  = 12,
  corner = 36,
  gap    = 8,
}: Props) {
  const lineStyle: React.CSSProperties = {
    position: "absolute",
    background: color,
    pointerEvents: "none",
  };

  // Las líneas laterales empiezan donde termina la L + gap
  const sideOffset = inset + corner + gap;

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {/* --- 4 ESQUINAS EN "L" --- */}
      {(["TL", "TR", "BL", "BR"] as const).map((pos) => {
        const s: React.CSSProperties = {
          position: "absolute",
          width: corner,
          height: corner,
          pointerEvents: "none",
        };
        if (pos === "TL") { s.top = inset; s.left = inset; }
        if (pos === "TR") { s.top = inset; s.right = inset; }
        if (pos === "BL") { s.bottom = inset; s.left = inset; }
        if (pos === "BR") { s.bottom = inset; s.right = inset; }

        const flipX = pos === "TR" || pos === "BR";
        const flipY = pos === "BL" || pos === "BR";

        return (
          <svg
            key={pos}
            width={corner}
            height={corner}
            viewBox={`0 0 ${corner} ${corner}`}
            style={{
              ...s,
              transform: `${flipX ? "scaleX(-1)" : ""} ${flipY ? "scaleY(-1)" : ""}`.trim(),
            }}
          >
            <path
              d={`M 0 1 L ${corner * 0.55} 1`}
              stroke={color} strokeWidth="1" fill="none"
            />
            <path
              d={`M 1 0 L 1 ${corner * 0.55}`}
              stroke={color} strokeWidth="1" fill="none"
            />
          </svg>
        );
      })}

      {/* --- 4 LÍNEAS LATERALES (conectan las L) --- */}
      {/* TOP */}
      <div style={{
        ...lineStyle,
        top: inset + 1,
        left:  sideOffset,
        right: sideOffset,
        height: 1,
      }} />
      {/* BOTTOM */}
      <div style={{
        ...lineStyle,
        bottom: inset + 1,
        left:  sideOffset,
        right: sideOffset,
        height: 1,
      }} />
      {/* LEFT */}
      <div style={{
        ...lineStyle,
        left: inset + 1,
        top:    sideOffset,
        bottom: sideOffset,
        width: 1,
      }} />
      {/* RIGHT */}
      <div style={{
        ...lineStyle,
        right: inset + 1,
        top:    sideOffset,
        bottom: sideOffset,
        width: 1,
      }} />
    </div>
  );
}
