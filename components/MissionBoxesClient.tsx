"use client";

/* Wrapper client-only para cargar MissionBoxes sin SSR.
   Three.js usa APIs del browser y no funciona durante el render server. */

import dynamic from "next/dynamic";
import type { MotionValue } from "framer-motion";

const MissionBoxes = dynamic(() => import("./MissionBoxes"), {
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
      LOADING BOXES…
    </div>
  ),
});

interface Props {
  progress: MotionValue<number>;
}

export default function MissionBoxesClient(props: Props) {
  return <MissionBoxes {...props} />;
}
