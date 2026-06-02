/* ============================================================================
   CONTACT — WhatsApp helpers para CTAs del catálogo
   ----------------------------------------------------------------------------
   Único lugar donde se centraliza el número de WA. Si cambia, se cambia acá
   una sola vez.
   ============================================================================ */

import type { CatalogEntry } from "@/data/catalog";

/** Número de WhatsApp en formato wa.me (sin +, sin guiones, sin espacios). */
export const WA_NUMBER = "5491176295915"; // +54 9 11 7629-5915

/* ---------- Mensaje base de producto ---------- */

export function buildProductMessage(
  entry: CatalogEntry,
  size?: string
): string {
  const lines = [
    "Hola Why Not, quiero consultar por este modelo:",
    `Marca: ${entry.brand}`,
    `Modelo: ${entry.model}`,
    `Colorway: ${entry.colorway}`,
  ];
  if (size) lines.push(`Talle: ${size}`);
  return lines.join("\n");
}

/* ---------- WhatsApp ---------- */

export function buildWhatsAppUrl(entry: CatalogEntry, size?: string): string {
  const msg = buildProductMessage(entry, size);
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
