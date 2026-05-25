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
import { useAnimations, useGLTF, AdaptiveDpr } from "@react-three/drei";
import { clone as cloneSkeletal } from "three/examples/jsm/utils/SkeletonUtils.js";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";
// Side-effect import: configura Draco decoder local (evita dependencia de gstatic)
import "@/lib/three-setup";
import { mobileGLB } from "@/lib/mobileGLB";
import R3FErrorBoundary from "./R3FErrorBoundary";

const MONO_SRC_DEFAULT        = "/assets/3d/mono-rigged.glb";
const MONO_SRC_GOTILA         = "/assets/3d/gotila-esenssial.glb";
const MONO_SRC_BLANCO         = "/assets/3d/mono-blanco.glb";
const MONO_SRC_LOUIS          = "/assets/3d/mono-louis.glb";
const MONO_SRC_DORADO         = "/assets/3d/mono-dorado.glb";
const MONO_SRC_BLANCO_DORADO  = "/assets/3d/mono-blanco-dorado.glb";
/* Preload: en mobile se carga la variant .mobile.glb (textures 256px,
   simplify mas agresivo, ~50% del peso). mobileGLB es no-op en desktop
   o si el GLB no esta en la whitelist.                                 */
useGLTF.preload(mobileGLB(MONO_SRC_DEFAULT));
useGLTF.preload(mobileGLB(MONO_SRC_GOTILA));
useGLTF.preload(mobileGLB(MONO_SRC_BLANCO));
useGLTF.preload(mobileGLB(MONO_SRC_LOUIS));
useGLTF.preload(mobileGLB(MONO_SRC_DORADO));
useGLTF.preload(mobileGLB(MONO_SRC_BLANCO_DORADO));

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
  /* mobileGLB() decide entre el GLB original (desktop) y la variant mobile
     en runtime. Es sync + idempotente: si el cliente ya recibio el preload
     de la variant correcta, useGLTF hit cache.                            */
  const { scene, animations } = useGLTF(mobileGLB(modelSrc));
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
     sincronizar el tween con la animacion. Default 3s para modelos sin
     animacion interna (antes era 1s, demasiado rapido — el tween de Y
     se completaba en 1s y el mono quedaba estatico). */
  const tweenStartMsRef = useRef<number | null>(null);
  const clipDurationRef = useRef<number>(3);

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
       frena al final → sensacion de aterrizaje con gravedad.
       Si el modelo NO tiene clip de animacion (no hay actionRef),
       agregamos rotacion procedural durante la caida para que tenga
       sensacion de movimiento. Solo aplica a unrigged → no afecta
       a los monos animados de Mixamo (que ya rotan via sus clips). */
    const startMs = tweenStartMsRef.current;
    if (startMs !== null) {
      const elapsed = (performance.now() - startMs) / 1000;
      const t = THREE.MathUtils.clamp(elapsed / clipDurationRef.current, 0, 1);
      const eased = easeOutCubic(t);
      obj.position.y = THREE.MathUtils.lerp(Y_DROP_FROM, Y_REST, eased);

      /* Rotacion procedural para unrigged models: 1 vuelta sobre Y +
         leve tilt en X que se asienta al final = sensacion de caer
         girando como un objeto. eased en lugar de t para que la rotacion
         siga el mismo perfil que la caida (rapida al principio, frena al
         aterrizar). */
      if (!actionRef.current) {
        obj.rotation.y = eased * Math.PI * 2;
        obj.rotation.x = (1 - eased) * Math.PI / 8;
      }

      if (t >= 1) {
        obj.position.y = Y_REST;
        if (!actionRef.current) {
          obj.rotation.y = 0;
          obj.rotation.x = 0;
        }
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

  /* Lazy mount: 300px de margin para precargar antes de llegar.
     En mobile, ADEMAS desmontamos el Canvas cuando el pilar sale del
     viewport con margin pequeño (200px). Esto libera el contexto WebGL
     y la VRAM asociada — critico cuando hay 4 pilares + otros 3 canvas
     R3F en la pagina (Hero model-viewer + Collections + Meteorite). El
     limite de browsers mobile suele ser 4-8 contextos antes de matar el
     mas viejo (= "GLBs que desaparecen"). En desktop dejamos el mount
     persistente porque el contexto extra no es problema. */
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShouldMount(true);
      return;
    }
    if (!isMobile) {
      /* Desktop: una sola vez, mount-and-forget */
      if (shouldMount) return;
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
    }
    /* Mobile: mount/unmount segun visibilidad para liberar WebGL ctx */
    const io = new IntersectionObserver(
      ([entry]) => setShouldMount(entry.isIntersecting),
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [shouldMount, isMobile]);

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
       <R3FErrorBoundary>
        <Canvas
          frameloop="always"
          camera={{ position: [0, 0.4, 6.5], fov: 36 }}
          /* dpr: en mobile lo bajamos a 1 fijo (sin techo de 2x). En un
             Android moderno DPR 2.5-3.5x estamos renderizando ~625k-1.2M
             pixels por canvas, * 4 monos = 2.5-5M pixels/frame. Adreno
             610-tier no llega — se cae a 20-30fps. dpr=1 baja el costo
             al 11%-25% y el mono se ve igual a esa distancia/tamano.
             AdaptiveDpr baja todavia mas si la GPU se queja.            */
          dpr={isMobile ? 1 : [1, 2]}
          style={{
            width: "100%",
            height: "100%",
            background: "transparent",
          }}
          gl={{
            /* antialias OFF en mobile: el costo de MSAA en un canvas
               1080p+ con 4 instancias es 20-30% de fillrate extra. Los
               bordes pixeleados se camuflan con el blur de los pilares.  */
            antialias: !isMobile,
            powerPreference: "high-performance",
            alpha: true,
          }}
        >
          {/* AdaptiveDpr: si el frame rate cae bajo 60fps, drei baja el
             dpr efectivo a la mitad automaticamente. Recovery al subir.  */}
          {isMobile && <AdaptiveDpr pixelated />}
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
       </R3FErrorBoundary>
      )}
    </div>
  );
}
