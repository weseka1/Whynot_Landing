"use client";

/* ============================================================================
   MISSION MASCOT — 4 poses del mono 3D sincronizadas con scroll.

   Reemplaza el cluster de 4 cajas + anillos atomicos por el mono cuerpo
   completo. Como el GLB no tiene huesos ni animaciones embebidas, simulamos
   movimiento con transformaciones globales del grupo:

     - Bobbing vertical senoidal (respiracion/flotacion)
     - Spin sobre el eje Y (giro continuo cuando aplica)
     - Lean Z (inclinacion lateral)
     - Tilt X (mira arriba/abajo)
     - Escala XYZ (squash & stretch — efecto cartoon clasico)

   Cada pilar (.001 .002 .003 .004) define una "pose" con esos parametros.
   El mono interpola suavemente entre poses con smoothstep + damp exponencial,
   asi el cambio entre estados se ve fluido en lugar de un cut.

   Mantiene la API y la logica izq/der de MissionBoxes (signo alternado por
   pilar — texto IZQ pone al mono a la DER, etc.) para ser drop-in.
   ============================================================================ */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

/* mono-rigged.glb = mesh Meshy + esqueleto Mixamo (65 huesos) + textura Meshy
   en WebP, draco-compressed → 39 MB → 1.55 MB (96% reduccion).
   Si trae animaciones del FBX (no T-pose), el componente las reproduce con
   useAnimations; si solo trae T-pose, la lógica procedural de poses sigue
   animandolo (bobbing + spin + lean + squash). */
const MONO_SRC = "/assets/3d/mono-rigged.glb";
useGLTF.preload(MONO_SRC);

/* Umbral: si la animacion del GLB dura menos que esto, asumimos que es
   T-pose estatica (los FBX de Mixamo sin animacion eligida traen 2 frames =
   ~0.03s) y NO la reproducimos — todo el movimiento queda procedural. */
const ANIM_MIN_DURATION_S = 0.5;

const PILLAR_COUNT  = 4;
const PROGRESS_IN   = 0.08;
const PROGRESS_OUT  = 0.92;

const TARGET_SIZE     = 2.4;   // alto del mono en unidades 3D — auto-fit
const GROUP_Y_OFFSET  = -0.6;  // baja la composicion para no chocar con texto del pilar
const POSITION_DAMP   = 7;
const ROTATION_DAMP   = 5;
const SCALE_DAMP      = 7;
const OFFSET_DIVISOR  = 5;     // viewport.width/OFFSET_DIVISOR = magnitud lateral
const TRANSITION_START = 0.40;
const TRANSITION_END   = 1.00;

/* POSES — parametros de movimiento del mono por pilar. Pensado como
   storytelling visual de Source → Build → Release → Archive:
     0  .001 Source   → flotando, gira lento sobre si mismo (descubrimiento)
     1  .002 Build    → squash + lean + rebote rapido (martillando, trabajando)
     2  .003 Release  → salto alto, stretch vertical, spin rapido (liberacion)
     3  .004 Archive  → quieto, respiracion suave (estado final, en pose) */
type Pose = {
  yLift: number;     // offset Y baseline
  bobAmp: number;    // amplitud bobbing senoidal
  bobFreq: number;   // frecuencia bobbing (ciclos/s aprox)
  spinSpeed: number; // rad/s — giro continuo Y
  baseRotY: number;  // rotacion Y base (mira a un lado)
  baseRotZ: number;  // lean lateral
  baseRotX: number;  // tilt frontal
  scaleX: number;
  scaleY: number;
  scaleZ: number;
};

const POSES: Pose[] = [
  /* .001 SOURCE — descubrimiento. Flota alto, gira lento sobre Y. */
  {
    yLift: 0.25,
    bobAmp: 0.20,
    bobFreq: 0.9,
    spinSpeed: 0.55,
    baseRotY: 0,
    baseRotZ: 0,
    baseRotX: -0.08,
    scaleX: 1.00, scaleY: 1.00, scaleZ: 1.00,
  },
  /* .002 BUILD — trabajando. Lean a la izquierda, squash horizontal,
     rebote rapido como martillazos. */
  {
    yLift: -0.05,
    bobAmp: 0.10,
    bobFreq: 2.6,
    spinSpeed: 0.0,
    baseRotY: -0.35,
    baseRotZ: 0.22,
    baseRotX: 0.05,
    scaleX: 1.06, scaleY: 0.93, scaleZ: 1.06,
  },
  /* .003 RELEASE — salto. Stretch vertical, spin rapido, mira arriba.
     Lo mas dramatico — celebracion. */
  {
    yLift: 0.55,
    bobAmp: 0.30,
    bobFreq: 1.5,
    spinSpeed: 1.6,
    baseRotY: 0,
    baseRotZ: 0,
    baseRotX: -0.18,
    scaleX: 0.92, scaleY: 1.13, scaleZ: 0.92,
  },
  /* .004 ARCHIVE — final. Pose tranquila, respira lento, leve giro al lado
     opuesto al de Build (mirando el archivo). */
  {
    yLift: 0.05,
    bobAmp: 0.06,
    bobFreq: 0.6,
    spinSpeed: 0.0,
    baseRotY: 0.30,
    baseRotZ: -0.05,
    baseRotX: 0.04,
    scaleX: 1.00, scaleY: 1.00, scaleZ: 1.00,
  },
];

/* Signo del offset lateral por pilar (replica exacta de MissionBoxes):
     pilar 0 (.001): texto IZQ → mono DER → +1
     pilar 1 (.002): texto DER → mono IZQ → -1
     pilar 2 (.003): texto IZQ → mono DER → +1
     pilar 3 (.004): texto DER → mono IZQ → -1                                 */
function pillarSign(pillarIdx: number): number {
  return pillarIdx % 2 === 0 ? 1 : -1;
}

function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const L = THREE.MathUtils.lerp;
  return {
    yLift:     L(a.yLift,     b.yLift,     t),
    bobAmp:    L(a.bobAmp,    b.bobAmp,    t),
    bobFreq:   L(a.bobFreq,   b.bobFreq,   t),
    spinSpeed: L(a.spinSpeed, b.spinSpeed, t),
    baseRotY:  L(a.baseRotY,  b.baseRotY,  t),
    baseRotZ:  L(a.baseRotZ,  b.baseRotZ,  t),
    baseRotX:  L(a.baseRotX,  b.baseRotX,  t),
    scaleX:    L(a.scaleX,    b.scaleX,    t),
    scaleY:    L(a.scaleY,    b.scaleY,    t),
    scaleZ:    L(a.scaleZ,    b.scaleZ,    t),
  };
}

interface MonkeyProps {
  progressRef: React.MutableRefObject<number>;
}

function Monkey({ progressRef }: MonkeyProps) {
  const { scene, animations } = useGLTF(MONO_SRC);
  const ref = useRef<THREE.Group>(null);
  /* Acumulamos el spin frame por frame en lugar de calcular state.clock*spinSpeed
     porque spinSpeed cambia entre poses — si lo hicieramos directo, el angulo
     daria saltos al cambiar de pose. Acumulando dt*spinSpeed la posicion angular
     es continua aunque la velocidad cambie. */
  const accumulatedSpin = useRef(0);

  /* Auto-fit del GLB a TARGET_SIZE y recentrado al origen — la posicion del
     <group> wrapper representa entonces el centro real del mono, sin sorpresas
     por el pivot nativo del modelo.
     CRITICO con modelos riggeados (skinned mesh): NO clonamos el scene porque
     el skeleton del mesh apunta a los huesos por referencia. Si clonamos solo
     con scene.clone(), el clon termina con un skin roto (skeleton hueérfano)
     y el mesh se renderiza en T-pose colapsada o invisible. Usamos el scene
     directo — ok porque este componente monta solo una instancia. */
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

  /* Reproducir la animacion del Mixamo SOLO si tiene duracion util.
     Si el FBX descargado de Mixamo no tenia animacion elegida, baja con
     T-pose estatica (~0.03s, 2 frames) — en ese caso skipeamos useAnimations
     y todo el movimiento queda en la capa procedural (bobbing, spin, squash).
     useAnimations debe llamarse SIEMPRE (es un hook) — el filtro va en el
     useEffect que decide si reproducirla. */
  const { actions, names } = useAnimations(animations, ref);
  useEffect(() => {
    if (!names.length) return;
    const firstAction = actions[names[0]];
    if (!firstAction) return;
    const duration = firstAction.getClip().duration;
    if (duration < ANIM_MIN_DURATION_S) return; // T-pose, skip
    firstAction.reset().play();
    firstAction.setLoop(THREE.LoopRepeat, Infinity);
  }, [actions, names]);

  useFrame((state, dt) => {
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
    const tInPillar = activeIndex - currentPillar;

    const isLastPillar = currentPillar === PILLAR_COUNT - 1;
    const poseNow  = POSES[currentPillar];
    const poseNext = isLastPillar ? poseNow : POSES[currentPillar + 1];
    const transitionT = THREE.MathUtils.smoothstep(
      tInPillar,
      TRANSITION_START,
      TRANSITION_END
    );
    const pose = lerpPose(poseNow, poseNext, transitionT);

    accumulatedSpin.current += pose.spinSpeed * dt;

    const bob = Math.sin(state.clock.elapsedTime * pose.bobFreq * Math.PI) * pose.bobAmp;
    const targetY = pose.yLift + bob;

    /* Mini-sway lateral senoidal (4% rad ≈ 2.3°) — vida sutil incluso en pose
       quieta. Distinto del lean baseRotZ que cambia por pose. */
    const sway = Math.sin(state.clock.elapsedTime * 1.3) * 0.04;
    const targetRotX = pose.baseRotX;
    const targetRotZ = pose.baseRotZ + sway;
    const targetRotY = pose.baseRotY + accumulatedSpin.current;

    const kPos = 1 - Math.exp(-dt * POSITION_DAMP);
    obj.position.y += (targetY - obj.position.y) * kPos;

    const kRot = 1 - Math.exp(-dt * ROTATION_DAMP);
    obj.rotation.x += (targetRotX - obj.rotation.x) * kRot;
    obj.rotation.z += (targetRotZ - obj.rotation.z) * kRot;
    /* Rotacion Y: asignacion directa, no lerp — el spin acumulado YA es
       continuo, y un lerp sobre angulos sin unwrap puede dar tirones al cruzar
       2π. baseRotY se interpola via lerpPose, asi que la transicion sigue suave. */
    obj.rotation.y = targetRotY;

    const kScale = 1 - Math.exp(-dt * SCALE_DAMP);
    obj.scale.x += (pose.scaleX - obj.scale.x) * kScale;
    obj.scale.y += (pose.scaleY - obj.scale.y) * kScale;
    obj.scale.z += (pose.scaleZ - obj.scale.z) * kScale;
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
  /* lateralRef agrupa el mono y aplica el offset izq/der por pilar, replicando
     la mecanica del wrapper de MissionBoxes — asi alterna lado siguiendo al
     texto de cada pilar (IZQ↔DER) con misma curva smoothstep. */
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
      /* Camara mas cerca y mas baja que MissionBoxes (que estaba elevada para
         mirar el anillo orbital desde arriba). Para un personaje, queremos
         vista frontal a la altura de los hombros → Y=0.8 y Z=5.5. FOV 36
         mantiene poca distorsion (consistente con la otra seccion). */
      camera={{ position: [0, 0.8, 5.5], fov: 36 }}
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
