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
  EVENTO_HERO_LISTO,
} from "@/lib/preloadAssets";

/** ── Cuánto dura la entrada (4-sep-2026) ─────────────────────────────────
    450 ms era un piso "por si acaso": lo justo para que no parpadeara cuando
    todo venía de cache. El problema es que ES lo que pasa siempre — los dos
    únicos assets críticos son webp de ~40 KB. Medido en el celu: el intro se
    veía a los 300 ms, ya no estaba a los 1200, y el contador nunca salía de
    "000" porque saltaba de 0 a 100 de una. Juani: "el inicio no figura en
    celu". La animación estaba; no le daban los tiempos para existir.

    Ahora la entrada dura lo que tiene que durar para verse. No es espera
    muerta: es la primera impresión de la marca, y pasa UNA vez por visita
    (volver de una ficha no la repite). */
const MIN_TIME = 1500;
/** Piso de visibilidad DESPUÉS de hidratar: aunque el reloj de la navegación
    ya haya pasado los 1500 ms (celu lento, red mala), la lámina se queda esto
    para que la animación se vea correr en vez de desaparecer al despertar. */
const PISO_VISIBLE = 700;
/** Con prefers-reduced-motion no hay show que valga: se entra y listo. */
const MIN_TIME_REDUCIDO = 450;
/** Techo duro por si algo se cuelga. Tiene que quedar arriba del piso más el
    fundido de salida (260 + 620 ms), si no el techo cortaría la animación. */
/** Techo duro de toda la entrada. Nada la puede estirar más que esto. */
const MAX_TIME = 3800;

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

/** Lo emite en cada cambio del contador, con el porcentaje entero. */
export const EVENTO_PROGRESO = "whynot:progreso";

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
    /* ── La entrada se marca cuando TERMINA, no cuando arranca ────────────
       Estaba acá arriba, y eso apagaba al PixelReveal: ese componente
       pregunta esPrimeraVisita() para saber si le toca, y como el preloader
       corría primero se encontraba la marca ya puesta y no se montaba nunca.
       Medido: 7 eventos de progreso emitidos y 0 celdas en pantalla.

       Marcar al cerrar es además lo correcto por definición: la visita
       "ocurrió" cuando la bienvenida terminó de correr. Si alguien recarga a
       mitad de la carga, la vuelve a ver — que es lo que corresponde, porque
       la primera no llegó a pasar. */

    reducedRef.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const start = performance.now();
    const FONTS_WEIGHT = 60;

    const assets = withMobileVariants(CRITICAL_ASSETS);
    /* ── La carga espera al MONO del hero (5-sep-2026) ────────────────────
       Juani: "aca me queda sin el mono en el inicio cuando entro de PC" y
       "falta el logging de la pagina cargando hasta iniciarse".

       Las dos cosas son la misma. El mono SI carga — medido en produccion:
       tag presente, loaded true, mono.glb 200. Lo que pasaba es que la
       lamina se iba antes que el, asi que quedaba el cielo vacio unos
       segundos y parecia que faltaba. Su captura era, justamente, de la
       pagina todavia cargando.

       Ahora el hero es parte de lo que la entrada espera. El contador llega
       a 100 cuando lo que se va a ver esta de verdad, no cuando bajaron dos
       webp de 40 KB. Eso es lo que hace que una carga se sienta un sistema
       y no un parpadeo.

       Con su propio techo: si el 3D falla, el CDN no responde o el aparato
       no soporta WebGL, se entra igual. Una entrada no puede quedar colgada
       esperando un adorno. */
    const HERO_WEIGHT = 90;
    /* 2,2 s y no más. Con 4,2 la lámina se estiraba a 8 segundos en una
       conexión mala y eso es peor que entrar sin el mono: nadie mira una
       pantalla de carga ocho segundos. El mono es el remate, no el
       contenido — si no llegó a tiempo, entra después y se ve aparecer. */
    const TECHO_HERO = 2200;
    const totalWeight =
      assets.reduce((s, a) => s + a.weight, 0) + FONTS_WEIGHT + HERO_WEIGHT;

    let doneWeight = 0;
    let cancelled = false;
    let closed = false;
    let display = 0;
    let lastInt = -1;
    let raf = 0;
    let hard = 0 as unknown as ReturnType<typeof setTimeout>;

    const minTime = reducedRef.current ? MIN_TIME_REDUCIDO : MIN_TIME;
    /* ── Dos relojes, no uno ─────────────────────────────────────────────
       `start` se toma cuando React hidrata, y en un celu eso puede ser 1,5 s
       después de que el visitante ya está mirando la lámina. Medido: el
       contador quedaba clavado en 000 todo ese rato y recién ahí empezaba a
       correr, con la entrada estirándose a 3 s.

       Así que la rampa del número va contra el reloj de la NAVEGACIÓN (el
       contador ya llega donde tenía que estar y camina lo que falta), y el
       cierre respeta además un piso desde la hidratación: sin eso, en un
       aparato lento la lámina se cerraría en el mismo frame en que despierta
       y no se vería nada — que es el bug original con otro disfraz. */
    const cuandoCerrar = () =>
      Math.max(
        minTime - performance.now(),
        start + PISO_VISIBLE - performance.now(),
        0,
      );

    /* El % se acerca al objetivo con lerp para que no salte. Solo se pide
       re-render cuando cambia el entero: ~100 renders en toda la corrida.

       El objetivo es el MENOR entre lo descargado y lo transcurrido, y esa
       es toda la corrección: antes miraba sólo la descarga, que termina en
       el primer pestañeo, así que el número se quedaba en 000 y de golpe
       desaparecía. Tomando el mínimo, el contador siempre se ve contar —
       y sigue sin poder mentir: no llega a 100 hasta que los assets están
       de verdad, porque entonces manda el otro término. */
    /* El suavizado se mide en TIEMPO, no en frames. `display += d * 0.16` por
       frame parece igual en cualquier lado, pero su velocidad real depende de
       los FPS: a 60 el número llega en medio segundo, a 8 (celu peleando, o
       este mismo verificador con GPU por software) tarda casi cuatro y se ve
       arrastrarse. Medido antes de esto: 038 a los 2,7 s. Con el paso
       normalizado a 16,7 ms la animación dura lo mismo en todos lados. */
    let ultimoFrame = performance.now();
    const tick = () => {
      if (cancelled) return;
      const ahora = performance.now();
      const dt = Math.min(100, ahora - ultimoFrame);
      ultimoFrame = ahora;
      const porAssets = Math.min(100, (doneWeight / totalWeight) * 100);
      const porTiempo = Math.min(100, (ahora / minTime) * 100);
      const target = Math.min(porAssets, porTiempo);
      display += (target - display) * (1 - Math.pow(1 - 0.16, dt / 16.7));
      const int = Math.round(display);
      if (int !== lastInt) {
        lastInt = int;
        setPct(int);
        /* El reveal de píxeles sigue este número: la web se destapa a
           medida que carga, no de golpe al final. Ver PixelReveal. */
        window.dispatchEvent(
          new CustomEvent(EVENTO_PROGRESO, { detail: { pct: int } }),
        );
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
      marcarEntrada();
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
    /* El hero avisa por evento cuando su <model-viewer> termino de cargar
       (ver components/Hero). Si no llega en TECHO_HERO, se sigue igual. */
    jobs.push(
      withTimeout(
        new Promise<void>((resolve) => {
          window.addEventListener(EVENTO_HERO_LISTO, () => resolve(), { once: true });
        }),
        TECHO_HERO,
      ).then(() => {
        if (!cancelled) doneWeight += HERO_WEIGHT;
      })
    );

    Promise.all(jobs).then(() => {
      if (cancelled) return;
      setTimeout(close, cuandoCerrar());
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
          /* ── La salida es un VELO que se desvanece, no una cortina ───────
             Probé con una persiana (clip-path que sube) copiando el gesto de
             Islas Group. En el iPhone de Juani dejaba una LÍNEA horizontal
             gris cruzando la pantalla mientras corría — la fotografió. Es el
             borde del recorte: la lámina tiene cielo desenfocado y viñeta
             encima, así que al cortarla en dos el canto se ve.

             Mirando cómo lo hace Bochile, que es la vara de la casa para una
             entrada: NO tiene cortina. El hero real está detrás desde el ms
             0 y la intro es un velo que se apaga con opacity; el contenido
             se revela en su lugar. No hay ninguna capa que tenga que
             correrse para descubrir el sitio, y por eso nunca hay costura.

             Acá el fondo de la lámina YA es el cielo del hero desenfocado,
             así que apagarla no es "sacar algo del medio": es el mismo cielo
             entrando en foco. Un escalado apenas por debajo de 1 acompaña
             sin dibujar ningún borde. */
          initial={{ opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 1.04 }}
          transition={{ duration: reduced ? 0.2 : 0.7, ease: [0.16, 1, 0.3, 1] }}
          aria-live="polite"
          aria-busy="true"
        >
          {/* El cielo del hero, desenfocado: es lo que el vidrio refracta y
              lo que hace que la entrada al hero no tenga corte. Entra con
              fade cuando termina de bajar; hasta entonces queda el halo. */}
          {/* El cielo desenfocado del preloader se fue: lo que se ve detras
              es el HERO de verdad, destapandose por celdas. Duplicarlo era
              la misma imagen dos veces, una encima de la otra. */}
          <div className="wn-vignette" aria-hidden="true" />

          {/* Halo calido: sostiene el centro antes de que llegue el cielo. */}
          <div className="wn-halo" aria-hidden="true" />

          <motion.div
            className="wn-glass"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            /* ── El contenido se va PRIMERO, y rápido ──────────────────────
               La lámina sale en 0,28 s y el velo en 0,7. Antes los dos
               tardaban lo mismo, y el resultado era el defecto que Juani
               fotografió: el fondo de vidrio es translúcido y sobre el cielo
               claro casi no se ve, pero la BARRA DE PROGRESO es oscura — así
               que a mitad del fundido quedaba una raya gris flotando sola en
               el medio de la pantalla, sin nada alrededor que la explicara.

               Yéndose antes, para cuando el velo empieza a transparentar ya
               no hay nada oscuro que pueda quedar suelto. */
            exit={
              reduced
                ? { opacity: 0 }
                : { opacity: 0, y: -14, scale: 1.02 }
            }
            transition={{
              duration: reduced ? 0.2 : 0.8,
              ease: [0.16, 1, 0.3, 1],
              /* El exit corre su propia carrera, más corta que la entrada. */
              opacity: { duration: reduced ? 0.15 : 0.28, ease: "easeIn" },
              y: { duration: reduced ? 0.15 : 0.34, ease: [0.7, 0, 0.84, 0] },
            }}
          >
            {/* ── El wordmark se ARMA, no aparece (4-sep-2026) ─────────
                Juani: "antes habia un WHY NOT y cargaba como un sistema,
                queria que eso lo dejasemos pro" y "una intro volada cuando
                abrimos, antes que cargue todo".

                Cada letra arranca abajo, tapada, y sube a su lugar con 35 ms
                de diferencia entre una y la otra. Es el gesto de la demo de
                Islas Group, que es la vara de la casa para una entrada: la
                marca no se muestra, se construye delante tuyo.

                Con prefers-reduced-motion aparece entera y listo. */}
            <p className="wn-mark" aria-label="Why Not">
              {"WHY NOT".split("").map((ch, i) => (
                <span className="wn-letra" key={i} aria-hidden="true">
                  <span
                    style={
                      reduced
                        ? undefined
                        : { animationDelay: `${180 + i * 35}ms` }
                    }
                  >
                    {ch === " " ? " " : ch}
                  </span>
                </span>
              ))}
            </p>

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
            /* ── El preloader ya NO tapa la pantalla (5-sep-2026) ────────
               Tenia fondo opaco propio, y eso escondia el reveal de pixeles
               que corre debajo: la grilla se abria detras de una pared y no
               se veia nada. Habia DOS capas de carga superpuestas haciendo
               el mismo trabajo.

               Ahora hay una sola: la grilla de pixeles ES el fondo, y se va
               destapando con el progreso; esta lamina flota encima con el
               nombre y el contador. Lo que se ve es la web apareciendo por
               partes mientras el numero sube — que es lo que Juani pidio:
               "que empiece a aparecer la pagina por pixeles hasta que carga
               al 100%".

               pointer-events none en el contenedor: es un cartel, no una
               pared. Si algo tarda, el visitante puede tocar lo que ya se
               destapo. */
            :global(.wn-preloader) {
              position: fixed;
              inset: 0;
              z-index: 9999;
              display: grid;
              place-items: center;
              background: transparent;
              pointer-events: none;
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
              /* justify-self + min-width, y NO width:100%: el contenedor es
                 un grid con place-items:center, asi que el item no estira y
                 el 100% quedaba sin contra que resolverse — la lamina medía
                 0x0 y no se veía nada. Medido, no supuesto. */
              justify-self: center;
              width: min(420px, calc(100vw - 48px));
              min-width: 260px;
              padding: 38px clamp(24px, 7vw, 44px) 26px;
              /* ── Vidrio CLARO, como el menú (5-sep-2026) ────────────────
                 Era crema al 4,5% con texto crema: se leía perfecto contra
                 el fondo near-black que tenía el preloader. Al sacar ese
                 fondo —para que se vea el reveal de píxeles detrás— la
                 lámina quedó invisible: 4% de blanco sobre un cielo rosa no
                 es nada, y el texto crema sobre claro tampoco.

                 Pasa al mismo lenguaje que el menú: relleno en padding-box +
                 gradiente de borde en border-box, que es lo que da el canto
                 biselado, y tinta oscura. Una sola familia de vidrio en toda
                 la web en vez de dos que no se parecen. */
              border: 1px solid transparent;
              border-radius: 28px;
              background:
                linear-gradient(
                    168deg,
                    rgba(255, 253, 250, 0.8),
                    rgba(240, 232, 252, 0.58)
                  )
                  padding-box,
                linear-gradient(
                    140deg,
                    rgba(255, 255, 255, 0.95),
                    rgba(255, 255, 255, 0.2) 38%,
                    rgba(255, 255, 255, 0.08) 64%,
                    rgba(126, 88, 190, 0.4)
                  )
                  border-box;
              backdrop-filter: blur(26px) saturate(180%);
              -webkit-backdrop-filter: blur(26px) saturate(180%);
              box-shadow:
                0 34px 80px -30px rgba(38, 20, 66, 0.5),
                inset 0 1px 0 rgba(255, 255, 255, 0.7);
              color: #17121f;
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

            /* --- wordmark: las letras suben desde abajo ------------------
               Cada .wn-letra es una ventana con overflow hidden; el <span>
               de adentro empieza corrido 120% hacia abajo (fuera de la
               ventana) y sube a 0. Por eso la letra no "aparece": entra. */
            .wn-letra {
              display: inline-block;
              overflow: hidden;
              vertical-align: bottom;
              /* Sin esto, las letras con tilde o descendentes se recortan
                 contra el borde de su propia ventana. */
              padding-bottom: 0.06em;
            }
            .wn-letra > span {
              display: inline-block;
              transform: translateY(120%);
              animation: wnSube 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            @keyframes wnSube {
              to {
                transform: translateY(0);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .wn-letra > span {
                transform: none;
                animation: none;
              }
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
              color: #17121f;
              opacity: 0.92;
            }

            /* --- progreso ----------------------------------------------- */
            .wn-track {
              position: relative;
              height: 1px;
              width: 100%;
              background: rgba(38, 20, 66, 0.14);
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
              color: rgba(38, 20, 66, 0.6);
            }
            .wn-pct {
              font-variant-numeric: tabular-nums;
              color: #4a2f7a;
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
