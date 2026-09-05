/* ============================================================================
   ⚠️ MOCK RETIRADO (5-sep-2026) — de acá ya NO salen datos de producto.
   ----------------------------------------------------------------------------
   Este archivo generaba stock, talles y etiqueta con un hash del nombre del
   producto. La ficha lo usaba, así que durante meses mostró talles que no
   existían en ningún lado: alguien podía elegir un 42 que no había, y el
   "Últimas 3 unidades" era un número inventado.

   Hoy la ficha lee landing_products (el panel). Lo único que sobrevive acá
   es el TIPO Badge, que sigue describiendo las etiquetas válidas.

   No volver a usar getProductMeta para nada que el visitante vea. Regla de
   la casa: cero datos ficticios.
   ============================================================================ */

/* ============================================================================
   PRODUCT META — mock data determinístico (stock/badge/sizes) por colorway
   ----------------------------------------------------------------------------
   Genera valores plausibles a partir del slug del producto. Determinístico:
   el mismo colorway siempre tira los mismos valores (evita parpadeos entre
   renders y hace los tests reproducibles). Reemplazar cuando exista backend.
   ============================================================================ */

import type { CatalogEntry } from "@/data/catalog";

export type Badge = "hot" | "new" | "drop" | null;

export type ProductMeta = {
  stock: number;          // 0 = sin stock, <5 = poco stock, >=5 = ok
  badge: Badge;
  sizes: string[];        // talles disponibles (todos los demás aparecen disabled)
  category: string;
};

const ALL_SIZES = ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"];

/** Hash 32-bit estable del slug (FNV-1a simplificado). */
function hashSlug(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** PRNG determinístico a partir de un seed (xorshift32). */
function makeRng(seed: number) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 10000) / 10000; // [0, 1)
  };
}

function deriveCategory(entry: CatalogEntry): string {
  const m = entry.model.toLowerCase();
  if (m.includes("boot") || m.includes("timberland")) return "Boots";
  if (m.includes("trainer") || m.includes("runner")) return "Runners";
  if (m.includes("dunk") || m.includes("af1") || m.includes("force"))
    return "Lifestyle";
  if (m.includes("retro") || m.includes("jordan")) return "Basketball";
  return "Sneakers";
}

export function getProductMeta(entry: CatalogEntry): ProductMeta {
  const rng = makeRng(hashSlug(entry.slug.full));

  // Stock: 75% en stock (5-20), 18% poco stock (1-4), 7% sin stock
  const stockRoll = rng();
  let stock: number;
  if (stockRoll < 0.07) stock = 0;
  else if (stockRoll < 0.25) stock = 1 + Math.floor(rng() * 4);
  else stock = 5 + Math.floor(rng() * 16);

  // Badge: 18% hot, 18% new, 12% drop, resto nada
  const badgeRoll = rng();
  let badge: Badge = null;
  if (badgeRoll < 0.18) badge = "hot";
  else if (badgeRoll < 0.36) badge = "new";
  else if (badgeRoll < 0.48) badge = "drop";

  // Talles disponibles: 70-100% de los talles, sin huecos extraños
  const availabilityRate = 0.7 + rng() * 0.3;
  const sizes = ALL_SIZES.filter(() => rng() < availabilityRate);
  // Garantizar al menos 3 talles
  if (sizes.length < 3) sizes.push(...ALL_SIZES.slice(2, 5));

  return {
    stock,
    badge,
    sizes: [...new Set(sizes)].sort(),
    category: deriveCategory(entry),
  };
}
