/* ============================================================================
   CATALOG — Data layer del catálogo BA1RES FOOTWEAR
   ----------------------------------------------------------------------------
   Source of truth: data/catalog-index.json (279 colorways)
   Imágenes hosteadas en Supabase:
     https://jkkytzgmhzzngnntkfbr.supabase.co/storage/v1/object/public/catalog/
   Estructura de paths del index: "MARCA/Modelo/Colorway"
   Frames 360: 360_01.jpg ... 360_NN.jpg (1-indexed, zero-padded a 2 dígitos).
   ============================================================================ */

import indexRaw from "./catalog-index.json";

export const SUPABASE_CATALOG_BASE =
  "https://jkkytzgmhzzngnntkfbr.supabase.co/storage/v1/object/public/catalog";

/* ---------- Raw types ---------- */
type RawEntry = { type: "360" | "image"; frames: number };
type RawIndex = Record<string, RawEntry>;
const RAW: RawIndex = indexRaw as RawIndex;

/* ---------- Public types ----------
   Plain data (sin métodos) para que sea serializable y se pueda pasar de
   Server Components a Client Components sin errores. Las URLs se calculan
   con las funciones helper de abajo: frameUrl(entry, n), mainUrl(entry).   */
export type CatalogEntry = {
  brand: string;          // "JORDAN"
  model: string;          // "3 Retro"  (puede incluir " / " si hay sub-modelo)
  colorway: string;       // "Black Cat"
  type: "360" | "image";
  frames: number;
  path: string;           // 'BRAND/Model/Colorway' (tal cual viene del index)
  encodedPath: string;    // path con cada segmento URL-encoded (cache)
  slug: {
    brand: string;
    model: string;
    colorway: string;
    full: string;         // 'brand/model/colorway' (lowercase, ascii-only)
  };
};

/** Frame n (1-indexed). Válido si entry.type === '360' y n <= entry.frames. */
export function frameUrl(entry: CatalogEntry, n: number): string {
  const num = String(n).padStart(2, "0");
  return `${SUPABASE_CATALOG_BASE}/${entry.encodedPath}/360_${num}.jpg`;
}

/** URL del main.jpg (fallback para items 'image'). */
export function mainUrl(entry: CatalogEntry): string {
  return `${SUPABASE_CATALOG_BASE}/${entry.encodedPath}/main.jpg`;
}

/** Primer frame (póster). Si es 360 → 360_01; si es image → main.jpg. */
export function posterUrl(entry: CatalogEntry): string {
  return entry.type === "360" ? frameUrl(entry, 1) : mainUrl(entry);
}

/* ---------- Helpers ---------- */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, "-and-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function encodePath(p: string): string {
  return p.split("/").map(encodeURIComponent).join("/");
}

function buildEntry(path: string, raw: RawEntry): CatalogEntry {
  const parts = path.split("/");
  const brand = parts[0] ?? "";
  const colorway = parts[parts.length - 1] ?? "";
  const model = parts.slice(1, -1).join(" / ");

  const slug = {
    brand: slugify(brand),
    model: slugify(model),
    colorway: slugify(colorway),
    full: "",
  };
  slug.full = `${slug.brand}/${slug.model}/${slug.colorway}`;

  return {
    brand,
    model,
    colorway,
    type: raw.type,
    frames: raw.frames,
    path,
    encodedPath: encodePath(path),
    slug,
  };
}

/* ---------- Build entries (eager) ---------- */
const ENTRIES: CatalogEntry[] = Object.entries(RAW).map(([path, raw]) =>
  buildEntry(path, raw)
);

const BY_PATH = new Map<string, CatalogEntry>(
  ENTRIES.map((e) => [e.path, e])
);
const BY_SLUG = new Map<string, CatalogEntry>(
  ENTRIES.map((e) => [e.slug.full, e])
);

/* ---------- Public API ---------- */
export function getAllEntries(): CatalogEntry[] {
  return ENTRIES;
}

export function getEntryByPath(path: string): CatalogEntry | null {
  return BY_PATH.get(path) ?? null;
}

export function getEntryBySlug(
  brand: string,
  model: string,
  colorway: string
): CatalogEntry | null {
  return BY_SLUG.get(`${brand}/${model}/${colorway}`) ?? null;
}

export function getEntriesByBrand(brand: string): CatalogEntry[] {
  return ENTRIES.filter((e) => e.brand === brand);
}

export function getEntriesByBrandSlug(brandSlug: string): CatalogEntry[] {
  return ENTRIES.filter((e) => e.slug.brand === brandSlug);
}

/** Devuelve el nombre real de la marca a partir del slug (o null). */
export function brandNameFromSlug(brandSlug: string): string | null {
  const entry = ENTRIES.find((e) => e.slug.brand === brandSlug);
  return entry?.brand ?? null;
}

/** Agrupa los entries por modelo, manteniendo el orden de aparición. */
export function groupByModel(entries: CatalogEntry[]): {
  model: string;
  modelSlug: string;
  colorways: CatalogEntry[];
}[] {
  const map = new Map<string, { model: string; modelSlug: string; colorways: CatalogEntry[] }>();
  for (const e of entries) {
    const key = e.slug.model;
    if (!map.has(key)) {
      map.set(key, { model: e.model, modelSlug: e.slug.model, colorways: [] });
    }
    map.get(key)!.colorways.push(e);
  }
  return Array.from(map.values());
}

export function getAllBrands(): string[] {
  return [...new Set(ENTRIES.map((e) => e.brand))].sort();
}

export function getAllBrandSlugs(): string[] {
  return [...new Set(ENTRIES.map((e) => e.slug.brand))].sort();
}

export const CATALOG_STATS = {
  total: ENTRIES.length,
  with360: ENTRIES.filter((e) => e.type === "360").length,
  withImage: ENTRIES.filter((e) => e.type === "image").length,
  totalFrames: ENTRIES.reduce((acc, e) => acc + e.frames, 0),
  brands: [...new Set(ENTRIES.map((e) => e.brand))].sort(),
} as const;

/* ============================================================================
   HERO MAPPING — vincula los 15 videos mp4 del hero PastDrop a colorways reales
   del catálogo. Cuando el usuario clickea una cápsula, navegamos al colorway
   correspondiente. Si la entry no existe (path obsoleto), heroEntry devuelve
   null y el caller maneja el fallback (link deshabilitado).
   ============================================================================ */
export type HeroSpec = {
  src: string;          // ruta al .mp4 en public/videos-360
  label: string;        // display name corto
  catalogPath: string;  // path canónico en el catalog-index
  /** Override del brand a mostrar en el HUD/label del PastDrop. Si está
      presente, prevalece sobre el `entry.brand` del catálogo. Sirve para
      modelos catalogados bajo una marca paraguas (ej: Jordan Tatum vive
      bajo "NIKE" en el catalog-index pero se vende como "JORDAN"). NO
      cambia la URL del producto — el click sigue navegando al catalogPath
      original.                                                              */
  displayBrand?: string;
};

/* Carrusel PastDrop: una zapa por marca (excepto JORDAN que de las 3
   originales se dejo solo la negra "Black Cat" — pedido del usuario).
   Si se quiere re-poner Patent Gold o Tatum, agregar abajo con su
   videoSrc + catalogPath.                                                */
export const HERO_SPECS: HeroSpec[] = [
  { src: "/videos-360/LUISVOUITTON.mp4",                       label: "LV TRAINER",
    catalogPath: "LOUIS VUITTON/Trainer Maxi/Denim & white" },
  { src: "/videos-360/adidasbape.mp4",                          label: "ADIDAS × BAPE",
    catalogPath: "ADIDAS x BAPE/Superstar x Bape/Blue White Star" },
  { src: "/videos-360/amiri.mp4",                               label: "AMIRI MA-1",
    catalogPath: "AMIRI/MA-1/White" },
  { src: "/videos-360/asicsgel-kayano.mp4",                     label: "GEL-KAYANO",
    catalogPath: "ASICS/Gel-Kayano/Grey" },
  { src: "/videos-360/balenciaga.mp4",                          label: "TRIPLE S",
    catalogPath: "BALENCIAGA/Triple S/Black Leather" },
  { src: "/videos-360/bape.mp4",                                label: "BAPE STA",
    catalogPath: "BAPE/STA Low/Royal Blue" },
  { src: "/videos-360/jordan3blackcat.mp4",                     label: "JORDAN III BLACK CAT",
    catalogPath: "JORDAN/3 Retro/Black Cat" },
  /* Jordan 1 Patent Gold + Jordan Tatum (Red Cement) sacados — de las 3
     Jordans dejamos solo la negra (Black Cat). Los .mp4 siguen en
     public/videos-360/ y los entries en el catalogo completo.            */
  { src: "/videos-360/lanvin.mp4",                              label: "LANVIN CURB",
    catalogPath: "LANVIN/Curb Sneakers/White Black" },
  { src: "/videos-360/nikeairforce1triplewhite.mp4",            label: "AF1 JEWELS WHITE",
    catalogPath: "NIKE/Air Force 1/Jewels White" },
  { src: "/videos-360/offwhitebe-right-4x-RIFE-RIFE3.1-16fps.mp4", label: "OFF-WHITE BE RIGHT",
    catalogPath: "OFF WHITE/Be-Right/White" },
  { src: "/videos-360/pumared.mp4",                             label: "PUMA LA FRANCÉ",
    catalogPath: "PUMA LE FRANCE/LaFrancé/Red" },
  { src: "/videos-360/sbdunkverdy.mp4",                         label: "SB DUNK VERDY",
    catalogPath: "SB DUNK/SB Dunk Low/Verdy" },
  { src: "/videos-360/timberland6-InchBoot.mp4",                label: "TIMBERLAND BOOTS",
    catalogPath: "TIMBERLAND/Boots/Wheat" },
];

/** Devuelve la HeroSpec enriquecida con su CatalogEntry (puede ser null si el path no existe). */
export function resolveHeroSpec(hs: HeroSpec) {
  return {
    ...hs,
    entry: getEntryByPath(hs.catalogPath),
  };
}
