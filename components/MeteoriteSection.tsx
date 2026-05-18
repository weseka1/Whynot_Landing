"use client";

/* ============================================================================
   METEORITE SECTION — sección dedicada con meteorito 3D rotando.
   - WebGL via react-three-fiber (Three.js)
   - Geometría: Icosaedro de alta densidad con displacement procedural →
     superficie rocosa/cratereada típica de asteroide
   - Tumbling: rotación constante en los 3 ejes a velocidades distintas
   - Lighting: key light cálida + rim light suave + ambient bajo
   - Stars de fondo
   ============================================================================ */

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

function Meteorite() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Generamos una geometría con superficie irregular (cráteres)
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.4, 6);
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    // Hash-noise simple para perturbar cada vértice → look de roca
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const n =
        Math.sin(v.x * 4) * 0.05 +
        Math.cos(v.y * 5) * 0.04 +
        Math.sin(v.z * 6) * 0.06 +
        Math.sin(v.x * 9 + v.y * 7) * 0.03;
      v.multiplyScalar(1 + n);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    return geo;
  }, []);

  // Tumbling: rotaciones desincronizadas en los 3 ejes
  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;
    m.rotation.x += delta * 0.35;
    m.rotation.y += delta * 0.50;
    m.rotation.z += delta * 0.22;
  });

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow>
      <meshStandardMaterial
        color="#a37962"
        roughness={0.95}
        metalness={0.05}
        flatShading={false}
      />
    </mesh>
  );
}

export default function MeteoriteSection() {
  return (
    <section
      id="section-meteorite"
      style={{
        position: "relative",
        background: "#070707",
        color: "var(--color-accent)",
        minHeight: "100vh",
        padding: "var(--space-lg) var(--container-pad)",
        display: "grid",
        gridTemplateRows: "auto 1fr auto",
        gap: "var(--space-md)",
        borderTop: "1px solid var(--color-line)",
        overflow: "hidden",
      }}
    >
      {/* TOP LABELS */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span className="system-text" style={{ color: "var(--color-accent)" }}>
          // OBJECT_03
        </span>
        <span className="system-text" style={{ color: "var(--color-accent)" }}>
          METEOR_CORE
        </span>
        <span className="system-text" style={{ color: "var(--color-accent)" }}>
          STATUS: ROTATING
        </span>
      </div>

      {/* CANVAS 3D */}
      <div style={{ position: "relative", minHeight: 460 }}>
        {/* Título atrás */}
        <h2
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-marquee)",
            fontSize: "clamp(4rem, 16vw, 14rem)",
            letterSpacing: "0.05em",
            color: "rgba(244,169,130,0.06)",
            textTransform: "uppercase",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          METEOR
        </h2>

        <Canvas
          camera={{ position: [0, 0, 4.5], fov: 35 }}
          style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}
          dpr={[1, 2]}
        >
          {/* Lighting */}
          <ambientLight intensity={0.25} />
          <directionalLight
            position={[5, 4, 5]}
            intensity={1.6}
            color="#ffd9b8"
          />
          <directionalLight
            position={[-4, -2, -3]}
            intensity={0.4}
            color="#5da3ff"
          />

          {/* Stars de fondo */}
          <Stars
            radius={50}
            depth={50}
            count={1200}
            factor={3}
            saturation={0}
            fade
            speed={0.4}
          />

          <Meteorite />
        </Canvas>
      </div>

      {/* BOTTOM INFO */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "var(--space-md)",
          alignItems: "end",
          paddingTop: "var(--space-md)",
          borderTop: "1px solid var(--color-line)",
        }}
      >
        <div className="system-text" style={{ display: "grid", gap: 2 }}>
          <span>MASS:</span>
          <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)" }}>
            4.32e+09 kg
          </span>
        </div>
        <div
          className="system-text"
          style={{ display: "grid", gap: 2, textAlign: "center" }}
        >
          <span>TUMBLING AXIS:</span>
          <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)" }}>
            X · Y · Z
          </span>
        </div>
        <div
          className="system-text"
          style={{ display: "grid", gap: 2, textAlign: "right" }}
        >
          <span>TRAJECTORY:</span>
          <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)" }}>
            INBOUND
          </span>
        </div>
      </div>
    </section>
  );
}
