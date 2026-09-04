/* ============================================================================
   CATÁLOGO — /catalog
   ----------------------------------------------------------------------------
   La página índice del catálogo NO existía: Next solo generaba
   /catalog/[marca]/, y el "Ver todo el catálogo" de la home mandaba a un 404
   (4-sep-2026). Esta es la entrada: un buscador de marcas y la grilla de
   marcas, cada una con cuántos modelos tiene y cuántos con vista 360°.

   Server component: cuenta todo en build desde catalog-index.json (279
   colorways, 19 marcas) y le pasa datos planos al cliente. Los productos que
   se cargan desde el panel aparecen en cada marca (PanelDrops), no acá.
   ============================================================================ */

import type { Metadata } from "next";
import {
  brandNameFromSlug,
  getAllBrandSlugs,
  getEntriesByBrandSlug,
  posterUrl,
} from "@/data/catalog";
import CatalogoIndice, { type MarcaResumen } from "@/components/tienda/CatalogoIndice";

export const metadata: Metadata = {
  title: "Catálogo — WHYNOT EXCLUSIVE",
  description:
    "Todas las marcas de WHYNOT EXCLUSIVE con vista 360°. Sneakers importados, envíos a todo el país y pago al recibir en CABA y GBA.",
};

function armarMarcas(): MarcaResumen[] {
  return getAllBrandSlugs()
    .map((slug) => {
      const entries = getEntriesByBrandSlug(slug);
      const nombre = brandNameFromSlug(slug) ?? slug;
      /* Portada: el primer 360 que haya (se ve mejor que una foto suelta). */
      const portada = entries.find((e) => e.type === "360") ?? entries[0];
      return {
        slug,
        nombre,
        total: entries.length,
        total360: entries.filter((e) => e.type === "360").length,
        modelos: new Set(entries.map((e) => e.model)).size,
        portada: portada ? posterUrl(portada) : "",
      };
    })
    .filter((m) => m.total > 0)
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
}

export default function CatalogPage() {
  const marcas = armarMarcas();
  const totalPares = marcas.reduce((s, m) => s + m.total, 0);
  return <CatalogoIndice marcas={marcas} totalPares={totalPares} />;
}
