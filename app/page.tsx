/* ============================================================================
   PAGE — orden de secciones siguiendo la composición de DICH:
     1) Preloader
     2) Header (+ MenuOverlay)
     3) Hero            #hero
     4) Collections     #section-collections   (Oraniths · 4 cards · ticker)
     5) Mission         #section-mission       (3 pilares .001/.002/.003)
     6) Past Drop       #section-past-drop     (Sirius · coords · badges grid)
     7) Anturax         #section-anturax       (toggle DARK/LIGHT)
     8) Idea Form       #section-form          ("Send Signal")
     9) Footer          (créditos · legal — NO TOCAR sin permiso)

   + LiquidCursor a nivel global: lente que distorsiona al pasar el mouse.
   ============================================================================ */

import Preloader    from "@/components/Preloader";
import Header       from "@/components/Header";
import Hero         from "@/components/Hero";
import CloudBand    from "@/components/CloudBand";
import Collections  from "@/components/Collections";
import FuturisticGallery from "@/components/FuturisticGallery";
import Mission      from "@/components/Mission";
import PastDrop     from "@/components/PastDrop";
import Anturax      from "@/components/Anturax";
import IdeaForm     from "@/components/IdeaForm";
import MeteoriteSection from "@/components/MeteoriteClient";
import WhyNotEnd    from "@/components/WhyNotEnd";
import Footer       from "@/components/Footer";
import LiquidCursor from "@/components/LiquidCursor";

export default function Page() {
  return (
    <>
      <Preloader />
      <Header />

      <main>
        <Hero />
        <CloudBand />
        <Collections />
        <FuturisticGallery />
        <Mission />
        <PastDrop />
        <Anturax />
        <IdeaForm />
        <MeteoriteSection />
        <WhyNotEnd />
      </main>

      <Footer />

      <LiquidCursor />
    </>
  );
}
