"use client";

/* ============================================================================
   MISSION MASCOT — mono 3D anclado a 4 puntos Y, uno por pilar.

   Comportamiento:
     - El mono esta SIEMPRE anclado a un punto Y discreto. Existen 4 puntos
       definidos por PILLAR_Y_POSITIONS, uno por pilar (.001 .002 .003 .004).
     - Cuando el usuario PARA de scrollear (debounce SCROLL_IDLE_MS) y queda
       en un pilar distinto al del ultimo trigger:
         1) Se dispara la animacion del clip Mixamo (una vez)
         2) En paralelo, el wrapper group hace un tween de la Y actual al
            Y target del nuevo pilar — sincronizado con la duracion del clip
       Al terminar todo, el mono queda quieto y anclado al nuevo punto Y.
     - Durante el scroll: el mono NO se mueve (sticky CSS + reset de Y por
       frame). Sin drift, sin slide.

   Decisiones tecnicas:
     - Root motion del clip stripped: los Mixamo clips que tienen translation
       en el Hips ("Falling", "Walking", etc.) mueven el mono en world space
       y el usuario percibe que "se va bajando" entre triggers. Aca filtramos
       los tracks de posicion del bone raiz al cargar el clip, quedandonos
       SOLO con las rotaciones — la pose se anima pero el mono se queda
       anclado al wrapper, que nosotros controlamos manualmente.
     - El tween Y usa performance.now() (no state.clock) porque arranca en
       el momento exacto del trigger y queremos sync con la duracion real
       del clip (afectada por timeScale).
   ============================================================================ */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const MONO_SRC = "/assets/3d/mono-rigged.glb";
useGLTF.preload(MONO_SRC);

const ANIM_MIN_DURATION_S = 0.5;

const PILLAR_COUNT  = 4;
const PROGRESS_IN   = 0.08;
const PROGRESS_OUT  = 0.92;

/* Mono mas grande: 2.5 unidades de altura (antes 2.2). */
const TARGET_SIZE     = 2.5;
/* GROUP_Y_OFFSET = posicion Y baseline del MascotStage. La Y por pilar
   se suma a este offset. */
const GROUP_Y_OFFSET  = -0.3;
const OFFSET_DIVISOR  = 4.5;

const ANIM_FADE_IN_S  = 0.15;
const ANIM_TIME_SCALE = 0.6;
const SCROLL_IDLE_MS  = 350;

/* PILLAR_Y_POSITIONS — punto Y al que el mono se ancla en cada pilar.
   Suman a GROUP_Y_OFFSET. Definidos para que el mono "baje de nivel" entre
   pilares (efecto de caer por etapas):
     .001 Source   → arriba (Y mas positiva)
     .002 Build    → un escalon abajo
     .003 Release  → un escalon mas abajo
     .004 Archive  → al "piso" (Y mas negativa)
   Valores chicos (~0.3 unidades por escalon) para que el desplazamiento
   sea perceptible pero no exagerado. */
const PILLAR_Y_POSITIONS = [0.45, 0.15, -0.15, -0.45];

/* Easing cubico inOut para el tween Y — suave en el inicio y fin, rapido
   en el medio. Misma curva que muchas UI transitions. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function pillarSign(_pillarIdx: number): number {
  return 1;
}

interface MonkeyProps {
  triggerSignalRef: React.MutableRefObject<number>;
  currentYRef: React.MutableRefObject<number>;
  targetYRef: React.MutableRefObject<number>;
  tweenStartMsRef: React.MutableRefObject<number | null>;
  clipDurationRef: React.MutableRefObject<number>;
}

function Monkey({
  triggerSignalRef,
  currentYRef,
  targetYRef,
  tweenStartMsRef,
  clipDurationRef,
}: MonkeyProps) {
  const { scene, animations } = useGLTF(MONO_SRC);
  const ref = useRef<THREE.Group>(null);

  /* Auto-fit por altura + recentrado al origen. NO clonar el scene (rompe
     el skin binding del rig Mixamo). */
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

  /* Strip root motion: filtrar los tracks de posicion del bone raiz del clip.
     Los clips de Mixamo con root motion ("Falling", "Walking", etc.) animan
     position del Hips, lo que mueve al mono en world space durante el clip.
     Si lo dejamos puesto, el mono se va a desplazar visualmente durante la
     animacion ademas del tween manual del wrapper Y — doble movimiento.
     Filtramos cualquier track cuyo nombre contenga ".position" y sea del
     bone raiz tipico de Mixamo (Hips/Armature/RootNode). El resto de tracks
     (rotation, scale, position de bones hijos) se mantienen → la pose se
     anima normalmente, solo no se desplaza el todo. */
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

  useEffect(() => {
    if (!names.length) return;
    const action = actions[names[0]];
    if (!action) return;
    const duration = action.getClip().duration;
    if (duration < ANIM_MIN_DURATION_S) return;

    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = true;
    action.timeScale = ANIM_TIME_SCALE;

    /* Pose final como pose inicial — saltar al ultimo frame y pausar. */
    action.reset();
    action.play();
    action.time = duration;
    mixer.update(0);
    action.paused = true;
    actionRef.current = action;
    clipDurationRef.current = duration / ANIM_TIME_SCALE;
  }, [actions, mixer, names, clipDurationRef]);

  useFrame(() => {
    const obj = ref.current;
    if (!obj) return;

    /* Trigger de nueva animacion: el wrapper exterior puso un pilar en
       triggerSignalRef. Disparamos clip + arrancamos tween Y. */
    const pendingPillar = triggerSignalRef.current;
    if (pendingPillar >= 0) {
      triggerSignalRef.current = -1;
      const action = actionRef.current;
      if (action) {
        action.reset();
        action.fadeIn(ANIM_FADE_IN_S);
        action.play();
      }
      /* Arrancar tween Y: target = PILLAR_Y_POSITIONS[pillar], start = now.
         La duracion del tween se lee de clipDurationRef en cada frame. */
      targetYRef.current = PILLAR_Y_POSITIONS[pendingPillar];
      tweenStartMsRef.current = performance.now();
    }

    /* Tween Y activo: avanzar segun tiempo transcurrido. Al llegar a 1,
       fijamos currentY=targetY y cerramos el tween (nullable). */
    const startMs = tweenStartMsRef.current;
    if (startMs !== null) {
      const elapsed = (performance.now() - startMs) / 1000;
      const tweenDuration = clipDurationRef.current || 1;
      const t = THREE.MathUtils.clamp(elapsed / tweenDuration, 0, 1);
      const eased = easeInOutCubic(t);
      const startY = obj.userData.tweenStartY as number | undefined;
      const fromY = startY ?? currentYRef.current;
      if (startY === undefined) obj.userData.tweenStartY = currentYRef.current;
      obj.position.y = THREE.MathUtils.lerp(fromY, targetYRef.current, eased);
      if (t >= 1) {
        currentYRef.current = targetYRef.current;
        obj.position.y = targetYRef.current;
        tweenStartMsRef.current = null;
        delete obj.userData.tweenStartY;
      }
    } else {
      /* Sin tween activo: forzar Y al ancla actual. Esto es lo que evita
         que el mono se "vaya bajando" — cada frame re-fija la Y al punto
         del pilar actual, sin importar que residual deje el mixer. */
      obj.position.y = currentYRef.current;
    }
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

interface MascotStageProps {
  triggerSignalRef: React.MutableRefObject<number>;
  currentYRef: React.MutableRefObject<number>;
  targetYRef: React.MutableRefObject<number>;
  tweenStartMsRef: React.MutableRefObject<number | null>;
  clipDurationRef: React.MutableRefObject<number>;
}

function MascotStage({
  triggerSignalRef,
  currentYRef,
  targetYRef,
  tweenStartMsRef,
  clipDurationRef,
}: MascotStageProps) {
  const lateralRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = lateralRef.current;
    if (!group) return;
    /* Anclaje lateral fijo en X — sin lerp. Se recorrige cada frame para
       sobrevivir resize del viewport. */
    group.position.x = pillarSign(0) * (state.viewport.width / OFFSET_DIVISOR);
  });

  return (
    <group position={[0, GROUP_Y_OFFSET, 0]}>
      <group ref={lateralRef}>
        <Monkey
          triggerSignalRef={triggerSignalRef}
          currentYRef={currentYRef}
          targetYRef={targetYRef}
          tweenStartMsRef={tweenStartMsRef}
          clipDurationRef={clipDurationRef}
        />
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

  const triggerSignalRef = useRef<number>(-1);
  const lastTriggeredPillarRef = useRef<number>(-1);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Refs compartidos con el Monkey para el tween Y entre pilares. */
  const currentYRef = useRef<number>(PILLAR_Y_POSITIONS[0]);
  const targetYRef = useRef<number>(PILLAR_Y_POSITIONS[0]);
  const tweenStartMsRef = useRef<number | null>(null);
  const clipDurationRef = useRef<number>(1);

  useMotionValueEvent(progress, "change", (v) => {
    progressRef.current = v;
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
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
        triggerSignalRef.current = currentPillar;
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
      /* Camera mas cerca (Z=6.5, antes 7.5) → mono mas grande en pantalla.
         Y=0.4 para ligera elevacion (mira a la altura de los hombros). */
      camera={{ position: [0, 0.4, 6.5], fov: 36 }}
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
        <MascotStage
          triggerSignalRef={triggerSignalRef}
          currentYRef={currentYRef}
          targetYRef={targetYRef}
          tweenStartMsRef={tweenStartMsRef}
          clipDurationRef={clipDurationRef}
        />
      </Suspense>
    </Canvas>
  );
}
