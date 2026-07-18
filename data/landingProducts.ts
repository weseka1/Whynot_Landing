/* ============================================================================
   LANDING PRODUCTS — productos cargados desde el PANEL (BairesContro).
   ----------------------------------------------------------------------------
   Viven en la tabla `landing_products` de Supabase y se leen EN VIVO desde el
   navegador (la web es un export estático, así que no hace falta re-buildear:
   un producto nuevo aparece solo).

   Solo trae filas con active = true y show_whynot = true.
   La lectura usa la ANON key (pública); la escritura la hace el panel con la
   service_role key (protegida por RLS).

   Las imágenes viven en el MISMO bucket `catalog` que el resto del catálogo,
   así que reutilizamos el tipo CatalogEntry + los helpers mainUrl/frameUrl.
   ============================================================================ */

import { SUPABASE_CATALOG_BASE, getEntryByPath, type CatalogEntry } from "./catalog";

const SUPABASE_URL = "https://jkkytzgmhzzngnntkfbr.supabase.co";
// Clave pública (anon). Diseñada para exponerse en el frontend; el acceso real
// está limitado por RLS (solo SELECT de filas activas).
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impra3l0emdtaHp6bmdubnRrZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODA0OTQsImV4cCI6MjA4NDk1NjQ5NH0.ztBsYgEa4OIEUGHZOtRE-8glkYH2-rg8RHHQADblQUQ";

export type PanelProduct = CatalogEntry & {
  /** URL pública directa de la foto de portada (main.jpg o 360_01.jpg). */
  imageUrl: string;
  /** Talles disponibles cargados en el panel. Vacío = sin info. */
  sizes: string[];
  /** Etiqueta promocional (nuevo, drop, ultimos-pares...). '' = ninguna. */
  badge: string;
  /** Pares disponibles. null = sin info (se trata como disponible). */
  stock: number | null;
};

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

type Row = {
  id: string;
  brand: string;
  model: string;
  variant: string;
  image_path: string;
  image_url: string;
  sizes: string[] | null;
  type: "360" | "image" | null;
  frames: number | null;
  badge: string | null;
  stock: number | null;
};

function buildEntry(row: Row): PanelProduct | null {
  if (!row || !row.brand || !row.model || !row.image_path) return null;
  const brand = String(row.brand);
  const model = String(row.model);
  const colorway = String(row.variant || "");
  const path = row.image_path;
  const slug = {
    brand: slugify(brand),
    model: slugify(model),
    colorway: slugify(colorway),
    full: "",
  };
  slug.full = `${slug.brand}/${slug.model}/${slug.colorway}`;

  // 360°: viene de la tabla. Antes estaba fijo en "image", lo que dejaba sin
  // visor 360 a los productos que sí lo tienen.
  const is360 = row.type === "360" && Number(row.frames) > 0;

  return {
    brand,
    model,
    colorway,
    type: is360 ? "360" : "image",
    frames: is360 ? Number(row.frames) : 0,
    path,
    encodedPath: encodePath(path),
    slug,
    imageUrl:
      row.image_url ||
      `${SUPABASE_CATALOG_BASE}/${encodePath(path)}/${is360 ? "360_01.jpg" : "main.jpg"}`,
    sizes: Array.isArray(row.sizes) ? row.sizes.map(String) : [],
    badge: String(row.badge ?? ""),
    stock: row.stock ?? null,
  };
}

/**
 * Lee los productos del panel para Whynot. Nunca lanza: ante cualquier error
 * devuelve [] para no romper el catálogo.
 * @param brandSlug  si se pasa, filtra solo esa marca.
 */
export async function fetchPanelProducts(brandSlug?: string): Promise<PanelProduct[]> {
  try {
    const url =
      `${SUPABASE_URL}/rest/v1/landing_products` +
      `?select=id,brand,model,variant,image_path,image_url,sizes,type,frames,badge,stock` +
      `&active=eq.true&show_whynot=eq.true&order=created_at.desc`;
    const res = await fetch(url, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    });
    if (!res.ok) return [];
    const rows = (await res.json()) as Row[];
    if (!Array.isArray(rows)) return [];
    let entries = rows.map(buildEntry).filter((e): e is PanelProduct => e !== null);
    // Dedupe contra el archivo estático: si el producto YA está en
    // catalog-index.json no lo repetimos en "Nuevos ingresos" (pasaría con
    // todo el catálogo una vez migrado al panel). Solo mostramos lo genuinamente
    // nuevo, que es lo que el archivo estático todavía no tiene.
    entries = entries.filter((e) => getEntryByPath(e.path) === null);
    if (brandSlug) entries = entries.filter((e) => e.slug.brand === brandSlug);
    return entries;
  } catch {
    return [];
  }
}
