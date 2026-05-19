"use client";

/* ============================================================================
   GLASS ORB — Esfera de cristal semitransparente CSS, autocontenida.

   Componente reutilizable. No depende de Three.js: solo CSS + pseudo-layers.
   Pensado para usarse SOBRE fondos claros (blanco, pearl, gris claro, peach)
   y dejar ver lo que hay detras a traves del cristal con backdrop-filter.

   USO BASICO:
     <GlassOrb src="/assets/hero/golden-goose.webp" alt="Sneaker" />

   USO CON CHILDREN (cualquier contenido React, no solo imagen):
     <GlassOrb size="420px">
       <video src="/assets/hero/golden-goose.mp4" autoPlay muted loop />
     </GlassOrb>

   PROPS:
     - src / alt:      imagen directa (atajo)
     - size:           CSS width del orb (default clamp 280-480px responsive)
     - innerScale:     0-1, % del orb que ocupa el contenido (default 0.62)
     - glow:           "warm" | "cool" | "neutral" — tinte del rim (default warm)
     - shadow:         boolean — dropshadow externo (default true)
     - className/style: passthrough al wrapper externo
   ============================================================================ */

import { CSSProperties, ReactNode } from "react";

interface Props {
  src?: string;
  alt?: string;
  size?: string;
  innerScale?: number;
  glow?: "warm" | "cool" | "neutral";
  shadow?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const GLOW_COLORS: Record<NonNullable<Props["glow"]>, { rim: string; sheen: string }> = {
  warm:    { rim: "rgba(255,232,200,0.55)", sheen: "rgba(255,220,180,0.30)" },
  cool:    { rim: "rgba(210,225,255,0.55)", sheen: "rgba(190,210,250,0.30)" },
  neutral: { rim: "rgba(255,255,255,0.55)", sheen: "rgba(230,230,230,0.30)" },
};

export default function GlassOrb({
  src,
  alt = "",
  size = "clamp(280px, 50vw, 480px)",
  innerScale = 0.62,
  glow = "warm",
  shadow = true,
  children,
  className,
  style,
}: Props) {
  const colors = GLOW_COLORS[glow];
  const innerPct = `${Math.round(innerScale * 100)}%`;

  return (
    <div
      className={`glass-orb ${className ?? ""}`}
      style={{ width: size, ...style }}
    >
      <div className="glass-orb__inner">
        {/* 1) Backdrop blur del fondo a traves del cristal */}
        <div className="glass-orb__backdrop" aria-hidden />

        {/* 2) Cuerpo del cristal: radial-gradient con highlights direccionales */}
        <div className="glass-orb__body" aria-hidden />

        {/* 3) Sombra interna inferior (le da peso a la esfera) */}
        <div className="glass-orb__bottom-shadow" aria-hidden />

        {/* 4) Reflejo principal arriba-izquierda (highlight especular) */}
        <div className="glass-orb__highlight" aria-hidden />

        {/* 5) Reflejo lateral fino (rim light derecho) */}
        <div className="glass-orb__side-reflect" aria-hidden />

        {/* 6) Aro de vidrio: borde fino refractante (white inner + dark outer) */}
        <div className="glass-orb__rim" aria-hidden />

        {/* 7) Contenido — flota dentro con animacion propia */}
        <div className="glass-orb__content">
          {src ? (
            <img src={src} alt={alt} className="glass-orb__content-img" />
          ) : (
            children
          )}
        </div>
      </div>

      <style jsx>{`
        .glass-orb {
          position: relative;
          aspect-ratio: 1 / 1;
          margin: 0 auto;
          /* Flotacion lenta de toda la esfera */
          animation: glass-orb-float 7s ease-in-out infinite;
          ${shadow ? "filter: drop-shadow(0 30px 50px rgba(0,0,0,0.18));" : ""}
        }
        .glass-orb__inner {
          position: relative;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          overflow: hidden;
          isolation: isolate;
        }

        /* 1) BACKDROP — blurea lo que esta detras del orb */
        .glass-orb__backdrop {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          backdrop-filter: blur(10px) saturate(1.1);
          -webkit-backdrop-filter: blur(10px) saturate(1.1);
          background: rgba(255, 255, 255, 0.08);
          z-index: 0;
        }

        /* 2) BODY — el "cristal" en si: gradiente radial con sombreado direccional */
        .glass-orb__body {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            radial-gradient(
              circle at 32% 28%,
              rgba(255,255,255,0.95) 0%,
              rgba(255,255,255,0.55) 18%,
              rgba(255,255,255,0.18) 38%,
              rgba(255,255,255,0.08) 62%,
              rgba(255,255,255,0.22) 82%,
              rgba(0,0,0,0.06) 100%
            );
          z-index: 1;
        }

        /* 3) SOMBRA INFERIOR INTERNA — terminador oscuro de la esfera */
        .glass-orb__bottom-shadow {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background:
            radial-gradient(circle at 72% 80%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.08) 25%, transparent 55%);
          mix-blend-mode: multiply;
          z-index: 2;
          pointer-events: none;
        }

        /* 4) HIGHLIGHT principal arriba-izquierda */
        .glass-orb__highlight {
          position: absolute;
          top: 6%;
          left: 14%;
          width: 38%;
          height: 28%;
          background: radial-gradient(
            ellipse at center,
            rgba(255,255,255,0.95) 0%,
            rgba(255,255,255,0.55) 35%,
            transparent 70%
          );
          filter: blur(3px);
          z-index: 5;
          pointer-events: none;
        }

        /* 5) REFLEJO LATERAL fino (rim light) */
        .glass-orb__side-reflect {
          position: absolute;
          top: 28%;
          right: 6%;
          width: 14%;
          height: 38%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            ${colors.sheen} 50%,
            rgba(255,255,255,0.55) 100%
          );
          border-radius: 50%;
          filter: blur(7px);
          z-index: 4;
          pointer-events: none;
        }

        /* 6) ARO DE VIDRIO: borde fino refractante. Inner-shadow blanca + thin
              dark line outer da look de cristal grueso pulido.            */
        .glass-orb__rim {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          z-index: 6;
          pointer-events: none;
          box-shadow:
            inset 0 0 0 1px rgba(255,255,255,0.7),
            inset 0 0 0 3px ${colors.rim},
            inset 0 0 28px rgba(255,255,255,0.45),
            inset 0 -10px 30px -10px rgba(0,0,0,0.12),
            0 0 0 1px rgba(0,0,0,0.04);
        }

        /* 7) CONTENT slot — la imagen / video flota aca dentro */
        .glass-orb__content {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          z-index: 3; /* sobre body y bottom-shadow, debajo del highlight */
          pointer-events: none;
        }
        .glass-orb__content :global(img),
        .glass-orb__content :global(video) {
          width: ${innerPct};
          height: ${innerPct};
          object-fit: contain;
          filter: drop-shadow(0 22px 26px rgba(0,0,0,0.22))
                  drop-shadow(0 4px 6px rgba(0,0,0,0.10));
          animation: glass-orb-float-inner 5s ease-in-out infinite;
          display: block;
        }
        /* Cuando se usa children custom, le aplicamos el mismo wrapper */
        .glass-orb__content > :global(*:not(img):not(video)) {
          max-width: ${innerPct};
          max-height: ${innerPct};
          filter: drop-shadow(0 22px 26px rgba(0,0,0,0.22));
          animation: glass-orb-float-inner 5s ease-in-out infinite;
        }

        @keyframes glass-orb-float {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-10px); }
        }
        @keyframes glass-orb-float-inner {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .glass-orb,
          .glass-orb__content :global(img),
          .glass-orb__content :global(video) {
            animation: none !important;
          }
        }
        /* Sin override de width en mobile — el size lo controla el padre o
           el clamp default. Asi GlassOrb se adapta al contenedor.        */
      `}</style>
    </div>
  );
}
