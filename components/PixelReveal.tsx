"use client";

/* ============================================================================
   PIXEL REVEAL — la web se destapa a medida que carga.
   ----------------------------------------------------------------------------
   Juani, 5-sep-2026: "quiero como un loading cuando se inicia, pero bien
   futurista, que empiece a aparecer la página por píxeles hasta que carga al
   100%, algo así bien pro" y "ese pixel reveal modificalo, dale el toque
   weseka especial".

   ── Qué cambió ────────────────────────────────────────────────────────────
   Antes: una grilla que tapaba todo y se desvanecía DE UNA cuando el
   preloader avisaba que había terminado. El reveal no decía nada sobre la
   carga — era una cortina más, después del hecho.

   Ahora: cada celda tiene un umbral y se destapa cuando el progreso REAL de
   la carga lo supera. Al 40% ves el 40% de la web. La animación no acompaña
   a la carga: ES la carga. Eso es lo que separa un loader de un adorno.

   ── El toque de la casa ───────────────────────────────────────────────────
   Tres decisiones que un generador no toma solo:

   1. El orden no es radial perfecto. Un barrido limpio desde el centro se lee
      mecánico, de plantilla. Acá el umbral mezcla distancia al centro (70%)
      con un ruido estable por celda (30%): la apertura tiene textura, se
      siente material y no calculada. El ruido es determinístico — la misma
      celda saca siempre el mismo valor, así no titila entre renders.

   2. Cada celda se va con un destello del acento antes de desaparecer, no con
      un fade. Un cuadro que se apaga es un cuadro; un cuadro que emite luz al
      abrirse es un sistema encendiéndose. Es UN acento sobre grafito, que es
      la regla de la casa — nada de arcoíris.

   3. La celda no desaparece en su lugar: se hunde y se achica apenas
      (scale .82, translateZ). El conjunto se lee como una superficie que se
      abre hacia adentro, no como píxeles que se borran.

   Todo con `prefers-reduced-motion` respetado y un techo por si el progreso
   nunca llega: la grilla NUNCA puede quedar tapando la web.
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { EVENTO_ENTRADA, esPrimeraVisita } from "@/lib/entrada";
import { EVENTO_PROGRESO } from "@/components/Preloader";

/* Tamaño objetivo de celda. 64px da ~6x14 en un iPhone (84 celdas) y ~21x12
   en 1366 (252). Suficiente resolución para que se lea "por píxeles" sin
   pagar cientos de nodos animándose a la vez. */
const CELDA_PX = 64;

/* Cuánto tarda una celda en irse, desde que le toca. */
const CELDA_MS = 420;

/* Techo absoluto. Si el progreso nunca llega —el preloader falló, el evento
   se perdió, lo que sea— la grilla se abre igual. Una animación no puede
   dejar la web tapada. */
const TECHO_MS = 4600;

/** Ruido estable por celda: la misma celda saca siempre el mismo valor. */
function ruido(i: number): number {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

export default function PixelReveal() {
  const [size, setSize] = useState<{ cols: number; rows: number } | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [removido, setRemovido] = useState(false);
  /* En el server siempre true (no hay sessionStorage) para que el HTML salga
     igual y no rompa la hidratación; el efecto lo corrige al toque. */
  const [corresponde, setCorresponde] = useState(true);
  const reducido = useRef(false);

  /* ¿Toca la bienvenida? Al volver de una ficha, no. */
  useEffect(() => {
    if (!esPrimeraVisita()) {
      setCorresponde(false);
      setRemovido(true);
    }
    reducido.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  /* Cols/rows según el viewport real. Sólo antes de arrancar: una vez que la
     apertura empezó, recalcular saltaría celdas ya abiertas. */
  useEffect(() => {
    const medir = () => {
      setSize({
        cols: Math.max(4, Math.ceil(window.innerWidth / CELDA_PX)),
        rows: Math.max(6, Math.ceil(window.innerHeight / CELDA_PX)),
      });
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, []);

  /* El progreso manda. Y dos salidas de emergencia: el evento de entrada
     (si el preloader cerró sin que llegara el último progreso) y el techo. */
  useEffect(() => {
    const onProgreso = (e: Event) => {
      const ce = e as CustomEvent<{ pct: number }>;
      const p = Number(ce.detail?.pct);
      if (Number.isFinite(p)) setProgreso((v) => (p > v ? p : v));
    };
    const abrirTodo = () => setProgreso(100);
    window.addEventListener(EVENTO_PROGRESO, onProgreso);
    window.addEventListener(EVENTO_ENTRADA, abrirTodo);
    const techo = window.setTimeout(abrirTodo, TECHO_MS);
    return () => {
      window.removeEventListener(EVENTO_PROGRESO, onProgreso);
      window.removeEventListener(EVENTO_ENTRADA, abrirTodo);
      clearTimeout(techo);
    };
  }, []);

  /* El umbral de cada celda: 70% distancia al centro + 30% ruido. Se calcula
     una vez por tamaño de grilla, no por frame. */
  const umbrales = useMemo(() => {
    if (!size) return [] as number[];
    const { cols, rows } = size;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const maxDist = Math.hypot(cx, cy) || 1;
    const arr = new Array<number>(cols * rows);
    for (let i = 0; i < arr.length; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const dist = Math.hypot(col - cx, row - cy) / maxDist;
      /* × 92 y no × 100: las últimas celdas se abren antes de llegar al tope,
         así el 100 coincide con la web ya destapada y no con el último cuadro
         recién empezando a irse. */
      arr[i] = (dist * 0.7 + ruido(i) * 0.3) * 92;
    }
    return arr;
  }, [size]);

  /* Cuando ya no queda ninguna tapada, la grilla se va del DOM: son cientos
     de divs y no tienen por qué seguir ahí. */
  useEffect(() => {
    if (progreso < 100) return;
    const t = window.setTimeout(() => setRemovido(true), CELDA_MS + 160);
    return () => clearTimeout(t);
  }, [progreso]);

  if (removido || !corresponde || !size) return null;

  const sinMovimiento = reducido.current;

  return (
    <div
      className="wn-pixels"
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        /* Entre la web (que tapa) y la lamina del preloader (9999), que
           flota encima con el nombre y el contador. */
        zIndex: 9990,
        display: "grid",
        gridTemplateColumns: `repeat(${size.cols}, 1fr)`,
        gridTemplateRows: `repeat(${size.rows}, 1fr)`,
        pointerEvents: "none",
        /* perspective: las celdas se hunden hacia adentro al abrirse. Sin
           esto el translateZ no hace nada y el gesto se pierde. */
        perspective: "900px",
      }}
    >
      {umbrales.map((umbral, i) => {
        const abierta = progreso >= umbral;
        return (
          <span
            key={i}
            className={abierta ? "celda abierta" : "celda"}
            style={{ transitionDelay: sinMovimiento ? "0ms" : `${(i % 3) * 26}ms` }}
          />
        );
      })}

      <style jsx>{`
        .celda {
          position: relative;
          background: var(--color-bg, #0e0b08);
          opacity: 1;
          transform: translateZ(0) scale(1);
          transition:
            opacity ${CELDA_MS}ms cubic-bezier(0.16, 1, 0.3, 1),
            transform ${CELDA_MS}ms cubic-bezier(0.16, 1, 0.3, 1);
          will-change: opacity, transform;
        }
        /* El destello: un borde de acento que aparece justo cuando la celda
           empieza a irse. Vive en el ::after para no pagar un nodo más por
           celda — con 250 celdas, cada nodo extra se nota. */
        .celda::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(
            160deg,
            rgba(205, 181, 240, 0.85),
            rgba(205, 181, 240, 0) 62%
          );
          opacity: 0;
          transition: opacity 150ms ease-out;
        }
        .celda.abierta {
          opacity: 0;
          /* Se hunde y se achica: la superficie se abre hacia adentro, no se
             borra en su lugar. */
          transform: translateZ(-60px) scale(0.82);
        }
        .celda.abierta::after {
          opacity: 1;
          /* El destello dura menos que la celda: alcanza a verse mientras se
             va, y no queda encendido en el vacío. */
          transition: opacity 90ms ease-out;
        }

        @media (prefers-reduced-motion: reduce) {
          .celda {
            transition: opacity 160ms linear;
            transform: none;
          }
          .celda.abierta {
            transform: none;
          }
          .celda::after {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
