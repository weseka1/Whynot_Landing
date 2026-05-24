"use client";

/* ============================================================================
   PIXEL REVEAL — inspirado en el "load_grid" de DICH™ Fashion.
   - Cubre toda la pantalla con una grilla de celdas opacas (color del bg).
   - Cuando el Preloader emite el evento "whynot:preloader-hidden", las celdas
     se desvanecen una por una, escalonadas desde el centro hacia afuera.
   - El stagger es por distancia euclidiana al centro: parece que la pagina
     "se abre por partes" desde el medio.
   - Vive en z-index 180 (debajo del preloader z=200, encima del contenido).
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";

/* Tamano objetivo de cada celda en px. Mas chico = mas "pixel art", mas grande
   = menos celdas (mas performante y mas "blocky"). 72px da ~26x12 en desktop
   1920x1080 ~= 312 celdas. Equilibrio bueno entre look y costo. */
const CELL_PX = 72;

/* Tiempo total que dura la "ola" desde el centro hasta los bordes. */
const TOTAL_REVEAL_MS = 950;

/* Duracion de fade de cada celda individual. */
const PER_CELL_FADE_MS = 90;

/* Hard fallback: si el evento del preloader nunca llega (raro), igual
   arrancamos a los 7s para no dejar la grilla tapando todo. */
const FALLBACK_START_MS = 7000;

export default function PixelReveal() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ cols: number; rows: number } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [removed, setRemoved] = useState(false);

  /* Calcula cols/rows segun el viewport real al montar (y en resize, antes
     de arrancar el reveal — una vez que arranca no tiene sentido recalcular). */
  useEffect(() => {
    const compute = () => {
      const cols = Math.max(6, Math.ceil(window.innerWidth / CELL_PX));
      const rows = Math.max(6, Math.ceil(window.innerHeight / CELL_PX));
      setSize({ cols, rows });
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  /* Precomputa el delay por celda en base a su distancia (euclidiana) al
     centro, normalizada al diametro de la grilla. Esto es lo que hace que
     la animacion arranque del medio y se expanda hacia afuera. */
  const delays = useMemo(() => {
    if (!size) return [] as number[];
    const { cols, rows } = size;
    const cx = (cols - 1) / 2;
    const cy = (rows - 1) / 2;
    const maxDist = Math.hypot(cx, cy) || 1;
    const arr = new Array<number>(cols * rows);
    for (let i = 0; i < arr.length; i++) {
      const col = i % cols;
      const row = (i / cols) | 0;
      const dist = Math.hypot(col - cx, row - cy);
      arr[i] = (dist / maxDist) * TOTAL_REVEAL_MS;
    }
    return arr;
  }, [size]);

  /* Espera el evento del preloader para arrancar. Tambien arma un fallback
     por las dudas que el evento no se dispare nunca. */
  useEffect(() => {
    if (!size) return;
    const start = () => setRevealing(true);
    window.addEventListener("whynot:preloader-hidden", start);
    const fallback = window.setTimeout(start, FALLBACK_START_MS);
    return () => {
      window.removeEventListener("whynot:preloader-hidden", start);
      clearTimeout(fallback);
    };
  }, [size]);

  /* Cuando termina la ola, desmontamos la grilla del DOM completo para no
     dejar 300+ divs cubriendo (aunque sean transparentes) — pointer-events
     ya es none, pero igual liberamos memoria. */
  useEffect(() => {
    if (!revealing) return;
    const t = window.setTimeout(
      () => setRemoved(true),
      TOTAL_REVEAL_MS + PER_CELL_FADE_MS + 100,
    );
    return () => clearTimeout(t);
  }, [revealing]);

  if (removed || !size) return null;

  return (
    <div
      ref={gridRef}
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 180,
        display: "grid",
        gridTemplateColumns: `repeat(${size.cols}, 1fr)`,
        gridTemplateRows: `repeat(${size.rows}, 1fr)`,
        pointerEvents: "none",
        /* Pintamos el fondo del wrapper tambien por si quedan gaps subpixel
           entre celdas durante el resize. Mismo color que las celdas. */
        background: "transparent",
      }}
    >
      {delays.map((delay, i) => (
        <div
          key={i}
          style={{
            background: "var(--color-bg)",
            opacity: revealing ? 0 : 1,
            transform: revealing ? "translateY(-8px)" : "translateY(0)",
            transition: `opacity ${PER_CELL_FADE_MS}ms ease-out, transform ${PER_CELL_FADE_MS}ms ease-out`,
            transitionDelay: `${delay}ms`,
            willChange: "opacity, transform",
          }}
        />
      ))}
    </div>
  );
}
