/* ============================================================================
   searchEntries — fuzzy search del catálogo con fuse.js.
   ----------------------------------------------------------------------------
   Por qué fuse.js: típica búsqueda de catálogo necesita tolerar typos,
   abreviaciones y orden de palabras (jordn → JORDAN, af1 → Air Force 1,
   travis scott → SB Dunk Low Travis Scott, etc.). Substring no alcanza.

   Estrategia "preguardado":
   - Al importar este módulo se construye UNA VEZ el índice Fuse global con
     getAllEntries() (279 items). Esa estructura queda en memoria.
   - searchAll(query) usa ese índice → respuestas instantáneas a cada
     keystroke porque NO reindexa.
   - searchEntries(entries, query) recibe un subset (e.g. la página de una
     marca) y construye un Fuse fresh para ese subset. Subset chico (~30)
     → el costo es trivial (microsegundos).
   ============================================================================ */

import Fuse from "fuse.js";
import { getAllEntries, type CatalogEntry } from "@/data/catalog";

const FUSE_OPTIONS: ConstructorParameters<typeof Fuse<CatalogEntry>>[1] = {
  keys: [
    { name: "brand", weight: 2 },
    { name: "model", weight: 1.6 },
    { name: "colorway", weight: 1.2 },
  ],
  threshold: 0.4,           // 0 exacto · 1 cualquier cosa — 0.4 = típicos typos OK
  distance: 100,
  minMatchCharLength: 1,
  ignoreLocation: true,     // que la match position no penalice (importante para queries cortas)
  includeScore: false,
  shouldSort: true,
  useExtendedSearch: false,
};

/* Índice global precomputado — construido al cargar el módulo (catálogo
   "preguardado"). Reusado en cada llamada a searchAll(). */
const GLOBAL_FUSE: Fuse<CatalogEntry> = new Fuse(
  getAllEntries(),
  FUSE_OPTIONS
);

/**
 * Búsqueda fuzzy en TODO el catálogo (279 items).
 * Usa el índice global cacheado → ideal para typeahead del CommandPalette.
 */
export function searchAll(query: string, limit?: number): CatalogEntry[] {
  const q = query.trim();
  /* Sin query devolvemos el arranque del catálogo, PERO respetando el
     límite. Antes esta rama lo ignoraba: al abrir el buscador —query
     vacía— montaba las 280 filas con sus 280 <img> de una, justo en el
     frame en que aparece el modal. En un celu eso es el tirón que hace
     pensar que la web se colgó. Medido 5-sep: 280 filas / 280 imágenes
     al abrir; con el límite, 12. */
  const base = q ? GLOBAL_FUSE.search(q).map((r) => r.item) : getAllEntries();
  return limit !== undefined ? base.slice(0, limit) : base;
}

/**
 * Búsqueda fuzzy sobre un subset arbitrario (e.g. los colorways de UNA marca).
 * Crea un Fuse fresh — barato para listas pequeñas (~30 items).
 */
export function searchEntries(
  entries: CatalogEntry[],
  query: string
): CatalogEntry[] {
  const q = query.trim();
  if (!q) return entries;
  if (entries.length === 0) return entries;
  const fuse = new Fuse(entries, FUSE_OPTIONS);
  return fuse.search(q).map((r) => r.item);
}
