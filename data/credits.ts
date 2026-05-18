/**
 * ============================================================================
 *  CREDITS / LEGAL  —  ZONA PROTEGIDA
 * ============================================================================
 *
 *  Este archivo contiene los créditos, derechos de autor y textos legales
 *  del sitio original.  El autor del proyecto (vos) tiene autorización para
 *  reutilizar la página, pero pidió expresamente:
 *
 *    - NO borrar créditos.
 *    - NO cambiar "SITE BY".
 *    - NO cambiar "MASTERCLASS BY".
 *    - NO cambiar "AWWWARDS".
 *    - NO cambiar "LEGAL".
 *    - NO modificar el año de copyright.
 *
 *  PEGÁ ACÁ los strings EXACTOS tal como figuran en el footer / créditos
 *  del sitio original.  Hasta que los pegues quedan como TODO visibles en
 *  el footer renderizado, así no te olvidás de completarlos.
 *
 *  Si más adelante querés mover esta página a otra marca, esto es lo único
 *  que NO se reemplaza salvo que tengas permiso explícito.
 * ============================================================================
 */

export const credits = {
  /** Línea principal de copyright. Ej: "© 2024 DICH. All rights reserved." */
  copyright:        "TODO: pegar línea de copyright original",

  /** Crédito al diseñador / studio que construyó el sitio. */
  siteBy: {
    label:          "SITE BY",
    name:           "TODO: pegar nombre original de SITE BY",
    href:           "",                 // ← pegar URL original si existe
  },

  /** Crédito de la masterclass (curso / academia) que produjo la pieza. */
  masterclassBy: {
    label:          "MASTERCLASS BY",
    name:           "TODO: pegar nombre original de MASTERCLASS BY",
    href:           "",
  },

  /** Mención de Awwwards (reconocimiento). */
  awwwards: {
    label:          "AWWWARDS",
    name:           "TODO: pegar texto / premio original",
    href:           "",                 // ← URL del perfil / nominación
  },

  /** Aviso legal del sitio. */
  legal: {
    label:          "LEGAL",
    text:           "TODO: pegar texto legal completo del original",
    href:           "",                 // ← URL de página legal si existe
  },

  /**
   * Links externos adicionales del footer original (Instagram, X, etc).
   * Dejar el array vacío si el original no tenía.
   */
  externalLinks: [
    // { label: "INSTAGRAM", href: "https://..." },
    // { label: "X",         href: "https://..." },
  ] as Array<{ label: string; href: string }>,
};

export type Credits = typeof credits;
