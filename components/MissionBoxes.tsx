"use client";

/* ============================================================================
   MISSION BOXES — Drop-off progresivo 4→3→2→1.

     Pilar .001 → estrella de 4 puntas (las 4 cajas).
     Pilar .002 → triángulo de 3 puntas (bape ya quedó atrás).
     Pilar .003 → 2 cajas enfrentadas (bape + balenciaga atrás).
     Pilar .004 → 1 caja sola al centro (dior).

   Cada caja "soltada" se queda en su posición de salida y sube en world Y
   proporcional al scroll restante → desaparece por arriba (scroll natural).
   Si scrolleás hacia arriba, todas las cajas vuelven y reintegran la
   formación. Las formaciones también alternan izq/der según el pilar
   (texto IZQ → cajas DER, etc.), interpolando suave en la transición.
   ============================================================================ */

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const BOX_SOURCES = [
  "/assets/3d/boxes/box-1-bape.glb",       // .001 Source
  "/assets/3d/boxes/box-2-balenciaga.glb", // .002 Build
  "/assets/3d/boxes/box-3-hands.glb",      // .003 Release
  "/assets/3d/boxes/box-4-dior.glb",       // .004 Archive
];

BOX_SOURCES.forEach((src) => useGLTF.preload(src));

const PILLAR_COUNT  = BOX_SOURCES.length; // 4
const PROGRESS_IN   = 0.08;
const PROGRESS_OUT  = 0.92;

const R = 1.05;                 // radio de las formaciones — más chico = cajas más juntas
const SQRT3_2 = 0.8660254;      // sin(60°)
const BASE_SCALE = 0.50;        // scale base de cada caja (modelos GLB son grandes)
const GROUP_TILT_X = 0.16;      // inclinación del grupo en X → perspectiva isométrica
const SPIN_RATE = 0.32;         // rad/s — giro propio de cada caja
const ANCHOR_RISE = 4.8;        // unidades world que sube por unidad de activeIndex
const ANCHOR_FADE_START = 0.30;
const ANCHOR_FADE_END   = 0.85;
const TRANSITION_START = 0.40;  // % del pilar donde arranca la transición (más larga = más fluida)
const TRANSITION_END   = 1.00;
const POSITION_DAMP = 7;        // lerp temporal de posición — alto = sigue al target, bajo = perezoso
const OPACITY_DAMP  = 6;
const OFFSET_DIVISOR = 6;       // viewport.width/OFFSET_DIVISOR = magnitud del lateral izq/der

/* FORMATIONS[N][slot] = posición (x,y,z) del slot `slot` cuando hay N cajas activas.
   Slot 0 = la caja que va a anclarse al final de ESTE pilar (la "saliente").
   Slot 1.. = las que siguen al pilar(es) siguiente(s).
   Las posiciones están elegidas para que cada caja se mueva lo MÍNIMO al
   transicionar entre formaciones consecutivas (4→3→2→1).                       */
const FORMATIONS: Record<number, [number, number, number][]> = {
  4: [
    [ R,  0,  0],   // slot 0 → caja 0 (bape, sale al pilar 2)
    [ 0,  R,  0],   // slot 1 → caja 1
    [-R,  0,  0],   // slot 2 → caja 2
    [ 0, -R,  0],   // slot 3 → caja 3
  ],
  3: [
    [ 0,            R,        0], // slot 0 → caja 1 (bale, apex; sale al pilar 3)
    [-R * SQRT3_2, -R * 0.5,  0], // slot 1 → caja 2
    [ R * SQRT3_2, -R * 0.5,  0], // slot 2 → caja 3
  ],
  2: [
    [-R, 0, 0],     // slot 0 → caja 2 (hands; sale al pilar 4)
    [ R, 0, 0],     // slot 1 → caja 3
  ],
  1: [
    [0, 0, 0],      // slot 0 → caja 3 (dior, sola al centro)
  ],
};

/* Cuál es la posición de la caja `boxIdx` cuando estás en el pilar `pillarIdx`:
   - Cantidad de cajas activas en ese pilar: PILLAR_COUNT - pillarIdx
   - Slot de la caja: boxIdx - pillarIdx                                          */
function posOnPillar(pillarIdx: number, boxIdx: number): [number, number, number] {
  const N = PILLAR_COUNT - pillarIdx;
  const slot = boxIdx - pillarIdx;
  return FORMATIONS[N][slot];
}

/* Signo del offset lateral según el pilar:
     pilar 0 (.001): texto IZQ → cajas DER → +1
     pilar 1 (.002): texto DER → cajas IZQ → -1
     pilar 2 (.003): texto IZQ → cajas DER → +1
     pilar 3 (.004): texto DER → cajas IZQ → -1                                   */
function pillarSign(pillarIdx: number): number {
  return pillarIdx % 2 === 0 ? 1 : -1;
}

interface BoxProps {
  src: string;
  index: number;
  progressRef: React.MutableRefObject<number>;
}

function Box({ src, index, progressRef }: BoxProps) {
  const { scene } = useGLTF(src);
  const ref = useRef<THREE.Object3D>(null);
  const materialsRef = useRef<THREE.Material[]>([]);

  /* Clonamos scene + materiales para mutar opacity sin afectar otras instancias */
  const cloned = useMemo(() => {
    const c = scene.clone();
    const mats: THREE.Material[] = [];
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const mat = (mesh.material as THREE.Material).clone();
        mat.transparent = true;
        mesh.material = mat;
        mats.push(mat);
      }
    });
    materialsRef.current = mats;
    return c;
  }, [scene]);

  /* Phase offset por caja → no spinean todas en el mismo ángulo */
  const phaseOffset = useMemo(() => index * (Math.PI / 3), [index]);

  useFrame((state, dt) => {
    const obj = ref.current;
    if (!obj) return;

    const p = progressRef.current;
    const t = THREE.MathUtils.clamp(
      (p - PROGRESS_IN) / (PROGRESS_OUT - PROGRESS_IN),
      0,
      1
    );
    const activeIndex = t * PILLAR_COUNT; // 0..PILLAR_COUNT

    const currentPillar = Math.min(Math.floor(activeIndex), PILLAR_COUNT - 1);
    const tInPillar = activeIndex - currentPillar;

    // Offset lateral en world units (la formación se desplaza al lado del pilar)
    const offsetMagnitude = state.viewport.width / OFFSET_DIVISOR;

    let targetX: number, targetY: number, targetZ: number;
    let targetOpacity = 1;

    if (index < currentPillar) {
      /* ===== Caja ya ANCLADA (su pilar quedó atrás) ===== */
      const base = posOnPillar(index, index); // slot 0 de su formación de origen
      const scrollSince = activeIndex - (index + 1); // >= 0 (puede ser 0 al cruzar exacto)
      targetX = base[0] + pillarSign(index) * offsetMagnitude;
      targetY = base[1] + Math.max(scrollSince, 0) * ANCHOR_RISE;
      targetZ = base[2];

      const fadeT = THREE.MathUtils.smoothstep(
        Math.max(scrollSince, 0),
        ANCHOR_FADE_START,
        ANCHOR_FADE_END
      );
      targetOpacity = 1 - fadeT;
    } else {
      /* ===== Caja ACTIVA (en formación o transicionando) ===== */
      const posNow = posOnPillar(currentPillar, index);
      const signNow = pillarSign(currentPillar);

      let posTarget: [number, number, number];
      let signTarget: number;
      let transitionT: number;

      const isLastPillar = currentPillar === PILLAR_COUNT - 1;
      const isLeavingHere = index === currentPillar && !isLastPillar;

      if (isLastPillar) {
        posTarget = posNow;
        signTarget = signNow;
        transitionT = 0;
      } else if (isLeavingHere) {
        posTarget = posNow;
        signTarget = signNow;
        transitionT = THREE.MathUtils.smoothstep(tInPillar, TRANSITION_START, TRANSITION_END);
      } else {
        posTarget = posOnPillar(currentPillar + 1, index);
        signTarget = pillarSign(currentPillar + 1);
        transitionT = THREE.MathUtils.smoothstep(tInPillar, TRANSITION_START, TRANSITION_END);
      }

      targetX = THREE.MathUtils.lerp(posNow[0], posTarget[0], transitionT);
      targetY = THREE.MathUtils.lerp(posNow[1], posTarget[1], transitionT);
      targetZ = THREE.MathUtils.lerp(posNow[2], posTarget[2], transitionT);

      const signLerped = THREE.MathUtils.lerp(signNow, signTarget, transitionT);
      targetX += signLerped * offsetMagnitude;
    }

    /* Lerp temporal: la posición persigue al target con easing exponencial.
       Aunque target salte al cruzar pilares, la posición real interpola suavemente.
       Framerate-independent: `1 - exp(-dt*k)` da la misma respuesta en 60/120 fps. */
    const kPos = 1 - Math.exp(-dt * POSITION_DAMP);
    obj.position.x += (targetX - obj.position.x) * kPos;
    obj.position.y += (targetY - obj.position.y) * kPos;
    obj.position.z += (targetZ - obj.position.z) * kPos;

    /* Scale base fijo (modelos GLB son grandes en su unidad nativa) */
    obj.scale.setScalar(BASE_SCALE);

    /* Spin continuo basado en clock → no acumula drift en pausas */
    const t0 = state.clock.elapsedTime;
    obj.rotation.y = t0 * SPIN_RATE + phaseOffset;
    obj.rotation.x = Math.sin(t0 * SPIN_RATE * 0.6 + phaseOffset) * 0.18;

    /* Opacity también con damp para fade fluido */
    const kOp = 1 - Math.exp(-dt * OPACITY_DAMP);
    const currentOp = materialsRef.current[0]?.opacity ?? 1;
    const newOp = currentOp + (targetOpacity - currentOp) * kOp;
    for (const m of materialsRef.current) m.opacity = newOp;
    obj.visible = newOp > 0.01;
  });

  return <primitive ref={ref} object={cloned} />;
}

interface BoxStarProps {
  progressRef: React.MutableRefObject<number>;
}

function BoxStar({ progressRef }: BoxStarProps) {
  /* Tilt en X del grupo entero → la estrella se inclina hacia atrás,
     mostrando 3 caras de cada caja (efecto isométrico). La subida de
     las cajas ancladas se desplaza en world Y, que después del tilt
     sigue dando dirección "hacia arriba" en pantalla.                  */
  return (
    <group rotation={[GROUP_TILT_X, 0, 0]}>
      {BOX_SOURCES.map((src, i) => (
        <Box key={src} src={src} index={i} progressRef={progressRef} />
      ))}
    </group>
  );
}

interface MissionBoxesProps {
  progress: MotionValue<number>;
}

export default function MissionBoxes({ progress }: MissionBoxesProps) {
  const progressRef = useRef(0);
  const isMobile = useIsMobile();

  useMotionValueEvent(progress, "change", (v) => {
    progressRef.current = v;
  });

  return (
    <Canvas
      /* Cámara alejada + Y elevada → más perspectiva 3D, cajas se ven más chicas.
         FOV bajo (36) reduce distorsión en los bordes.                           */
      camera={{ position: [0, 1.1, 9], fov: 36 }}
      dpr={isMobile ? 1 : [1, 2]}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 6, 5]} intensity={1.6} color="#ffd9b8" />
      {!isMobile && (
        <>
          <directionalLight position={[-4, -2, -3]} intensity={0.55} color="#5da3ff" />
          <pointLight position={[0, 0, 5]} intensity={0.5} color="#ffffff" />
        </>
      )}

      <Suspense fallback={null}>
        <BoxStar progressRef={progressRef} />
      </Suspense>
    </Canvas>
  );
}
