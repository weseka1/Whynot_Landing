/**
 * SITE CONTENT — toda la copy editable.
 * Cambiar acá los textos sin tocar componentes.
 * Créditos legales viven en /data/credits.ts (no tocar sin permiso).
 */

/* Canal de contacto: cada pilar opcionalmente tiene una lista de
   channels[] que se renderiza como pills con icono inline en Mission.tsx.
   - note: descripcion corta que se muestra DEBAJO de la pill (ej:
     "collabs, re-stock, sale"). Opcional.                                 */
type Channel = {
  type:    "whatsapp" | "instagram" | "web" | "whatsapp-channel";
  display: string;
  url:     string;
  note?:   string;
};

/* closing: parrafo final que aparece DEBAJO de los channel pills.
   Usado p/ ej en el pilar .002 CANALES para el call-to-action.         */
type Pillar = {
  id:        string;
  label:     string;
  copy:      string;
  channels?: Channel[];
  closing?:  string;
};

export const site = {
  brand: {
    name: "WHY NOT",
    tagline: "Sneakers importados",
  },

  /* ---------------- NAV ---------------- */
  /* El menu sigue el orden de la home nueva (4-sep-2026): primero lo que se
     compra. #tienda envuelve Mas vendidos + Nuevos ingresos. */
  nav: [
    /* Anclas con "/" adelante: funcionan tambien desde /catalog/ y /politicas/.
       "Catálogo" es ruta propia (la pagina indice con el buscador de marcas). */
    { label: "Inicio",       href: "/#hero" },
    { label: "Tienda",       href: "/#tienda" },
    { label: "Catálogo",     href: "/catalog/" },
    { label: "Drops",        href: "/#section-past-drop" },
    { label: "Cómo comprar", href: "/#section-como-comprar" },
    { label: "Nosotros",     href: "/#section-mission" },
  ],

  /* ---------------- PRELOADER ---------------- */
  preloader: {
    label: "C://SYSTEM_FILES",
    decrypt: "D://DATA_CORE / DECRYPTING...",
    granted: "ACCESS GRANTED",
    decrypted: "FILE DECRYPTED",
  },

  /* ---------------- HERO ---------------- */
  hero: {
    eyebrow:   "ENVÍOS / TODO EL PAÍS",
    tagline:   "Future\nMode",
    sub:       "Sneakers importados. Envíos a todo el país. En CABA y GBA, en el día y pagás al recibir.",
    discover:  "Ver zapatillas",
    metaLeft:  "SNEAKERS",
    metaRight: "PEDIDOS / WHATSAPP",
    /* GLB model centerpiece (reemplazar archivo en /public/assets/3d/) */
    model:     "/assets/3d/mono.glb",
    /* Fondo del hero (WebP cielo, fallback PNG si hace falta). */
    bgImage:   "/assets/hero/sky-background.webp",
  },

  /* ---------------- COLLECTIONS / ORANITHS ---------------- */
  collections: {
    eyebrow: "COLECCIONES",
    title:   "Golden Goose",
    ticker:  "Future Mode · Encrypted Couture",
    items: [
      /* image = preview del thumb. video (opcional) = lo que se muestra en
         el planeta cuando este item esta activo. Los .webm tienen alpha
         real (VP9 yuva420p) procesado desde 144 frames 360 grados — fondo
         negro recortado con extract-black-bg.py (luminance + flood). */
      { id: "01", name: "Super Star · White Black",  caption: "Blanco y negro",    image: "/assets/hero/golden-goose-white-black.webp",  video: "/assets/hero/golden-goose-white-black.webm" },
      { id: "02", name: "Super Star · Silver Star",  caption: "Estrella plateada", image: "/assets/hero/golden-goose-silver-star.webp",  video: "/assets/hero/golden-goose-silver-star.webm" },
      { id: "03", name: "Super Star · Gold Star",    caption: "Estrella dorada",   image: "/assets/hero/golden-goose-gold-star.webp",    video: "/assets/hero/golden-goose-gold-star.webm" },
    ],
  },

  /* ---------------- MISSION ----------------
     5 pilares con texto a la izquierda + mono dorado 3D que se repite
     a la derecha de cada uno. Cubren el flow completo: como comprar,
     canales oficiales, envios CABA/GBA, envios al interior, dudas/asesor. */
  mission: {
    eyebrow:  "// OUR MISSION",
    title:    "Somos Why Not",
    subtitle: "Una forma distinta de pisar la street....",
    pillars: [
      {
        id:    ".001 COMPRA",
        label: "¿Cómo comprar?",
        copy:  "Cada compra se gestiona con atención personalizada. Escribinos por WhatsApp y nuestro equipo te guía para avanzar con tu drop.",
        channels: [
          { type: "whatsapp",  display: "+54 9 11 7629-5915", url: "https://wa.me/5491176295915" },
        ],
      },
      {
        id:    ".002 CANALES",
        label: "¿Cuáles son nuestros canales oficiales?",
        copy:  "Viví la experiencia Why Not: drops semanales, lanzamientos exclusivos, promociones y STOCK LIMITADO.",
        channels: [
          { type: "whatsapp-channel", display: "Canal WhatsApp",      url: "https://wa.me/5491176295915",
            note: "promociones · detrás de cámara · unboxings · avisos de stock y re-stock" },
          { type: "web",              display: "Web oficial",         url: "/",
            note: "catálogo completo · drops activos · pre-venta" },
        ],
        closing: "¿Querés ser exclusivo como nosotros? No te pierdas las novedades y enterate con prioridad de cada lanzamiento en nuestros canales.",
      },
      {
        id:    ".003 CABA",
        label: "¿Sos de CABA o GBA?",
        copy:  "Los envíos son en el día. Y SÍ, podés abonar TODO al recibir 🫵🏼. Contactate con nosotros para coordinarlo.",
      },
      {
        id:    ".004 ARGENTINA",
        label: "¡Llegamos a TODO Argentina! 🇦🇷",
        copy:  "De la mano de OCA y Correo Argentino despachamos tu pedido a cualquier parte del país. Entrega de 2 a 3 días hábiles 🔥 (excepción Tierra del Fuego: 5 a 7 días 📦).",
      },
      {
        id:    ".005 DUDAS",
        label: "¿Tenés dudas?",
        copy:  "Te asesoramos de forma personalizada para ayudarte a elegir el drop que necesitás. También podés solicitar un video unboxing y conocer el producto en detalle antes de recibirlo.",
        channels: [
          { type: "whatsapp",  display: "Chat WhatsApp",     url: "https://wa.me/5491176295915" },
        ],
      },
    ] as Pillar[],

    /* Cierre: despues del ultimo pilar, el mono dorado solo y centrado
       con una frase grande abajo. Funciona como sello/firma de la
       seccion completa. */
    closing: {
      phrase: "¡Estamos para ayudarte a encontrar tu mejor DROP! 🫵🏼🫡",
    },
  },

  /* ---------------- PAST DROP (Sirius) ---------------- */
  pastDrop: {
    eyebrow: "MODELOS EN 360°",
    title:   "drops",
    drop: {
      name:        "Sirius",
      season:      "AW / 02",
      coordinates: "06h 45m 08.9s · −16° 42′ 58″",
      image:       "/assets/hero/extra.webp",
      copy:        "Archive release. Read-only. Documented from origin to thread.",
    },
    badgeCount: 12,    /* cantidad de badges en el grid */
  },

  /* ---------------- ANTURAX ---------------- */
  anturax: {
    eyebrow: "C://SYSTEM_FILES / VARIANT",
    title:   "Anturax",
    copy:    "Heavier, sculpted line. Toggle the style to preview both states.",
    toggle:  { off: "DARK", on: "LIGHT" },
  },
};

export type Site = typeof site;
