/**
 * SITE CONTENT — toda la copy editable.
 * Cambiar acá los textos sin tocar componentes.
 * Créditos legales viven en /data/credits.ts (no tocar sin permiso).
 */

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
         el circulo muestra image como background. */
      { id: "01", name: "Capsule 01", caption: "Shift the vision",  image: "/assets/hero/character.webp", video: "/assets/hero/golden-goose.mp4" },
      { id: "02", name: "Capsule 02", caption: "Evolve",            image: "/assets/hero/extra.webp" },
      { id: "03", name: "Capsule 03", caption: "Touch the void",    image: "/assets/hero/character.webp", video: "/assets/hero/golden-goose.mp4" },
      { id: "04", name: "Capsule 04", caption: "Decrypted",          image: "/assets/hero/extra.webp" },
    ],
  },

  /* ---------------- MISSION ---------------- */
  mission: {
    eyebrow: "C://SYSTEM_FILES / MISSION",
    title:   "Our Mission",
    pillars: [
      { id: ".001", label: "Source",     copy: "Designing fashion as software. Every drop is versioned and documented." },
      { id: ".002", label: "Build",      copy: "Engineered silhouettes from recycled tech-fibers. Traceable thread to thread." },
      { id: ".003", label: "Release",    copy: "Wearer-owned. Never algorithmic. Each release is a file you can open." },
      { id: ".004", label: "Archive",    copy: "Every capsule preserved. Numbered, sealed, indexed — nothing leaves the system." },
    ],
  },

  /* ---------------- PAST DROP (Sirius) ---------------- */
  pastDrop: {
    eyebrow: "D://DATA_CORE / ARCHIVE",
    title:   "Past Drop",
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
