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

/* TARGET_SIZE = altura del mono en unidades 3D. Base del fit es size.y
   (no Math.max), asi el alto del mono es siempre TARGET_SIZE sin que la
   T-pose ancha (brazos abiertos) compriman el alto visible. Con la
   animacion los brazos bajan → el mono se ve mas grande proporcionalmente
   sin tocar la escala. */
const TARGET_SIZE     = 3.0;
/* GROUP_Y_OFFSET negativo → baja al mono dentro del canvas para que la
   cabeza no quede tapada por el header global de la pagina (FUTURE MODE
   bar, ~80px). Bajado 0.4 unidades en world Y → la cabeza queda visible
   debajo del header en todo viewport razonable. */
const GROUP_Y_OFFSET  = -0.4;
/* Magnitud lateral fijada — ya no varia por pilar. viewport.width/OFFSET
   = cuanto a la derecha (sign siempre +1). Con OFFSET_DIVISOR=4.5 queda
   un poco mas a la derecha que antes (era 5) — composicion mas ancha. */
const OFFSET_DIVISOR  = 4.5;

/* Crossfade de entrada del clip — suaviza la transicion desde pose final
   hacia frame 0 al re-disparar. */
const ANIM_FADE_IN_S  = 0.15;

/* timeScale < 1 → la animacion va mas lenta. 0.6 = 60% velocidad
   (animacion 1.67x mas larga). Hace la caida mas "vistosa" y fluida. */
const ANIM_TIME_SCALE = 0.6;

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

  /* prevPillarRef = el ultimo currentPillar visto. Cuando cambia, disparamos
     la animacion. Inicializado a 0 (no -1) porque el mono ya esta en su
     pose final desde el mount — no queremos disparar al entrar al primer
     pilar, solo cuando el usuario empieza a scrollear hacia abajo. */
  const prevPillarRef = useRef<number>(0);

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
        /* Re-disparar la animacion desde frame 0. action.reset() pone
           time=0 y paused=false; fadeIn suaviza la transicion desde la
           pose final (frame=duration) hacia frame=0. Al terminar, con
           clampWhenFinished=true, queda en el ultimo frame → vuelve a
           la misma pose final hasta el proximo cambio de pilar. */
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
