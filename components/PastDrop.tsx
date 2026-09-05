"use client";

/* ============================================================================
   PAST DROP — DICH ARCHIVE / SPECIMEN MODE
   ----------------------------------------------------------------------------
   Cinematic premium-futurism showroom para los videos 360 con fondo blanco.
   Cada zapa = "specimen" en una cápsula glassmórfica con marcadores técnicos
   y scan line. La capa blanca del video se vuelve la plataforma de exhibición.

   Layers (z bottom → top):
     0  BackgroundAurora  — gradientes radiales animados (violeta + magenta + ámbar)
     0  BackgroundGrid    — grid técnico tenue con mask radial
     1  BackgroundParticles — 22 puntos flotantes ámbar
     1  Giant brand text  — nombre de la marca activa, serif italic, opacity 0.08
     4  Title             — "Past Drop" + eyebrow
     5  Capsule carousel  — cápsulas con tilt 3D reactivo al cursor
     8  Metadata panel    — BRAND/YEAR/MATERIAL/CODE/STATUS/LUM live
    10  HUD top+bottom    — SPEC_NNN, pulse dot, coords X//Y reactivas
   ============================================================================ */

import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionValueEvent,
  AnimatePresence,
  MotionValue,
} from "framer-motion";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { site } from "@/data/site";
import { HERO_SPECS, resolveHeroSpec, type CatalogEntry } from "@/data/catalog";
import { Scanlines, CursorGlow } from "@/components/CatalogAtmosphere";
/* ── El buscador se descarga cuando se ABRE (4-sep-2026) ────────────────
   Estaba importado estatico, o sea que su chunk viajaba con el de PastDrop
   aunque el visitante no lo abriera nunca — y arrastra getAllEntries(), las
   280 entradas del catalogo. Juani: "ese buscador siento que relentiza
   mucho la web". Tenia razon: se pagaba siempre y se usaba casi nunca.
   Con dynamic + el gate de abajo, quien no busca no lo baja. */
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), {
  ssr: false,
  loading: () => null,
});
import BrandModelFilter from "@/components/BrandModelFilter";
import { useIsMobile } from "@/components/useIsMobile";

/* ---------------- METADATA ----------------
   Cada Spec se construye a partir de un HeroSpec (video + path canonico al
   catalogo) + la CatalogEntry resuelta. Así cada cápsula muestra datos reales
   del catálogo (frames disponibles, marca/modelo/colorway exactos) y, al
   clickearla, navegamos a la página del producto.                              */
type Spec = {
  src: string;
  label: string;
  brand: string;
  model: string;
  colorway: string;
  year: string;          // sintetizado por brand (placeholder editorial)
  material: string;      // sintetizado por brand (placeholder editorial)
  code: string;          // sintetizado por brand+model+colorway
  spec: string;          // sintetizado por brand+index
  href: string | null;   // ruta del producto en este Next app (null si no existe)
  entry: CatalogEntry | null;
};

/* Editorial fillers para que el HUD siga teniendo "metadata premium" hasta
   que tengamos campos reales (year/material/sku) en el index del catálogo. */
const BRAND_FALLBACKS: Record<string, { year: string; material: string }> = {
  "LOUIS VUITTON":  { year: "2024", material: "MONOGRAM DENIM" },
  "ADIDAS x BAPE":  { year: "2023", material: "CAMO LEATHER" },
  "AMIRI":          { year: "2024", material: "TECH CANVAS" },
  "ASICS":          { year: "2023", material: "MESH × GEL" },
  "BALENCIAGA":     { year: "2022", material: "MULTI-PANEL" },
  "BAPE":           { year: "2024", material: "PATENT LEATHER" },
  "JORDAN":         { year: "2023", material: "PREMIUM LEATHER" },
  "LANVIN":         { year: "2024", material: "SUEDE × CALFSKIN" },
  "NIKE":           { year: "2024", material: "TUMBLED LEATHER" },
  "OFF WHITE":      { year: "2022", material: "MIXED MEDIA" },
  "PUMA LE FRANCE": { year: "2024", material: "SUEDE" },
  "SB DUNK":        { year: "2024", material: "PREMIUM SUEDE" },
  "TIMBERLAND":     { year: "2023", material: "PREMIUM NUBUCK" },
};

function buildSpec(hs: typeof HERO_SPECS[number], i: number): Spec {
  const resolved = resolveHeroSpec(hs);
  const entry = resolved.entry;
  /* displayBrand permite overridear el brand del catalogo para el HUD
     (ej: Jordan Tatum vive bajo "NIKE" en el catalogo pero queremos
     mostrarlo como "JORDAN" en el carrusel). El click sigue navegando
     al catalogPath original — esto es solo cosmetic display.            */
  const brand = hs.displayBrand ?? entry?.brand ?? "—";
  const model = entry?.model ?? "";
  const colorway = entry?.colorway ?? "";
  const fb = BRAND_FALLBACKS[brand] ?? { year: "—", material: "—" };
  const codeShort = (brand.replace(/[^A-Z]/g, "").slice(0, 3) || "DCH")
    .padEnd(3, "X");
  const code = `${codeShort}.${String(i + 1).padStart(3, "0")}`;
  const spec = `SPEC-${String(i + 1).padStart(3, "0")}-${codeShort}`;
  /* Click en una cápsula del hero → abre el CATÁLOGO DE LA MARCA completa
     (todos los modelos + colorways de esa marca). Para ver el colorway
     individual con visor 360, el usuario clickea desde la brand page.       */
  const href = entry ? `/catalog/${entry.slug.brand}` : null;
  return {
    src: hs.src,
    label: hs.label,
    brand,
    model,
    colorway,
    year: fb.year,
    material: fb.material,
    code,
    spec,
    href,
    entry,
  };
}

const SPECS: Spec[] = HERO_SPECS.map(buildSpec);
const N = SPECS.length;

/* ---------------- LAYOUT ----------------
   Dos perfiles: desktop (mas grande, overlap suave entre vecinos para
   sensacion de "profundidad") y mobile (mas chico, vecinos claramente
   separados del activo para que un tap accidental sobre el vecino sea
   imposible y el swipe se sienta natural). El factor critico es la
   relacion SPACING/CIRCLE_SIZE — desktop 0.85 (overlap), mobile 1.18
   (gap real entre vecinos).                                            */
type Layout = {
  CIRCLE_SIZE: number;
  SPACING: number;
  SIDE_SCALE: number;
  OUTER_SCALE: number;
  FADE_START: number;
  FADE_END: number;
  DRAG_THRESHOLD_PX: number;
  /* Solo renderizamos el <video> y decoraciones pesadas de las capsulas
     dentro de esta distancia del activo. El resto = disco blanco vacio.
     Evita tener 14 <video> + 14 SVG ring + 14 scanning arc animandose
     todo el tiempo en mobile.                                          */
  VIDEO_RENDER_RANGE: number;
};

const LAYOUT_DESKTOP: Layout = {
  CIRCLE_SIZE: 340,
  SPACING: 290,
  SIDE_SCALE: 0.48,
  OUTER_SCALE: 0.32,
  FADE_START: 1.7,
  FADE_END: 2.5,
  DRAG_THRESHOLD_PX: 4,
  VIDEO_RENDER_RANGE: 3,
};

const LAYOUT_MOBILE: Layout = {
  CIRCLE_SIZE: 220,
  SPACING: 185,   // overlap leve (~84%) — circulos mas juntos en mobile
  SIDE_SCALE: 0.42,
  OUTER_SCALE: 0.22,
  FADE_START: 1.2,
  FADE_END: 2.0,
  DRAG_THRESHOLD_PX: 10, // mas tolerante: el dedo se mueve sin querer
  VIDEO_RENDER_RANGE: 2, // solo 5 videos vivos a la vez
};

const GOLD = "#e8c468";   // ámbar pálido — el accent del sistema
const GOLD_DIM = "rgba(232,196,104,0.55)";

/* Noise SVG inline para el overlay cinematográfico (grain sutil sobre todo) */
const NOISE_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

/* ---------------- HELPERS ---------------- */
function wrapOffset(raw: number, total: number) {
  let o = raw % total;
  if (o > total / 2) o -= total;
  if (o < -total / 2) o += total;
  return o;
}
function makeScaleForOffset(L: Layout) {
  return (off: number) => {
    const a = Math.abs(off);
    if (a <= 1) return 1 - (1 - L.SIDE_SCALE) * a;
    if (a <= 2) return L.SIDE_SCALE - (L.SIDE_SCALE - L.OUTER_SCALE) * (a - 1);
    return L.OUTER_SCALE;
  };
}
function makeOpacityForOffset(L: Layout) {
  return (off: number) => {
    const a = Math.abs(off);
    if (a <= L.FADE_START) return 1;
    if (a >= L.FADE_END) return 0;
    return 1 - (a - L.FADE_START) / (L.FADE_END - L.FADE_START);
  };
}

/* ============================================================================ */
export default function PastDrop() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /* Layout responsive: mobile usa circulos mas chicos, vecinos separados
     del activo, y threshold de drag mas alto para que el dedo se pueda
     mover sin que se interprete como tap.                              */
  const isMobile = useIsMobile();
  const L = isMobile ? LAYOUT_MOBILE : LAYOUT_DESKTOP;
  const scaleForOffset = useMemo(() => makeScaleForOffset(L), [L]);
  const opacityForOffset = useMemo(() => makeOpacityForOffset(L), [L]);

  /* ---------- Command palette (search global) ---------- */
  const [searchOpen, setSearchOpen] = useState(false);
  /* Una vez abierto queda montado: si lo desmontaramos al cerrar se perderia
     su animacion de salida, y el chunk ya esta en cache igual. */
  const [buscadorUsado, setBuscadorUsado] = useState(false);
  useEffect(() => {
    if (searchOpen) setBuscadorUsado(true);
  }, [searchOpen]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------- Posición continua ----------
     Antes en MOBILE el scroll vertical del browser driveaba el carrusel
     (seccion 180vh con 80vh de "track"). El usuario reporto que mientras
     bajaba normalmente las capsulas "giraban como locas". Ahora el
     scroll no participa en NINGUN modo — solo gestos horizontales
     (swipe en mobile, drag/flechas en desktop) mueven el carrusel.

     Mantengo `useScroll` declarado (no se llama en effects ni en JSX)
     por si en el futuro queremos progress de scroll para otras cosas
     (ej: HUD fading). El listener `scrollPosition.change` esta sacado.   */
  const { scrollYProgress: _scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  /* ---------- Drag offset ---------- */
  const dragOffset = useMotionValue(0);

  /* ---------- Posición combinada ----------
     targetPosition = dragOffset directo en AMBOS modos (mobile y desktop).
     El spring se encarga del easing.                                     */
  const targetPosition = useMotionValue(0);
  useMotionValueEvent(dragOffset, "change", (v) => {
    targetPosition.set(v);
  });
  /* Spring: en mobile bajamos stiffness y subimos damping. Resultado:
     menos bounce al scrollear hacia atras rapido (el sintoma que reportaba
     el usuario, "se traba cuando voy para atras" venia del rebote del
     spring chocando con el cambio de scrollProgress). Desktop mantiene los
     valores snappy originales.                                            */
  const position = useSpring(targetPosition, isMobile
    ? { stiffness: 55, damping: 34, mass: 1 }
    : { stiffness: 78, damping: 26, mass: 1 });

  /* ---------- Active index ---------- */
  const [activeIndex, setActiveIndex] = useState(0);
  const lastIdxRef = useRef(0);
  useMotionValueEvent(position, "change", (v) => {
    const idx = ((Math.round(v) % N) + N) % N;
    if (idx !== lastIdxRef.current) {
      lastIdxRef.current = idx;
      setActiveIndex(idx);
    }
  });

  /* ---------- Mouse tilt (3D parallax sobre la cápsula activa) ---------- */
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const mouseXSpring = useSpring(mouseX, { stiffness: 55, damping: 14 });
  const mouseYSpring = useSpring(mouseY, { stiffness: 55, damping: 14 });
  const tiltX = useTransform(mouseYSpring, [-0.5, 0.5], [7, -7]);   // pitch
  const tiltY = useTransform(mouseXSpring, [-0.5, 0.5], [-11, 11]); // yaw

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  }, [mouseX, mouseY]);
  const onMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  /* ---------- Gesture state machine (tap vs hswipe vs vscroll) ----------
     Intent explícito por puntero. Mientras es "unknown" no movemos el
     carrusel — solo decidimos en cuanto la distancia supera NOISE_PX:
       angle > ~50° (|dy| > |dx|*1.2)  → "vscroll": soltamos el pointer
                                          capture para que el browser haga
                                          scroll nativo limpio. Nunca
                                          navegamos en pointer-up.
       angle <= ~50°                    → "hswipe": empezamos a driver el
                                          dragOffset. Nunca navegamos en up.
     Si nunca cruzamos NOISE_PX y el up llega rapido (<700ms) y el dedo
     cayo sobre el activo → "tap" → navegamos.

     Porque arregla el bug:
       Antes, scrollear vertical no cambiaba "didDrag" y el pointer-up
       caia en "!didDrag && landedOnActive" → router.push → catalogo
       fantasma. Ahora ese caso queda marcado como intent="vscroll" y el
       up NO navega.
     Tambien:
       pointercancel (el browser tomo el scroll nativo) entra en la misma
       rama que vscroll y nunca navega — antes lo trataba como pointer-up
       y abria catalogo. */

  type Intent = "unknown" | "hswipe" | "vscroll";
  const NOISE_PX = 6;       // distancia minima para clasificar el gesto
  const TAP_PX = 8;         // limite de movimiento para considerar tap
  const TAP_MS_MAX = 700;   // limite temporal para considerar tap

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTime: number;
    baseOffset: number;
    landedOnActive: boolean;
    intent: Intent;
    captured: boolean;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignorar botones de mouse no-primarios (right/middle) en desktop
      if (e.pointerType === "mouse" && e.button !== 0) return;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const distFromCenter = Math.abs(e.clientX - cx);
      const landedOnActive = distFromCenter <= L.CIRCLE_SIZE / 2;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTime: performance.now(),
        baseOffset: dragOffset.get(),
        landedOnActive,
        intent: "unknown",
        captured: true,
      };
    },
    [dragOffset, L.CIRCLE_SIZE]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const g = dragRef.current;
      if (!g || e.pointerId !== g.pointerId) return;

      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;

      if (g.intent === "vscroll") return; // soltamos el control al browser

      if (g.intent === "unknown") {
        const dist = Math.hypot(dx, dy);
        if (dist < NOISE_PX) return; // todavia ambiguo
        // Decidir por angulo: vertical-leaning => scroll
        if (Math.abs(dy) > Math.abs(dx) * 1.2) {
          g.intent = "vscroll";
          if (g.captured) {
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(g.pointerId);
            } catch {}
            g.captured = false;
          }
          return;
        }
        g.intent = "hswipe";
      }

      // intent === "hswipe": driver del offset
      dragOffset.set(g.baseOffset - dx / L.SPACING);
    },
    [dragOffset, L.SPACING]
  );

  const finishGesture = useCallback(
    (e: React.PointerEvent, cancelled: boolean) => {
      const g = dragRef.current;
      if (!g || e.pointerId !== g.pointerId) return;
      if (g.captured) {
        try {
          (e.currentTarget as HTMLElement).releasePointerCapture(g.pointerId);
        } catch {}
      }
      const intent = g.intent;
      const totalDist = Math.hypot(
        e.clientX - g.startX,
        e.clientY - g.startY
      );
      const elapsed = performance.now() - g.startTime;
      const landedOnActive = g.landedOnActive;
      dragRef.current = null;

      // Solo navegamos en un tap real:
      //   no cancelado (pointercancel = browser tomo el scroll)
      //   intent quedo "unknown" (nunca cruzamos la zona de ruido)
      //   movimiento total < TAP_PX, duracion < TAP_MS_MAX
      //   y el dedo aterrizo sobre el activo
      if (
        !cancelled &&
        intent === "unknown" &&
        totalDist < TAP_PX &&
        elapsed < TAP_MS_MAX &&
        landedOnActive
      ) {
        const href = SPECS[lastIdxRef.current]?.href;
        if (href) router.push(href);
      }
    },
    [router]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => finishGesture(e, false),
    [finishGesture]
  );
  const onPointerCancel = useCallback(
    (e: React.PointerEvent) => finishGesture(e, true),
    [finishGesture]
  );

  /* ---------- Advance by ±1 specimen ----------
     Calcula el TARGET DESEADO (round(current) + delta), y ajusta dragOffset
     para que targetPosition se mueva ahí. El spring se encarga de la
     animación smooth y los capsule transforms reaccionan vía useTransform.

     IMPORTANTE: en mobile targetPosition = scrollPosition + dragOffset, asi
     que para que targetPosition aterrice en newTarget hay que setear
     dragOffset = newTarget - scrollPosition. En desktop scrollPosition NO
     participa de la formula (ver useMotionValueEvent de dragOffset arriba):
     targetPosition = dragOffset directo. Restar scrollPosition.get() en
     desktop hacia que cuando el usuario estaba scrolleado adentro de la
     seccion (scrollPosition != 0) el spring tuviese que recorrer muchas
     capsulas para llegar al target — el sintoma "gira un monton" reportado
     por el usuario. Ahora cada formula matchea su modo.                    */
  const advance = useCallback(
    (delta: 1 | -1) => {
      const currentTarget = targetPosition.get();
      const newTarget = Math.round(currentTarget) + delta;
      dragOffset.set(newTarget);
    },
    [targetPosition, dragOffset]
  );

  /* ---------- Salto absoluto a un indice (no relativo) ----------
     Usado por el BrandModelFilter: cuando el usuario elige una marca en
     el dropdown, el carrusel rota automaticamente a la primera capsula
     de esa marca. Toma el camino MAS CORTO en el wrap circular (si el
     target esta a 10 de un lado y a 5 del otro, gira solo 5).            */
  const goToIndex = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= N) return;
      const currentTarget = targetPosition.get();
      /* targetPosition no esta wrappeado — busco el equivalente de idx
         mas cercano al currentTarget para que el spring no de la vuelta
         larga. Algoritmo: tomo idx + k*N donde k es el entero que
         minimiza la distancia con currentTarget.                          */
      const k = Math.round((currentTarget - idx) / N);
      const newTarget = idx + k * N;
      dragOffset.set(newTarget);
    },
    [targetPosition, dragOffset]
  );

  /* ---------- Brand -> indice de la primera capsula con esa marca ----
     El dropdown BrandModelFilter lista las marcas de getAllEntries()
     (catalog.brand). Cada Spec tiene entry?.brand (catalog brand) — uso
     ese match para encontrar la capsula. Si una marca tiene multiples
     capsulas (ej: JORDAN con Black Cat + Patent Gold) vamos a la primera. */
  const goToBrand = useCallback(
    (catalogBrand: string) => {
      const idx = SPECS.findIndex((s) => s.entry?.brand === catalogBrand);
      if (idx >= 0) goToIndex(idx);
    },
    [goToIndex]
  );

  /* ---------- Keyboard ← → ----------
     Listener global; ignora si el foco está en un input/textarea/contentEditable.
     PastDrop solo se monta en la home; la colorway page tiene su propio
     listener (en Frame360Viewer) — no se pisan porque son rutas distintas. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        advance(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        advance(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance]);

  /* ---------- Video play/pause ----------
     Triple-trigger para garantizar que el activo SIEMPRE este girando:
     1) useEffect on activeIndex change → play(active), pause(otros)
     2) registerRef on mount → si es el activo, play() apenas el <video>
        existe (cubre el caso first-mount con preload="metadata", donde
        el useEffect inicial puede ganarle al ref).
     3) onLoadedMetadata → retry play si es el activo (cubre autoplay
        policies + bufferings lentos).
     ademas: <video autoPlay/> en el JSX como fallback nativo del browser. */
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const activeIndexRef = useRef(activeIndex);
  activeIndexRef.current = activeIndex;

  /* ── Nada se reproduce fuera de pantalla (4-sep-2026) ─────────────────
     Medido con la pagina quieta y el PastDrop fuera del viewport: seguia
     habiendo un <video> reproduciendose. Decodificar video es trabajo de
     CPU/GPU constante para algo que nadie ve, y se suma al costo de todo
     el scroll. Al volver a entrar, retoma. */
  const enPantallaRef = useRef(true);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([e]) => {
        enPantallaRef.current = e.isIntersecting;
        const vids = el.querySelectorAll("video");
        if (e.isIntersecting) {
          const v = vids[activeIndexRef.current];
          if (v) v.play().catch(() => {});
        } else {
          vids.forEach((v) => v.pause());
        }
      },
      /* Margen 0: con 200px la seccion seguia contando como visible desde
         "Como comprar" (la de al lado) y el video nunca se pausaba. */
      { rootMargin: "0px", threshold: 0 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* Hay CUATRO lugares que llaman play(): el efecto de activeIndex, el
     registro del ref, onLoadedMetadata y el onCanPlay del <video>. Cualquiera
     de ellos revivia el video despues de que el observer lo pausaba (medido:
     LUISVOUITTON.mp4 seguia reproduciendose con la seccion fuera de vista).
     Todos pasan por aca. */
  const reproducir = useCallback((v: HTMLVideoElement | null) => {
    if (!v || !enPantallaRef.current) return;
    v.play().catch(() => {});
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIndex) reproducir(v);
      else v.pause();
    });
  }, [activeIndex, reproducir]);

  const registerVideoRef = useCallback(
    (i: number, el: HTMLVideoElement | null) => {
      videoRefs.current[i] = el;
      if (el && i === activeIndexRef.current) reproducir(el);
    },
    []
  );

  const onLoadedMetadata = useCallback(
    (i: number, el: HTMLVideoElement | null) => {
      if (!el) return;
      if (el.currentTime === 0) el.currentTime = 0.05;
      if (i === activeIndexRef.current) reproducir(el);
    },
    []
  );

  /* ---------- HUD live data ---------- */
  const coordX = useTransform(position, (p) => {
    const n = Math.abs(Math.round(p * 137)) % 10000;
    return `X.${String(n).padStart(4, "0")}`;
  });
  const coordY = useTransform(position, (p) => {
    const n = Math.abs(Math.round(p * 89 + 353)) % 10000;
    return `Y.${String(n).padStart(4, "0")}`;
  });
  const luminosity = useTransform(position, (p) => {
    return (0.5 + Math.sin(p * 0.7) * 0.499).toFixed(3);
  });

  const active = SPECS[activeIndex];

  return (
    <section
      id="section-past-drop"
      ref={sectionRef}
      data-bg-color="#e0b3f5"
      data-text-color="#0a0a14"
      style={{
        position: "relative",
        /* Ambos modos: 100vh. Antes mobile era 180vh (con 80vh de "track"
           para que el scroll vertical drivee el carrusel) — el usuario
           reporto que mientras scrolleaba normal las capsulas "giraban
           como locas". Ahora el carrusel SOLO se mueve con swipe horizontal
           en mobile (drag + flechas en desktop). El scroll vertical pasa
           limpio.                                                          */
        minHeight: "100vh",
        /* background driven por useSectionColor (--page-bg) en lugar de
           hardcoded "#e0b3f5". El data-bg-color de esta seccion es ese
           mismo lila, asi el look no cambia EN la seccion — pero ahora
           el sweep entre PastDrop y secciones vecinas SI se ve.          */
        background: "var(--page-bg)",
        color: "#0a0a14",
        overflow: "hidden",
      }}
    >
      {/* ============ STAGE ============
          Ambos modos: relative 100vh. Sin sticky porque ya no hay scroll
          track que driveear el carrusel — solo swipe/drag.                  */}
      <div
        style={{
          position: "relative",
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* ----- BACKGROUND LAYERS -----
             En mobile cortamos:
              - BackgroundAurora: 2 motion.div con animate continuo de
                32s/26s. CADA frame el browser recalcula los gradients
                radiales blureados (filter:blur(50-70px) es lo mas caro
                que existe en CSS). Apagando esto recupera ~6-10ms/frame.
              - BackgroundParticles: 8 puntos animandose y rebotando
                continuo — extras durante el scroll thrash. */}
        {!isMobile && <BackgroundAurora />}
        <BackgroundGrid />
        {!isMobile && <BackgroundParticles count={22} />}

        {/* ----- GIANT BRAND TEXT BEHIND -----
             Sobre lila: italic oscuro en lugar de white-on-dark. Sin
             mix-blend (que en bg claro lo borraría). Opacity un poco más
             alta para que se lea bien la marca activa.                    */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.brand}
            initial={{ opacity: 0, y: 28, filter: "blur(28px)" }}
            animate={{ opacity: 0.14, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -28, filter: "blur(28px)" }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "absolute",
              left: 0, right: 0,
              top: "30%",
              textAlign: "center",
              fontFamily: "var(--font-marquee)",
              fontSize: "clamp(6rem, 20vw, 20rem)",
              letterSpacing: "0.02em",
              lineHeight: 0.85,
              color: "#0a0a14",
              pointerEvents: "none",
              whiteSpace: "nowrap",
              zIndex: 1,
              userSelect: "none",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            {active.brand}
          </motion.div>
        </AnimatePresence>

        {/* ----- TOP HUD ----- */}
        <HudTop
          active={active}
          activeIndex={activeIndex}
          onSearchClick={() => setSearchOpen(true)}
          isMobile={isMobile}
        />

        {/* ----- TITLE + EYEBROW + BRAND×MODEL FILTER -----
             Wrapper unico para eyebrow / titulo / filtro. Antes el titulo
             estaba absolute (top:9%) y el filtro tambien (top:16%), y en
             mobile se superponian (la D y la P de "DROP" tapaban los pills
             MARCA / MODEL/VAR). Ahora estan en el mismo grid con gap
             responsivo: la separacion vertical sale del flujo natural y se
             mantiene consistente en cualquier viewport.                     */}
        <div
          style={{
            position: "absolute",
            top: "calc(9% - 1cm)", // subido 1cm respecto a top:9% original
            left: 0, right: 0,
            textAlign: "center",
            zIndex: 7, // alto para que el dropdown se superponga a las capsulas
            padding: "0 var(--container-pad)",
            pointerEvents: "none", // children re-habilitan donde corresponde
            display: "grid",
            justifyItems: "center",
            gap: "clamp(0.9rem, 2.4vw, 1.6rem)",
          }}
        >
          <div
            className="system-text"
            style={{
              color: "rgba(10,10,20,0.65)",
              fontSize: "0.72rem",
              letterSpacing: "0.3em",
            }}
          >
            {site.pastDrop.eyebrow}
          </div>
          {/* Titulo "DROP" como imagen — esta pre-renderizado con T-12 real
              (el cliente paso el PNG por ChatGPT, lo procesamos con sharp:
              blanco -> transparente, bbox crop, WebP q95). Asi el titulo
              matchea exacto el look del marquee del Hero sin requerir el
              archivo .otf de Studio Innate ($29). aria-label preserva
              accesibilidad del texto. */}
          <h2
            aria-label={site.pastDrop.title}
            style={{
              margin: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src="/assets/past-drop/drop-title.webp"
              alt=""
              aria-hidden
              draggable={false}
              style={{
                display: "block",
                width: "auto",
                height: "clamp(2.4rem, 6vw, 5rem)",
                userSelect: "none",
              }}
            />
          </h2>

          {/* BRAND × MODEL filter — pills glass debajo del titulo. Click en
              un colorway navega al catalogo del producto. Los dropdowns se
              superponen a las capsulas cuando se abren (zIndex del wrapper).
              onBrandSelect: al elegir marca, el carrusel rota automaticamente
              a la primera capsula de esa marca (UX: el dropdown te abre el
              segundo combo Y mueve la zapa visible al mismo tiempo).         */}
          <BrandModelFilter isMobile={isMobile} onBrandSelect={goToBrand} />
        </div>

        {/* ----- CAPSULE CAROUSEL STAGE ----- */}
        <div
          ref={stageRef}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{
            position: "absolute",
            inset: 0,
            cursor: "grab",
            /* touchAction "pan-y": permite que el browser maneje el scroll
               vertical (para que la pagina siga scrolleando con el dedo)
               PERO nosotros capturamos el pan horizontal via pointerdown/
               move/up. "none" bloqueaba el scroll vertical; sin pan-y, el
               browser cancelaba el pointer-move antes del threshold y se
               interpretaba como tap → navegabamos al catalogo en vez de
               cambiar de zapa. Combinado con la state machine de intent
               (hswipe/vscroll/tap), garantiza scroll vertical limpio y
               click solo en taps reales.                                  */
            touchAction: "pan-y",
            userSelect: "none",
            WebkitUserSelect: "none",
            // iOS: matar el highlight azul + el menu de long-press
            WebkitTapHighlightColor: "transparent",
            WebkitTouchCallout: "none",
            perspective: "1600px",
            zIndex: 5,
            /* Bajamos las capsulas para que NO queden tapadas por las pills
               del filtro BRAND/MODEL que viven en el title block (top ~9%).
               El usuario reporto overlap incluso en desktop con el offset
               anterior (1cm) -> subimos a 2.8cm desktop / 3.4cm mobile.
               Mobile necesita mas porque el viewport es mas corto y las
               pills son proporcionalmente mas grandes.                       */
            transform: isMobile ? "translateY(3.4cm)" : "translateY(2.8cm)",
          }}
        >
          {SPECS.map((spec, i) => (
            <Capsule
              key={spec.src}
              index={i}
              position={position}
              spec={spec}
              tiltX={tiltX}
              tiltY={tiltY}
              registerRef={(el) => registerVideoRef(i, el)}
              onLoadedMetadata={(el) => onLoadedMetadata(i, el)}
              reproducir={reproducir}
              activeIndex={activeIndex}
              layout={L}
              isMobile={isMobile}
              scaleForOffset={scaleForOffset}
              opacityForOffset={opacityForOffset}
            />
          ))}
        </div>

        {/* ----- NAV ARROWS (hermanas del stage para no pisar el drag).
                Mobile las oculta: el swipe es la interaccion natural y los
                arrows se apretujaban con los vecinos en pantallas chicas. */}
        {!isMobile && (
          <>
            <NavArrow direction="left" onClick={() => advance(-1)} />
            <NavArrow direction="right" onClick={() => advance(1)} />
          </>
        )}

        {/* ----- METADATA PANEL (left). Mobile lo oculta — toda esa info ya
                esta en el HUD top + bottom + corner labels del activo;
                apretarla a la izquierda en 375px tapaba al specimen. ----- */}
        {!isMobile && (
          <MetadataPanel active={active} activeIndex={activeIndex} luminosity={luminosity} />
        )}

        {/* ----- PROGRESS TICKS (scrubber visual del archive) ----- */}
        <ProgressTicks activeIndex={activeIndex} position={position} />

        {/* ----- BOTTOM HUD ----- */}
        <HudBottom active={active} coordX={coordX} coordY={coordY} />

        {/* ----- NOISE OVERLAY (grain cinematográfico sobre todo) -----
             mix-blend-mode "multiply" sobre toda la seccion sticky forza
             al compositor a re-blendear cada frame. En mobile lo dropeamos
             — el grain casi no se ve en pantallas pequenas de todos modos. */}
        {!isMobile && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: NOISE_URL,
              backgroundRepeat: "repeat",
              opacity: 0.04,
              mixBlendMode: "multiply",
              pointerEvents: "none",
              zIndex: 12,
            }}
          />
        )}
      </div>

      {/* Cursor-reactive glow + scanlines CRT (sobre toda la seccion sticky).
          En mobile no hay cursor (touch), y las scanlines CRT son un overlay
          full-screen con repeating-linear-gradient + animacion — caro en
          GPU mobile, y casi imperceptible en pantalla chica.                */}
      {!isMobile && <CursorGlow />}
      {!isMobile && <Scanlines />}

      {/* Command palette overlay (global archive search) */}
      {buscadorUsado && (
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      )}
    </section>
  );
}

/* ============================================================================
   PROGRESS TICKS — scrubber visual (15 tick marks) que muestra posición
   en el archive. La activa se ilumina y se agranda. La posición flotante
   (entre dos ticks) se indica con un caret pequeño que se desliza.
   ============================================================================ */
function ProgressTicks({
  activeIndex,
  position,
}: {
  activeIndex: number;
  position: MotionValue<number>;
}) {
  /* Caret posicional: el motion value position determina dónde está el
     "marcador continuo" dentro del array de ticks. */
  const caretX = useTransform(position, (p) => {
    const wrapped = ((p % N) + N) % N;
    /* cada tick ocupa 14px (10 + 4 gap aprox). Total ancho = N*14 - 4 */
    return wrapped * 14;
  });
  return (
    <div
      style={{
        position: "absolute",
        bottom: 70,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 6,
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: 4, position: "relative" }}>
        {Array.from({ length: N }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 2,
              height: i === activeIndex ? 16 : 6,
              background:
                i === activeIndex ? "#0a0a14" : "rgba(10,10,20,0.32)",
              boxShadow:
                i === activeIndex
                  ? "0 0 8px rgba(10,10,20,0.35)"
                  : "none",
              transition: "height 0.4s cubic-bezier(0.16,1,0.3,1), background 0.4s, box-shadow 0.4s",
            }}
          />
        ))}
        {/* Caret continuo (sigue position en vivo) */}
        <motion.div
          style={{
            position: "absolute",
            top: -8,
            left: -3,
            x: caretX,
            width: 8,
            height: 5,
            borderTop: `1px solid #0a0a14`,
            borderLeft: "4px solid transparent",
            borderRight: "4px solid transparent",
            background: "transparent",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================================
   BACKGROUND LAYERS
   ============================================================================ */
function BackgroundAurora() {
  /* Atmósferas suaves para el lila — pastel highlights y un magenta-rosado
     tenue que da profundidad sin oscurecer el fondo. Sin vignette (oscurecía
     los bordes del lila); sin cosmos dark. */
  return (
    <>
      {/* Pastel highlights drift */}
      <motion.div
        aria-hidden
        animate={{ x: [-40, 40, -40], y: [-25, 25, -25] }}
        transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -80,
          background:
            "radial-gradient(circle 700px at 30% 40%, rgba(255,240,255,0.28), transparent 60%)",
          filter: "blur(50px)",
          mixBlendMode: "screen",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
      {/* Magenta-rosado accent drift */}
      <motion.div
        aria-hidden
        animate={{ x: [30, -30, 30], y: [20, -20, 20] }}
        transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
        style={{
          position: "absolute",
          inset: -50,
          background:
            "radial-gradient(circle 500px at 70% 60%, rgba(220,140,200,0.32), transparent 65%)",
          filter: "blur(70px)",
          mixBlendMode: "multiply",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />
    </>
  );
}

function BackgroundGrid() {
  /* Dots oscuros sobre el lila (estilo DICH PAST_DROP). Patrón regular. */
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage:
          "radial-gradient(rgba(10,10,20,0.18) 1px, transparent 1px)",
        backgroundSize: "26px 26px",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}

function BackgroundParticles({ count = 22 }: { count?: number }) {
  /* Deterministic spread → mismo render en SSR y CSR.
     Mobile pasa count=8 (vs 22 desktop) — el bg lila ya tiene movimiento
     suficiente con el aurora, no necesita 22 puntos blureados animados
     tirando GPU.                                                          */
  const items = Array.from({ length: count }).map((_, i) => ({
    left: ((i * 37) % 97) + 1,
    top: ((i * 23) % 95) + 2,
    size: 1 + (i % 3),
    dur: 14 + (i % 9) * 1.8,
    delay: (i % 5) * 0.7,
  }));
  return (
    <>
      {items.map((p, i) => (
        <motion.div
          key={i}
          animate={{
            y: [-14, 14, -14],
            opacity: [0.15, 0.55, 0.15],
          }}
          transition={{
            duration: p.dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay: p.delay,
          }}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: `${p.top}%`,
            width: p.size,
            height: p.size,
            borderRadius: "50%",
            background: "rgba(10,10,20,0.6)",
            boxShadow: "0 0 6px rgba(10,10,20,0.35)",
            pointerEvents: "none",
            zIndex: 1,
          }}
        />
      ))}
    </>
  );
}

/* ============================================================================
   HUD
   ============================================================================ */
function HudTop({
  active,
  activeIndex,
  onSearchClick,
  isMobile,
}: {
  active: Spec;
  activeIndex: number;
  onSearchClick?: () => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        padding: "var(--space-md) var(--container-pad) 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
        color: "rgba(10,10,20,0.7)",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: isMobile ? "0.62rem" : "0.7rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: isMobile ? "0.6rem" : "1.2rem", alignItems: "center" }}>
        <motion.span
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          style={{
            color: "#ff5436",
            fontSize: "0.6rem",
            textShadow: "0 0 8px rgba(255,84,54,0.6)",
          }}
        >
          ●
        </motion.span>
        {/* En mobile "D://DATA_CORE / ARCHIVE • SPEC_NNN" se chocaba con el
            boton de search a la derecha. Mostramos solo el SPEC_NNN. */}
        {!isMobile && <span>WHYNOT / CATALOGO</span>}
        {!isMobile && <span style={{ opacity: 0.4 }}>•</span>}
        <span style={{ color: "#0a0a14", fontWeight: 600 }}>
          MODELO {String(activeIndex + 1).padStart(3, "0")}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: isMobile ? "0.55rem" : "1rem",
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        {/* Search trigger — en mobile, icono solo (sin "SEARCH" ni "⌘K")
            para no quitarle ancho al [01/14] de la derecha. Tap target
            agrandado a 36px minimo. */}
        {onSearchClick && (
          <motion.button
            onClick={onSearchClick}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Abrir buscador del catálogo"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              padding: isMobile ? "0.45rem 0.55rem" : "0.35rem 0.8rem",
              background: "rgba(255,255,255,0.6)",
              border: "1.5px solid #0a0a14",
              borderRadius: 999,
              cursor: "pointer",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.62rem",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#0a0a14",
              fontWeight: 600,
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              boxShadow:
                "0 4px 14px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
              minWidth: isMobile ? 36 : undefined,
              minHeight: isMobile ? 36 : undefined,
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>⌖</span>
            {!isMobile && <span>BUSCAR</span>}
            {!isMobile && (
              <span
                style={{
                  padding: "1px 6px",
                  background: "rgba(244,220,63,0.6)",
                  border: "1px solid #0a0a14",
                  borderRadius: 4,
                  fontSize: "0.52rem",
                  letterSpacing: "0.18em",
                }}
              >
                ⌘K
              </span>
            )}
          </motion.button>
        )}
        {!isMobile && <span style={{ opacity: 0.55 }}>{active.colorway}</span>}
        <span style={{ color: "#0a0a14", fontWeight: 600 }}>
          [{String(activeIndex + 1).padStart(2, "0")}/{String(N).padStart(2, "0")}]
        </span>
      </div>
    </div>
  );
}

function HudBottom({
  active,
  coordX,
  coordY,
}: {
  active: Spec;
  coordX: MotionValue<string>;
  coordY: MotionValue<string>;
}) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: "0 var(--container-pad) var(--space-md)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        zIndex: 10,
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.7rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
        <span style={{ color: "#0a0a14" }}>▸</span>
        <AnimatePresence mode="wait">
          <motion.span
            key={active.label}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(6px)" }}
            transition={{ duration: 0.45 }}
            style={{ color: "#0a0a14", letterSpacing: "0.2em", fontWeight: 600 }}
          >
            {active.label}
          </motion.span>
        </AnimatePresence>
      </div>
      <div style={{ display: "flex", gap: "1rem", color: "rgba(10,10,20,0.65)" }}>
        <motion.span>ENVIOS</motion.span>
        <span>//</span>
        <motion.span>CONTRA ENTREGA</motion.span>
      </div>
    </div>
  );
}

/* ============================================================================
   METADATA PANEL — sidebar inferior izquierda, crossfade en cada cambio
   ============================================================================ */
function MetadataPanel({
  active,
  activeIndex,
  luminosity,
}: {
  active: Spec;
  activeIndex: number;
  luminosity: MotionValue<string>;
}) {
  const rows = [
    { label: "MARCA", value: active.brand },
    { label: "MODELO", value: active.model },
    { label: "COLOR", value: active.colorway },
    { label: "PAGO", value: "CONTRA ENTREGA" },
    { label: "STOCK", value: "CONSULTAR" },
  ];
  return (
    <div
      style={{
        position: "absolute",
        left: "var(--container-pad)",
        bottom: "14%",
        zIndex: 8,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          width: 1,
          height: 32,
          background:
            "linear-gradient(to bottom, transparent, rgba(10,10,20,0.8))",
          marginBottom: "1rem",
        }}
      />
      <AnimatePresence mode="wait">
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 10 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.72rem",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
          }}
        >
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                display: "flex",
                gap: "0.8rem",
                marginBottom: "0.45rem",
              }}
            >
              <span
                style={{
                  width: 92,
                  color: "rgba(10,10,20,0.55)",
                  whiteSpace: "nowrap",
                }}
              >
                {r.label}
              </span>
              <span style={{ color: "#0a0a14", fontWeight: 600 }}>{r.value}</span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              gap: "0.8rem",
              marginTop: "1rem",
              paddingTop: "0.8rem",
              borderTop: "1px solid rgba(10,10,20,0.18)",
            }}
          >
            <span style={{ width: 92, color: "rgba(10,10,20,0.55)" }}>CONSULTAS</span>
            <motion.span style={{ color: "#0a0a14", fontWeight: 600 }}>POR WHATSAPP</motion.span>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ============================================================================
   CAPSULE — un specimen del carrusel
   ============================================================================ */
type CapsuleProps = {
  index: number;
  position: MotionValue<number>;
  spec: Spec;
  tiltX: MotionValue<number>;
  tiltY: MotionValue<number>;
  registerRef: (el: HTMLVideoElement | null) => void;
  onLoadedMetadata: (el: HTMLVideoElement | null) => void;
  /** play() que respeta el viewport — ver `reproducir` en el padre. */
  reproducir: (el: HTMLVideoElement | null) => void;
  activeIndex: number;
  layout: Layout;
  isMobile: boolean;
  scaleForOffset: (off: number) => number;
  opacityForOffset: (off: number) => number;
};

function Capsule({
  index,
  position,
  spec,
  tiltX,
  tiltY,
  registerRef,
  onLoadedMetadata,
  reproducir,
  activeIndex,
  layout,
  isMobile,
  scaleForOffset,
  opacityForOffset,
}: CapsuleProps) {
  /* Offset continuo del item respecto al centro (wrap a [-N/2, N/2)). */
  const offset = useTransform(position, (p) => wrapOffset(index - p, N));
  const x = useTransform(offset, (o) => o * layout.SPACING);
  const s = useTransform(offset, scaleForOffset);
  const opacity = useTransform(offset, opacityForOffset);
  const zIndex = useTransform(offset, (o) =>
    Math.round(100 - Math.abs(o) * 10)
  );

  /* ── Las vecinas se van de FOCO, no solo de opacidad (4-sep-2026) ──────
     Juani: "que quede como el efecto de los relojes de Islas Group o como
     el de las camperas de Diego". Mirando las dos demos de la casa, el
     gesto que comparten no es el movimiento: es como tratan a las piezas
     que NO son la activa. No les bajan la opacidad y listo — les sacan el
     foco (blur), el color (grayscale) y la luz (brightness). El ojo lee una
     vidriera con una pieza iluminada, no una fila de items medio
     transparentes.

     Se calcula sobre el offset continuo, asi que acompaña el dedo mientras
     arrastras en vez de saltar al soltar. El activo devuelve "none": el
     video que se esta mirando no paga ni un filtro.

     El blur es la mitad en mobile. Es la unica parte cara de esto y ya
     sabemos como termina esa historia en un celu. */
  const filtro = useTransform(offset, (o) => {
    const a = Math.min(1, Math.abs(o));
    if (a < 0.08) return "none";
    const desenfoque = (isMobile ? 1.1 : 2.2) * a;
    const gris = 0.55 * a;
    const luz = 1 - 0.3 * a;
    return `blur(${desenfoque.toFixed(2)}px) grayscale(${gris.toFixed(2)}) brightness(${luz.toFixed(2)})`;
  });

  /* Solo renderizamos <video> + decoraciones animadas dentro del rango
     cercano al activo. Las capsulas lejanas son disco blanco vacio. La
     opacity de la capsula igual las hace casi invisibles, asi que el
     usuario no nota la diferencia, pero saltamos N-5 elementos <video>
     simultaneos + N SVGs animandose — ahorro real de GPU en mobile.    */
  const distFromActive = Math.abs(wrapOffset(index - activeIndex, N));
  const renderHeavy = distFromActive <= layout.VIDEO_RENDER_RANGE;

  /* "isActive" continuo: 1 cuando offset ≈ 0, 0 cuando se aleja.
     Manija para el tilt (solo el activo se mueve con el mouse) y para
     mostrar/ocultar los marcadores técnicos de la cápsula activa.       */
  const isActive = useTransform(offset, (o) => {
    const a = Math.abs(o);
    return a < 0.35 ? 1 : Math.max(0, 1 - (a - 0.35) * 2.5);
  });

  /* Tilt aplicado solo al activo: rotate × isActive */
  const ax = useTransform([tiltX, isActive] as MotionValue<number>[], (vs) => {
    const arr = vs as unknown as number[];
    return arr[0] * arr[1];
  });
  const ay = useTransform([tiltY, isActive] as MotionValue<number>[], (vs) => {
    const arr = vs as unknown as number[];
    return arr[0] * arr[1];
  });

  /* Opacity para el orbital ring (multiplicador suave para que no sea full) */
  const orbitalOpacity = useTransform(isActive, (a) => a * 0.55);
  const arcOpacity = useTransform(isActive, (a) => a * 0.9);

  return (
    <motion.div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: layout.CIRCLE_SIZE,
        height: layout.CIRCLE_SIZE,
        marginLeft: -layout.CIRCLE_SIZE / 2,
        marginTop: -layout.CIRCLE_SIZE / 2,
        x,
        scaleX: s,
        scaleY: s,
        opacity,
        filter: filtro,
        zIndex,
        rotateX: ax,
        rotateY: ay,
        transformStyle: "preserve-3d",
        willChange: "transform, opacity",
      }}
    >
      {/* ===== Breathing glow detrás del activo — pastel rosado-blanco
              que apoya al activo sobre el lila (en lugar de cosmic dark).
              En mobile lo dejamos estatico (sin breathing animate). El
              gradient blureado es lo mas caro de pintar; animar scale + opacity
              cada frame en blur(30px) full-quality es el peor combo posible. */}
      <motion.div
        aria-hidden
        style={{
          position: "absolute",
          inset: -80,
          opacity: isActive,
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <motion.div
          animate={isMobile ? undefined : { opacity: [0.55, 0.95, 0.55], scale: [1, 1.06, 1] }}
          transition={isMobile ? undefined : { duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(circle, rgba(255,250,240,0.55) 0%, rgba(244,220,63,0.18) 40%, transparent 70%)",
            filter: isMobile ? "blur(18px)" : "blur(30px)",
          }}
        />
      </motion.div>

      {/* ===== Orbital ring (dashed, slow rotation 60s). Solo cerca del
              activo Y solo en desktop — en mobile el ring se pisa con los
              markers de los vecinos. ===== */}
      {renderHeavy && !isMobile && (
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute",
            inset: -32,
            opacity: orbitalOpacity,
            pointerEvents: "none",
          }}
        >
          <svg viewBox="0 0 400 400" width="100%" height="100%">
            <circle
              cx="200"
              cy="200"
              r="198"
              fill="none"
              stroke="rgba(10,10,20,0.6)"
              strokeWidth="1"
              strokeDasharray="2 8"
            />
          </svg>
        </motion.div>
      )}

      {/* ===== Scanning arc (60° visible, fast rotation 7s) — yellow DICH
              accent. Mismo gating: cerca del activo + solo desktop. ===== */}
      {renderHeavy && !isMobile && (
        <motion.div
          aria-hidden
          animate={{ rotate: 360 }}
          transition={{ duration: 7, repeat: Infinity, ease: "linear" }}
          style={{
            position: "absolute",
            inset: -12,
            opacity: arcOpacity,
            pointerEvents: "none",
          }}
        >
          <svg viewBox="0 0 400 400" width="100%" height="100%">
            <defs>
              <linearGradient id={`arc-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(244,220,63,0)" />
                <stop offset="100%" stopColor="#f4dc3f" />
              </linearGradient>
            </defs>
            <circle
              cx="200"
              cy="200"
              r="196"
              fill="none"
              stroke={`url(#arc-${index})`}
              strokeWidth="2"
              strokeDasharray="200 1060"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
      )}

      {/* ===== L-corner markers en el bounding-box del círculo. Mobile los
              oculta para no apretujarse con el marker del vecino. ===== */}
      {!isMobile && (
        <>
          <CornerMarker pos="tl" />
          <CornerMarker pos="tr" />
          <CornerMarker pos="bl" />
          <CornerMarker pos="br" />
        </>
      )}

      {/* ===== Outer glass capsule (CÍRCULO) — adaptado para lila ===== */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: "#ffffff",
          border: "2px solid #0a0a14",
          boxShadow: `
            0 35px 70px rgba(0,0,0,0.28),
            0 0 30px rgba(10,10,20,0.18),
            inset 0 1px 1px rgba(255,255,255,0.7),
            inset 0 -2px 4px rgba(0,0,0,0.08)
          `,
          overflow: "hidden",
        }}
      >
        {/* ===== Inner white platform (shoe stage). Solo montamos el
                <video> + decoraciones de la zapa en las capsulas cercanas
                al activo (renderHeavy). Las lejanas son disco blanco vacio
                — ya casi no se ven por opacity, asi que el usuario no
                nota, pero saltamos N-5 elementos <video> simultaneos.
                Ademas el preload es por distancia (ver abajo): montar el
                <video> no es lo mismo que descargarlo entero. */}
        <div
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: "50%",
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          {renderHeavy && (
            <video
              ref={registerRef}
              src={spec.src}
              muted
              loop
              playsInline
              /* Solo el activo se baja entero. Los vecinos piden metadata
                 (arrancan al toque cuando les toca) y el resto nada: con
                 preload="auto" en todos se bajaban 7,5 MB de videos antes
                 de que el visitante viera la tienda. */
              preload={
                distFromActive === 0
                  ? "auto"
                  : distFromActive <= 1
                    ? "metadata"
                    : "none"
              }
              onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget)}
              onCanPlay={(e) => {
                /* Safety net: si es el activo y esta pausado, dar play.
                   Cubre el caso de autoplay policy + first-load buffering.
                   No es-activo: deja pausado (eso lo maneja el useEffect). */
                if (index !== activeIndex) return;
                const v = e.currentTarget;
                /* reproducir() respeta el viewport: este era el cuarto punto
                   que revivia el video con la seccion fuera de pantalla. */
                if (v.paused) reproducir(v);
              }}
              onError={(e) => {
                /* Diagnostico de carga del video: log con el src y el codigo
                   de error del MediaError. Asi cuando un cliente reporta
                   "no se ve la zapatilla" podemos ver en console exactamente
                   que .mp4 fallo y por que (red / codec no soportado /
                   bloqueado por cors).                                       */
                const ve = e.currentTarget;
                const err = ve.error;
                console.warn(
                  `[PastDrop] video error en ${spec.src} (idx ${index}): code=${err?.code} msg=${err?.message}`
                );
              }}
              onStalled={() => {
                /* iOS Safari especialmente: a veces el video stallea sin
                   error pero sin avanzar. Log para detectar el patron.     */
                console.warn(
                  `[PastDrop] video stalled en ${spec.src} (idx ${index})`
                );
              }}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transform: "scale(0.85)",
                transformOrigin: "center",
                pointerEvents: "none",
                display: "block",
              }}
            />
          )}
          {/* Contact shadow bajo la zapa — solo cuando hay zapa visible */}
          {renderHeavy && (
            <div
              aria-hidden
              style={{
                position: "absolute",
                bottom: "13%",
                left: "24%",
                right: "24%",
                height: 10,
                background:
                  "radial-gradient(ellipse at center, rgba(0,0,0,0.22), transparent 70%)",
                filter: "blur(5px)",
                pointerEvents: "none",
              }}
            />
          )}
          {/* Scan line vertical solo en activo cercano */}
          {renderHeavy && (
            <motion.div
              aria-hidden
              animate={{ y: ["-30%", "130%"] }}
              transition={{ duration: 6.5, repeat: Infinity, ease: "linear" }}
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                height: 50,
                background:
                  "linear-gradient(180deg, transparent, rgba(10,10,20,0.06), transparent)",
                pointerEvents: "none",
                opacity: isActive,
              }}
            />
          )}
        </div>
      </div>

      {/* ===== Floating data labels con líneas conectoras (solo en activo).
          Mobile las oculta: las etiquetas se posicionaban a -125/-110px
          FUERA del circulo y en una pantalla de 375px desbordaban contra
          los vecinos. Toda esa info ya esta en el HUD top/bottom. ===== */}
      {!isMobile && (
        <>
          <FloatingLabel pos="tl" opacity={isActive}>
            <span style={{ color: "#ff5436", fontSize: "0.5rem" }}>
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.4, repeat: Infinity }}
                style={{ display: "inline-block" }}
              >
                ●
              </motion.span>
            </span>{" "}
            360°
          </FloatingLabel>
          <FloatingLabel pos="tr" opacity={isActive}>
            EXCLUSIVO
          </FloatingLabel>
          <FloatingLabel pos="bl" opacity={isActive}>
            ENVIOS AL PAIS
          </FloatingLabel>
          <FloatingLabel pos="br" opacity={isActive}>
            <span style={{ color: "#0a0a14", fontWeight: 600 }}>WHATSAPP</span>
          </FloatingLabel>
        </>
      )}

      {/* ===== BRAND LABEL en T-12 (debajo de TODA cápsula, no solo activa).
              Activa: brackets [ ] que respiran + chrome gradient en el texto
              + scan-line bajo el nombre. Inactiva: nombre en flat dark con
              opacity baja (queda como tag pasivo). ===== */}
      <BrandLabel
        brand={spec.brand}
        isActive={isActive}
        isMobile={isMobile}
      />

      {/* ===== ENTER prompt (debajo del brand label, solo activo+clickeable) */}
      {spec.href && (
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            bottom: isMobile ? -78 : -96,
            left: "50%",
            translateX: "-50%",
            opacity: isActive,
            pointerEvents: "none",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.58rem",
            letterSpacing: "0.4em",
            color: "rgba(10,10,20,0.7)",
            fontWeight: 600,
            whiteSpace: "nowrap",
            display: "flex",
            gap: "0.6rem",
            alignItems: "center",
          }}
        >
          <motion.span
            animate={{ x: [0, 4, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            ▸
          </motion.span>
          VER TODA LA MARCA
        </motion.div>
      )}
    </motion.div>
  );
}

/* ============================================================================
   BrandLabel — nombre de la marca en T-12, debajo de la cápsula.
   - Inactiva: tipografía en gris-oscuro tenue, brackets pasivos.
   - Activa: brackets [ ] que respiran, chrome gradient sobre el texto,
     scan-line animado debajo. Crea un "name plate" futurista que ancla
     visualmente cada cápsula a su marca.
   ============================================================================ */
function BrandLabel({
  brand,
  isActive,
  isMobile,
}: {
  brand: string;
  isActive: MotionValue<number>;
  isMobile: boolean;
}) {
  /* Opacities derivadas: la marca SIEMPRE visible (mínimo 0.45 incluso
     en cápsulas alejadas), pero los adornos (brackets, scanline, chrome)
     solo aparecen cuando la cápsula se acerca al centro. */
  const baseOpacity = useTransform(isActive, (a) => 0.45 + a * 0.55);
  const ornamentOpacity = useTransform(isActive, (a) => a);

  const size = isMobile ? "0.95rem" : "1.35rem";
  const bracketSize = isMobile ? "1rem" : "1.5rem";
  const bottom = isMobile ? -42 : -56;

  return (
    <motion.div
      aria-hidden
      style={{
        position: "absolute",
        bottom,
        left: "50%",
        translateX: "-50%",
        display: "flex",
        alignItems: "center",
        gap: isMobile ? "0.4rem" : "0.6rem",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        opacity: baseOpacity,
      }}
    >
      {/* Bracket izquierdo — solo activo, respira.
          En mobile no animamos el respiro: 14 capsulas × 2 brackets = 28
          motion values activos que se evaluan cada frame para CSS opacity.
          En estatico la estetica del bracket se conserva.                  */}
      <motion.span
        animate={isMobile ? undefined : { opacity: [0.55, 1, 0.55] }}
        transition={isMobile ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        style={{
          opacity: ornamentOpacity,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: bracketSize,
          fontWeight: 300,
          color: "#0a0a14",
          lineHeight: 1,
          translate: "0 -1px",
        }}
      >
        [
      </motion.span>

      {/* Nombre de la marca en T-12, con stack visual:
          - Capa base: texto plano dark (siempre legible).
          - Capa overlay: gradient cromado (silver→pearl→silver) con
            background-clip text, solo visible en activo.                 */}
      <span
        style={{
          position: "relative",
          fontFamily: "var(--font-marquee)",
          fontSize: size,
          letterSpacing: "0.08em",
          fontWeight: 400,
          color: "#0a0a14",
          lineHeight: 1,
          textTransform: "uppercase",
        }}
      >
        {brand}
        {/* Chrome overlay — solo activo. Mismo glyph encima con gradient.   */}
        <motion.span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            opacity: ornamentOpacity,
            backgroundImage:
              "linear-gradient(180deg, #ffffff 0%, #c8c4cc 45%, #4a4654 75%, #0a0a14 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
            pointerEvents: "none",
          }}
        >
          {brand}
        </motion.span>
        {/* Scan-line debajo del nombre — solo activo, recorre L→R en loop.
            En mobile la dropeamos: es una animacion infinita de transform
            por cada una de las 14 capsulas. La linea base estatica de
            abajo conserva el "underscore" visual.                          */}
        {!isMobile && (
          <motion.span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: -6,
              height: 1,
              opacity: ornamentOpacity,
              overflow: "hidden",
            }}
          >
            <motion.span
              animate={{ x: ["-100%", "100%"] }}
              transition={{
                duration: 3.2,
                repeat: Infinity,
                ease: "linear",
              }}
              style={{
                display: "block",
                width: "60%",
                height: "100%",
                background:
                  "linear-gradient(90deg, transparent, #0a0a14 50%, transparent)",
              }}
            />
          </motion.span>
        )}
        {/* Línea estática base (siempre, muy tenue) bajo el nombre. */}
        <span
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: -6,
            height: 1,
            background: "rgba(10,10,20,0.18)",
            zIndex: -1,
          }}
        />
      </span>

      {/* Bracket derecho — espejo del izquierdo */}
      <motion.span
        animate={isMobile ? undefined : { opacity: [0.55, 1, 0.55] }}
        transition={isMobile ? undefined : { duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1.2 }}
        style={{
          opacity: ornamentOpacity,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: bracketSize,
          fontWeight: 300,
          color: "#0a0a14",
          lineHeight: 1,
          translate: "0 -1px",
        }}
      >
        ]
      </motion.span>
    </motion.div>
  );
}

/* ============================================================================
   FloatingLabel — etiqueta técnica posicionada FUERA del círculo con line
   connector apuntando al círculo (data-viz callout)
   ============================================================================ */
function FloatingLabel({
  pos,
  opacity,
  children,
}: {
  pos: "tl" | "tr" | "bl" | "br";
  opacity: MotionValue<number>;
  children: React.ReactNode;
}) {
  const isLeft = pos === "tl" || pos === "bl";
  const positions: Record<typeof pos, React.CSSProperties> = {
    tl: { top: -2, left: -125 },
    tr: { top: -2, right: -110 },
    bl: { bottom: -2, left: -125 },
    br: { bottom: -2, right: -110 },
  };
  return (
    <motion.div
      style={{
        position: "absolute",
        ...positions[pos],
        display: "flex",
        alignItems: "center",
        gap: "0.55rem",
        opacity,
        pointerEvents: "none",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.58rem",
        letterSpacing: "0.25em",
        color: "rgba(10,10,20,0.75)",
        whiteSpace: "nowrap",
        flexDirection: isLeft ? "row" : "row-reverse",
      }}
    >
      <span>{children}</span>
      <span
        style={{
          width: 28,
          height: 1,
          background:
            "linear-gradient(to right, transparent, rgba(10,10,20,0.7))",
        }}
      />
    </motion.div>
  );
}

function CornerMarker({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const SIZE = 16;
  const base: React.CSSProperties = {
    position: "absolute",
    width: SIZE,
    height: SIZE,
    pointerEvents: "none",
  };
  /* Markers en CORNERS del bounding-box (estilo viewfinder/scope), oscuros. */
  const stroke = `1px solid rgba(10,10,20,0.65)`;
  const styleByPos: Record<typeof pos, React.CSSProperties> = {
    tl: { top: -2, left: -2, borderTop: stroke, borderLeft: stroke },
    tr: { top: -2, right: -2, borderTop: stroke, borderRight: stroke },
    bl: { bottom: -2, left: -2, borderBottom: stroke, borderLeft: stroke },
    br: { bottom: -2, right: -2, borderBottom: stroke, borderRight: stroke },
  };
  return <div aria-hidden style={{ ...base, ...styleByPos[pos] }} />;
}

/* ============================================================================
   NavArrow — botón futurista para avanzar/retroceder el carrusel
   ----------------------------------------------------------------------------
   - Glass blur background + borde ámbar + glow ámbar exterior
   - Chevron SVG con stroke fino (1.5px) estilo techwear
   - PREV/NEXT label microtipografía mono debajo del botón
   - Posicionado como hermano del stage (no dentro) → no pisa el drag handler
   - hover: scale 1.06 + glow más fuerte; tap: scale 0.94
   ============================================================================ */
function NavArrow({
  direction,
  onClick,
}: {
  direction: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = direction === "left";
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      aria-label={isLeft ? "Anterior" : "Siguiente"}
      style={{
        position: "absolute",
        top: "50%",
        [isLeft ? "left" : "right"]: "2.5rem",
        transform: "translateY(-50%)",
        width: 60,
        height: 60,
        borderRadius: "50%",
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: "1.5px solid #0a0a14",
        boxShadow:
          "0 0 30px rgba(255,255,255,0.4), 0 12px 26px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.85), inset 0 -2px 4px rgba(0,0,0,0.08)",
        cursor: "pointer",
        color: "#0a0a14",
        display: "grid",
        placeItems: "center",
        zIndex: 8,
        pointerEvents: "auto",
        padding: 0,
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d={isLeft ? "M15 5 L8 12 L15 19" : "M9 5 L16 12 L9 19"}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {/* Micro-tipo abajo del botón */}
      <span
        style={{
          position: "absolute",
          top: "calc(100% + 10px)",
          left: "50%",
          transform: "translateX(-50%)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.55rem",
          letterSpacing: "0.35em",
          color: "rgba(10,10,20,0.7)",
          whiteSpace: "nowrap",
          pointerEvents: "none",
          fontWeight: 600,
        }}
      >
        {isLeft ? "ANTERIOR" : "SIGUIENTE"}
      </span>
    </motion.button>
  );
}
