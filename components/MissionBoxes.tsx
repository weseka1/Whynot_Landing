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
import { useIsMobile } from "./useIsMobile";

const BOX_SOURCES = [
  "/assets/3d/boxes/box-1-bape.glb",
  "/assets/3d/boxes/box-2-balenciaga.glb",
  "/assets/3d/boxes/box-3-hands.glb",
  "/assets/3d/boxes/box-4-dior.glb",
];

/* Los GLB están comprimidos con Draco — drei carga el decoder automáticamente
   desde la CDN oficial de Google (gstatic). No requiere configuración extra. */

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
  isMobile: boolean;
}

function BoxStar({ progressRef, isMobile }: BoxStarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const driftRef = useRef(0);  // acumulador del giro continuo (no se reinicia)

  /* Drift rate: en mobile lo desactivamos (0) para que el canvas se
     mantenga estático cuando el usuario no scrollea → menos render
     load, mejor batería.                                                            */
  const DRIFT_RATE = isMobile ? 0 : 0.35;

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;
    const p = progressRef.current;
    driftRef.current += dt * DRIFT_RATE;
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
  const isMobile = useIsMobile();

  useMotionValueEvent(progress, "change", (v) => {
    progressRef.current = v;
  });

  /* En mobile bajamos DPR (1 fijo en lugar de 2) y simplificamos lighting
     → menos draw calls + render más liviano + batería+CPU+GPU.            */
  return (
    <Canvas
      camera={{ position: [0, 1.8, 6.5], fov: 38 }}
      dpr={isMobile ? 1 : [1, 2]}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
    >
      {/* Lighting — en mobile solo 2 lights, no pointLight */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 6, 5]} intensity={1.6} color="#ffd9b8" />
      {!isMobile && (
        <>
          <directionalLight position={[-4, -2, -3]} intensity={0.5} color="#5da3ff" />
          <pointLight position={[0, 0, 5]} intensity={0.6} color="#ffffff" />
        </>
      )}

      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.4}>
          <BoxStar progressRef={progressRef} isMobile={isMobile} />
        </Bounds>
      </Suspense>
    </Canvas>
  );
}
