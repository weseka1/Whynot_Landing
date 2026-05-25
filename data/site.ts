/**
 * SITE CONTENT — toda la copy editable.
 * Cambiar acá los textos sin tocar componentes.
 * Créditos legales viven en /data/credits.ts (no tocar sin permiso).
 */

/* Canal de contacto: cada pilar opcionalmente tiene una lista de
   channels[] que se renderiza como pills con icono inline en Mission.tsx. */
type Channel = {
  type:    "whatsapp" | "instagram" | "web" | "whatsapp-channel";
  display: string;
  url:     string;
};

type Pillar = {
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
    ],
  },

  /* ---------------- MISSION ----------------
     5 pilares con texto a la izquierda + mono dorado 3D que se repite
     a la derecha de cada uno. Cubren el flow completo: como comprar,
     canales oficiales, envios CABA/GBA, envios al interior, dudas/asesor. */
  mission: {
    eyebrow:  "// OUR MISSION",
    title:    "Somos WhyNot",
    subtitle: "Conocenos. Una forma distinta de comprar.",
    pillars: [
      {
        id:    ".001 COMPRA",
        label: "¿Cómo comprar?",
        copy:  "Asesoramiento online personalizado. Te respondemos en el momento por el canal que prefieras.",
        channels: [
          { type: "instagram", display: "@whynot_exclusive",  url: "https://www.instagram.com/whynot_exclusive/" },
          { type: "whatsapp",  display: "+54 9 11 7629-5915", url: "https://wa.me/5491176295915" },
        ],
      },
      {
        id:    ".002 CANALES",
        label: "¿Cuáles son nuestros canales oficiales?",
        copy:  "Entrá por donde te quede mejor — la conversación no se rompe entre canales.",
        channels: [
          /* WhatsApp y Web los sacamos por redundancia: ya aparecen como
             pills en otros pilares (.001 COMPRA y .005 DUDAS para WA,
             y la URL se ve en el body). Aca solo dejamos los canales
             "extra" que solo se muestran aca: Instagram + Canal WhatsApp. */
          { type: "instagram",        display: "@whynot_exclusive",  url: "https://www.instagram.com/whynot_exclusive/" },
          /* TODO: reemplazar el "#" cuando me pases la URL del Canal de WhatsApp. */
          { type: "whatsapp-channel", display: "Canal WhatsApp",      url: "#" },
        ],
      },
      {
        id:    ".003 CABA",
        label: "¿Sos de CABA o GBA?",
        copy:  "Los envíos son en el día. Y SÍ, podés abonar TODO al recibir. Contactate con nosotros para coordinarlo.",
      },
      {
        id:    ".004 ARGENTINA",
        label: "¡Llegamos a TODO Argentina!",
        copy:  "De la mano de OCA y Correo Argentino despachamos tu pedido a cualquier parte del país. Entrega de 2 a 3 días hábiles (excepción Tierra del Fuego: 5 a 7 días).",
      },
      {
        id:    ".005 DUDAS",
        label: "¿Tenés dudas?",
        copy:  "Contactate con un asesor de ventas. Podés pedir un video umboxing del producto antes de la compra.",
        channels: [
          { type: "whatsapp",  display: "Chat WhatsApp",     url: "https://wa.me/5491176295915" },
          { type: "instagram", display: "@whynot_exclusive", url: "https://www.instagram.com/whynot_exclusive/" },
        ],
      },
    ] as Pillar[],

    /* Cierre: despues del ultimo pilar, el mono dorado solo y centrado
       con una frase grande abajo. Funciona como sello/firma de la
       seccion completa. */
    closing: {
      phrase: "¡Estamos para ayudarte a encontrar tu mejor DROP!",
    },
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
