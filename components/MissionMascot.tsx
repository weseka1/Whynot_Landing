"use client";

/* ============================================================================
   MISSION MASCOT — mono 3D quieto al frente, animacion solo en transicion.

   Comportamiento:
     - El mono esta de frente, en su pose natural (bind pose del rig Mixamo),
       sin spin, sin bobbing, sin squash, sin tilt — completamente quieto.
     - Cada vez que el scroll cruza al SIGUIENTE pilar (currentPillar cambia),
       se DISPARA UNA VEZ la animacion del clip embebido en el GLB (Mixamo).
     - Al terminar el clip, el mono vuelve a quedar quieto en pose natural
       (clampWhenFinished=false → bind pose).
     - Lo unico que mantenemos del sistema original es el offset lateral
       izq/der por pilar (el mono "salta" al otro lado cuando el texto del
       pilar cambia de lado), porque eso es estructural del layout.

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

const TARGET_SIZE     = 2.4;
/* GROUP_Y_OFFSET=0 → centro del mono coincide con el centro del canvas, que
   coincide con el centro vertical de cada pilar (donde esta el texto, por
   flex alignItems:center del .Mission). Asi el mono "cae a la altura del
   texto" en lugar de quedar abajo en el frame. */
const GROUP_Y_OFFSET  = 0;
const POSITION_DAMP   = 7;
const OFFSET_DIVISOR  = 5;
const TRANSITION_START = 0.40;
const TRANSITION_END   = 1.00;

/* Crossfade de entrada/salida del clip — suavizado de cuando empieza y
   cuando vuelve a quieto. Sin fadeIn el cambio se ve como un cut. */
const ANIM_FADE_IN_S  = 0.12;

/* Mono SIEMPRE a la derecha — todos los pilares con texto a la izquierda
   (sin alternancia izq/der). Antes alternaba +1/-1 segun el pilar. */
function pillarSign(_pillarIdx: number): number {
  return 1;
}

interface MonkeyProps {
  progressRef: React.MutableRefObject<number>;
}

function Monkey({ progressRef }: MonkeyProps) {
  const { scene, animations } = useGLTF(MONO_SRC);
  const ref = useRef<THREE.Group>(null);

  /* Auto-fit del GLB a TARGET_SIZE y recentrado al origen.
     CRITICO con skinned mesh: NO clonamos el scene — rompe el binding del
     skeleton (mesh apunta a huesos por referencia; clonar deja el skin
     huerfano y el mesh colapsa o desaparece). Usamos scene directo — una
     sola instancia montada. */
  useMemo(() => {
    const bbox = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = TARGET_SIZE / maxDim;
    scene.scale.setScalar(fitScale);
    bbox.setFromObject(scene);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    scene.position.sub(center);
  }, [scene]);

  /* Guardamos la action del clip en una ref para dispararla on-demand
     desde useFrame. NO se reproduce al montar — el usuario quiere quietud
     hasta el primer cambio de pilar.
     Configuracion:
       - LoopOnce + repetitions=1     → se reproduce una sola vez
       - clampWhenFinished=false      → al terminar, regresa a bind pose
         (el rest natural del rig de Mixamo: brazos extendidos, todo neutro) */
  const { actions, names } = useAnimations(animations, ref);
  const actionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if (!names.length) return;
    const action = actions[names[0]];
    if (!action) return;
    const duration = action.getClip().duration;
    if (duration < ANIM_MIN_DURATION_S) return; // T-pose, no usar
    action.setLoop(THREE.LoopOnce, 1);
    action.clampWhenFinished = false;
    actionRef.current = action;
  }, [actions, names]);

  /* prevPillarRef = el ultimo currentPillar visto. Cuando cambia, disparamos
     la animacion. Inicializado a -1 para que el primer pilar tambien dispare
     al entrar al stage (sino el mono no se moveria nunca en el primer pilar). */
  const prevPillarRef = useRef<number>(-1);

  useFrame(() => {
    const obj = ref.current;
    if (!obj) return;

    const p = progressRef.current;
    const t = THREE.MathUtils.clamp(
      (p - PROGRESS_IN) / (PROGRESS_OUT - PROGRESS_IN),
      0,
      1
    );
    const activeIndex = t * PILLAR_COUNT;
    const currentPillar = Math.min(Math.floor(activeIndex), PILLAR_COUNT - 1);

    /* Detectar cambio de pilar → disparar animacion una vez.
       Funciona en ambas direcciones (scroll down e up) — cada cruce de
       umbral entre pilares es un trigger. */
    if (currentPillar !== prevPillarRef.current) {
      prevPillarRef.current = currentPillar;
      const action = actionRef.current;
      if (action) {
        /* reset() rebobina el clip al frame 0; fadeIn suaviza la entrada
           para no cortar de quieto a movimiento como un cut. Si la action
           ya estaba sonando (cambio rapido de pilar), reset+play la reinicia
           desde el principio — efecto deseado. */
        action.reset();
        action.fadeIn(ANIM_FADE_IN_S);
        action.play();
      }
    }
  });

  return (
    <group ref={ref}>
      <primitive object={scene} />
    </group>
  );
}

interface MascotStageProps {
  progressRef: React.MutableRefObject<number>;
}

function MascotStage({ progressRef }: MascotStageProps) {
  /* lateralRef agrupa el mono y aplica el offset izq/der por pilar — esto
     se mantiene del sistema original porque es estructural del layout
     (cada pilar tiene texto en un lado y el mono va al otro). El movimiento
     lateral lerp-da entre pilares para no saltar bruscamente. */
  const lateralRef = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const group = lateralRef.current;
    if (!group) return;

    const p = progressRef.current;
    const t = THREE.MathUtils.clamp(
      (p - PROGRESS_IN) / (PROGRESS_OUT - PROGRESS_IN),
      0,
      1
    );
    const activeIndex = t * PILLAR_COUNT;
    const currentPillar = Math.min(Math.floor(activeIndex), PILLAR_COUNT - 1);
    const tInPillar = activeIndex - currentPillar;

    const signNow = pillarSign(currentPillar);
    const signNext = currentPillar < PILLAR_COUNT - 1
      ? pillarSign(currentPillar + 1)
      : signNow;
    const transitionT = THREE.MathUtils.smoothstep(
      tInPillar,
      TRANSITION_START,
      TRANSITION_END
    );
    const signLerped = THREE.MathUtils.lerp(signNow, signNext, transitionT);
    const offsetMagnitude = state.viewport.width / OFFSET_DIVISOR;
    const targetX = signLerped * offsetMagnitude;

    const k = 1 - Math.exp(-dt * POSITION_DAMP);
    group.position.x += (targetX - group.position.x) * k;
  });

  return (
    <group position={[0, GROUP_Y_OFFSET, 0]}>
      <group ref={lateralRef}>
        <Monkey progressRef={progressRef} />
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

  useMotionValueEvent(progress, "change", (v) => {
    progressRef.current = v;
  });

  return (
    <Canvas
      /* Camera Y=0 → mira directo al origen (el centro del mono). Con
         GROUP_Y_OFFSET=0, el mono queda exactamente en el centro vertical
         del canvas, alineado con el texto del pilar (vertical-centered por
         el flex layout de Mission.tsx). Z=5.5 + FOV 36° encuadra al mono
         (2.4 unidades) llenando ~67% vertical del frame. */
      camera={{ position: [0, 0, 5.5], fov: 36 }}
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
        <MascotStage progressRef={progressRef} />
      </Suspense>
    </Canvas>
  );
}
