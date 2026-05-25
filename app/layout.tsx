import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

/* ============================================================================
   ROOT LAYOUT
   - Mantiene EXACTAMENTE los preloads originales (sky + marquee text + GLB
     del Hero) — NO los toca porque son criticos para que el modelo del Hero
     y el LCP carguen como esperabas.
   - Agrega: metadata SEO completa, OG, Twitter Card, JSON-LD, manifest,
     icons, robots, formatDetection completo.
   - Agrega: CSP estricta + security headers via meta (defensa en
     profundidad; los headers HTTP "reales" estan en render.yaml).
   ============================================================================ */

const SITE_URL = "https://whynot-landing.onrender.com";
const SITE_NAME = "WHYNOT";
const SITE_TITLE = "WHYNOT — Future Fashion System";
const SITE_DESC = "Luxury sneaker drops. Encrypted couture. A cyber-fashion operating system.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESC,
  applicationName: SITE_NAME,
  formatDetection: { telephone: false, email: false, address: false },
  keywords: [
    "WHYNOT", "luxury sneakers", "future fashion", "drops",
    "Golden Goose", "Balenciaga 3XL", "cyber couture",
  ],
  authors: [{ name: "WHYNOT" }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "fashion",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESC,
    url: SITE_URL,
    locale: "es_AR",
    images: [
      {
        url: "/assets/hero/character.webp",
        width: 1200,
        height: 1200,
        alt: "WHYNOT — Future Fashion System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
    images: ["/assets/hero/character.webp"],
  },
  manifest: "/manifest.webmanifest",
};

/* Viewport en Next 14 va como export separado, no dentro de metadata */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0908",
  colorScheme: "dark",
};

/* JSON-LD structured data — Organization + WebSite */
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}#org`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/assets/hero/character.webp`,
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}#site`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESC,
      publisher: { "@id": `${SITE_URL}#org` },
    },
  ],
};

/* CSP REMOVIDA del meta head: estaba bloqueando el Draco decoder de drei
   (script desde www.gstatic.com) y WebAssembly (require 'wasm-unsafe-eval'),
   lo que rompia la carga de los GLBs de Mission + Meteorite. Las security
   headers reales viven en render.yaml a nivel host. Si en algun momento
   queremos reactivar CSP en meta, hay que incluir:
     - script-src ... 'wasm-unsafe-eval' https://www.gstatic.com
     - worker-src 'self' blob:
   y testear que tanto model-viewer como @react-three/drei sigan
   descargando sus decoders sin error. */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* SECURITY meta — sin CSP (rompia carga del Draco decoder
            y WebAssembly de los GLBs). Las security headers HTTP reales
            estan en render.yaml. */}
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />

        {/* --font-marquee chain:
              1) "T-12"/"T-012" local (definida en globals.css con @font-face,
                 archivo en /public/fonts/) — la fuente verdadera del marquee
                 "WHYNOT AMK EXCLUSIVE" del Hero. Studio Innate, premium.
              2) Audiowide (Google Fonts) — el clon gratuito mas cercano,
                 con los cortes/breaks caracteristicos de la T-12 (W, H, K,
                 M, E, S). Bridge mientras no este la T-12 original.
              3) Orbitron — geometrica cyber, fallback ultimo.
            Preconnect + display:swap = no bloquea el primer paint.        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Preconnect al CDN de model-viewer (Hero + MonoMascot) — abre la
            conexion TCP+TLS en paralelo con el resto del HTML, asi cuando
            el Script afterInteractive pide model-viewer.min.js, la
            conexion ya esta lista. Ahorra ~150-300ms del handshake en la
            primera carga (sobre todo en mobile con RTT alto).             */}
        <link rel="preconnect" href="https://ajax.googleapis.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://ajax.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Audiowide&family=Orbitron:wght@700;900&display=swap"
        />

        {/* Preload de assets criticos del Hero — el browser los pide en
            paralelo con el JS, no espera a que React monte el componente.
            Estos comparten lista con CRITICAL_ASSETS en Preloader.tsx para
            que la barra 0→100% del loader cubra exactamente lo que se ve
            en el primer scroll. */}
        <link
          rel="preload"
          as="image"
          href="/assets/hero/sky-background.webp"
          type="image/webp"
          // @ts-ignore fetchpriority no esta en types aun pero el browser lo respeta
          fetchpriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/assets/marquee/whynot-text.webp"
          type="image/webp"
        />
        {/* mono.glb preload REMOVIDO — antes forzaba descarga del GLB desktop
            (~1MB) en TODOS los clientes, incluido mobile. Ahora el Hero hace
            mounted-gate y carga la variant correcta (mono.glb o mono.mobile.glb)
            en un solo fetch. El Preloader tambien usa mobileGLB() para
            estimar el progreso correcto. Trade-off: ~150ms mas tarde aparece
            el modelo en desktop (FCP del Hero ya quedo visible mucho antes,
            asi que no se nota), pero AHORRAMOS 660KB en mobile.            */}

        {/* Preconnect a gstatic REMOVIDO — el Draco decoder ahora se sirve
            desde /draco/ local (ver lib/three-setup.ts + public/draco/). Sin
            dependencia de CDN externo, mas confiable en redes mobile flojas. */}

        {/* Prefetch (baja prioridad) del resto de assets de la home — el
            browser los baja en idle time. Para los GLBs ya no prefetcheamos
            aca: cada componente que los usa hace useGLTF.preload(mobileGLB(...))
            a module-load, lo que respeta el tier del cliente.                 */}
        {/* CloudBand */}
        <link rel="prefetch" href="/nuves/cloud-center.webp" as="image" />
        <link rel="prefetch" href="/nuves/cloud-2.webp" as="image" />
        <link rel="prefetch" href="/nuves/cloud-center-bottom.webp" as="image" />
        {/* Collections */}
        <link rel="prefetch" href="/assets/hero/golden-goose-white-black.webp" as="image" />
        <link rel="prefetch" href="/assets/hero/golden-goose-silver-star.webp" as="image" />
        <link rel="prefetch" href="/assets/hero/golden-goose-gold-star.webp" as="image" />

        {/* JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}
        {/* model-viewer CDN — afterInteractive: carga DESPUES de que la
            page sea interactive, sin bloquear el primer paint. El Hero
            renderiza el <model-viewer> en el HTML; aunque el script no
            este disponible aun, el web component se hidrata al cargar
            (model-viewer es self-bootstrapping). */}
        <Script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
