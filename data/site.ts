/**
 * SITE CONTENT — toda la copy editable.
 * Cambiar acá los textos sin tocar componentes.
 * Créditos legales viven en /data/credits.ts (no tocar sin permiso).
 */

type Social = {
  instagram?: { handle: string; url: string };
  whatsapp?:  { display: string; url: string };
};

type Pillar = {
  id:     string;
  label:  string;
  copy:   string;
  social?: Social;
};

export const site = {
  brand: {
    name: "DICH",
    tagline: "Future Mode",
  },

  /* ---------------- NAV ---------------- */
  nav: [
    { label: "Home",        href: "#hero" },
    { label: "Collections", href: "#section-collections" },
    { label: "Mission",     href: "#section-mission" },
    { label: "Past Drop",   href: "#section-past-drop" },
    { label: "Anturax",     href: "#section-anturax" },
    { label: "Your Idea",   href: "#section-form" },
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
    eyebrow:   "C://SYSTEM_FILES / 01",
    tagline:   "Future\nMode",
    sub:       "An operating system for fashion drops. Wear the file.",
    discover:  "Discover",
    metaLeft:  "VERSION 02.6",
    metaRight: "EST. 20XX",
    /* GLB model centerpiece (reemplazar archivo en /public/assets/3d/) */
    model:     "/assets/3d/mono.glb",
    /* Fondo del hero (WebP cielo, fallback PNG si hace falta). */
    bgImage:   "/assets/hero/sky-background.webp",
  },

  /* ---------------- COLLECTIONS / ORANITHS ---------------- */
  collections: {
    eyebrow: "D://DATA_CORE / COLLECTIONS",
    title:   "Oraniths",
    ticker:  "Future Mode · DICH · Encrypted Couture",
    items: [
      /* image = preview del thumb. video (opcional) = lo que se muestra en
         el circulo central cuando este item esta activo. Si no hay video,
         el circulo muestra image como background. Cada item tiene su
         propio video (white-black / silver / gold). */
      { id: "01", name: "Capsule 01", caption: "Shift the vision",  image: "/assets/hero/golden-goose.webp", video: "/assets/hero/golden-goose-alpha.webm" },
      { id: "02", name: "Capsule 02", caption: "Evolve",            image: "/assets/hero/golden-goose.webp", video: "/assets/hero/golden-goose-silver.mp4" },
      { id: "03", name: "Capsule 03", caption: "Touch the void",    image: "/assets/hero/golden-goose.webp", video: "/assets/hero/golden-goose-gold.mp4" },
      { id: "04", name: "Capsule 04", caption: "Decrypted",          image: "/assets/hero/extra.webp" },
    ],
  },

  /* ---------------- MISSION ---------------- */
  mission: {
    eyebrow:  "// OUR MISSION",
    title:    "Somos WhyNot",
    subtitle: "Conocenos. Cuatro pilares. Una forma distinta de comprar.",
    pillars: [
      {
        id:    ".001 SOURCE",
        label: "Asesoría 1:1",
        copy:  "Curaduría humana por Instagram y WhatsApp. Te ayudamos a elegir como si fuera para nosotros — cero bots, cero scripts. Respuesta real, en el momento.",
      },
      {
        id:    ".002 BUILD",
        label: "Unboxing a medida",
        copy:  "¿Viste algo que te gustó? Mandanos la captura. Te devolvemos un video unboxing del producto, grabado para vos, antes de tomar la decisión.",
      },
      {
        id:    ".003 RELEASE",
        label: "Tres canales, un hilo",
        copy:  "Instagram · WhatsApp · Web. Entrás por donde te queda mejor — la conversación no se rompe entre canales.",
        social: {
          instagram: {
            handle: "@whynot_exclusive",
            url:    "https://www.instagram.com/whynot_exclusive/",
          },
          whatsapp: {
            display: "+54 9 291 441-3200",
            url:     "https://wa.me/5492914413200",
          },
        },
      },
      {
        id:    ".004 ARCHIVE",
        label: "Llegada garantizada",
        copy:  "CABA y GBA: entrega en el día, pago contra-entrega. Interior del país: 2 a 4 días hábiles, directo a tu puerta.",
      },
    ],
  },

  /* ---------------- PAST DROP (Sirius) ---------------- */
  pastDrop: {
    eyebrow: "D://DATA_CORE / ARCHIVE",
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

  /* ---------------- FORM / YOUR IDEA ---------------- */
  form: {
    eyebrow: "C://SYSTEM_FILES / INPUT",
    title:   "Your Idea",
    copy:    "Submit a concept. Selected ideas become real drops.",
    cta:     "Send Signal",
    fields:  { name: "Name", email: "Email", world: "World" },
    success: "SIGNAL SENT — STATUS: OK",
  },
};

export type Site = typeof site;
