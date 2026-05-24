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

import { useRef, useEffect, useState, useCallback } from "react";
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
import { useRouter } from "next/navigation";
import { site } from "@/data/site";
import { HERO_SPECS, resolveHeroSpec, type CatalogEntry } from "@/data/catalog";
import { Scanlines, CursorGlow } from "@/components/CatalogAtmosphere";
import CommandPalette from "@/components/CommandPalette";

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
  const brand = entry?.brand ?? "—";
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

/* ---------------- LAYOUT ---------------- */
const CIRCLE_SIZE = 340;  // diámetro de la cápsula activa (px)
const SPACING = 290;      // distancia entre centros — overlap suave (~50px)
const SIDE_SCALE = 0.48;  // off=±1 — bastante más chicas (deja respirar al activo)
const OUTER_SCALE = 0.32; // off=±2
const FADE_START = 1.7;
const FADE_END = 2.5;

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
function scaleForOffset(off: number) {
  const a = Math.abs(off);
  if (a <= 1) return 1 - (1 - SIDE_SCALE) * a;
  if (a <= 2) return SIDE_SCALE - (SIDE_SCALE - OUTER_SCALE) * (a - 1);
  return OUTER_SCALE;
}
function opacityForOffset(off: number) {
  const a = Math.abs(off);
  if (a <= FADE_START) return 1;
  if (a >= FADE_END) return 0;
  return 1 - (a - FADE_START) / (FADE_END - FADE_START);
}

/* ============================================================================ */
export default function PastDrop() {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /* ---------- Command palette (search global) ---------- */
  const [searchOpen, setSearchOpen] = useState(false);
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

  /* ---------- Scroll → posición continua ---------- */
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });
  const scrollPosition = useTransform(scrollYProgress, [0, 1], [0, N]);

  /* ---------- Drag offset ---------- */
  const dragOffset = useMotionValue(0);

  /* ---------- Posición combinada ---------- */
  const targetPosition = useMotionValue(0);
  useMotionValueEvent(scrollPosition, "change", (v) => {
    targetPosition.set(v + dragOffset.get());
  });
  useMotionValueEvent(dragOffset, "change", (v) => {
    targetPosition.set(scrollPosition.get() + v);
  });
  const position = useSpring(targetPosition, {
    stiffness: 78, damping: 26, mass: 1,
  });

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

  /* ---------- Drag handlers (con disambiguación click vs drag) ----------
     Si el puntero se movió más de DRAG_THRESHOLD_PX entre down y up → fue
     drag → no navegar. Si fue click puro → navegar al href del activo.    */
  /* Threshold pixel para distinguir tap de swipe. En mobile, los dedos
     mueven al menos 3-4px sin querer. Bajamos de 8 a 4 para que el swipe
     se detecte temprano y NO se interprete como click → asi se puede
     deslizar para cambiar de specimen en lugar de abrir el catalogo.    */
  const DRAG_THRESHOLD_PX = 4;
  const dragRef = useRef<{
    startX: number;
    baseOffset: number;
    didDrag: boolean;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        baseOffset: dragOffset.get(),
        didDrag: false,
      };
    },
    [dragOffset]
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      if (Math.abs(dx) > DRAG_THRESHOLD_PX) dragRef.current.didDrag = true;
      dragOffset.set(dragRef.current.baseOffset - dx / SPACING);
    },
    [dragOffset]
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragRef.current) return;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      const didDrag = dragRef.current.didDrag;
      dragRef.current = null;
      if (!didDrag) {
        const href = SPECS[lastIdxRef.current]?.href;
        if (href) router.push(href);
      }
    },
    [router]
  );

  /* ---------- Advance by ±1 specimen ----------
     Calcula el TARGET DESEADO (round(current) + delta), y ajusta dragOffset
     para que targetPosition se mueva ahí. El spring se encarga de la
     animación smooth y los capsule transforms reaccionan vía useTransform. */
  const advance = useCallback(
    (delta: 1 | -1) => {
      const currentTarget = targetPosition.get();
      const newTarget = Math.round(currentTarget) + delta;
      dragOffset.set(newTarget - scrollPosition.get());
    },
    [targetPosition, dragOffset, scrollPosition]
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

  /* ---------- Video play/pause ---------- */
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === activeIndex) v.play().catch(() => {});
      else v.pause();
    });
  }, [activeIndex]);
  const onLoadedMetadata = (el: HTMLVideoElement | null) => {
    if (el && el.currentTime === 0) el.currentTime = 0.05;
  };

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
      style={{
        position: "relative",
        minHeight: "260vh",
        background: "#e0b3f5", // vibrant pink-lavender (mas vivo que el #cdb5f0 anterior)
        color: "#0a0a14",
        overflow: "hidden",
      }}
    >
      {/* ============ STICKY STAGE ============ */}
      <div
        style={{
          position: "sticky",
          top: 0,
          height: "100vh",
          overflow: "hidden",
        }}
      >
        {/* ----- BACKGROUND LAYERS ----- */}
        <BackgroundAurora />
        <BackgroundGrid />
        <BackgroundParticles />

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
        />

        {/* ----- TITLE + EYEBROW ----- */}
        <div
          style={{
            position: "absolute",
            top: "calc(9% - 1cm)", // subido 1cm respecto a top:9% original
            left: 0, right: 0,
            textAlign: "center",
            zIndex: 4,
            padding: "0 var(--container-pad)",
            pointerEvents: "none",
          }}
        >
          <div
            className="system-text"
            style={{
              color: "rgba(10,10,20,0.65)",
              marginBottom: "0.6rem",
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
        </div>

        {/* ----- CAPSULE CAROUSEL STAGE ----- */}
        <div
          ref={stageRef}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            position: "absolute",
            inset: 0,
            cursor: "grab",
            /* touchAction "pan-y": permite que el browser maneje el scroll
               vertical (para que la pagina siga scrolleando con el dedo)
               PERO captura el pan horizontal → nuestros pointerdown/move/up
               disparan limpio cuando el usuario desliza horizontal para
               cambiar de specimen. "none" bloqueaba el scroll vertical
               y ademas en algunos browsers mobile cancelaba el pointer-
               move antes de que el threshold (4px) se cumpliera, asi que
               se interpretaba como tap → ibamos al catalogo en vez de
               cambiar de zapa.                                            */
            touchAction: "pan-y",
            userSelect: "none",
            perspective: "1600px",
            zIndex: 5,
            transform: "translateY(1cm)", // bajado 1cm los circulos de zapas
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
              registerRef={(el) => { videoRefs.current[i] = el; }}
              onLoadedMetadata={onLoadedMetadata}
            />
          ))}
        </div>

        {/* ----- NAV ARROWS (hermanas del stage para no pisar el drag) ----- */}
        <NavArrow direction="left" onClick={() => advance(-1)} />
        <NavArrow direction="right" onClick={() => advance(1)} />

        {/* ----- METADATA PANEL (left) ----- */}
        <MetadataPanel active={active} activeIndex={activeIndex} luminosity={luminosity} />

        {/* ----- PROGRESS TICKS (scrubber visual del archive) ----- */}
        <ProgressTicks activeIndex={activeIndex} position={position} />

        {/* ----- BOTTOM HUD ----- */}
        <HudBottom active={active} coordX={coordX} coordY={coordY} />

        {/* ----- NOISE OVERLAY (grain cinematográfico sobre todo) ----- */}
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
      </div>

      {/* Cursor-reactive glow + scanlines CRT (sobre toda la seccion sticky) */}
      <CursorGlow />
      <Scanlines />

      {/* Command palette overlay (global archive search) */}
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
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

function BackgroundParticles() {
  /* Deterministic spread → mismo render en SSR y CSR */
  const items = Array.from({ length: 22 }).map((_, i) => ({
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
}: {
  active: Spec;
  activeIndex: number;
  onSearchClick?: () => void;
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
        fontSize: "0.7rem",
        letterSpacing: "0.22em",
        textTransform: "uppercase",
        pointerEvents: "none",
      }}
    >
      <div style={{ display: "flex", gap: "1.2rem", alignItems: "center" }}>
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
        <span>D://DATA_CORE / ARCHIVE</span>
        <span style={{ opacity: 0.4 }}>•</span>
        <span style={{ color: "#0a0a14", fontWeight: 600 }}>
          SPEC_{String(activeIndex + 1).padStart(3, "0")}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          gap: "1rem",
          alignItems: "center",
          pointerEvents: "auto",
        }}
      >
        {/* Search trigger glass pill */}
        {onSearchClick && (
          <motion.button
            onClick={onSearchClick}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            aria-label="Open archive search"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.55rem",
              padding: "0.35rem 0.8rem",
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
            }}
          >
            <span style={{ fontSize: "0.85rem", lineHeight: 1 }}>⌖</span>
            <span>SEARCH</span>
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
          </motion.button>
        )}
        <span style={{ opacity: 0.55 }}>{active.spec}</span>
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
        <motion.span>{coordX}</motion.span>
        <span>//</span>
        <motion.span>{coordY}</motion.span>
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
    { label: "BRAND", value: active.brand },
    { label: "YEAR", value: active.year },
    { label: "MATERIAL", value: active.material },
    { label: "DROP CODE", value: active.code },
    { label: "STATUS", value: "ARCHIVED" },
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
            <span style={{ width: 92, color: "rgba(10,10,20,0.55)" }}>LUM</span>
            <motion.span style={{ color: "#0a0a14", fontWeight: 600 }}>{luminosity}</motion.span>
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
};

function Capsule({
  index,
  position,
  spec,
  tiltX,
  tiltY,
  registerRef,
  onLoadedMetadata,
}: CapsuleProps) {
  /* Offset continuo del item respecto al centro (wrap a [-N/2, N/2)). */
  const offset = useTransform(position, (p) => wrapOffset(index - p, N));
  const x = useTransform(offset, (o) => o * SPACING);
  const s = useTransform(offset, scaleForOffset);
  const opacity = useTransform(offset, opacityForOffset);
  const zIndex = useTransform(offset, (o) =>
    Math.round(100 - Math.abs(o) * 10)
  );

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
        width: CIRCLE_SIZE,
        height: CIRCLE_SIZE,
        marginLeft: -CIRCLE_SIZE / 2,
        marginTop: -CIRCLE_SIZE / 2,
        x,
        scaleX: s,
        scaleY: s,
        opacity,
        zIndex,
        rotateX: ax,
        rotateY: ay,
        transformStyle: "preserve-3d",
        willChange: "transform, opacity",
      }}
    >
      {/* ===== Breathing glow detrás del activo — pastel rosado-blanco
              que apoya al activo sobre el lila (en lugar de cosmic dark). */}
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
          animate={{ opacity: [0.55, 0.95, 0.55], scale: [1, 1.06, 1] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: "100%",
            height: "100%",
            background:
              "radial-gradient(circle, rgba(255,250,240,0.55) 0%, rgba(244,220,63,0.18) 40%, transparent 70%)",
            filter: "blur(30px)",
          }}
        />
      </motion.div>

      {/* ===== Orbital ring (dashed, slow rotation 60s) ===== */}
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

      {/* ===== Scanning arc (60° visible, fast rotation 7s) — yellow DICH accent ===== */}
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

      {/* ===== L-corner markers en el bounding-box del círculo ===== */}
      <CornerMarker pos="tl" />
      <CornerMarker pos="tr" />
      <CornerMarker pos="bl" />
      <CornerMarker pos="br" />

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
        {/* ===== Inner white platform (shoe stage) ===== */}
        <div
          style={{
            position: "absolute",
            inset: 10,
            borderRadius: "50%",
            background: "#ffffff",
            overflow: "hidden",
          }}
        >
          <video
            ref={registerRef}
            src={spec.src}
            muted
            loop
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => onLoadedMetadata(e.currentTarget)}
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
          {/* Contact shadow bajo la zapa */}
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
          {/* Scan line vertical que recorre el activo (tinte oscuro suave) */}
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
        </div>
      </div>

      {/* ===== Floating data labels con líneas conectoras (solo en activo) =====
          Posicionadas FUERA del círculo en las 4 esquinas del bounding box,
          extendidas hacia los costados. Cada label tiene una thin connector
          line que apunta hacia el círculo (data-viz minimal aesthetic).        */}
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
        REC
      </FloatingLabel>
      <FloatingLabel pos="tr" opacity={isActive}>
        {spec.year}
      </FloatingLabel>
      <FloatingLabel pos="bl" opacity={isActive}>
        {spec.spec}
      </FloatingLabel>
      <FloatingLabel pos="br" opacity={isActive}>
        <span style={{ color: "#0a0a14", fontWeight: 600 }}>{spec.code}</span>
      </FloatingLabel>

      {/* ===== ENTER prompt (debajo del activo, indica clickeable) ===== */}
      {spec.href && (
        <motion.div
          aria-hidden
          style={{
            position: "absolute",
            bottom: -42,
            left: "50%",
            translateX: "-50%",
            opacity: isActive,
            pointerEvents: "none",
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.62rem",
            letterSpacing: "0.4em",
            color: "#0a0a14",
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
          OPEN {spec.brand} ARCHIVE
        </motion.div>
      )}
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
      aria-label={isLeft ? "Previous specimen" : "Next specimen"}
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
        {isLeft ? "PREV" : "NEXT"}
      </span>
    </motion.button>
  );
}
