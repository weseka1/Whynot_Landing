"use client";

/* ============================================================================
   MISSION MASCOT — mono 3D anclado, animacion al parar de scrollear.

   Comportamiento:
     - El mono esta SIEMPRE quieto en su pose final (clip terminado),
       anclado a una posicion lateral y vertical fija.
     - Durante el scroll: nada se mueve. El mono no responde.
     - Cuando el usuario PARA de scrollear (debounce de SCROLL_IDLE_MS) y
       quedo posado en un pilar distinto al del ultimo trigger, se dispara
       la animacion UNA VEZ. Al terminar vuelve a quietud.
     - El primer trigger es al primer stop dentro de la seccion, los siguientes
       solo si cambia de pilar (no re-dispara si se queda quieto en el mismo).

   GLB esperado en /assets/3d/mono-rigged.glb:
     - mesh Meshy + skeleton Mixamo (65 huesos) + textura packed
     - 1 clip de animacion del Mixamo (Idle, Walking, Jump, etc.)
       de duracion >= ANIM_MIN_DURATION_S (sino se asume T-pose y NO se dispara)
   ============================================================================ */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const MONO_SRC = "/assets/3d/mono-rigged.glb";
useGLTF.preload(MONO_SRC);

/* Umbral de animacion util — si el clip dura menos, se asume T-pose
   estatica y no se dispara nunca (el mono queda quieto siempre). */
const ANIM_MIN_DURATION_S = 0.5;

const PILLAR_COUNT  = 4;
const PROGRESS_IN   = 0.08;
const PROGRESS_OUT  = 0.92;

/* TARGET_SIZE = altura del mono en unidades 3D. Base del fit es size.y
   (no Math.max), asi la altura del mono es siempre TARGET_SIZE sin que la
   T-pose ancha (brazos abiertos) compriman el alto visible. 2.2 deja al
   mono mas chico y con mas margen alrededor — encuadre completo seguro. */
const TARGET_SIZE     = 2.2;
/* GROUP_Y_OFFSET negativo → baja al mono dentro del canvas para que la
   cabeza no quede tapada por el header global FUTURE MODE (~80px). */
const GROUP_Y_OFFSET  = -0.3;
/* Magnitud lateral fijada — todos los pilares usan el mismo signo (+1).
   viewport.width/OFFSET = cuantas unidades 3D a la derecha del centro. */
const OFFSET_DIVISOR  = 4.5;

/* Crossfade de entrada del clip — suaviza la transicion desde pose final
   hacia frame 0 al re-disparar. */
const ANIM_FADE_IN_S  = 0.15;

/* timeScale < 1 → la animacion va mas lenta. 0.6 = 60% velocidad
   (animacion 1.67x mas larga). Hace la caida mas "vistosa" y fluida. */
const ANIM_TIME_SCALE = 0.6;

/* SCROLL_IDLE_MS = cuanto tiempo sin scroll para considerar "parado". Al
   pasar este tiempo desde el ultimo cambio de progress, evaluamos en que
   pilar quedo el usuario y disparamos la animacion. 350ms = balance entre
   responsive (no esperar mucho) y robusto (no triggear con micro-movimientos
   del trackpad inertial scroll). */
const SCROLL_IDLE_MS  = 350;

/* Mono SIEMPRE a la derecha — todos los pilares con texto a la izquierda
   (sin alternancia izq/der). Antes alternaba +1/-1 segun el pilar. */
function pillarSign(_pillarIdx: number): number {
  return 1;
}

interface MonkeyProps {
  /* triggerSignalRef: cuando el scroll se queda quieto y el pilar evaluado
     es distinto al ultimo triggered, el wrapper exterior pone aca el pilar
     a animar. El Monkey lo consume desde useFrame, dispara la animacion,
     y resetea a -1 (consumed). */
  triggerSignalRef: React.MutableRefObject<number>;
}

function Monkey({ triggerSignalRef }: MonkeyProps) {
  const { scene, animations } = useGLTF(MONO_SRC);
  const ref = useRef<THREE.Group>(null);

  /* Auto-fit del GLB y recentrado al origen.
     Base del fit = size.y (altura) en lugar de Math.max(x,y,z). Porque el
     bbox se mide en T-pose (brazos abiertos en cruz) → size.x es enorme,
     y Math.max usaba ese ancho como referencia, comprimiendo la altura
     visible del mono. Con size.y forzamos que la ALTURA siempre quede en
     TARGET_SIZE, asi el mono ocupa el frame vertical consistentemente y
     no se ve mas chico despues de la animacion (cuando los brazos bajan
     y el ancho del bbox se reduce).
     CRITICO con skinned mesh: NO clonamos el scene — rompe el binding del
     skeleton (mesh apunta a huesos por referencia; clonar deja el skin
     huerfano y el mesh colapsa o desaparece). Usamos scene directo — una
     sola instancia montada. */
  useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const fitScale = TARGET_SIZE / (size.y || 1);
    scene.scale.setScalar(fitScale);
    bbox.setFromObject(scene);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    scene.position.sub(center);
  }, [scene]);

  /* Setup de la action + inicializacion en el ULTIMO FRAME del clip.
     El usuario quiere que la pose inicial sea la pose final de la animacion
     (no T-pose) — por ejemplo, si el clip es una caida, el mono arranca ya
     caido en el piso, y cada cambio de pilar repite la caida.

     Tecnica: arrancar la action, saltar action.time al final del clip,
     forzar mixer.update(0) para commitear esa pose al mesh, y pausar.
     Asi visualmente el mono aparece directamente en el ultimo frame sin
     ver la animacion ejecutarse al montar.

     LoopOnce + clampWhenFinished=true:
       - Una sola reproduccion por trigger
       - Al terminar, la action queda en el ultimo frame (no rebobina) →
         el mono queda en pose final hasta el proximo trigger. */
  const { actions, mixer, names } = useAnimations(animations, ref);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if (!names.length) return;
    const action = actions[names[0]];
    if (!action) return;
    const duration = action.getClip().duration;
    if (duration < ANIM_MIN_DURATION_S) return; // T-pose, no usar
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = ANIM_TIME_SCALE;

    /* Saltar a la pose final como estado inicial. Necesitamos play() antes
       de tocar action.time porque el mixer solo evalua actions activas; sin
       play() la pose no se aplica al mesh.
       mixer.update(0) fuerza una evaluacion instantanea con dt=0 — calcula
       las transformaciones de huesos para action.time=duration sin avanzar
       el reloj. Despues paused=true congela la action ahi hasta que el
       usuario dispare un cambio de pilar. */
    action.reset();
    action.play();
    action.time = duration;
    mixer.update(0);
    action.paused = true;
    actionRef.current = action;
  }, [actions, mixer, names]);

  /* useFrame consume el triggerSignalRef: cuando el wrapper exterior detecta
     scroll-stop y pone un pilar en la signal, el Monkey lo lee, dispara la
     animacion y resetea la signal a -1 (consumed). Entre triggers el mono
     no se mueve — esta completamente anclado en pose final, sin lerp, sin
     drift. La unica fuente de movimiento es la animacion del clip. */
  useFrame(() => {
    if (!ref.current) return;
    const pendingPillar = triggerSignalRef.current;
    if (pendingPillar < 0) return; // nada pendiente

    triggerSignalRef.current = -1; // consume el signal
    const action = actionRef.current;
    if (!action) return;

    /* Re-disparar desde frame 0. action.reset() pone time=0 y paused=false;
       fadeIn suaviza la transicion desde la pose final (frame=duration)
       hacia frame=0. clampWhenFinished=true → al terminar queda en el
       ultimo frame igual que antes. */
    action.reset();
    action.fadeIn(ANIM_FADE_IN_S);
    action.play();
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

interface MascotStageProps {
  triggerSignalRef: React.MutableRefObject<number>;
}

function MascotStage({ triggerSignalRef }: MascotStageProps) {
  /* lateralRef agrupa el mono. Como ahora pillarSign() devuelve siempre +1,
     el mono va a la misma posicion lateral en los 4 pilares. Lo posicionamos
     al targetX FIJO en el primer frame (sin lerp) — el lerp solo introducia
     un drift visible al montaje (0 → +viewport/4.5) que el usuario no quiere.
     Anclado desde frame 1. */
  const lateralRef = useRef<THREE.Group>(null);
  const initializedRef = useRef(false);

  useFrame((state) => {
    const group = lateralRef.current;
    if (!group) return;

    const targetX = pillarSign(0) * (state.viewport.width / OFFSET_DIVISOR);
    if (!initializedRef.current) {
      group.position.x = targetX;
      initializedRef.current = true;
    } else {
      /* Re-corregir en cada frame para mantenerse anclado cuando cambia
         viewport.width (resize). Asignacion directa — sin lerp, sin drift. */
      group.position.x = targetX;
    }
  });

  return (
    <group position={[0, GROUP_Y_OFFSET, 0]}>
      <group ref={lateralRef}>
        <Monkey triggerSignalRef={triggerSignalRef} />
      </group>
    </group>
  );
}

interface MissionMascotProps {
  progress: MotionValue<number>;
}

export default function MissionMascot({ progress }: MissionMascotProps) {
  const progressRef = useRef(0);
  const isMobile = useIsMobile();

  /* triggerSignalRef: -1 = nada pendiente. Cuando el debounce se cumple,
     ponemos aca el pilar evaluado; el Monkey lo lee en useFrame, dispara
     la animacion, y resetea a -1. */
  const triggerSignalRef = useRef<number>(-1);
  /* lastTriggeredPillarRef: el ultimo pilar para el que efectivamente
     disparamos animacion. Evita re-disparar si el usuario se queda quieto
     en el mismo pilar. Inicializado a -1 → el primer stop dentro de la
     seccion va a disparar siempre. */
  const lastTriggeredPillarRef = useRef<number>(-1);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMotionValueEvent(progress, "change", (v) => {
    progressRef.current = v;

    /* Reset del debounce — cada cambio de scroll reinicia el timer. La
       animacion solo se evalua despues de SCROLL_IDLE_MS sin actividad. */
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      /* Evaluar en que pilar quedo el usuario. Si el progress esta fuera
         del rango activo (PROGRESS_IN..OUT), no disparamos — solo dentro
         de la seccion Mission. */
      const p = progressRef.current;
      if (p < PROGRESS_IN || p > PROGRESS_OUT) return;
      const t = THREE.MathUtils.clamp(
        (p - PROGRESS_IN) / (PROGRESS_OUT - PROGRESS_IN),
        0,
        1
      );
      const activeIndex = t * PILLAR_COUNT;
      const currentPillar = Math.min(
        Math.floor(activeIndex),
        PILLAR_COUNT - 1
      );

      if (currentPillar !== lastTriggeredPillarRef.current) {
        lastTriggeredPillarRef.current = currentPillar;
        triggerSignalRef.current = currentPillar; // signal al Monkey
      }
    }, SCROLL_IDLE_MS);
  });

  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, []);

  return (
    <Canvas
      /* Camera mas alejada (Z=7.5, antes 5.5) + ligera elevacion (Y=0.4)
         para que la cabeza del mono quede dentro del frame con margen.
         FOV 36° + Z=7.5 → vertical half-extent ≈ 2.44 unidades; con
         TARGET_SIZE=2.2 el mono ocupa ~45% del frame vertical y tiene
         espacio arriba/abajo. */
      camera={{ position: [0, 0.4, 7.5], fov: 36 }}
      dpr={isMobile ? 1 : [1, 1.5]}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[5, 6, 5]} intensity={1.4} color="#ffd9b8" />
      {!isMobile && (
        <>
          <directionalLight position={[-4, -2, -3]} intensity={0.45} color="#5da3ff" />
          <pointLight position={[0, 0, 5]} intensity={0.4} color="#ffffff" />
        </>
      )}

      <Suspense fallback={null}>
        <MascotStage triggerSignalRef={triggerSignalRef} />
      </Suspense>
    </Canvas>
  );
}
