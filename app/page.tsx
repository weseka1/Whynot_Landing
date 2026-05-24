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

const Collections = dynamic(() => import("@/components/Collections"), {
  loading: () => <SectionSkeleton id="section-collections" />,
});
const Mission = dynamic(() => import("@/components/Mission"), {
  ssr: false,
  loading: () => <SectionSkeleton id="section-mission" h="60vh" />,
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
const MeteoriteSection = dynamic(() => import("@/components/MeteoriteClient"), {
  ssr: false,
  loading: () => <SectionSkeleton id="section-meteorite" />,
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
        <MeteoriteSection />
        <WhyNotEnd />
      </main>

      <Footer />

      <LiquidCursor />
    </>
  );
}
