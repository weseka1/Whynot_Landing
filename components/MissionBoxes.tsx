"use client";

/* ============================================================================
   MISSION BOXES — Three.js Canvas con 4 cajas formando estrella.

   Fase 1 — POC:
     - Carga los 4 GLB con useGLTF
     - Las posiciona en un patrón de estrella (4 brazos, plano XY)
     - Rota el grupo entero usando el scroll progress (auto-rotation extra)
     - Sin lógica de drop-off (eso es Fase 2)
   ============================================================================ */

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Bounds } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";

const BOX_SOURCES = [
  "/assets/3d/boxes/box-1-bape.glb",
  "/assets/3d/boxes/box-2-balenciaga.glb",
  "/assets/3d/boxes/box-3-hands.glb",
  "/assets/3d/boxes/box-4-dior.glb",
];

// Preload todos los GLB (drei los cachea)
BOX_SOURCES.forEach((src) => useGLTF.preload(src));

interface BoxProps {
  src: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}

function Box({ src, position, rotation, scale }: BoxProps) {
  const { scene } = useGLTF(src);
  // Cloneamos el scene para que cada instancia sea independiente
  const cloned = useMemo(() => scene.clone(), [scene]);
  return (
    <primitive
      object={cloned}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}

interface BoxStarProps {
  progressRef: React.MutableRefObject<number>;
}

function BoxStar({ progressRef }: BoxStarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const driftRef = useRef(0);  // acumulador del giro continuo (no se reinicia)

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const p = progressRef.current;

    /* Rotación UNICA sobre el eje Y → orbit tipo carrusel.
       Dos componentes que se SUMAN cada frame (no se sobrescriben):
         · scroll-tied: 4 vueltas en el recorrido total. Reacciona al scroll
           hacia adelante Y hacia atrás.
         · drift continuo: el grupo gira siempre, aún si el usuario no scrollea
           (acumulador independiente).                                              */
    driftRef.current += dt * 0.35;
    g.rotation.y = p * Math.PI * 4 + driftRef.current;
  });

  /* Distribución de 4 puntas sobre el plano HORIZONTAL (XZ).
     Cada caja queda a misma altura (Y=0), separadas 90° alrededor del centro.
     La rotación del grupo en Y hace que orbiten como en un carrusel.                  */
  const RADIUS = 2.2;
  const positions: [number, number, number][] = [
    [ RADIUS, 0,       0], // east
    [      0, 0,  RADIUS], // south (cerca de la cámara)
    [-RADIUS, 0,       0], // west
    [      0, 0, -RADIUS], // north (lejos de la cámara)
  ];

  /* Cada caja rota Y para "mirar hacia afuera" del centro
     (su cara frontal apunta radialmente fuera del orbit).                              */
  const rotations: [number, number, number][] = [
    [0,           0, 0], // east  → 0°
    [0,  Math.PI / 2, 0], // south → 90°
    [0,  Math.PI    , 0], // west  → 180°
    [0, -Math.PI / 2, 0], // north → -90°
  ];

  return (
    <group ref={groupRef}>
      {BOX_SOURCES.map((src, i) => (
        <Box
          key={src}
          src={src}
          position={positions[i]}
          rotation={rotations[i]}
          scale={1}
        />
      ))}
    </group>
  );
}

interface MissionBoxesProps {
  progress: MotionValue<number>;
}

export default function MissionBoxes({ progress }: MissionBoxesProps) {
  const progressRef = useRef(0);

  useMotionValueEvent(progress, "change", (v) => {
    progressRef.current = v;
  });

  return (
    <Canvas
      camera={{ position: [0, 1.8, 6.5], fov: 38 }}
      dpr={[1, 2]}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 6, 5]} intensity={1.6} color="#ffd9b8" />
      <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#5da3ff" />
      <pointLight position={[0, 0, 5]} intensity={0.6} color="#ffffff" />

      <Suspense fallback={null}>
        {/* Bounds auto-fitea el viewport a los modelos cargados */}
        <Bounds fit clip observe margin={1.4}>
          <BoxStar progressRef={progressRef} />
        </Bounds>
      </Suspense>
    </Canvas>
  );
}
