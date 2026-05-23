import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "WHYNOT — Future Fashion System",
  description: "Editable skeleton — cyber luxury fashion system.",
  formatDetection: { telephone: false },
};

/* Viewport en Next 14 va como export separado, no dentro de metadata */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#0a0908",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* Solo Orbitron (700/900) — antes habia 4 familias (Audiowide, Bruno
            Ace SC, Quantico, Orbitron); las primeras 3 estaban en fallback
            chain pero nunca se usaban. Preconnect + display:swap = casi
            instantaneo, fuente fallback hasta que carga (no bloquea paint). */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap"
        />

        {/* Preload de assets criticos del Hero — el browser los pide en
            paralelo con el JS, no espera a que React monte el componente. */}
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
