/* ============================================================================
   PAGE — composición de la home.
   - Above-the-fold (Preloader, Header, Hero, CloudBand): import directo,
     entran al bundle inicial → primer paint inmediato.
   - Below-the-fold: dynamic import con ssr:false. Sólo se descarga JS de
     esa sección cuando el usuario se acerca al scroll. Esto baja
     drásticamente el bundle inicial (Mission/PastDrop/Gallery contienen
     R3F + three.js + framer-motion pesado).
   - LiquidCursor: dynamic con ssr:false, no hace falta en el primer paint
     (no se ve hasta que el mouse se mueve). Touch/mobile lo deshabilita
     internamente con un guard JS.
   ============================================================================ */

import dynamic from "next/dynamic";
import Preloader from "@/components/Preloader";
import Header    from "@/components/Header";
import Hero      from "@/components/Hero";
import CloudBand from "@/components/CloudBand";

/* Loading placeholders — mantienen el espacio para evitar CLS al hidratar. */
function SectionSkeleton({ id, h = "100vh" }: { id?: string; h?: string }) {
  return (
    <section
      id={id}
      aria-hidden
      style={{
        minHeight: h,
        background: "var(--color-bg)",
        borderTop: "1px solid var(--color-line)",
      }}
    />
  );
}

/* IMPORT DIRECTO (NO dynamic) para Mission y MeteoriteClient:
   Mission ya hace dynamic() interno por cada MissionPillarMonkey (5 canvas
   R3F) y MeteoriteClient ya hace lazy mount con IntersectionObserver. Si
   encima envolvemos en otro dynamic, el primer paso es renderizar un
   skeleton — si el chunk tarda en hidratar, da impresion de "monos
   desaparecidos". Mejor: que entren al bundle inicial y dejar que los
   IntersectionObservers internos hagan el lazy real. */
import Mission         from "@/components/Mission";
import MeteoriteClient from "@/components/MeteoriteClient";

const Collections = dynamic(() => import("@/components/Collections"), {
  loading: () => <SectionSkeleton id="section-collections" />,
});
const PastDrop = dynamic(() => import("@/components/PastDrop"), {
  loading: () => <SectionSkeleton id="section-past-drop" h="80vh" />,
});
const FuturisticGallery = dynamic(() => import("@/components/FuturisticGallery"), {
  loading: () => <SectionSkeleton id="section-futuristic-gallery" h="60vh" />,
});
const IdeaForm = dynamic(() => import("@/components/IdeaForm"), {
  loading: () => <SectionSkeleton id="section-form" h="60vh" />,
});
const WhyNotEnd = dynamic(() => import("@/components/WhyNotEnd"), {
  loading: () => <SectionSkeleton id="section-whynot-end" h="60vh" />,
});
const Footer = dynamic(() => import("@/components/Footer"), {
  loading: () => null,
});

/* LiquidCursor: ssr:false porque depende de window.matchMedia.
   Cargado lazy → no inflama el bundle inicial. */
const LiquidCursor = dynamic(() => import("@/components/LiquidCursor"), {
  ssr: false,
  loading: () => null,
});

export default function Page() {
  return (
    <>
      <Preloader />
      <Header />

      <main>
        <Hero />
        <CloudBand />
        <Collections />
        <Mission />
        <PastDrop />
        <FuturisticGallery />
        <IdeaForm />
        <MeteoriteClient />
        <WhyNotEnd />
      </main>

      <Footer />

      <LiquidCursor />
    </>
  );
}
