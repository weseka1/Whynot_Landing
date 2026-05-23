"use client";

/* ============================================================================
   BRAND HERO — header de las brand pages del catálogo.
   Reescrito: ahora muestra SOLO el logo dorado "WHY NOT" + el mono mascot
   a la derecha. Antes traía:
     - eyebrow BRAND_ARCHIVE · NN MODELS · NN COLORWAYS
     - <h1> gigante con el brand name (AMIRI, ASICS, etc.)
     - stats row (SPECIMENS / 360° READY / STATIC / STATUS)
     - vertical accent line
   El cliente pidió sacar todo eso — "todo lo que no sea relacionado con
   las zapatillas o info de valor o de marketing". El brand name y los
   counters son data interna, no aportan al consumer.

   Mantengo la firma de props para no romper la pagina [brand]/page.tsx;
   las props que ya no se usan se ignoran (totalModels/totalColorways/
   total360). Si querés podes simplificar luego app/catalog/[brand]/
   page.tsx para no pasarlas.
   ============================================================================ */

import { motion } from "framer-motion";
import MonoMascot from "./MonoMascot";

type Props = {
  brandName: string;
  totalModels?: number;
  totalColorways?: number;
  total360?: number;
};

export default function BrandHero({ brandName }: Props) {
  return (
    <div
      style={{
        position: "relative",
        padding: "2.5rem 2.5rem 3rem",
        zIndex: 5,
      }}
    >
      {/* Logo WHY NOT dorado — pre-renderizado por el cliente (PNG),
          procesado con rembg birefnet-general-lite -> WebP transparente
          (370 KB). Reemplaza el <h1>BRAND_NAME</h1> gigante anterior. */}
      <motion.img
        src="/assets/marquee/whynot-gold.webp"
        alt={`WHY NOT — ${brandName} archive`}
        initial={{ opacity: 0, y: 24, filter: "blur(16px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        draggable={false}
        style={{
          display: "block",
          height: "clamp(7rem, 18vw, 14rem)",
          width: "auto",
          userSelect: "none",
          /* paddingRight no aplica a img — usamos margin-right para
             reservar espacio del mascot a la derecha y que el logo no
             se solape en breakpoints intermedios.                       */
          marginRight: "clamp(0px, 30vw, 520px)",
          filter:
            "drop-shadow(0 8px 30px rgba(255, 200, 80, 0.35)) drop-shadow(0 0 14px rgba(255, 215, 100, 0.25))",
        }}
      />

      {/* Mono mascot 3D — anclado al bottom del header, pies en el divider
          con el catalog grid. Sin cambios respecto del commit anterior. */}
      <motion.div
        className="brand-mascot"
        initial={{ opacity: 0, scale: 0.85, x: 24 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 1, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "absolute",
          top: "auto",
          bottom: "-3rem",
          right: "2.5rem",
          zIndex: 6,
        }}
      >
        <MonoMascot
          width={460}
          height={640}
          radius="130%"
          cameraTarget="0m 0.85m 0m"
        />
      </motion.div>

      <style jsx>{`
        @media (max-width: 768px) {
          .brand-mascot {
            position: static !important;
            margin: 1.5rem auto 0;
            display: block !important;
          }
          .brand-mascot > div {
            width: 300px !important;
            height: 420px !important;
          }
        }
      `}</style>
    </div>
  );
}
