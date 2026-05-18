/* ============================================================================
   CORNER FRAME
   SVG decorativo en forma de "L" que se ancla a una esquina del contenedor.
   Uso típico: dentro de un wrapper con position:relative.
     <CornerFrame position="top-left" />
   ============================================================================ */

type Position = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type Props = {
  position: Position;
  size?: number;     // px
  color?: string;
};

export default function CornerFrame({
  position,
  size = 32,
  color = "var(--color-accent)",
}: Props) {
  const pos: React.CSSProperties = { position: "absolute", pointerEvents: "none" };

  switch (position) {
    case "top-left":     pos.top = 0;    pos.left = 0;   break;
    case "top-right":    pos.top = 0;    pos.right = 0;  pos.transform = "scaleX(-1)"; break;
    case "bottom-left":  pos.bottom = 0; pos.left = 0;   pos.transform = "scaleY(-1)"; break;
    case "bottom-right": pos.bottom = 0; pos.right = 0;  pos.transform = "scale(-1)";  break;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={pos}
      aria-hidden
    >
      <path d="M0 1 L14 1" stroke={color} strokeWidth="1" fill="none" />
      <path d="M1 0 L1 14" stroke={color} strokeWidth="1" fill="none" />
    </svg>
  );
}
