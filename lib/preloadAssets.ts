/* ============================================================================
   PRELOAD ASSETS — las dos capas de carga del sitio
   ----------------------------------------------------------------------------
   REGLA: el visitante ve la tienda lo antes posible. Nada que no se vea en la
   primera pantalla puede bloquear la entrada.

   Capa 1 · CRITICAL  → lo que se ve arriba de todo (fondo del hero + su GLB).
                        Bloquea el preloader. Techo duro: MAX_TIME.
   Capa 2 · DEFERRED  → todo lo demas (videos 360 del PastDrop, GLB de las
                        otras secciones, fotos de galeria). Se baja DESPUES de
                        que la web ya es visible e interactiva, en tiempo
                        ocioso del browser. El usuario ya esta navegando
                        mientras esto ocurre.

   Historia: hasta 09-2026 TODO esto era critico — ~14 MB con un cap de 30 s.
   El comentario original admitia el motivo (los videos del PastDrop trababan
   el primer scroll) y lo resolvia haciendo esperar a todos, siempre. Se
   invirtio: la entrada es inmediata y el PastDrop pide sus videos cuando el
   usuario se acerca a la seccion.
   ============================================================================ */

import { HERO_SPECS } from "@/data/catalog";
import { mobileGLB } from "@/lib/mobileGLB";

export type AssetKind = "image" | "fetch";
export type Asset = { url: string; kind: AssetKind; weight: number };

/* --------------------------------------------------------------------------
   CAPA 1 — CRITICO
   Solo lo que se pinta en la primera pantalla. Si algo de aca se cae, se
   resuelve igual (ver loadImage/fetchAsset): un asset roto no traba la entrada.
   -------------------------------------------------------------------------- */
export const CRITICAL_ASSETS: Asset[] = [
  { url: "/assets/hero/sky-background.webp", kind: "image", weight: 40 },
  { url: "/assets/marquee/whynot-text.webp", kind: "image", weight: 30 },
];

/* mono.glb (el del hero) NO esta aca desde el 4-sep-2026: pesa 1 MB y era el
   95% del peso critico. Ahora el Hero lo monta despues del primer pintado
   (ver components/Hero.tsx), asi que bloquear por el solo retrasaba la
   entrada sin adelantar nada. Se calienta en la capa 2. */

/* --------------------------------------------------------------------------
   CAPA 2 — DIFERIDO
   Nada de esto bloquea. Se dispara con requestIdleCallback despues del
   evento `whynot:preloader-hidden`.
   -------------------------------------------------------------------------- */

/** Pesos reales (KB) de los videos 360 del PastDrop. Fallback ~450 KB. */
const PAST_DROP_VIDEO_WEIGHTS: Record<string, number> = {
  "/videos-360/LUISVOUITTON.mp4": 549,
  "/videos-360/adidasbape.mp4": 420,
  "/videos-360/amiri.mp4": 453,
  "/videos-360/asicsgel-kayano.mp4": 729,
  "/videos-360/balenciaga.mp4": 397,
  "/videos-360/bape.mp4": 464,
  "/videos-360/jordan3blackcat.mp4": 409,
  "/videos-360/lanvin.mp4": 373,
  "/videos-360/nikeairforce1triplewhite.mp4": 343,
  "/videos-360/offwhitebe-right-4x-RIFE-RIFE3.1-16fps.mp4": 590,
  "/videos-360/pumared.mp4": 546,
  "/videos-360/sbdunkverdy.mp4": 391,
  "/videos-360/timberland6-InchBoot.mp4": 449,
};

const PAST_DROP_VIDEO_ASSETS: Asset[] = HERO_SPECS.map((hs) => ({
  url: hs.src,
  kind: "fetch" as const,
  weight: PAST_DROP_VIDEO_WEIGHTS[hs.src] ?? 450,
}));

export const DEFERRED_ASSETS: Asset[] = [
  /* El mono del hero: se ve primero que nada, asi que encabeza la capa 2. */
  { url: "/assets/3d/mono.glb", kind: "fetch", weight: 1060 },

  /* Nubes y decorados de las secciones intermedias */
  { url: "/nuves/cloud-center.webp", kind: "image", weight: 110 },
  { url: "/nuves/cloud-2.webp", kind: "image", weight: 36 },
  { url: "/nuves/cloud-center-bottom.webp", kind: "image", weight: 19 },

  /* Collections — thumbs y sus videos con alpha */
  { url: "/assets/hero/golden-goose-white-black.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-silver-star.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-gold-star.webp", kind: "image", weight: 10 },
  { url: "/assets/hero/golden-goose-white-black.webm", kind: "fetch", weight: 360 },
  { url: "/assets/hero/golden-goose-silver-star.webm", kind: "fetch", weight: 360 },
  { url: "/assets/hero/golden-goose-gold-star.webm", kind: "fetch", weight: 360 },

  /* PastDrop + galeria */
  { url: "/assets/hero/extra.webp", kind: "image", weight: 180 },
  { url: "/assets/past-drop/drop-title.webp", kind: "image", weight: 62 },
  { url: "/assets/futuristic-fashion/man-01.webp", kind: "image", weight: 82 },
  { url: "/assets/futuristic-fashion/man-02.webp", kind: "image", weight: 102 },
  { url: "/assets/futuristic-fashion/man-03.webp", kind: "image", weight: 79 },
  { url: "/assets/futuristic-fashion/man-04.webp", kind: "image", weight: 101 },
  { url: "/assets/futuristic-fashion/man-05.webp", kind: "image", weight: 118 },
  { url: "/assets/futuristic-fashion/woman-01.webp", kind: "image", weight: 103 },
  { url: "/assets/futuristic-fashion/woman-02.webp", kind: "image", weight: 88 },

  /* Los primeros videos del PastDrop, para que el carrusel arranque sin
     espera. El resto los pide cada <video> por cercania al activo
     (PastDrop.tsx) — traerlos todos aca los descargaba dos veces. */
  ...PAST_DROP_VIDEO_ASSETS.slice(0, 3),
];

/* Los .glb NO van aca: cada componente que usa uno hace
   `useGLTF.preload(mobileGLB(...))` a module-load, que ya respeta el tier del
   cliente y usa el cache de three. Duplicarlos aca solo agregaba requests
   (medido: 15 pedidos de GLB para 7 archivos distintos). */

/* --------------------------------------------------------------------------
   LOADERS — nunca rechazan. Un asset caido no puede trabar la entrada.
   -------------------------------------------------------------------------- */

export function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => {
      console.warn(`[preload] imagen no disponible: ${src}`);
      resolve();
    };
    img.src = src;
  });
}

export function fetchAsset(src: string): Promise<void> {
  return fetch(src, { cache: "force-cache" })
    .then(() => undefined)
    .catch(() => {
      console.warn(`[preload] asset no disponible: ${src}`);
    });
}

/** Resuelve igual si `p` tarda mas de `ms`. La descarga sigue en background. */
export function withTimeout(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    p.finally(() => {
      clearTimeout(t);
      resolve();
    });
  });
}

/**
 * Techo por asset critico. El GLB del hero pesa ~1 MB (~530 KB en mobile) y es
 * lo unico pesado que queda bloqueando: si en 1,8 s no llego, se entra igual y
 * el modelo aparece cuando termina (el Suspense de R3F lo cubre). Nadie mira
 * una pantalla de carga esperando un mono.
 */
const ASSET_TIMEOUT_MS = 1800;

export function loadAsset(a: Asset): Promise<void> {
  const p = a.kind === "image" ? loadImage(a.url) : fetchAsset(a.url);
  return a.url.endsWith(".glb") ? withTimeout(p, ASSET_TIMEOUT_MS) : p;
}

/** Espera a las webfonts. Si la API no existe, resuelve al toque. */
export function fontsReady(): Promise<void> {
  const d = document as any;
  if (!d?.fonts?.ready) return Promise.resolve();
  return d.fonts.ready.then(() => undefined).catch(() => undefined);
}

/** Aplica el remapeo mobile a los .glb (variante liviana en celu). */
export function withMobileVariants(assets: Asset[]): Asset[] {
  return assets.map((a) => {
    if (a.kind !== "fetch" || !a.url.endsWith(".glb")) return a;
    const url = mobileGLB(a.url);
    return url === a.url ? a : { ...a, url, weight: Math.round(a.weight * 0.5) };
  });
}

/* --------------------------------------------------------------------------
   CAPA 2 · disparo
   -------------------------------------------------------------------------- */

const idle = (fn: () => void, timeout = 2000) => {
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(fn, { timeout });
  else setTimeout(fn, 200);
};

let deferredStarted = false;

/**
 * Baja la capa 2 en tiempo ocioso, de a tandas chicas para no pelear ancho de
 * banda con lo que el usuario esta mirando. Idempotente: corre una sola vez.
 * Respeta Save-Data / 2G: en ese caso no precarga nada y cada seccion pide lo
 * suyo cuando hace falta.
 */
export function startDeferredPreload(): void {
  if (deferredStarted || typeof window === "undefined") return;
  deferredStarted = true;

  const conn = (navigator as any).connection;
  if (conn?.saveData === true || /(^|-)2g$/.test(conn?.effectiveType ?? "")) return;

  /* Primero los chunks de las secciones de abajo: importarlos dispara sus
     `useGLTF.preload(...)`, asi que recien pueden correr aca. */
  idle(() => {
    import("@/components/Collections").catch(() => {});
    import("@/components/PastDrop").catch(() => {});
  });

  const queue = withMobileVariants(DEFERRED_ASSETS);
  const BATCH = 3;
  let i = 0;

  const pump = () => {
    if (i >= queue.length) return;
    const batch = queue.slice(i, i + BATCH);
    i += BATCH;
    Promise.all(batch.map(loadAsset)).then(() => idle(pump));
  };

  idle(pump);
}
