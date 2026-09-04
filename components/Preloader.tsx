"use client";

/* ============================================================================
   PRELOADER — liquid glass.
   ----------------------------------------------------------------------------
   Decision de diseno: el logo no se dibuja, se compone. Una lamina de vidrio
   real (blur + saturate + specular highlight en el borde superior) sosteniendo
   el wordmark en tipografia fina con mucho aire. Sin spray, sin particulas de
   canvas, sin logs de boot: eran restos de la plantilla y se veian como un
   crayon rayando la pantalla.

   Decision de carga: solo bloquea lo que se ve en la primera pantalla
   (lib/preloadAssets · CRITICAL_ASSETS). El resto baja en tiempo ocioso una vez
   que la web ya es visible. Antes bloqueaba ~14 MB con un techo de 30 s.

   Contrato que se mantiene: emite `whynot:preloader-hidden` al terminar
   (lo escucha PixelReveal) y aplica el remapeo mobile de los .glb.
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EVENTO_ENTRADA, esPrimeraVisita, marcarEntrada } from "@/lib/entrada";
import {
  CRITICAL_ASSETS,
  fontsReady,
  loadAsset,
  startDeferredPreload,
  withMobileVariants,
  withTimeout,
} from "@/lib/preloadAssets";

/** Piso: evita el flash cuando todo viene de cache. */
const MIN_TIME = 450;
/** Techo duro. Bajo a 2,5 s el 4-sep-2026: sin el GLB de 1 MB en la lista
    critica, lo unico que queda son dos webp de ~40 KB y las fuentes (que ya
    tienen su propio techo de 800 ms). Un techo de 4,5 s era espacio para que
    algo saliera mal, no una espera necesaria. */
const MAX_TIME = 2500;

/* Los chunks de las secciones de abajo NO se piden aca. Importar
   Collections/PastDrop ejecuta su `useGLTF.preload(...)` a module-load, lo que
   dispara la descarga de todos los GLB pesados antes de que el visitante entre
   (medido: 10 MB y 5,7 s). Next ya los parte solos y los carga cuando se
   montan; el calentamiento vive en la capa 2 (startDeferredPreload). */

/** Techo para las webfonts: `fonts.ready` espera a TODAS, incluidas las de
    Google Fonts. Si tardan, se entra igual y el texto reflowea. */
const FONTS_TIMEOUT = 800;

/** El mismo cielo del hero. Desenfocado, es lo que el vidrio refracta. */
const SKY = "/assets/hero/sky-background.webp";

export default function Preloader() {
  const [pct, setPct] = useState(0);
  /* Arranca visible SIEMPRE en el server para no romper la hidratación; el
     efecto lo apaga al instante si ya se entró (ver más abajo). */
  const [visible, setVisible] = useState(true);
  const [skyReady, setSkyReady] = useState(false);
  const reducedRef = useRef(false);

  useEffect(() => {
    /* ── Volver atrás no es entrar de nuevo ──────────────────────────────
       Si el visitante ya pasó por la home en esta pestaña (abrió una zapa y
       volvió con el botón de atrás), el preloader NO se muestra: se apaga en
       el mismo frame y se avisa a PixelReveal para que no quede esperando su
       señal. Antes se re-montaba en cada navegación, tapaba la pantalla y
       daba la sensación de que la web recargaba entera — además de pisarle
       al browser la restauración del scroll, que necesita el contenido
       montado y visible para poder volver a la posición anterior. */
    if (!esPrimeraVisita()) {
      setVisible(false);
      setPct(100);
      /* marcarEntrada() ANTES de emitir: deja la bandera en memoria para el
         que se monte después. El evento solo lo escucha quien ya estaba. */
      marcarEntrada();
      window.dispatchEvent(new CustomEvent(EVENTO_ENTRADA));
      startDeferredPreload();
      return;
    }
    marcarEntrada();

    reducedRef.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const start = performance.now();
    const FONTS_WEIGHT = 60;

    const assets = withMobileVariants(CRITICAL_ASSETS);
    const totalWeight = assets.reduce((s, a) => s + a.weight, 0) + FONTS_WEIGHT;

    let doneWeight = 0;
    let cancelled = false;
    let closed = false;
    let display = 0;
    let lastInt = -1;
    let raf = 0;
    let hard = 0 as unknown as ReturnType<typeof setTimeout>;

    /* El % se acerca al objetivo con lerp para que no salte. Solo se pide
       re-render cuando cambia el entero: ~100 renders en toda la corrida. */
    const tick = () => {
      if (cancelled) return;
      const target = Math.min(100, (doneWeight / totalWeight) * 100);
      display += (target - display) * 0.16;
      const int = Math.round(display);
      if (int !== lastInt) {
        lastInt = int;
        setPct(int);
      }
      if (display < 99.5 || target < 100) raf = requestAnimationFrame(tick);
      else if (lastInt !== 100) setPct(100);
    };
    raf = requestAnimationFrame(tick);

    /* Idempotente a proposito: close() lo pueden llamar los assets Y el techo
       de MAX_TIME. Sin esta guarda corria dos veces y `whynot:preloader-hidden`
       se emitia dos veces — PixelReveal recibia su senal de arranque duplicada
       y la capa 2 se disparaba de nuevo (medido: segundo evento a los 5,7 s
       cuando la pantalla ya estaba libre a los 2,2 s). */
    const close = () => {
      if (cancelled || closed) return;
      closed = true;
      clearTimeout(hard);
      doneWeight = totalWeight;
      setTimeout(() => {
        if (cancelled) return;
        setPct(100);
        setVisible(false);
        setTimeout(() => {
          if (cancelled) return;
          window.dispatchEvent(new CustomEvent(EVENTO_ENTRADA));
          /* Recien ahora arranca la capa 2: la web ya esta en pantalla. */
          startDeferredPreload();
        }, 620);
      }, 260);
    };

    const jobs: Promise<void>[] = assets.map((a) =>
      loadAsset(a).then(() => {
        if (!cancelled) doneWeight += a.weight;
      })
    );
    jobs.push(
      withTimeout(fontsReady(), FONTS_TIMEOUT).then(() => {
        if (!cancelled) doneWeight += FONTS_WEIGHT;
      })
    );

    Promise.all(jobs).then(() => {
      if (cancelled) return;
      setTimeout(close, Math.max(0, MIN_TIME - (performance.now() - start)));
    });

    hard = setTimeout(close, MAX_TIME);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(hard);
    };
  }, []);

  const reduced = reducedRef.current;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="wn-preloader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.2 : 0.62, ease: [0.16, 1, 0.3, 1] }}
          aria-live="polite"
          aria-busy="true"
        >
          {/* El cielo del hero, desenfocado: es lo que el vidrio refracta y
              lo que hace que la entrada al hero no tenga corte. Entra con
              fade cuando termina de bajar; hasta entonces queda el halo. */}
          <img
            className={`wn-sky${skyReady ? " is-ready" : ""}`}
            src={SKY}
            alt=""
            aria-hidden="true"
            decoding="async"
            onLoad={() => setSkyReady(true)}
          />
          <div className="wn-vignette" aria-hidden="true" />

          {/* Halo calido: sostiene el centro antes de que llegue el cielo. */}
          <div className="wn-halo" aria-hidden="true" />

          <motion.div
            className="wn-glass"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.03 }}
            transition={{ duration: reduced ? 0.2 : 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="wn-mark">WHY NOT</p>

            <div
              className="wn-track"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="wn-fill" style={{ transform: `scaleX(${pct / 100})` }} />
            </div>

            <div className="wn-meta">
              <span>Cargando</span>
              <span className="wn-pct">{String(pct).padStart(3, "0")}</span>
            </div>
          </motion.div>

          {/* Grano: una sola capa, sutil, no interactiva. El data-URI va
              inline: dentro de <style jsx> rompe el parser y se pierden las
              reglas que vienen despues (aca era la ultima y no se notaba;
              en Mission se llevo la seccion entera). */}
          <div
            className="wn-grain"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")",
            }}
            aria-hidden="true"
          />

          <style jsx>{`
            /* :global: son motion.div (componentes) y styled-jsx no les pone
               la clase scoped. Sin esto el preloader no era fixed ni tenia
               fondo: se veia como un bloque roto al ir y volver. */
            :global(.wn-preloader) {
              position: fixed;
              inset: 0;
              z-index: 9999;
              display: grid;
              place-items: center;
              /* Nunca negro puro: near-black calido de la paleta. */
              background: var(--color-bg, #0a0908);
              padding: 24px;
            }

            /* --- cielo desenfocado -------------------------------------- */
            .wn-sky {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              /* scale para que el blur no descubra los bordes */
              transform: scale(1.16);
              filter: blur(58px) saturate(125%) brightness(0.62);
              opacity: 0;
              transition: opacity 900ms cubic-bezier(0.16, 1, 0.3, 1);
            }
            .wn-sky.is-ready {
              opacity: 0.62;
            }

            /* Vineta: cierra los bordes y deja respirar el centro. */
            .wn-vignette {
              position: absolute;
              inset: 0;
              background: radial-gradient(
                78% 62% at 50% 50%,
                transparent 0%,
                rgba(10, 9, 8, 0.55) 62%,
                rgba(10, 9, 8, 0.9) 100%
              );
            }

            /* --- halo --------------------------------------------------- */
            .wn-halo {
              position: absolute;
              inset: 0;
              background: radial-gradient(
                46% 30% at 50% 50%,
                rgba(201, 173, 107, 0.15) 0%,
                rgba(201, 173, 107, 0.04) 46%,
                transparent 72%
              );
              animation: wn-breathe 5.5s ease-in-out infinite;
            }
            @keyframes wn-breathe {
              0%,
              100% {
                opacity: 0.72;
              }
              50% {
                opacity: 1;
              }
            }

            /* --- la lamina de vidrio ------------------------------------ */
            :global(.wn-glass) {
              position: relative;
              width: min(420px, 100%);
              padding: 38px clamp(24px, 7vw, 44px) 26px;
              border-radius: 26px;
              background: rgba(243, 236, 225, 0.045);
              backdrop-filter: blur(22px) saturate(180%);
              -webkit-backdrop-filter: blur(22px) saturate(180%);
              border: 1px solid rgba(243, 236, 225, 0.1);
              box-shadow: 0 24px 70px -30px rgba(0, 0, 0, 0.9),
                inset 0 1px 0 rgba(243, 236, 225, 0.16);
            }
            /* Specular highlight: el reflejo del borde superior. Es el detalle
               que separa "vidrio" de "div con blur". */
            :global(.wn-glass)::before {
              content: "";
              position: absolute;
              inset: 0;
              border-radius: inherit;
              padding: 1px;
              background: linear-gradient(
                160deg,
                rgba(243, 236, 225, 0.34) 0%,
                rgba(243, 236, 225, 0.04) 34%,
                transparent 62%
              );
              -webkit-mask: linear-gradient(#000 0 0) content-box,
                linear-gradient(#000 0 0);
              -webkit-mask-composite: xor;
              mask-composite: exclude;
              pointer-events: none;
            }

            /* --- wordmark ----------------------------------------------- */
            .wn-mark {
              margin: 0 0 30px;
              text-align: center;
              font-family: var(--font-body, "Helvetica Neue", system-ui, sans-serif);
              font-weight: 200;
              font-size: clamp(1.05rem, 4.4vw, 1.42rem);
              letter-spacing: 0.42em;
              /* el tracking agrega aire a la derecha: se compensa */
              text-indent: 0.42em;
              color: var(--color-fg, #f3ece1);
              opacity: 0.94;
            }

            /* --- progreso ----------------------------------------------- */
            .wn-track {
              position: relative;
              height: 1px;
              width: 100%;
              background: rgba(243, 236, 225, 0.12);
              overflow: hidden;
            }
            .wn-fill {
              position: absolute;
              inset: 0;
              transform-origin: left center;
              background: linear-gradient(
                90deg,
                rgba(201, 173, 107, 0.5) 0%,
                var(--color-gold-soft, #c9ad6b) 100%
              );
              box-shadow: 0 0 10px rgba(201, 173, 107, 0.5);
              transition: transform 420ms cubic-bezier(0.16, 1, 0.3, 1);
            }

            /* --- pie ---------------------------------------------------- */
            .wn-meta {
              display: flex;
              align-items: baseline;
              justify-content: space-between;
              margin-top: 12px;
              font-family: var(--font-mono, ui-monospace, monospace);
              font-size: 0.62rem;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: var(--color-muted, #6e6155);
            }
            .wn-pct {
              font-variant-numeric: tabular-nums;
              color: var(--color-gold-soft, #c9ad6b);
            }

            /* --- grano -------------------------------------------------- */
            .wn-grain {
              position: absolute;
              inset: 0;
              pointer-events: none;
              opacity: 0.035;
            }

            @media (prefers-reduced-motion: reduce) {
              .wn-halo {
                animation: none;
              }
              .wn-fill {
                transition: none;
              }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
