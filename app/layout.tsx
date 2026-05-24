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

/* CSP via meta. Permisiva para:
   - 'unsafe-inline' en style/script: tailwind inline + scripts inline de Next
   - fonts.googleapis + fonts.gstatic: Audiowide/Orbitron
   - ajax.googleapis: model-viewer CDN (web component que carga el Hero)
   - gstatic.com: Draco decoder usado por drei (Meteorite)
   - data: y blob: en img/media para svgs inline y posibles canvas-toBlob
   Notas: 'frame-ancestors' en meta NO funciona — eso va en render.yaml
   como X-Frame-Options. */
const CSP = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "script-src 'self' 'unsafe-inline' https://ajax.googleapis.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://www.gstatic.com https://ajax.googleapis.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* SECURITY meta (defensa en profundidad; render.yaml duplica como
            headers HTTP reales) */}
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta
          httpEquiv="Permissions-Policy"
          content="camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
        />

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
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Audiowide&family=Orbitron:wght@700;900&display=swap"
        />

        {/* Preload de assets criticos del Hero — el browser los pide en
            paralelo con el JS, no espera a que React monte el componente.
            ESTOS PRELOADS NO SE TOCAN: son los que aseguran que el modelo
            3D del Hero y el LCP carguen bien. */}
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
        <link
          rel="preload"
          as="fetch"
          href="/assets/3d/mono.glb"
          crossOrigin=""
        />

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
