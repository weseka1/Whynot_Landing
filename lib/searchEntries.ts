/* ============================================================================
   searchEntries — filtro de catálogo por texto libre.
   ----------------------------------------------------------------------------
   Tokeniza la query y exige que TODOS los tokens aparezcan (substring case-
   insensitive) en el haystack "BRAND MODEL COLORWAY". Suficientemente rápido
   para 279 entries (decenas de microsegundos). Si en el futuro escalamos,
   sustituir por fuse.js sin tocar callers.
   ============================================================================ */

import type { CatalogEntry } from "@/data/catalog";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function searchEntries(
  entries: CatalogEntry[],
  query: string
): CatalogEntry[] {
  const q = normalize(query).trim();
  if (!q) return entries;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return entries;
  return entries.filter((e) => {
    const haystack = normalize(`${e.brand} ${e.model} ${e.colorway}`);
    return tokens.every((t) => haystack.includes(t));
  });
}
