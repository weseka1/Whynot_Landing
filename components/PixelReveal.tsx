"use client";

/* ============================================================================
   PIXEL REVEAL — la grilla que se abre desde el centro al entrar.
   ----------------------------------------------------------------------------
   Cubre la pantalla con celdas opacas y las desvanece una por una, escalonadas
   por distancia al centro, cuando el Preloader avisa que terminó.

   ── El bug que costó "la web tarda un montón" (4-sep-2026) ────────────────
   El listener del evento se registraba en un efecto que dependía de `size`, y
   `size` se calcula en OTRO efecto: o sea, recién en el segundo render. El
   Preloader, en cambio, monta antes y —cuando ya se había entrado— emitía el
   evento de forma síncrona en su primer efecto. Resultado: el evento pasaba
   con la sala vacía, nadie lo escuchaba, y la grilla se quedaba tapando todo
   hasta el fallback... que era de SIETE segundos. Pantalla negra con líneas.

   Dos arreglos, no uno:
   1. Si ya se entró en esta pestaña, este componente NO se monta. El reveal es
      parte de la bienvenida; al volver de una ficha no corresponde repetirlo.
   2. Igual se consulta la bandera en memoria (`lib/entrada`) además de
      escuchar el evento: quien llega tarde se entera igual. Y el fallback
      baja de 7 s a 2,5 s — un seguro, no una espera.
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { EVENTO_ENTRADA, esPrimeraVisita } from "@/lib/entrada";

/* Tamano objetivo de cada celda en px. Mas chico = mas "pixel art", mas grande
   = menos celdas (mas performante y mas "blocky"). 72px da ~26x12 en desktop
   1920x1080 ~= 312 celdas. Equilibrio bueno entre look y costo. */
const CELL_PX = 72;

/* Tiempo total que dura la "ola" desde el centro hasta los bordes. */
const TOTAL_REVEAL_MS = 950;

/* Duracion de fade de cada celda individual. */
const PER_CELL_FADE_MS = 90;

/* Seguro por si el evento nunca llega. 2,5 s: lo suficiente para no pisar una
   carga lenta de verdad, poco para que nadie se coma una pantalla trabada. */
const FALLBACK_START_MS = 2500;

export default function PixelReveal() {
  const gridRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ cols: number; rows: number } | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [removed, setRemoved] = useState(false);
  /* En el server siempre true (no hay sessionStorage) para que el HTML salga
     igual y no rompa la hidratación; el efecto de abajo lo corrige al toque. */
  const [corresponde, setCorresponde] = useState(true);

  /* ¿Toca mostrar la bienvenida? Si ya se entró, este componente se va. */
  useEffect(() => {
    if (!esPrimeraVisita()) {
      setCorresponde(false);
      setRemoved(true);
    }
  }, []);

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

  /* El listener va en su PROPIO efecto, sin depender de `size`: así se
     registra en el primer render y no se pierde un evento temprano. Y antes
     de escuchar, se consulta la bandera por si ya pasó. */
  useEffect(() => {
    const start = () => setRevealing(true);
    if (!esPrimeraVisita()) {
      start();
      return;
    }
    window.addEventListener(EVENTO_ENTRADA, start);
    const fallback = window.setTimeout(start, FALLBACK_START_MS);
    return () => {
      window.removeEventListener(EVENTO_ENTRADA, start);
      clearTimeout(fallback);
    };
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

  if (removed || !corresponde || !size) return null;

  return (
    <div
      ref={gridRef}
      className="wn-pixel-reveal"
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
