/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /* Static export — genera HTML/CSS/JS estáticos en /out al hacer `next build`.
     Compatible con hosts de Static Site (Render, Netlify, Vercel, GitHub Pages). */
  output: "export",
  /* Trailing slash en URLs (mejor compat con hosts estáticos) */
  trailingSlash: true,
  images: {
    /* next/image necesita un loader server-side por defecto. Para export
       estático lo desactivamos: las <Image /> se sirven sin optimización
       (nuestro proyecto usa <img> y CSS background-image, así que en la
       práctica no afecta nada). */
    unoptimized: true,
    remotePatterns: [],
  },
};

export default nextConfig;
