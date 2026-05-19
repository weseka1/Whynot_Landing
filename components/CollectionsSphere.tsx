"use client";

/* ============================================================================
   COLLECTIONS SPHERE — esfera 3D real con R3F (Three.js)
   - <Sphere> con meshPhysicalMaterial transmission=1 → vidrio refractante
   - 3 <Torus> torus rings inclinados (anillos planetarios reales 3D, no CSS)
   - Environment "studio" para reflejos sutiles
   - Lighting: key direccional calida + fill azul + ambient

   Diseñada para vivir DETRAS del video del producto en Collections. La
   esfera + anillos quedan visibles alrededor del video (que tiene mask
   radial en los bordes, dejando pasar el render 3D).
   ============================================================================ */

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment } from "@react-three/drei";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

function GlassSphere() {
  const ref = useRef<THREE.Mesh>(null);
  /* Rotacion lenta sobre Y → la luz/reflejos se mueven sutilmente */
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });

  /* Esfera BLANCA OPACA con shading direccional real (no cristal) — actua
     como el "fondo blanco" curvado donde va a flotar el producto. El
     lighting (directional + ambient + environment) genera highlights y
     terminador oscuro naturales: eso es lo que da la sensacion de esfera
     3D vs el circulo plano CSS anterior.                                 */
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.0, 96, 96]} />
      <meshPhysicalMaterial
        color="#ffffff"
        metalness={0.05}
        roughness={0.38}
        clearcoat={0.6}
        clearcoatRoughness={0.25}
        sheen={0.4}
        sheenColor="#fff4e0"
        sheenRoughness={0.5}
      />
    </mesh>
  );
}

function PlanetaryRings() {
  const refOuter = useRef<THREE.Mesh>(null);
  const refMid   = useRef<THREE.Mesh>(null);
  const refInner = useRef<THREE.Mesh>(null);

  /* Cada anillo rota a velocidad distinta sobre su eje normal al plano
     de los anillos (el grupo se inclina, asi rotan dentro de su plano). */
  useFrame((_, dt) => {
    if (refOuter.current) refOuter.current.rotation.z += dt * 0.04;
    if (refMid.current)   refMid.current.rotation.z   -= dt * 0.06;
    if (refInner.current) refInner.current.rotation.z += dt * 0.10;
  });

  /* group rotation: tilt tipo Saturno/Jupiter (~75° en X, leve Z) */
  return (
    <group rotation={[Math.PI / 2 - 0.32, 0, -0.18]}>
      <mesh ref={refOuter}>
        {/* Torus(radius, tube, radialSegments, tubularSegments) — radios
            ajustados para acompañar la sphere de 1.0 unidad.             */}
        <torusGeometry args={[1.55, 0.006, 8, 128]} />
        <meshStandardMaterial
          color="#a9a299"
          roughness={0.6}
          metalness={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh ref={refMid}>
        <torusGeometry args={[1.38, 0.004, 8, 128]} />
        <meshStandardMaterial
          color="#c9ad6b"
          roughness={0.5}
          metalness={0.4}
          transparent
          opacity={0.5}
        />
      </mesh>
      <mesh ref={refInner}>
        <torusGeometry args={[1.22, 0.003, 8, 128]} />
        <meshStandardMaterial
          color="#a9a299"
          roughness={0.7}
          metalness={0.2}
          transparent
          opacity={0.35}
        />
      </mesh>
    </group>
  );
}

interface Props {
  isInView: boolean;
}

export default function CollectionsSphere({ isInView }: Props) {
  const isMobile = useIsMobile();

  return (
    <Canvas
      /* frameloop on-demand cuando sale del viewport → 0 CPU/GPU. */
      frameloop={isInView ? "always" : "never"}
      camera={{ position: [0, 0, 3.6], fov: 38 }}
      dpr={isMobile ? 1 : [1, 1.5]}
      gl={{
        antialias: !isMobile,
        alpha: true,
        powerPreference: "high-performance",
      }}
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        pointerEvents: "none",
      }}
    >
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3, 4, 5]}
        intensity={1.2}
        color="#fffaf0"
      />
      {!isMobile && (
        <directionalLight
          position={[-3, -1, -2]}
          intensity={0.4}
          color="#c0d5ff"
        />
      )}
      <pointLight position={[0, 2, 2]} intensity={0.4} color="#ffffff" />

      {/* Environment para reflejos (drei built-in HDR studio). En mobile
          lo skipeamos para ahorrar memoria — la esfera igual se ve bien
          con solo las luces direccionales. */}
      {!isMobile && <Environment preset="studio" />}

      <GlassSphere />
      <PlanetaryRings />
    </Canvas>
  );
}
