import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

/* Fuentes:
   - Audiowide se carga desde Google Fonts con un truco non-blocking:
     <link rel="preload" as="style"> + <link rel="stylesheet" media="print">
     parcheado a media="all" por inline script tras LCP. Texto siempre
     se pinta con fallback system, después swap (display=swap).
   - Orbitron eliminado del top — era sólo fallback final, casi no se usa,
     y cada weight extra es ~15KB.
   - Razón para no usar next/font: requiere fetch a Google Fonts en build
     time, lo que falla en entornos sin SSL system CA. El stack
     manual + display=swap entrega 0 FOIT y casi 0 FOUT después del primer
     paint. */

/* ============================================================================
   ROOT LAYOUT
   - SEO completo: OG, Twitter, robots, canonical, structured data (JSON-LD).
   - Preload sólo de assets LCP-críticos. NO precargamos el GLB (2.3MB) por
     fetch: compite con el cielo (39KB, LCP real) y, en 3G/4G, retrasa el
     first paint sin acelerar la escena 3D (model-viewer lo carga eager
     desde su atributo `src` igual).
   - Google Fonts cargado sin bloquear el render (preconnect + media swap).
   - CSP/Permissions-Policy via meta (output: "export" no permite headers
     HTTP desde Next; lo ideal es replicarlos también a nivel host/CDN).
   - model-viewer CDN: lazyOnload — no es crítico para el primer paint, el
     componente se hidrata cuando llega.
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
  icons: {
    icon: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0908" },
    { media: "(prefers-color-scheme: light)", color: "#0a0908" },
  ],
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

/* CSP estricta vía meta. Algunas directivas (frame-ancestors,
   X-Frame-Options) NO funcionan vía meta — esas las debe poner el host
   (Render: headers en render.yaml). Acá cubrimos lo que sí aplica al
   parsing del documento.
   Notas:
   - 'unsafe-inline' en style-src es inevitable con CSS-in-JS / Tailwind
     inline; sería ideal moverse a nonces si en algún momento dejamos
     output:"export" y volvemos a runtime SSR.
   - font-src incluye fonts.gstatic.com porque next/font puede caer en
     fallback runtime en algunos entornos. data: para WOFF inline.
   - connect-src incluye gstatic.com (Draco decoder usado por drei). */
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
  "frame-ancestors 'none'",
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
        {/* SECURITY — defensa en profundidad */}
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <meta httpEquiv="X-Content-Type-Options" content="nosniff" />
        <meta name="referrer" content="strict-origin-when-cross-origin" />
        <meta
          httpEquiv="Permissions-Policy"
          content="camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
        />

        {/* DNS / connection hints */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="dns-prefetch" href="https://ajax.googleapis.com" />
        <link rel="dns-prefetch" href="https://www.gstatic.com" />

        {/* Audiowide non-blocking: preload+stylesheet print + swap
            (parche aplicado por inline script para evitar onLoad en JSX). */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap"
        />
        <link
          id="font-audiowide"
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap"
          media="print"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Audiowide&display=swap"
          />
        </noscript>
        <Script id="font-swap" strategy="afterInteractive">{`
          var l=document.getElementById('font-audiowide');
          if(l)l.media='all';
        `}</Script>

        {/* LCP — fondo cielo del Hero (39KB) y marquee text (12KB).
            NO precargamos el GLB: 2.3MB compitiendo con el LCP. El
            model-viewer arranca a cargarlo apenas se monta el DOM. */}
        <link
          rel="preload"
          as="image"
          href="/assets/hero/sky-background.webp"
          type="image/webp"
          // @ts-ignore fetchpriority no está en types aún
          fetchpriority="high"
        />
        <link
          rel="preload"
          as="image"
          href="/assets/marquee/whynot-text.webp"
          type="image/webp"
        />

        {/* JSON-LD structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body>
        {children}

        {/* model-viewer CDN: lazyOnload — no es crítico para el primer paint.
            El <model-viewer> es self-bootstrapping (custom element): renderea
            su poster mientras el script llega, después hidrata. */}
        <Script
          type="module"
          src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"
          strategy="lazyOnload"
        />
      </body>
    </html>
  );
}
