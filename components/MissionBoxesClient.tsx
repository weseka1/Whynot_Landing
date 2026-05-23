"use client";

/* Wrapper client-only para cargar el stage 3D de Mission sin SSR.
   Three.js usa APIs del browser y no funciona durante el render server.

   Cambio: ahora carga MissionMascot (mono animado proceduralmente) en lugar
   del cluster de cajas + anillos. MissionBoxes.tsx queda en el repo intacto
   por si hay que revertir — basta con cambiar el import de abajo. */

import dynamic from "next/dynamic";
import type { MotionValue } from "framer-motion";

const MissionMascot = dynamic(() => import("./MissionMascot"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--color-accent)",
        fontFamily: "var(--font-mono)",
        letterSpacing: "0.2em",
        fontSize: "0.75rem",
      }}
    >
      LOADING MASCOT…
    </div>
  ),
});

interface Props {
  progress: MotionValue<number>;
}

export default function MissionBoxesClient(props: Props) {
  return <MissionMascot {...props} />;
}
