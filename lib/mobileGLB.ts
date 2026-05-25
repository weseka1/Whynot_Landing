/* ============================================================================
   MOBILE GLB — switcher entre variant desktop y mobile
   ----------------------------------------------------------------------------
   Convencion: cada GLB pesado del repo tiene un par ".mobile.glb" generado
   con `npm run optimize:glb:mobile` (textures 256px, simplify mas agresivo).
   En mobile servimos la variant chica → menos MB, parse mas rapido, menos
   triangulos para la GPU.

   Detection: sin hooks — leemos navigator.userAgent + connection.effectiveType
   sincronicamente (server-safe via guards). Esto evita una transicion
   visual (cargar GLB desktop primero, despues mobile) cuando un hook
   asincronico decide el isMobile.

   Si tenes el hook useIsMobile activo, podes pasarlo como override.
   ============================================================================ */

/** Detecta una vez si el cliente es mobile/red lenta. SSR-safe (false en server). */
export function detectMobileTier(): boolean {
  if (typeof window === "undefined") return false;

  // 1) viewport chico
  const narrow =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 768px)").matches;

  // 2) puntero coarse (touch primario)
  const touch =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  // 3) conexion declarada como lenta (Network Information API — Chrome Android)
  const conn =
    (navigator as any).connection ||
    (navigator as any).mozConnection ||
    (navigator as any).webkitConnection;
  const slowConn =
    conn?.effectiveType === "slow-2g" ||
    conn?.effectiveType === "2g" ||
    conn?.saveData === true;

  // 4) DPR bajo → device de gama baja
  const lowDpr = (window.devicePixelRatio ?? 1) <= 1.5 && narrow;

  return narrow || touch || slowConn || lowDpr;
}

/**
 * Whitelist: solo estos GLBs tienen una variant ".mobile.glb" generada
 * Y queremos servirla en mobile. Si pedis mobileGLB() de una URL no
 * listada, devuelve la URL original (no asumimos que existe el
 * .mobile.glb → evita 404 silencioso).
 *
 * mono.glb (Hero centerpiece) intencionalmente NO esta en el whitelist:
 * la variant mobile tenia texturas a 256px (vs 512px) + simplify -60%
 * y se veia borroso en pantalla mobile. El Hero es lo primero que ve
 * el usuario y ocupa casi toda la pantalla, asi que la calidad importa
 * mas que los ~700KB extra de descarga. El preloader caches el desktop
 * GLB antes del primer paint, asi que el usuario no siente el delay.
 *
 * Los otros monos siguen con variant mobile porque son los pilares
 * chicos del Mission section — el detalle de textura no se nota a esa
 * escala y el ahorro de peso/triangulos es valioso (4 instancias).
 *
 * Mantener sincronizado con scripts/optimize-glb-mobile.mjs TARGETS.
 */
const HAS_MOBILE_VARIANT = new Set<string>([
  "/assets/3d/mono-dorado.glb",
  "/assets/3d/mono-blanco.glb",
  "/assets/3d/mono-blanco-dorado.glb",
  "/assets/3d/mono-rigged.glb",
  "/assets/3d/mono-louis.glb",
  "/assets/3d/gotila-esenssial.glb",
]);

/**
 * Devuelve la URL del GLB a usar segun el tier del cliente.
 *
 * `desktopUrl`: URL del GLB original (ej "/assets/3d/mono.glb").
 * Retorna "<base>.mobile.glb" si detectMobileTier() === true Y el GLB
 * esta en HAS_MOBILE_VARIANT. Caso contrario devuelve `desktopUrl`.
 */
export function mobileGLB(desktopUrl: string, isMobileOverride?: boolean): string {
  if (!HAS_MOBILE_VARIANT.has(desktopUrl)) return desktopUrl;
  const isMobile = isMobileOverride ?? detectMobileTier();
  if (!isMobile) return desktopUrl;
  // ".glb" → ".mobile.glb"
  return desktopUrl.replace(/\.glb$/i, ".mobile.glb");
}
