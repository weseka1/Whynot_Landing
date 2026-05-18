"use client";

/* ============================================================================
   CLOUD BAND — banda horizontal que SUBE al lugar correcto en el seam
   Hero ↔ Collections con muy poco scroll, fluidamente.

   - Atada al scrollY GLOBAL del window (no al progreso relativo).
   - useSpring suaviza el scrollY → cada "click" de rueda (que viene en
     chunks de ~100px en Windows) se interpola → movimiento fluido.
   - Sube en los primeros RISE_PX px de scroll y queda quieta sobre el seam.
   - 4 nubes layered centradas en el seam (translateY -50%): media en Hero,
     media en Collections, disimulando la unión.

   Tunear:
     - RISE_FROM   → desde dónde sube (offset Y inicial)
     - RISE_PX     → en cuántos píxeles de scroll completa la subida
     - useSpring   → carácter del movimiento (stiffness/damping/mass)
   ============================================================================ */

import { motion, useScroll, useSpring, useTransform } from "framer-motion";

/* Dos fases:
   1) RISE: del scroll 0 al RISE_PX la nube sube desde RISE_FROM hasta 0vh.
   2) DRIFT: del scroll RISE_PX al RISE_PX + DRIFT_PX la nube sigue subiendo
      muy lentamente hasta DRIFT_TO. Le da movimiento sutil mientras
      scrolleás Collections, así nunca se siente estática.            */

const RISE_FROM = "45vh";
const RISE_PX   = 150;
const DRIFT_TO  = "-18vh";   // cuánto sigue subiendo en total después del rise
const DRIFT_PX  = 2200;      // sobre cuánto scroll se reparte ese drift

export default function CloudBand() {
  const { scrollY } = useScroll();

  const smoothY = useSpring(scrollY, {
    stiffness: 65,
    damping: 21,
    mass: 1.1,
    restDelta: 0.2,
  });

  const y = useTransform(
    smoothY,
    [0, RISE_PX, RISE_PX + DRIFT_PX],
    [RISE_FROM, "0vh", DRIFT_TO],
    { clamp: true }
  );

  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        height: 0,
        zIndex: 10,
        pointerEvents: "none",
      }}
    >
      <motion.div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 0,
          y,
        }}
      >
        {/* lateral izquierdo */}
        <img
          src="/nuves/cloud-center.png"
          alt=""
          style={{
            position: "absolute",
            left: "5%",
            top: 0,
            transform: "translateY(-50%)",
            width: "35%",
            height: "auto",
            zIndex: 4,
            display: "block",
          }}
        />

        {/* back central wide */}
        <img
          src="/nuves/cloud-center.png"
          alt=""
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translate(-50%, -50%)",
            width: "45%",
            height: "auto",
            zIndex: 4,
            display: "block",
          }}
        />

        {/* lateral derecho */}
        <img
          src="/nuves/cloud-2.png"
          alt=""
          style={{
            position: "absolute",
            right: "5%",
            top: 0,
            transform: "translateY(-50%)",
            width: "30%",
            height: "auto",
            zIndex: 4,
            display: "block",
          }}
        />

        {/* refuerzo central plano */}
        <img
          src="/nuves/cloud-center-bottom.png"
          alt=""
          style={{
            position: "absolute",
            left: "50%",
            top: 0,
            transform: "translate(-50%, -50%)",
            width: "28%",
            height: "auto",
            zIndex: 5,
            display: "block",
          }}
        />
      </motion.div>
    </div>
  );
}
