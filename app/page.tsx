/* ============================================================================
   PAGE — composicion de la home.
   - Above-the-fold (Preloader, Header, Hero, CloudBand): import directo.
   - Mission y MeteoriteSection: import directo (tienen 3D y ya hacen su
     propio lazy mount interno con IntersectionObserver — envolverlos en
     dynamic() rompe los monos).
   - Resto de secciones below-the-fold (Collections, PastDrop,
     FuturisticGallery, WhyNotEnd, Footer): dynamic con skeleton
     para no inflar el bundle inicial.
   - LiquidCursor: dynamic con ssr:false (depende de window.matchMedia).
   ============================================================================ */

import dynamic from "next/dynamic";
import Preloader               from "@/components/Preloader";
import PixelReveal             from "@/components/PixelReveal";
import SoundController         from "@/components/SoundController";
import SectionColorController  from "@/components/SectionColorController";
import Header                  from "@/components/Header";
import Hero                    from "@/components/Hero";
import CloudBand               from "@/components/CloudBand";
import Mission                 from "@/components/Mission";
import MeteoriteSection        from "@/components/MeteoriteClient";

function SectionSkeleton({ id, h = "100vh" }: { id?: string; h?: string }) {
  return (
    <section
      id={id}
      aria-hidden
      style={{
        minHeight: h,
        background: "var(--color-bg)",
      }}
    />
  );
}

const Collections = dynamic(() => import("@/components/Collections"), {
  loading: () => <SectionSkeleton id="section-collections" />,
});
const PastDrop = dynamic(() => import("@/components/PastDrop"), {
  loading: () => <SectionSkeleton id="section-past-drop" h="80vh" />,
});
const FuturisticGallery = dynamic(() => import("@/components/FuturisticGallery"), {
  loading: () => <SectionSkeleton id="section-futuristic-gallery" h="60vh" />,
});
const WhyNotEnd = dynamic(() => import("@/components/WhyNotEnd"), {
  loading: () => <SectionSkeleton id="section-whynot-end" h="60vh" />,
});
const Footer = dynamic(() => import("@/components/Footer"), {
  loading: () => null,
});
const LiquidCursor = dynamic(() => import("@/components/LiquidCursor"), {
  ssr: false,
  loading: () => null,
});

export default function Page() {
  return (
    <>
      <Preloader />
      <PixelReveal />
      <SoundController />
      {/* DICH-style color sweep: observa todos los <section data-bg-color>
          y setea --page-bg / --page-fg en :root segun cual cruza el 50%
          del viewport. El body interpola via CSS transition 700ms.       */}
      <SectionColorController />
      <Header />

      <main>
        {/* Orden de secciones: Hero, CloudBand, Collections, PastDrop,
            FuturisticGallery, MeteoriteSection, Mission, WhyNotEnd.
            IdeaForm ("Your Idea") removido por pedido del usuario.   */}
        <Hero />
        <CloudBand />
        <Collections />
        <PastDrop />
        <FuturisticGallery />
        <MeteoriteSection />
        <Mission />
        <WhyNotEnd />
      </main>

      <Footer />

      <LiquidCursor />
    </>
  );
}
