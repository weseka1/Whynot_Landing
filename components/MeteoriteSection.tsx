"use client";

/* ============================================================================
   ARTIFACT SECTION — antes "Meteorite". Ahora muestra el GLB de Balenciaga
   3XL como artefacto orbitando en un escenario futurista.

   Herramientas R3F (mismas que GlassOrb3D + MissionPillarMonkey):
     - useGLTF (drei, Draco habilitado por default) → carga balenciaga-3xl.glb
     - Center + bbox fit → escala/centra el modelo sin importar pivot del GLB
     - Environment preset "city" → reflejos metálicos en piezas del modelo
     - MeshReflectorMaterial → piso espejado con blur (look platform/futuro)
     - Sparkles → partículas orbitando (atmósfera)
     - Stars (drei) → campo de estrellas de fondo
     - Float → leve flotación del artefacto
     - Anillos orbitales (3 torus) rotando en ejes desincronizados → HUD 3D
     - HTML overlay: scanlines + corner markers + system_text → look holográfico

   Mantengo id="section-meteorite" porque hay CSS targeteando ese selector en
   globals.css y links externos a esa ancla.
   ============================================================================ */

import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Environment,
  Float,
  MeshReflectorMaterial,
  Sparkles,
  Stars,
  useGLTF,
} from "@react-three/drei";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";
import { useInViewport } from "./useInViewport";

/* Asset optimizado con `npm run optimize:glb` → 41.25 MB → 1.21 MB
   (Draco mesh + WebP textures + 1024px max). Drei useGLTF carga el decoder
   Draco desde gstatic CDN automáticamente.                                */
const ARTIFACT_SRC = "/assets/3d/balenciaga-3xl.glb";
useGLTF.preload(ARTIFACT_SRC);

const TARGET_SIZE = 2.6;

/* ----------------------------------------------------------------------------
   Artifact — el modelo 3D del Balenciaga 3XL.
   - Clonado con scene.clone(true) (no es skinned, no necesita SkeletonUtils)
   - Centrado vía bbox + escalado al TARGET_SIZE en su eje más largo
   - Rotación sostenida en Y (orbitando) para mostrar todas las caras
   ---------------------------------------------------------------------------- */
function Artifact() {
  const { scene } = useGLTF(ARTIFACT_SRC);
  const groupRef = useRef<THREE.Group>(null);

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = TARGET_SIZE / longest;
    c.scale.setScalar(fitScale);
    c.updateMatrixWorld(true);
    bbox.setFromObject(c);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    c.position.sub(center);
    /* Boost de metalness/contraste en materiales que sean MeshStandard.
       No tocamos texturas — solo subimos envMapIntensity para que la
       reflexión del Environment "city" pegue más fuerte y le dé el toque
       futurista que pidió el usuario.                                     */
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const apply = (m: THREE.MeshStandardMaterial) => {
          if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            m.envMapIntensity = 1.25;
          }
        };
        if (Array.isArray(mat)) mat.forEach(apply);
        else apply(mat as THREE.MeshStandardMaterial);
      }
    });
    return c;
  }, [scene]);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;
    g.rotation.y += delta * 0.45;
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}

/* ----------------------------------------------------------------------------
   OrbitRings — 3 toruses delgados rotando en ejes desincronizados.
   Estética HUD 3D sutil alrededor del artefacto, sin tapar la zapa.
   ---------------------------------------------------------------------------- */
function OrbitRings({ isMobile }: { isMobile: boolean }) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const c = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (a.current) a.current.rotation.z += delta * 0.18;
    if (b.current) b.current.rotation.x += delta * 0.22;
    if (c.current) c.current.rotation.y += delta * 0.10;
  });

  return (
    <group>
      <mesh ref={a} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[2.2, 0.005, 8, 96]} />
        <meshBasicMaterial color="#f4a982" transparent opacity={0.55} />
      </mesh>
      {!isMobile && (
        <mesh ref={b} rotation={[Math.PI / 3, Math.PI / 6, 0]}>
          <torusGeometry args={[2.6, 0.004, 8, 96]} />
          <meshBasicMaterial color="#5da3ff" transparent opacity={0.38} />
        </mesh>
      )}
      <mesh ref={c} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[3.0, 0.003, 8, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

/* ----------------------------------------------------------------------------
   ReflectiveFloor — piso espejado con blur. Igual look que showrooms 3D
   modernos: la zapa "flota" sobre un reflejo borroso de sí misma.
   Mobile: bajamos blur y resolución para no tankear FPS.
   ---------------------------------------------------------------------------- */
function ReflectiveFloor({ isMobile }: { isMobile: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.3, 0]}>
      <planeGeometry args={[14, 14]} />
      <MeshReflectorMaterial
        blur={isMobile ? [120, 60] : [320, 120]}
        resolution={isMobile ? 256 : 512}
        mixBlur={1.4}
        mixStrength={1.0}
        roughness={0.95}
        depthScale={0.8}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#0a0a0a"
        metalness={0.55}
        mirror={0}
      />
    </mesh>
  );
}

export default function MeteoriteSection() {
  const isMobile = useIsMobile();
  /* Pausa el render loop de R3F cuando el canvas esta fuera del viewport.
     frameloop="never" deja el canvas montado (no remountamos GLB ni stars)
     pero detiene useFrame → ahorro de CPU/GPU sustancial.                 */
  const { ref: canvasContainerRef, isInView } = useInViewport<HTMLDivElement>({
    rootMargin: "100px",
  });

  return (
    <section
      id="section-meteorite"
      style={{
        position: "relative",
        background:
          "radial-gradient(ellipse at center, #0d0a13 0%, #050307 70%, #020103 100%)",
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
          // ARTIFACT_03
        </span>
        <span className="system-text" style={{ color: "var(--color-accent)" }}>
          BLNC_3XL_CORE
        </span>
        <span className="system-text" style={{ color: "var(--color-accent)" }}>
          STATUS: ORBITING
        </span>
      </div>

      {/* CANVAS 3D */}
      <div
        ref={canvasContainerRef}
        style={{ position: "relative", minHeight: 520 }}
      >
        {/* Big back-title */}
        <h2
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-marquee)",
            fontSize: "clamp(6rem, 22vw, 18rem)",
            letterSpacing: "0.05em",
            color: "rgba(244,169,130,0.06)",
            textTransform: "uppercase",
            pointerEvents: "none",
            zIndex: 0,
          }}
        >
          3XL
        </h2>

        {/* Scanline overlay (CSS gradient repetido). Encima del canvas pero
            con pointer-events:none y opacity baja → no estorba la lectura.  */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "repeating-linear-gradient(0deg, rgba(244,169,130,0.045) 0px, rgba(244,169,130,0.045) 1px, transparent 1px, transparent 3px)",
            mixBlendMode: "screen",
            pointerEvents: "none",
            zIndex: 2,
          }}
        />

        {/* Corner brackets — UI holográfica */}
        {[
          { top: 0, left: 0, borderTop: 1, borderLeft: 1 },
          { top: 0, right: 0, borderTop: 1, borderRight: 1 },
          { bottom: 0, left: 0, borderBottom: 1, borderLeft: 1 },
          { bottom: 0, right: 0, borderBottom: 1, borderRight: 1 },
        ].map((p, i) => (
          <div
            key={i}
            aria-hidden
            style={{
              position: "absolute",
              width: 28,
              height: 28,
              pointerEvents: "none",
              zIndex: 3,
              ...(p as React.CSSProperties),
              borderTopWidth: p.borderTop ? 1 : 0,
              borderBottomWidth: p.borderBottom ? 1 : 0,
              borderLeftWidth: p.borderLeft ? 1 : 0,
              borderRightWidth: p.borderRight ? 1 : 0,
              borderStyle: "solid",
              borderColor: "rgba(244,169,130,0.55)",
            }}
          />
        ))}

        <Canvas
          frameloop={isInView ? "always" : "never"}
          camera={{ position: [0, 0.6, 5.2], fov: 35 }}
          style={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}
          dpr={isMobile ? 1 : [1, 1.5]}
          gl={{
            antialias: !isMobile,
            powerPreference: "high-performance",
            alpha: true,
          }}
          shadows
        >
          <color attach="background" args={["#050307"]} />
          <fog attach="fog" args={["#050307", 6, 14]} />

          <ambientLight intensity={0.35} />
          <directionalLight
            position={[5, 6, 5]}
            intensity={1.6}
            color="#ffd9b8"
            castShadow
          />
          <directionalLight
            position={[-4, -2, -3]}
            intensity={0.55}
            color="#5da3ff"
          />
          <pointLight position={[0, 2.5, 2]} intensity={0.45} color="#ffffff" />
          {/* Rim cálido por detrás para silueta tipo studio */}
          <pointLight position={[0, 1.0, -3]} intensity={0.7} color="#f4a982" />

          <Suspense fallback={null}>
            {!isMobile && <Environment preset="city" background={false} />}

            <Stars
              radius={50}
              depth={50}
              count={isMobile ? 300 : 1200}
              factor={3}
              saturation={0}
              fade
              speed={isMobile ? 0 : 0.4}
            />

            <Sparkles
              count={isMobile ? 30 : 70}
              scale={[6, 4, 6]}
              size={3}
              speed={0.35}
              opacity={0.7}
              color="#f4a982"
            />

            <ReflectiveFloor isMobile={isMobile} />
            <OrbitRings isMobile={isMobile} />

            <Float
              speed={1.2}
              rotationIntensity={0.15}
              floatIntensity={0.4}
              floatingRange={[-0.05, 0.05]}
            >
              <Artifact />
            </Float>
          </Suspense>
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
          <span>MODEL:</span>
          <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)" }}>
            BALENCIAGA 3XL
          </span>
        </div>
        <div
          className="system-text"
          style={{ display: "grid", gap: 2, textAlign: "center" }}
        >
          <span>ORBIT AXIS:</span>
          <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)" }}>
            Y · 0.45 rad/s
          </span>
        </div>
        <div
          className="system-text"
          style={{ display: "grid", gap: 2, textAlign: "right" }}
        >
          <span>RENDER MODE:</span>
          <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)" }}>
            HOLOGRAPHIC
          </span>
        </div>
      </div>
    </section>
  );
}
