"use client";

/* ============================================================================
   FRAME 360 VIEWER — visor cinemático para secuencias 360_NN.jpg
   ----------------------------------------------------------------------------
   - Preload de todos los frames en paralelo (Image() en useEffect)
   - Loading HUD elegante con progreso real (frames cargados / total)
   - Drag-to-rotate: ~8px de movimiento horizontal = 1 frame
   - Inertia suave al soltar (decay del momentum)
   - Auto-rotate idle: cuando el usuario no interactúa, rota lento (12 fps)
   - Wheel: rotar con el scroll horizontal del trackpad / shift+wheel
   - Keyboard: ← → para rotar frame a frame
   - Indicador angular en el HUD inferior
   ============================================================================ */

import {
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { frameUrl as buildFrameUrl, mainUrl as buildMainUrl, type CatalogEntry } from "@/data/catalog";

const PIXELS_PER_FRAME = 7;          // sensibilidad del drag
const AUTO_ROTATE_INTERVAL_MS = 90;  // ~11 fps idle
const AUTO_ROTATE_DELAY_MS = 2200;   // espera tras la última interacción
const INERTIA_DECAY = 0.92;          // por tick (16ms)
const INERTIA_MIN_VELOCITY = 0.3;    // px/ms

const DARK = "#0a0a14";
const DARK_DIM = "rgba(10,10,20,0.65)";
const YELLOW = "#f4dc3f";

type Props = {
  entry: CatalogEntry;
  /** Forzar auto-rotate inicial (default true). */
  autoRotate?: boolean;
  /** Aspect ratio del contenedor. Default 1 (cuadrado). */
  aspectRatio?: number;
  className?: string;
};

export default function Frame360Viewer({
  entry,
  autoRotate = true,
  aspectRatio = 1,
  className,
}: Props) {
  const frames = entry.type === "360" ? entry.frames : 1;
  const is360 = entry.type === "360" && frames > 1;

  const [currentFrame, setCurrentFrame] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const [isInteracting, setIsInteracting] = useState(false);

  /* ---------- Preload de todos los frames ---------- */
  useEffect(() => {
    if (!is360) {
      setLoadedCount(1);
      return;
    }
    let cancelled = false;
    const imgs: HTMLImageElement[] = [];
    for (let i = 1; i <= frames; i++) {
      const img = new Image();
      img.src = buildFrameUrl(entry, i);
      img.onload = () => {
        if (!cancelled) setLoadedCount((c) => c + 1);
      };
      img.onerror = () => {
        if (!cancelled) setLoadedCount((c) => c + 1); // contar como "no-bloquea"
      };
      imgs.push(img);
    }
    return () => {
      cancelled = true;
      imgs.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
  }, [entry.path, frames, is360]);

  /* ---------- Drag rotate ---------- */
  const accumRef = useRef(0);
  const lastXRef = useRef(0);
  const lastTimeRef = useRef(0);
  const velocityRef = useRef(0);
  const draggingRef = useRef(false);
  const lastInteractionRef = useRef(0);
  const inertiaTimerRef = useRef<number | null>(null);

  const stopInertia = useCallback(() => {
    if (inertiaTimerRef.current !== null) {
      window.clearInterval(inertiaTimerRef.current);
      inertiaTimerRef.current = null;
    }
  }, []);

  const advanceFrames = useCallback(
    (delta: number) => {
      if (!is360) return;
      setCurrentFrame((f) => {
        const next = (f + delta) % frames;
        return next < 0 ? next + frames : next;
      });
    },
    [frames, is360]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!is360) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      draggingRef.current = true;
      setIsInteracting(true);
      lastXRef.current = e.clientX;
      lastTimeRef.current = performance.now();
      velocityRef.current = 0;
      accumRef.current = 0;
      lastInteractionRef.current = performance.now();
      stopInertia();
    },
    [is360, stopInertia]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !is360) return;
      const now = performance.now();
      const dx = e.clientX - lastXRef.current;
      const dt = Math.max(1, now - lastTimeRef.current);
      lastXRef.current = e.clientX;
      lastTimeRef.current = now;
      velocityRef.current = dx / dt; // px/ms
      accumRef.current += dx;
      let advances = 0;
      while (accumRef.current >= PIXELS_PER_FRAME) {
        accumRef.current -= PIXELS_PER_FRAME;
        advances += 1;
      }
      while (accumRef.current <= -PIXELS_PER_FRAME) {
        accumRef.current += PIXELS_PER_FRAME;
        advances -= 1;
      }
      if (advances !== 0) advanceFrames(advances);
      lastInteractionRef.current = now;
    },
    [advanceFrames, is360]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      /* Inertia: continúa rotando con damping geométrico hasta que la
         velocidad baja del umbral mínimo. Usa setInterval 16ms.            */
      stopInertia();
      let v = velocityRef.current;
      inertiaTimerRef.current = window.setInterval(() => {
        v *= INERTIA_DECAY;
        accumRef.current += v * 16; // px en 16ms
        let advances = 0;
        while (accumRef.current >= PIXELS_PER_FRAME) {
          accumRef.current -= PIXELS_PER_FRAME;
          advances += 1;
        }
        while (accumRef.current <= -PIXELS_PER_FRAME) {
          accumRef.current += PIXELS_PER_FRAME;
          advances -= 1;
        }
        if (advances !== 0) {
          advanceFrames(advances);
          lastInteractionRef.current = performance.now();
        }
        if (Math.abs(v) < INERTIA_MIN_VELOCITY) {
          stopInertia();
          setIsInteracting(false);
        }
      }, 16);
    },
    [advanceFrames, stopInertia]
  );

  /* ---------- Auto-rotate idle ---------- */
  useEffect(() => {
    if (!autoRotate || !is360) return;
    const timer = window.setInterval(() => {
      if (draggingRef.current) return;
      if (inertiaTimerRef.current !== null) return;
      if (
        performance.now() - lastInteractionRef.current <
        AUTO_ROTATE_DELAY_MS
      )
        return;
      advanceFrames(1);
    }, AUTO_ROTATE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [autoRotate, advanceFrames, is360]);

  /* ---------- Wheel (horizontal scroll = rotate) ---------- */
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!is360) return;
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (Math.abs(dx) < 2) return;
      e.preventDefault();
      accumRef.current += dx * 0.5;
      let advances = 0;
      while (accumRef.current >= PIXELS_PER_FRAME) {
        accumRef.current -= PIXELS_PER_FRAME;
        advances += 1;
      }
      while (accumRef.current <= -PIXELS_PER_FRAME) {
        accumRef.current += PIXELS_PER_FRAME;
        advances -= 1;
      }
      if (advances !== 0) advanceFrames(advances);
      lastInteractionRef.current = performance.now();
    },
    [advanceFrames, is360]
  );

  /* ---------- Keyboard ← → ---------- */
  useEffect(() => {
    if (!is360) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        advanceFrames(-1);
        lastInteractionRef.current = performance.now();
      } else if (e.key === "ArrowRight") {
        advanceFrames(1);
        lastInteractionRef.current = performance.now();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advanceFrames, is360]);

  /* ---------- Cleanup on unmount ---------- */
  useEffect(() => () => stopInertia(), [stopInertia]);

  /* ---------- Render ---------- */
  const progress = is360 ? loadedCount / frames : 1;
  const ready = progress >= 0.85; // permitir interacción al 85%
  const angle = is360 ? Math.round((currentFrame / frames) * 360) : 0;
  const currentUrl = is360
    ? buildFrameUrl(entry, currentFrame + 1)
    : buildMainUrl(entry);

  return (
    <div
      className={className}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: `${aspectRatio}`,
        cursor: is360 ? (draggingRef.current ? "grabbing" : "grab") : "default",
        touchAction: "none",
        userSelect: "none",
        background: "#ffffff",
        borderRadius: 16,
        overflow: "hidden",
        border: "2px solid #0a0a14",
        boxShadow:
          "0 0 60px rgba(255,255,255,0.5), 0 30px 60px rgba(0,0,0,0.28), inset 0 1px 1px rgba(255,255,255,0.8)",
      }}
    >
      {/* Frame actual */}
      <div
        style={{
          position: "absolute",
          inset: 14,
          borderRadius: 12,
          background: "#ffffff",
          overflow: "hidden",
        }}
      >
        {ready && (
          <img
            src={currentUrl}
            alt={`${entry.brand} ${entry.model} ${entry.colorway} · frame ${currentFrame + 1}/${frames}`}
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              pointerEvents: "none",
              display: "block",
              transform: "scale(0.86)",
              transformOrigin: "center",
            }}
          />
        )}

        {/* Contact shadow bajo la zapa */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            bottom: "11%",
            left: "20%",
            right: "20%",
            height: 14,
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.22), transparent 70%)",
            filter: "blur(6px)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Corner markers */}
      {[
        { top: 8, left: 8, borderTop: 1, borderLeft: 1 },
        { top: 8, right: 8, borderTop: 1, borderRight: 1 },
        { bottom: 8, left: 8, borderBottom: 1, borderLeft: 1 },
        { bottom: 8, right: 8, borderBottom: 1, borderRight: 1 },
      ].map((p, i) => (
        <div
          key={i}
          aria-hidden
          style={{
            position: "absolute",
            width: 18,
            height: 18,
            pointerEvents: "none",
            ...(p as React.CSSProperties),
            borderTopWidth: p.borderTop ? 1 : 0,
            borderBottomWidth: p.borderBottom ? 1 : 0,
            borderLeftWidth: p.borderLeft ? 1 : 0,
            borderRightWidth: p.borderRight ? 1 : 0,
            borderStyle: "solid",
            borderColor: DARK_DIM,
          }}
        />
      ))}

      {/* HUD inferior: angular indicator + frame count */}
      <div
        style={{
          position: "absolute",
          bottom: 16,
          left: 16,
          right: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.6rem",
          letterSpacing: "0.25em",
          color: DARK_DIM,
          pointerEvents: "none",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            color: isInteracting ? DARK : DARK_DIM,
            fontWeight: isInteracting ? 700 : 500,
          }}
        >
          {is360 ? "DRAG TO ROTATE" : "STATIC PREVIEW"}
        </span>
        {is360 && (
          <span style={{ color: DARK, fontWeight: 700 }}>
            {String(angle).padStart(3, "0")}° · {currentFrame + 1}/{frames}
          </span>
        )}
      </div>

      {/* Loading overlay */}
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(255,255,255,0.92)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.2rem",
            backdropFilter: "blur(4px)",
            zIndex: 10,
            fontFamily: "var(--font-mono, monospace)",
            color: DARK_DIM,
            fontSize: "0.7rem",
            letterSpacing: "0.3em",
            textTransform: "uppercase",
          }}
        >
          <div style={{ fontWeight: 600 }}>LOADING SPECIMEN</div>
          <div
            style={{
              width: 220,
              height: 2,
              background: "rgba(10,10,20,0.15)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                width: `${Math.round(progress * 100)}%`,
                background:
                  "linear-gradient(90deg, rgba(10,10,20,0.7), #0a0a14)",
                transition: "width 0.2s linear",
              }}
            />
          </div>
          <div style={{ color: DARK, fontWeight: 600 }}>
            {loadedCount}/{frames} FRAMES
          </div>
        </div>
      )}
    </div>
  );
}
