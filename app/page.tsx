/* ============================================================================
   PAGE — composicion de la home.
   ----------------------------------------------------------------------------
   Reordenada el 4-sep-2026. Antes eran SEIS secciones de espectaculo 3D antes
   del primer producto, y el sintoma estaba medido: "la gente pregunta como
   utilizarla" (Juani) + ARS 859.897 de ads con UNA conversacion respondida.

   Ahora la tienda va adelante y el 3D queda como acento de marca, no como
   relleno. El orden cuenta una historia: que hay -> que sale -> como lo pago
   -> quienes somos.

     1  Hero + CloudBand ....... la marca, corto
     2  Mas vendidos ........... featured del panel
     3  Nuevos ingresos ........ ultimo que carga el panel, en vivo
     4  PastDrop ............... las zapas girando (el diferencial, se queda)
     5  Como comprar ........... mata el "no se usarla"
     6  Collections ............ la pieza de marca
     7  Mission ................ quienes somos + canales

   Sacadas: MeteoriteSection (ARTIFACT_03 / STATUS: ORBITING),
   FuturisticGallery y WhyNotEnd (INTO THE FUTURE) — decorado de la plantilla
   DICH que no vendia nada. LiquidCursor tambien sale: cursor custom es veto
   viejo de la casa.

   Carga: above-the-fold (Preloader, Header, Hero, CloudBand) directo. Mission
   va directo porque tiene 3D con su propio lazy mount interno (envolverlo en
   dynamic() rompe los monos). El resto, dynamic con skeleton.
   ============================================================================ */

import dynamic from "next/dynamic";
import Preloader               from "@/components/Preloader";
import PixelReveal             from "@/components/PixelReveal";
import AvisoCarrito           from "@/components/tienda/AvisoCarrito";
import GuiaScroll             from "@/components/GuiaScroll";
import BarraPedido            from "@/components/tienda/BarraPedido";
import SoundController         from "@/components/SoundController";
import SectionColorController  from "@/components/SectionColorController";
import Header                  from "@/components/Header";
import Hero                    from "@/components/Hero";
import CloudBand               from "@/components/CloudBand";
import Mission                 from "@/components/Mission";

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

const SeccionProductos = dynamic(() => import("@/components/tienda/SeccionProductos"), {
  loading: () => <SectionSkeleton h="60vh" />,
});
const ComoComprar = dynamic(() => import("@/components/tienda/ComoComprar"), {
  loading: () => <SectionSkeleton id="section-como-comprar" h="60vh" />,
});
const Carrito = dynamic(() => import("@/components/tienda/Carrito"), {
  ssr: false,
  loading: () => null,
});
const Collections = dynamic(() => import("@/components/Collections"), {
  loading: () => <SectionSkeleton id="section-collections" />,
});
const PastDrop = dynamic(() => import("@/components/PastDrop"), {
  loading: () => <SectionSkeleton id="section-past-drop" h="80vh" />,
});
const Footer = dynamic(() => import("@/components/Footer"), {
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
        <Hero />
        <CloudBand />

        {/* --- LA TIENDA --------------------------------------------------
            #tienda es el ancla del CTA del hero y del menu: apunta al bloque
            entero porque "Mas vendidos" no se renderiza mientras el panel no
            tenga ningun producto con featured=true. */}
        <div id="tienda">
          <SeccionProductos
            id="section-mas-vendidos"
            eyebrow="Lo que más sale"
            titulo="Más vendidos"
            bajada="Los pares que más nos piden. Elegí talle y sumalos al pedido."
            fuente="destacados"
          />

          <SeccionProductos
            id="section-nuevos"
            eyebrow="Recién llegados"
            titulo="Nuevos ingresos"
            bajada="Lo último que entró. Stock limitado: cuando se va, se va."
            fuente="nuevos"
            verMas={{ texto: "Ver todo el catálogo", href: "/catalog/" }}
          />
        </div>

        {/* --- EL DIFERENCIAL --------------------------------------------- */}
        <PastDrop />

        {/* --- LA RESPUESTA AL "no sé cómo usarla" ------------------------ */}
        <ComoComprar />

        {/* --- MARCA ------------------------------------------------------ */}
        <Collections />
        <Mission />
      </main>

      <Footer />
      <Carrito />
      <AvisoCarrito />
      <GuiaScroll />
      <BarraPedido />
    </>
  );
}
