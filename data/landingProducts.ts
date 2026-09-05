/* ============================================================================
   LANDING PRODUCTS — productos cargados desde el PANEL.
   ----------------------------------------------------------------------------
   Viven en la tabla `landing_products` de Supabase y se leen EN VIVO desde el
   navegador (la web es un export estático, así que no hace falta re-buildear:
   un producto nuevo aparece solo).

   Solo trae filas con active = true y show_whynot = true.
   La lectura usa la ANON key (pública); la escritura la hace el panel con la
   service_role key (protegida por RLS).

   Las imágenes viven en el MISMO bucket `catalog` que el resto del catálogo,
   así que reutilizamos el tipo CatalogEntry + los helpers mainUrl/frameUrl.

   ── Dos lecturas distintas, a propósito ─────────────────────────────────────
   · fetchPanelProducts()  → "Nuevos ingresos" de la brand page. DEDUPLICA
                             contra el archivo estático: solo lo que el catálogo
                             todavía no tiene.
   · fetchShopProducts()   → la TIENDA de la home. NO deduplica y trae los
                             campos comerciales (precio, cuotas, talles, stock).
                             Acá el precio es el protagonista: 311 de los 327
                             productos ya lo tienen cargado en el panel.
   ============================================================================ */

import { SUPABASE_CATALOG_BASE, getEntryByPath, type CatalogEntry } from "./catalog";

const SUPABASE_URL = "https://jkkytzgmhzzngnntkfbr.supabase.co";
// Clave pública (anon). Diseñada para exponerse en el frontend; el acceso real
// está limitado por RLS (solo SELECT de filas activas).
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impra3l0emdtaHp6bmdubnRrZmJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzODA0OTQsImV4cCI6MjA4NDk1NjQ5NH0.ztBsYgEa4OIEUGHZOtRE-8glkYH2-rg8RHHQADblQUQ";

/** Campos comerciales: lo que hace que la web sea una tienda y no un catálogo. */
/* ── ¿La web muestra precios? (5-sep-2026) ────────────────────────────────
   Juani: "al final Whynot es sin precios, sacale los precios ya".

   Va como bandera y no borrando el código en los cinco lugares donde se
   mostraban, porque esta decisión ya cambió de lado una vez: los precios se
   sacaron, después los chicos los volvieron a cargar (225 productos tienen
   transferencia y cuotas en la base), y ahora salen de nuevo. Con la
   bandera, volver a mostrarlos es cambiar false por true; borrando el
   código, es rehacerlo.

   Los datos NO se tocan: siguen cargados en landing_products. Lo que se
   apaga es mostrarlos. */
export const MOSTRAR_PRECIOS = false;

export type Precio = {
  /** Precio de lista. 0 o null = sin precio cargado → no se muestra. */
  price: number | null;
  /** ARS por defecto. */
  currency: string;
  /** Precio por transferencia (suele ser menor). null = no aplica. */
  transferencia: number | null;
  /** Valor de cada cuota, no el total. null = no aplica. */
  cuota3: number | null;
  cuota6: number | null;
};

export type PanelProduct = CatalogEntry &
  Precio & {
    /** id de la fila en el panel — clave del carrito. */
    id: string;
    /** URL pública directa de la foto de portada (main.jpg o 360_01.jpg). */
    imageUrl: string;
    /** Talles disponibles cargados en el panel. Vacío = sin info. */
    sizes: string[];
    /** Etiqueta promocional (nuevo, drop, ultimos-pares...). '' = ninguna. */
    badge: string;
    /** Pares disponibles. null = sin info (se trata como disponible). */
    stock: number | null;
    /** Marcado desde el panel. Es lo que alimenta "Más vendidos". */
    featured: boolean;
    /** Categoría libre del panel. '' = ninguna. */
    category: string;
    /** Fecha de alta — ordena "Nuevos ingresos". */
    createdAt: string;
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
  price: number | null;
  currency: string | null;
  price_transferencia: number | null;
  cuota3: number | null;
  cuota6: number | null;
  featured: boolean | null;
  category: string | null;
  created_at: string | null;
};

/** Columnas que pedimos siempre. Si falta una, el producto pierde su precio. */
const SELECT_COLS =
  "id,brand,model,variant,image_path,image_url,sizes,type,frames,badge,stock," +
  "price,currency,price_transferencia,cuota3,cuota6,featured,category,created_at";

/** Un número que de verdad sirve como precio. 0, negativo o null → null. */
function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

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
    id: String(row.id),
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
    price: num(row.price),
    currency: String(row.currency || "ARS"),
    transferencia: num(row.price_transferencia),
    cuota3: num(row.cuota3),
    cuota6: num(row.cuota6),
    featured: row.featured === true,
    category: String(row.category ?? ""),
    createdAt: String(row.created_at ?? ""),
  };
}

/** GET a la tabla. Nunca lanza: ante cualquier error devuelve []. */
async function query(params: string): Promise<PanelProduct[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/landing_products?select=${SELECT_COLS}&${params}`,
      { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } }
    );
    if (!res.ok) return [];
    const rows = (await res.json()) as Row[];
    if (!Array.isArray(rows)) return [];
    return rows.map(buildEntry).filter((e): e is PanelProduct => e !== null);
  } catch {
    return [];
  }
}

const BASE = "active=eq.true&show_whynot=eq.true";

/**
 * "Nuevos ingresos" de la brand page. Deduplica contra el archivo estático:
 * si el producto YA está en catalog-index.json no lo repite, porque abajo ya
 * aparece en el catálogo. Solo muestra lo genuinamente nuevo.
 * @param brandSlug  si se pasa, filtra solo esa marca.
 */
export async function fetchPanelProducts(brandSlug?: string): Promise<PanelProduct[]> {
  let entries = await query(`${BASE}&order=created_at.desc`);
  entries = entries.filter((e) => getEntryByPath(e.path) === null);
  if (brandSlug) entries = entries.filter((e) => e.slug.brand === brandSlug);
  return entries;
}

/* --------------------------------------------------------------------------
   LA TIENDA — lecturas para la home. Sin dedupe: acá el catálogo entero es
   el producto, y el precio es lo que el visitante vino a ver.
   -------------------------------------------------------------------------- */

/**
 * Los que el panel marcó como destacados (`featured`) — la sección
 * "Más vendidos". Si nadie marcó ninguno devuelve [] y la sección no se
 * renderiza: preferimos que falte a mostrar productos elegidos por nosotros.
 */
/**
 * Trae UN producto del panel por su slug de catálogo (marca/modelo/color).
 *
 * La ficha de producto es estática (se prerenderiza en build), así que sus
 * datos comerciales tienen que entrar desde el cliente. Devuelve null si ese
 * producto todavía no está cargado en el panel — que hoy pasa seguido: el
 * catálogo de fotos tiene 280 entradas y el panel 327, pero no son el mismo
 * conjunto.
 */
export async function fetchProductoPorSlug(
  brandSlug: string,
  modelSlug: string,
  colorwaySlug: string,
): Promise<PanelProduct | null> {
  /* Consulta propia, SIN el dedupe de fetchPanelProducts.
     Esa función descarta a propósito todo lo que ya está en
     catalog-index.json, porque alimenta la fila de "nuevos ingresos". Una
     ficha de producto es, por definición, algo que SÍ está en el catálogo:
     usándola de atajo el producto quedaba siempre filtrado y la ficha creía
     que el panel no lo tenía. Costó un rato de mirar los talles de la web
     contra la base y ver que no coincidían. */
  const todos = await query(`${BASE}&order=created_at.desc`);
  const buscado = `${brandSlug}/${modelSlug}/${colorwaySlug}`;
  return todos.find((p) => p.slug.full === buscado) ?? null;
}

/* ── Talles: qué hay y qué no (5-sep-2026) ────────────────────────────────
   Juani: "armemos la estructura para trabajar por talles/producto... que el
   stock sea administrado por ellos, ellos deciden cuántos pares por talle
   hay".

   La forma final es una columna `stock_por_talle` (jsonb) en
   landing_products: {"40": 3, "41": 1}. Todavía no existe — hay que crearla
   en Supabase, y para eso hace falta la service key.

   Mientras tanto esto deriva del `sizes` que ya está cargado: un talle que
   figura en la lista está disponible, aunque no sepamos cuántos pares.
   Cuando la columna exista, se lee de ahí y el resto del código no cambia:
   por eso la decisión vive acá y no repartida por los componentes. */
export type Disponibilidad = {
  /** Talles que se pueden pedir. */
  disponibles: string[];
  /** true si el producto no tiene datos y estamos asumiendo que hay de todo. */
  asumido: boolean;
};

export function disponibilidadDeTalles(
  p: PanelProduct | null,
  todosLosTalles: readonly string[],
): Disponibilidad {
  /* Sin producto en el panel, o cargado sin talles: se asume que hay de todo.
     Decisión de Juani (5-sep) sobre los 169 productos que hoy no tienen
     talles cargados — prefiere ofrecerlos y ajustar por chat antes que
     mostrar medio catálogo como agotado.

     Distinto de lo que hacía lib/productMeta, que INVENTABA un subconjunto
     con un hash del nombre: que un producto tuviera 39, 42 y 45 pero no 40
     no respondía a nada. Esto es una política declarada y pareja. */
  if (!p || p.sizes.length === 0) {
    return { disponibles: [...todosLosTalles], asumido: true };
  }
  return { disponibles: p.sizes, asumido: false };
}

export async function fetchDestacados(limit = 8): Promise<PanelProduct[]> {
  return query(`${BASE}&featured=is.true&order=created_at.desc&limit=${limit}`);
}

/** Los últimos que cargó el panel — "Nuevos ingresos" de la home. */
export async function fetchNuevos(limit = 8): Promise<PanelProduct[]> {
  return query(`${BASE}&order=created_at.desc&limit=${limit}`);
}

/** Todo lo de una marca, para la entrada del catálogo. */
export async function fetchPorMarca(brandSlug: string, limit = 60): Promise<PanelProduct[]> {
  const entries = await query(`${BASE}&order=created_at.desc&limit=500`);
  return entries.filter((e) => e.slug.brand === brandSlug).slice(0, limit);
}

/**
 * Las marcas con cuántos productos tiene cada una — la sección
 * "Comprá por marca". Ordenadas por cantidad, de mayor a menor.
 */
export async function fetchMarcas(): Promise<{ slug: string; nombre: string; total: number }[]> {
  const entries = await query(`${BASE}&order=brand.asc&limit=1000`);
  const mapa = new Map<string, { slug: string; nombre: string; total: number }>();
  for (const e of entries) {
    const actual = mapa.get(e.slug.brand);
    if (actual) actual.total++;
    else mapa.set(e.slug.brand, { slug: e.slug.brand, nombre: e.brand, total: 1 });
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

/* --------------------------------------------------------------------------
   FORMATO
   -------------------------------------------------------------------------- */

/** `166999` → `$ 166.999`. Sin decimales: son pesos, no centavos. */
export function formatPrecio(n: number | null, currency = "ARS"): string {
  if (n == null) return "";
  const s = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
  // Intl mete un espacio finito raro entre el signo y el número; lo normalizamos.
  return s.replace(/ /g, " ");
}
