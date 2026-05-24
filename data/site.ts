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

/* Canales de contacto en bloques de "How It Works": cada uno tiene un
   tipo que mapea a un icono SVG en HowItWorks.tsx. */
type Channel = {
  type:    "whatsapp" | "instagram" | "web" | "whatsapp-channel";
  display: string;
  url:     string;
};

type HowItWorksBlock = {
  id:        string;
  label:     string;
  copy:      string;
  channels?: Channel[];
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
         el planeta cuando este item esta activo. Los .webm tienen alpha
         real (VP9 yuva420p) procesado desde 144 frames 360 grados — fondo
         negro recortado con extract-black-bg.py (luminance + flood). */
      { id: "01", name: "Super Star · White Black",  caption: "Shift the vision",  image: "/assets/hero/golden-goose-white-black.webp",  video: "/assets/hero/golden-goose-white-black.webm" },
      { id: "02", name: "Super Star · Silver Star",  caption: "Evolve",            image: "/assets/hero/golden-goose-silver-star.webp",  video: "/assets/hero/golden-goose-silver-star.webm" },
      { id: "03", name: "Super Star · Gold Star",    caption: "Touch the void",    image: "/assets/hero/golden-goose-gold-star.webp",    video: "/assets/hero/golden-goose-gold-star.webm" },
      { id: "04", name: "Capsule 04",                caption: "Decrypted",          image: "/assets/hero/extra.webp" },
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
            display: "+54 9 11 7629-5915",
            url:     "https://wa.me/5491176295915",
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

  /* ---------------- HOW IT WORKS ----------------
     5 bloques que extienden la Mission: van justo despues de los 4
     pilares, mismo fondo lavanda + mismo mono dorado 3D que se repite.
     Cada bloque opcionalmente tiene channels[] (botones a IG/WA/Web/
     Canal de WA) renderizados como pills futuristas.                    */
  howItWorks: {
    eyebrow: "// HOW IT WORKS",
    blocks: [
      {
        id:    ".005 COMPRA",
        label: "¿Cómo comprar?",
        copy:  "Asesoramiento online personalizado. Te respondemos en el momento por el canal que prefieras.",
        channels: [
          { type: "instagram", display: "@whynot_exclusive",       url: "https://www.instagram.com/whynot_exclusive/" },
          { type: "whatsapp",  display: "+54 9 11 7629-5915",      url: "https://wa.me/5491176295915" },
        ],
      },
      {
        id:    ".006 CANALES",
        label: "¿Cuáles son nuestros canales oficiales?",
        copy:  "Entrá por donde te quede mejor — la conversación no se rompe entre canales.",
        channels: [
          { type: "whatsapp",         display: "+54 9 11 7629-5915", url: "https://wa.me/5491176295915" },
          { type: "instagram",        display: "@whynot_exclusive",  url: "https://www.instagram.com/whynot_exclusive/" },
          { type: "web",              display: "www.whynotamk.com.ar", url: "https://www.whynotamk.com.ar" },
          /* TODO: reemplazar el "#" cuando me pases la URL del Canal de WhatsApp. */
          { type: "whatsapp-channel", display: "Canal WhatsApp",     url: "#" },
        ],
      },
      {
        id:    ".007 CABA",
        label: "¿Sos de CABA o GBA?",
        copy:  "Los envíos son en el día. Y SÍ, podés abonar TODO al recibir 🫵🏼. Contactate con nosotros para coordinarlo 🫡",
      },
      {
        id:    ".008 ARGENTINA",
        label: "¡Llegamos a TODO Argentina! 🇦🇷",
        copy:  "De la mano de OCA y Correo Argentino despachamos tu pedido a cualquier parte del país. Entrega de 2 a 3 días hábiles 🔥 (excepción Tierra del Fuego: 5 a 7 días 📦).",
      },
      {
        id:    ".009 DUDAS",
        label: "¿Tenés dudas?",
        copy:  "Contactate con un asesor de ventas. Podés pedir un video unboxing del producto antes de la compra.",
        channels: [
          { type: "whatsapp",  display: "Chat WhatsApp",      url: "https://wa.me/5491176295915" },
          { type: "instagram", display: "@whynot_exclusive",  url: "https://www.instagram.com/whynot_exclusive/" },
        ],
      },
    ] as HowItWorksBlock[],
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
