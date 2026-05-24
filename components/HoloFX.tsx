"use client";

/* ============================================================================
   HoloFX — capa de efectos futuristas para la AR capsule de Collections.

   Filosofia: SVG + CSS animations puras (sin canvas, sin three.js, sin RAF).
   El zapa de arriba ya rota como video — esta capa AGREGA el "envoltorio"
   futurista (anillos holograficos, scan, particulas, halo cromatico),
   sincronizando los acentos con el variant activo (white-black / silver /
   gold).

   Performance:
     - Todo se anima con CSS @keyframes (composited en GPU)
     - 0 listeners de scroll/resize
     - mix-blend-mode: multiply | screen para integrarse con el fondo pearl
     - prefers-reduced-motion respetado (los animation-duration ya se
       neutralizan globalmente en globals.css)

   Uso:
     <HoloFX accent="gold" />     // accent: "white" | "silver" | "gold"

   Se monta DENTRO de .ar-capsule (position:relative). Cubre 100% del padre
   con pointer-events: none, ocupa 2 capas distintas via la prop `layer`:
     - layer="back"  → anillos, halo, particulas (detras del producto)
     - layer="front" → scan line + corner ticks animados (delante)
   ============================================================================ */

import { memo } from "react";

type Accent = "white" | "silver" | "gold";

const ACCENT_TOKENS: Record<Accent, { hi: string; mid: string; lo: string }> = {
  /* Tonos pensados sobre fondo pearl (#f4f1ec). hi = brillo principal,
     mid = anillos, lo = sombras suaves del halo.                        */
  white:  { hi: "rgba(255,255,255,0.95)", mid: "rgba(169,162,153,0.55)", lo: "rgba(46,42,37,0.18)" },
  silver: { hi: "rgba(220,224,230,0.95)", mid: "rgba(169,178,189,0.60)", lo: "rgba(60,68,78,0.18)"  },
  gold:   { hi: "rgba(232,205,140,0.95)", mid: "rgba(201,173,107,0.65)", lo: "rgba(140,108,52,0.20)" },
};

interface HoloFXProps {
  accent?: Accent;
  layer?: "back" | "front";
}

function HoloFXImpl({ accent = "gold", layer = "back" }: HoloFXProps) {
  const t = ACCENT_TOKENS[accent];

  /* Genero los SVG dots con coords precalculadas (12 particulas en 3 anillos).
     Cada una recibe un delay distinto para que la rotacion se vea organica. */
  const PARTICLES = Array.from({ length: 12 }, (_, i) => {
    const ring = i % 3; // 0,1,2
    const radius = 36 + ring * 7; // % del viewBox
    const startAngle = (i * 30) % 360;
    const size = ring === 0 ? 1.6 : ring === 1 ? 1.2 : 0.9;
    const dur = 18 + ring * 6; // s
    const reverse = ring === 1; // alterno sentido
    return { ring, radius, startAngle, size, dur, reverse, i };
  });

  if (layer === "front") {
    /* ====== CAPA SUPERIOR — scan sweep + tick marks animados ====== */
    return (
      <div
        aria-hidden
        className="holo-fx-front"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          overflow: "hidden",
          borderRadius: "inherit",
          zIndex: 4,
        }}
      >
        {/* Scan line horizontal que cruza la capsule top → bottom */}
        <div
          className="holo-scan"
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: 0,
            height: 2,
            background: `linear-gradient(90deg, transparent 0%, ${t.hi} 50%, transparent 100%)`,
            boxShadow: `0 0 12px 1px ${t.hi}`,
            mixBlendMode: "screen",
            opacity: 0.55,
          }}
        />
        {/* Glow secundario detras de la scan line (resalta sobre pearl) */}
        <div
          className="holo-scan-trail"
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: 0,
            height: 36,
            marginTop: -18,
            background: `linear-gradient(180deg, transparent 0%, ${t.mid} 50%, transparent 100%)`,
            opacity: 0.18,
            filter: "blur(6px)",
          }}
        />

        <style jsx>{`
          @keyframes holo-scan-move {
            0%   { transform: translateY(-10%); opacity: 0; }
            8%   { opacity: 0.55; }
            92%  { opacity: 0.55; }
            100% { transform: translateY(820%); opacity: 0; }
          }
          @keyframes holo-scan-trail-move {
            0%   { transform: translateY(-10%); opacity: 0; }
            10%  { opacity: 0.22; }
            90%  { opacity: 0.18; }
            100% { transform: translateY(2150%); opacity: 0; }
          }
          .holo-scan       { animation: holo-scan-move 5.4s cubic-bezier(.4,0,.2,1) infinite; }
          .holo-scan-trail { animation: holo-scan-trail-move 5.4s cubic-bezier(.4,0,.2,1) infinite; }
        `}</style>
      </div>
    );
  }

  /* ============ CAPA POSTERIOR — halo + anillos + particulas + sonar ============ */
  return (
    <div
      aria-hidden
      className="holo-fx-back"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        borderRadius: "inherit",
      }}
    >
      {/* === HALO CONICO (sheen cromatico de fondo) ===
          Conic-gradient rotando lento → "spin de cromo" detras del producto.
          mix-blend-mode: multiply tinta el pearl con un duotono dorado/plata
          sin agresividad. */}
      <div
        className="holo-halo"
        style={{
          position: "absolute",
          inset: "-6%",
          borderRadius: "50%",
          background: `conic-gradient(from 0deg,
            ${t.lo} 0deg,
            transparent 30deg,
            ${t.mid} 90deg,
            transparent 150deg,
            ${t.lo} 210deg,
            transparent 270deg,
            ${t.mid} 330deg,
            ${t.lo} 360deg)`,
          opacity: 0.35,
          filter: "blur(28px)",
          mixBlendMode: "multiply",
        }}
      />

      {/* === GLOW central radial (suaviza el bg debajo del zapa) === */}
      <div
        style={{
          position: "absolute",
          inset: "12%",
          borderRadius: "50%",
          background: `radial-gradient(circle at 50% 55%, ${t.hi} 0%, transparent 55%)`,
          opacity: 0.30,
          filter: "blur(14px)",
          mixBlendMode: "screen",
        }}
      />

      {/* === ANILLOS HOLOGRAFICOS SVG === */}
      <svg
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid meet"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
        }}
      >
        <defs>
          <radialGradient id={`holo-glow-${accent}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor={t.hi}  stopOpacity="0.0" />
            <stop offset="70%" stopColor={t.mid} stopOpacity="0.0" />
            <stop offset="100%" stopColor={t.mid} stopOpacity="0.45" />
          </radialGradient>

          {/* Filtro de glow suave para los anillos */}
          <filter id={`holo-blur-${accent}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="0.5" />
          </filter>
        </defs>

        {/* anillo externo segmentado (data ticks) rotando lento */}
        <g className="holo-ring-out" style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}>
          <circle
            cx="100" cy="100" r="88"
            fill="none"
            stroke={t.mid}
            strokeWidth="0.6"
            strokeDasharray="2 6"
            opacity="0.85"
          />
          {/* 4 marcas de cuadrante mas marcadas */}
          {[0, 90, 180, 270].map((deg) => (
            <line
              key={deg}
              x1="100" y1="6"
              x2="100" y2="14"
              stroke={t.hi}
              strokeWidth="1.2"
              transform={`rotate(${deg} 100 100)`}
              opacity="0.9"
            />
          ))}
        </g>

        {/* anillo intermedio fino, rota en sentido opuesto */}
        <g className="holo-ring-mid" style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}>
          <circle
            cx="100" cy="100" r="74"
            fill="none"
            stroke={t.mid}
            strokeWidth="0.35"
            opacity="0.6"
          />
          {/* arco activo (data segment) */}
          <circle
            cx="100" cy="100" r="74"
            fill="none"
            stroke={t.hi}
            strokeWidth="0.9"
            strokeDasharray="60 405"
            opacity="0.9"
            filter={`url(#holo-blur-${accent})`}
          />
        </g>

        {/* anillo interno SOLIDO muy fino — borde del producto */}
        <circle
          cx="100" cy="100" r="60"
          fill="none"
          stroke={t.mid}
          strokeWidth="0.25"
          opacity="0.4"
          strokeDasharray="1 3"
        />

        {/* Pulsos sonar — 2 circulos que crecen y se desvanecen */}
        <circle
          className="holo-pulse"
          cx="100" cy="100" r="40"
          fill="none"
          stroke={t.hi}
          strokeWidth="0.6"
          opacity="0"
          style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}
        />
        <circle
          className="holo-pulse holo-pulse-delay"
          cx="100" cy="100" r="40"
          fill="none"
          stroke={t.mid}
          strokeWidth="0.5"
          opacity="0"
          style={{ transformOrigin: "50% 50%", transformBox: "view-box" }}
        />

        {/* Particulas orbitando */}
        <g className="holo-particles">
          {PARTICLES.map((p) => (
            <g
              key={p.i}
              className={`holo-orbit ${p.reverse ? "holo-orbit-rev" : ""}`}
              style={{
                transformOrigin: "50% 50%", transformBox: "view-box",
                animationDuration: `${p.dur}s`,
                animationDelay: `${(p.i * -1.4).toFixed(2)}s`,
              }}
            >
              {/* La particula se posiciona a (100, 100 - radius) y el padre
                  rota → asi traza el circulo de radio `radius`. */}
              <circle
                cx="100"
                cy={100 - p.radius}
                r={p.size}
                fill={t.hi}
                opacity="0.85"
              >
                {/* Twinkle: parpadeo sutil */}
                <animate
                  attributeName="opacity"
                  values="0.2;0.95;0.2"
                  dur={`${2.4 + (p.i % 4) * 0.3}s`}
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          ))}
        </g>

        {/* Marcadores cardinales con etiquetas tipo HUD (N/E/S/W con coords) */}
        <g className="holo-cardinals" opacity="0.55">
          {[
            { x: 100, y: 4,   t: "N" },
            { x: 196, y: 102, t: "E" },
            { x: 100, y: 198, t: "S" },
            { x: 4,   y: 102, t: "W" },
          ].map((c) => (
            <text
              key={c.t}
              x={c.x} y={c.y}
              fontSize="3.5"
              fill={t.mid}
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
              letterSpacing="0.4"
            >
              {c.t}
            </text>
          ))}
        </g>
      </svg>

      <style jsx>{`
        @keyframes holo-spin       { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes holo-spin-rev   { from { transform: rotate(360deg); } to { transform: rotate(0deg);   } }
        @keyframes holo-halo-spin  { from { transform: rotate(0deg); }   to { transform: rotate(360deg); } }
        @keyframes holo-pulse {
          0%   { r: 40px; opacity: 0;    stroke-width: 0.8; }
          15%  {           opacity: 0.55; }
          80%  {           opacity: 0; }
          100% { r: 96px; opacity: 0;    stroke-width: 0.1; }
        }

        .holo-halo       { animation: holo-halo-spin 30s linear infinite; }
        :global(.holo-ring-out)  { animation: holo-spin     38s linear infinite; }
        :global(.holo-ring-mid)  { animation: holo-spin-rev 22s linear infinite; }
        :global(.holo-orbit)     { animation: holo-spin     20s linear infinite; }
        :global(.holo-orbit-rev) { animation-name: holo-spin-rev; }
        :global(.holo-pulse) {
          animation: holo-pulse 4.5s ease-out infinite;
        }
        :global(.holo-pulse-delay) {
          animation-delay: 2.25s;
        }
      `}</style>
    </div>
  );
}

const HoloFX = memo(HoloFXImpl);
export default HoloFX;
