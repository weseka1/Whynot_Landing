/* ============================================================================
   CONTACT — WhatsApp + Instagram helpers para CTAs del catálogo
   ----------------------------------------------------------------------------
   Único lugar donde se centralizan número de WA y user de IG. Si cambian, se
   cambian acá una sola vez.
   ============================================================================ */

import type { CatalogEntry } from "@/data/catalog";

/** Número de WhatsApp en formato wa.me (sin +, sin guiones, sin espacios). */
export const WA_NUMBER = "5491176295915"; // +54 9 11 7629-5915

/** Handle de Instagram (sin @). */
export const IG_HANDLE = "whynot_exclusive";

const IG_DESKTOP_URL = `https://www.instagram.com/${IG_HANDLE}/`;
const IG_MOBILE_DM_URL = `instagram://user?username=${IG_HANDLE}`;

/* ---------- Mensaje base de producto ---------- */

export function buildProductMessage(
  entry: CatalogEntry,
  size?: string
): string {
  const lines = [
    "Hola WhyNot, quiero consultar por este modelo:",
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

/* ---------- Instagram ---------- */

function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mobi|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * Flujo "Pedir por Instagram":
 *   1. Copia el mensaje del producto al portapapeles.
 *   2. Abre Instagram (app en mobile, web en desktop).
 *   3. Devuelve feedback al caller para mostrar al usuario.
 */
export async function handleInstagramClick(
  entry: CatalogEntry,
  size: string | undefined,
  onFeedback: (msg: string) => void
): Promise<void> {
  const message = buildProductMessage(entry, size);
  const copied = await copyToClipboard(message);

  const url = isMobileDevice() ? IG_MOBILE_DM_URL : IG_DESKTOP_URL;
  window.open(url, "_blank", "noopener,noreferrer");

  onFeedback(
    copied
      ? "Modelo copiado. Pegá el mensaje en el DM de Instagram y enviá."
      : "No se pudo copiar automáticamente — te abrimos Instagram igual."
  );
}
