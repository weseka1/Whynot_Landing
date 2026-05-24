"use client";

/* ============================================================================
   MISSION PILLAR MONKEY v3 — R3F per-pilar (un mono por pilar, in-DOM).

   Por que R3F y no model-viewer: el setup R3F del MissionMascot anterior
   se veia bien (textura, animacion, iluminacion). Lo que fallaba era multi-
   instancia por el cache de useGLTF + skeleton binding compartido. Esta
   version resuelve eso usando SkeletonUtils.clone CON updateMatrixWorld
   antes del bbox — el problema anterior era medir el bbox sobre un clone
   sin world matrix actualizada, daba escalas incorrectas (mono enorme o
   cámara dentro del modelo).

   Comportamiento (igual que antes):
     - El mono es parte del DOM normal del pilar. NO sticky.
     - Cuando entra al viewport (>=30%), dispara la animacion una vez.
     - Al salir completamente, reset del trigger → vuelve a disparar al
       reentrar (scroll up funciona).
     - Mono inicial en pose FINAL del clip (no T-pose). Root motion stripped.

   Optimizacion:
     - frameloop="always" — necesario para el AnimationMixer.
     - 4 canvases R3F en una pagina son manejables (<16 WebGL contexts).
     - Lazy mount via IntersectionObserver con margin grande (300px) — el
       canvas solo se crea cuando el pilar esta cerca del viewport.
   ============================================================================ */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { clone as cloneSkeletal } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const MONO_SRC_DEFAULT = "/assets/3d/mono-rigged.glb";
const MONO_SRC_GOTILA  = "/assets/3d/gotila-esenssial.glb";
const MONO_SRC_BLANCO  = "/assets/3d/mono-blanco.glb";
useGLTF.preload(MONO_SRC_DEFAULT);
useGLTF.preload(MONO_SRC_GOTILA);
useGLTF.preload(MONO_SRC_BLANCO);

const ANIM_MIN_DURATION_S = 0.5;
const TARGET_SIZE         = 2.5;
const ANIM_FADE_IN_S      = 0.15;
const ANIM_TIME_SCALE     = 0.45;

/* Y_DROP_FROM = altura inicial del mono en world Y (3D units) — bien arriba
   del frame visible para que entre cayendo desde fuera del viewport del
   canvas. Frame vertical aprox: [-2.4, +2.4] con cam Z=6.5 FOV 36°. +4
   queda por encima del frame: el mono entra al frame durante la caida. */
const Y_DROP_FROM = 4.0;
/* Y_REST = posicion final/anchor del mono. 0 = centro del frame (su sitio
   natural). */
const Y_REST = 0;

/* easeOutCubic — desacelera al final. Visualmente: el mono cae rapido al
   principio (gravedad) y "frena" al aterrizar. Da sensacion de impacto. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

interface MonkeyProps {
  triggerSignalRef: React.MutableRefObject<boolean>;
  modelSrc: string;
}

function Monkey({ triggerSignalRef, modelSrc }: MonkeyProps) {
  const { scene, animations } = useGLTF(modelSrc);
  const ref = useRef<THREE.Group>(null);

  /* SkeletonUtils.clone clona scene + skeleton + skinned-mesh binding —
     necesario para multi-instancia del mismo GLB cacheado. CRITICO:
     llamar updateMatrixWorld(true) en el clone ANTES de calcular el bbox,
     sino el bbox sale con world matrix sin actualizar y la escala/centro
     son incorrectos (resultado: mono enorme con la camara dentro). */
  const cloned = useMemo(() => {
    const c = cloneSkeletal(scene);
    c.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const fitScale = size.y > 0 ? TARGET_SIZE / size.y : 1;
    c.scale.setScalar(fitScale);
    c.updateMatrixWorld(true);
    bbox.setFromObject(c);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    c.position.sub(center);
    return c;
  }, [scene]);

  /* Strip root motion del clip — eliminar tracks de posicion del bone raiz
     para que el mono no se desplace en world space (queremos que la pose
     se anime pero el mono se quede en su lugar). */
  const cleanedAnimations = useMemo(() => {
    return animations.map((clip) => {
      const cleaned = clip.clone();
      cleaned.tracks = cleaned.tracks.filter((track) => {
        const name = track.name.toLowerCase();
        const isPosition = name.endsWith(".position");
        const isRootish =
          name.includes("hips") ||
          name.includes("armature") ||
          name.includes("rootnode") ||
          name.startsWith(".bones[0]");
        return !(isPosition && isRootish);
      });
      return cleaned;
    });
  }, [animations]);

  const { actions, mixer, names } = useAnimations(cleanedAnimations, ref);
  const actionRef = useRef<THREE.AnimationAction | null>(null);
  /* Refs para el tween de caida Y. tweenStartMsRef = null cuando no hay
     tween activo. clipDurationRef = duracion del clip / timeScale para
     sincronizar el tween con la animacion. */
  const tweenStartMsRef = useRef<number | null>(null);
  const clipDurationRef = useRef<number>(1);

  /* Posicion inicial del wrapper: ARRIBA del frame, fuera del viewport del
     canvas. Se setea siempre (haya o no clip de animacion) para que modelos
     sin clip tambien arranquen ocultos hasta que el trigger los suelte. */
  useEffect(() => {
    if (ref.current) ref.current.position.y = Y_DROP_FROM;
  }, []);

  useEffect(() => {
    if (!names.length) return;
    const action = actions[names[0]];
    if (!action) return;
    const duration = action.getClip().duration;
    if (duration < ANIM_MIN_DURATION_S) return;
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = ANIM_TIME_SCALE;
    action.reset();
    action.play();
    action.time = duration;
    mixer.update(0);
    action.paused = true;
    actionRef.current = action;
    clipDurationRef.current = duration / ANIM_TIME_SCALE;
  }, [actions, mixer, names]);

  useFrame(() => {
    const obj = ref.current;
    if (!obj) return;

    /* Trigger: cuando el wrapper exterior pone triggerSignalRef en true,
       arrancamos animacion + tween Y. El mono SALTA a Y_DROP_FROM (arriba)
       instantaneamente y empieza a caer mientras se reproduce el clip. */
    if (triggerSignalRef.current) {
      triggerSignalRef.current = false;
      const action = actionRef.current;
      if (action) {
        action.reset();
        action.fadeIn(ANIM_FADE_IN_S);
        action.play();
      }
      obj.position.y = Y_DROP_FROM;
      tweenStartMsRef.current = performance.now();
    }

    /* Tween Y activo: avanzar segun tiempo. easeOutCubic = cae rapido,
       frena al final → sensacion de aterrizaje con gravedad. */
    const startMs = tweenStartMsRef.current;
    if (startMs !== null) {
      const elapsed = (performance.now() - startMs) / 1000;
      const t = THREE.MathUtils.clamp(elapsed / clipDurationRef.current, 0, 1);
      const eased = easeOutCubic(t);
      obj.position.y = THREE.MathUtils.lerp(Y_DROP_FROM, Y_REST, eased);
      if (t >= 1) {
        obj.position.y = Y_REST;
        tweenStartMsRef.current = null;
      }
    }
  });

  return (
    <group ref={ref}>
      <primitive object={cloned} />
    </group>
  );
}

interface MissionPillarMonkeyProps {
  /** Override del modelo a renderizar. Default = mono-rigged. */
  modelSrc?: string;
}

export default function MissionPillarMonkey({
  modelSrc = MONO_SRC_DEFAULT,
}: MissionPillarMonkeyProps = {}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerSignalRef = useRef<boolean>(false);
  const hasTriggeredRef = useRef<boolean>(false);
  const isMobile = useIsMobile();
  const [shouldMount, setShouldMount] = useState(false);

  /* Lazy mount: 300px de margin para precargar antes de llegar. */
  useEffect(() => {
    if (shouldMount) return;
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
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldMount]);

  /* Trigger por viewport entry: cuando >=30% visible, dispara animacion. */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio >= 0.3 && !hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          triggerSignalRef.current = true;
        } else if (entry.intersectionRatio === 0) {
          /* Reset al salir completamente → puede re-disparar al volver. */
          hasTriggeredRef.current = false;
        }
      },
      { threshold: [0, 0.3] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
        <Canvas
          frameloop="always"
          camera={{ position: [0, 0.4, 6.5], fov: 36 }}
          dpr={isMobile ? 1 : [1, 1.5]}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
          }}
          gl={{
            antialias: !isMobile,
            powerPreference: "high-performance",
            alpha: true,
          }}
        >
          <ambientLight intensity={0.65} />
          <directionalLight
            position={[5, 6, 5]}
            intensity={1.4}
            color="#ffd9b8"
          />
          {!isMobile && (
            <>
              <directionalLight
                position={[-4, -2, -3]}
                intensity={0.45}
                color="#5da3ff"
              />
              <pointLight position={[0, 0, 5]} intensity={0.4} color="#ffffff" />
            </>
          )}
          <Suspense fallback={null}>
            <Monkey triggerSignalRef={triggerSignalRef} modelSrc={modelSrc} />
          </Suspense>
        </Canvas>
      )}
    </div>
  );
}
