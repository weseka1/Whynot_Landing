"use client";

/* ============================================================================
   MISSION BOXES — Three.js Canvas con 4 cajas formando estrella.

   Sincronización caja↔pilar:
     - Progress (0..1) se mapea a un activeIndex continuo (0..3) que sigue
       qué pilar se está leyendo.
     - El grupo rota en Y para traer la caja activa al frente de cámara (+Z).
     - Cada caja escala y se atenúa según qué tan al frente esté, usando
       cos(ánguloAparente) → transición suave, no binaria.
   ============================================================================ */

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, Bounds } from "@react-three/drei";
import { MotionValue, useMotionValueEvent } from "framer-motion";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const BOX_SOURCES = [
  "/assets/3d/boxes/box-1-bape.glb",       // .001 Source
  "/assets/3d/boxes/box-2-balenciaga.glb", // .002 Build
  "/assets/3d/boxes/box-3-hands.glb",      // .003 Release
  "/assets/3d/boxes/box-4-dior.glb",       // .004 Archive
];

/* Los GLB están comprimidos con Draco — drei carga el decoder automáticamente
   desde la CDN oficial de Google (gstatic). No requiere configuración extra. */

// Preload todos los GLB (drei los cachea)
BOX_SOURCES.forEach((src) => useGLTF.preload(src));

/* Ángulo en el plano XZ de cada caja respecto al frente (+Z), CCW desde arriba.
   - i=0 east (+X)  → -π/2
   - i=1 south (+Z) →  0
   - i=2 west (-X)  → +π/2
   - i=3 north (-Z) → +π
   Para llevar la caja i al frente, el grupo debe rotar Y a `-angles[i]`.   */
const ANGLES = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

/* Rango de progress en el que la sincronización está "activa" (después del
   título arriba y antes del fade-out final). Coincide con el window de
   opacidad del wrapper en Mission.tsx (0.08–0.92).                          */
const PROGRESS_IN  = 0.10;
const PROGRESS_OUT = 0.90;

const SCALE_FRONT = 1.35;  // tamaño cuando está al frente
const SCALE_BACK  = 0.55;  // tamaño cuando está atrás
const OPACITY_BACK = 0.22; // atenuación de las cajas no activas

interface BoxProps {
  src: string;
  position: [number, number, number];
  rotation: [number, number, number];
  baseAngle: number;
  groupRotYRef: React.MutableRefObject<number>;
}

function Box({ src, position, rotation, baseAngle, groupRotYRef }: BoxProps) {
  const { scene } = useGLTF(src);
  const ref = useRef<THREE.Object3D>(null);
  const materialsRef = useRef<THREE.Material[]>([]);

  // Cloneamos scene + materiales (para poder mutar opacity sin afectar otros)
  const cloned = useMemo(() => {
    const c = scene.clone();
    const mats: THREE.Material[] = [];
    c.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.material) {
        const original = mesh.material as THREE.Material;
        const mat = original.clone();
        mat.transparent = true;
        (mat as THREE.MeshStandardMaterial).depthWrite = true;
        mesh.material = mat;
        mats.push(mat);
      }
    });
    materialsRef.current = mats;
    return c;
  }, [scene]);

  useFrame(() => {
    const obj = ref.current;
    if (!obj) return;
    // Ángulo aparente: dónde está esta caja después de rotar el grupo.
    const apparent = baseAngle + groupRotYRef.current;
    // frontness: 1 = al frente (+Z), 0 = atrás (-Z). Suaviza con cos().
    const frontness = (Math.cos(apparent) + 1) / 2;
    const scale = THREE.MathUtils.lerp(SCALE_BACK, SCALE_FRONT, frontness);
    obj.scale.setScalar(scale);
    const op = THREE.MathUtils.lerp(OPACITY_BACK, 1, frontness);
    for (const m of materialsRef.current) m.opacity = op;
  });

  return (
    <primitive
      ref={ref}
      object={cloned}
      position={position}
      rotation={rotation}
    />
  );
}

interface BoxStarProps {
  progressRef: React.MutableRefObject<number>;
  isMobile: boolean;
}

function BoxStar({ progressRef, isMobile }: BoxStarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const groupRotYRef = useRef(0);

  /* Lerp factor: en mobile más bajo (~más liviano, transición un toque más floja) */
  const LERP_K = isMobile ? 3 : 5;

  useFrame((_, dt) => {
    const g = groupRef.current;
    if (!g) return;

    const p = progressRef.current;
    // Mapear progress al activeIndex continuo (0..3) dentro del rango visible.
    const t = THREE.MathUtils.clamp(
      (p - PROGRESS_IN) / (PROGRESS_OUT - PROGRESS_IN),
      0,
      1
    );
    const activeIndex = t * (BOX_SOURCES.length - 1); // 0..3

    // Target Y rotation para traer la caja `activeIndex` al frente.
    // angle de la caja i = ANGLES[i]; rotar grupo por -ANGLES[i] la lleva al frente.
    // Interpolación entre ANGLES como función lineal de i: ANGLES[i] = -π/2 + i·π/2.
    // → -ANGLES[activeIndex] = π/2 - activeIndex · π/2
    const targetRotY = Math.PI / 2 - activeIndex * (Math.PI / 2);

    const k = 1 - Math.exp(-dt * LERP_K);
    g.rotation.y = THREE.MathUtils.lerp(g.rotation.y, targetRotY, k);
    groupRotYRef.current = g.rotation.y;
  });

  /* Distribución de 4 puntas sobre el plano HORIZONTAL (XZ).
     Cada caja queda a misma altura (Y=0), separadas 90° alrededor del centro.    */
  const RADIUS = 2.2;
  const positions: [number, number, number][] = [
    [ RADIUS, 0,       0], // east  → .001
    [      0, 0,  RADIUS], // south → .002
    [-RADIUS, 0,       0], // west  → .003
    [      0, 0, -RADIUS], // north → .004
  ];

  /* Cada caja rota Y para "mirar hacia afuera" del centro
     (su cara frontal apunta radialmente fuera del orbit).                        */
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
          baseAngle={ANGLES[i]}
          groupRotYRef={groupRotYRef}
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
        {/* Bounds fit al mount: encuadra la estrella una sola vez.
            Sin `observe` para que el scale dinámico de las cajas no
            dispare re-frames constantes de la cámara.                    */}
        <Bounds fit clip margin={1.4}>
          <BoxStar progressRef={progressRef} isMobile={isMobile} />
        </Bounds>
      </Suspense>
    </Canvas>
  );
}
