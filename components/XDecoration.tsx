"use client";

/* ============================================================================
   X DECORATION
   Marcas en forma de X dispersas como decoración de fondo (tipo telemetría).
   Render randomizado pero determinista: seed por sección para que no salte
   entre renders.
   ============================================================================ */

type Props = { count?: number; seed?: number; color?: string };

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function XDecoration({
  count = 18,
  seed = 1,
  color = "var(--color-accent)",
}: Props) {
  const rand = mulberry32(seed);
  const marks = Array.from({ length: count }, (_, i) => ({
    key: i,
    top: rand() * 100,
    left: rand() * 100,
    size: 6 + rand() * 10,
    rot: rand() * 90,
    op: 0.15 + rand() * 0.3,
  }));

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      {marks.map((m) => (
        <svg
          key={m.key}
          width={m.size}
          height={m.size}
          viewBox="0 0 10 10"
          style={{
            position: "absolute",
            top: `${m.top}%`,
            left: `${m.left}%`,
            opacity: m.op,
            transform: `rotate(${m.rot}deg)`,
          }}
        >
          <path d="M0 0 L10 10 M10 0 L0 10" stroke={color} strokeWidth="0.8" />
        </svg>
      ))}
    </div>
  );
}
