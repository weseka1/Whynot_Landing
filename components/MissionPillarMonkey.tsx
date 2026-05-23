"use client";

/* ============================================================================
   MISSION PILLAR MONKEY — un mono 3D embedded EN el flujo del pilar.

   Implementacion v2: usa el web component <model-viewer> (Google) en lugar
   de R3F. Cada instancia es independiente, sin problemas de skeleton-binding
   compartido entre clones. Sin WebGL context multi-instance overhead.

   Comportamiento:
     - El mono es parte del DOM normal (NO sticky). Se desplaza con su pilar
       al hacer scroll — entra desde abajo, sale por arriba.
     - Carga inicial en pose FINAL del clip (paused en currentTime=duration).
     - Cuando el pilar esta >= 30% visible (IntersectionObserver), dispara
       la animacion una vez: currentTime=0 + play(). Al terminar (sin loop),
       model-viewer se queda en el ultimo frame.
     - Al salir completamente del viewport, reset del trigger → puede volver
       a disparar en scroll up.

   El <script> de model-viewer y el preload del GLB ya estan en app/layout.tsx
   ============================================================================ */

import { useEffect, useRef, useState } from "react";

const MONO_SRC = "/assets/3d/mono-rigged.glb";

/* Animacion: si el clip se llama distinto al cargar, model-viewer expone
   el array `availableAnimations`. Para Mixamo es "Armature|mixamo.com|Layer0"
   pero por simplicidad NO seteamos animationName explicito — model-viewer
   usa la primera animacion del GLB por default. */

export default function MissionPillarMonkey() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLElement | null>(null);

  /* shouldMount: lazy — no monta el web component hasta que el pilar esta
     proximo al viewport (200px margin). Cada pilar paga el costo de su
     mono solo si el usuario realmente llega ahi. */
  const [shouldMount, setShouldMount] = useState(false);
  /* hasTriggeredRef: trackea si ya se disparo la animacion en la actual
     "entrada" al viewport. Reset al salir completamente. */
  const hasTriggeredRef = useRef(false);

  /* IntersectionObserver #1: lazy-mount cuando se acerca al viewport. */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldMount(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldMount(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /* IntersectionObserver #2: trigger de la animacion al estar 30%+ visible.
     Solo arma este observer despues del mount del model-viewer, sino no
     hay ref al modelRef. */
  useEffect(() => {
    if (!shouldMount) return;
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      ([entry]) => {
        const model = modelRef.current as any;
        if (entry.intersectionRatio >= 0.3) {
          if (!hasTriggeredRef.current && model) {
            hasTriggeredRef.current = true;
            /* Disparar la animacion: rebobina y play. model-viewer reproduce
               la primera animacion del GLB por default. Cuando termina (sin
               loop) se queda en el ultimo frame. */
            try {
              model.currentTime = 0;
              model.play({ repetitions: 1 });
            } catch {
              /* model puede no estar listo todavia — no critico */
            }
          }
        } else if (entry.intersectionRatio === 0) {
          /* Reset al salir completamente — al volver a entrar, dispara de
             nuevo. Permite scroll-up + scroll-down repetidos. */
          hasTriggeredRef.current = false;
        }
      },
      { threshold: [0, 0.3] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldMount]);

  /* Setup inicial del model-viewer cuando se monta: dejar el mono en la
     POSE FINAL del clip (no T-pose). Esperamos al evento "load" del modelo
     para tener la animacion disponible.
     - autoplay esta off (no queremos loop)
     - Al load: timeScale lento (0.6) + ir al ultimo frame y pausar */
  useEffect(() => {
    if (!shouldMount) return;
    const model = modelRef.current as any;
    if (!model) return;

    const onLoad = () => {
      try {
        /* timeScale: model-viewer no expone directo — usamos la velocidad
           via el atributo. Para reduccionar velocidad de la animacion,
           model-viewer no tiene un API directo igual que three.js. Lo
           dejamos a velocidad normal por simplicidad. */
        const duration = model.duration; // segundos
        if (typeof duration === "number" && duration > 0) {
          model.currentTime = duration;
          model.pause();
        }
      } catch {
        /* swallow */
      }
    };

    model.addEventListener("load", onLoad);
    /* Por si el modelo ya cargo antes de attachear el listener */
    if (model.loaded) onLoad();

    return () => {
      model.removeEventListener("load", onLoad);
    };
  }, [shouldMount]);

  return (
    <div
      ref={wrapperRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        pointerEvents: "none",
      }}
      aria-hidden
    >
      {!shouldMount ? null : (
        /* @ts-ignore — web component declarado en types/model-viewer.d.ts */
        <model-viewer
          ref={modelRef as any}
          src={MONO_SRC}
          alt="WHYNOT pillar mono"
          /* Camara: orbit horizontal frontal (0deg), polar 80deg para mirar
             ligeramente desde arriba, distancia 4m. camera-target apunta a
             la cintura del mono (Y=0.9). */
          camera-orbit="0deg 80deg 4.5m"
          camera-target="0m 0.9m 0m"
          field-of-view="32deg"
          /* Interaccion off — el usuario no puede rotar/zoom */
          disable-zoom
          interaction-prompt="none"
          /* Sin animation-loop → al terminar el clip queda en el ultimo
             frame (lo que queremos). */
          shadow-intensity="0"
          exposure="1.1"
          loading="eager"
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
            "--poster-color": "transparent",
          } as React.CSSProperties}
        />
      )}
    </div>
  );
}
