/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Configurar dominios externos acá si en el futuro se cargan imágenes remotas.
    remotePatterns: [],
  },
};

export default nextConfig;
