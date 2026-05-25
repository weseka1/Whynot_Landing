"use client";

/* ============================================================================
   SneakerPlanet — escena WebGL "product showcase" premium.
   ============================================================================
   Rework profesional: el contenedor ES un porthole circular oscuro (clipado
   con border-radius + overflow:hidden) sobre el pearl bg de la seccion. El
   WebGL se desarrolla DENTRO de ese porthole sobre fondo oscuro → bloom y
   reflejos cromados destacan en vez de "quemar" sobre cream.

   Aprendizajes del v1 (que se veia mal):
     - Bloom 0.55 sobre bg claro quema todo → ahora bloom 0.18 + bg oscuro.
     - ChromaticAberration postproc agregaba franjas RGB feas → REMOVIDA.
     - Rim point light (1.1 intensity, atras-izq) creaba un hot spot que en
       la sphere transmission parecia "la zapa duplicada en reflejos" →
       cambiado a area light suave atras.
     - Anillos con tilts diagonales (0.38π, -0.32π, 0.22π) cruzaban la zapa
       como rajaduras → ahora cerca de la equatorial (PI/2 + chico delta) y
       sin ticks aliased.
     - Plane con depthTest:false + toneMapped:false bloomeaba sin limite →
       toneMapped:true para que entre al pipeline de tone mapping.

   Stack: R3F + drei (MeshTransmissionMaterial, ContactShadows, Environment,
   Sparkles, Stars, Billboard, AdaptiveDpr, PerformanceMonitor) +
   postprocessing (solo Bloom + Vignette).

   Mobile fallback (useIsMobile): postproc off, transmission off,
   ContactShadows off, particulas /3.
   ============================================================================ */

import { Suspense, memo, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Sparkles,
  Stars,
  Float,
  MeshTransmissionMaterial,
  MeshReflectorMaterial,
  ContactShadows,
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
  useGLTF,
} from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

/* Mismo GLB que usa MeteoriteSection (al fondo). Pre-procesado con
   `npm run optimize:glb` -> 41 MB -> 1.21 MB (Draco + WebP + 1024 max).  */
const ARTIFACT_SRC = "/assets/3d/balenciaga-3xl.glb";
useGLTF.preload(ARTIFACT_SRC);

type Accent = "white" | "silver" | "gold";

/* Paleta tonal pensada para escena oscura (#0a0a0e bg):
     key = warm directional, rim = cool emisivo anillos,
     bg  = backdrop circular oscuro tonalmente con accent */
const ACCENT: Record<
  Accent,
  { key: string; rim: string; ring: string; bg: string; particles: string }
> = {
  white:  { key: "#fbf6ec", rim: "#cad7e2", ring: "#e6edf4", bg: "#0c0e12", particles: "#f0f3f8" },
  silver: { key: "#f3f4f6", rim: "#aebdce", ring: "#cdd5de", bg: "#0a0b0f", particles: "#dde2ea" },
  gold:   { key: "#ffe6b8", rim: "#b7977a", ring: "#d3aa6d", bg: "#0e0c08", particles: "#e8c98c" },
};

interface SneakerPlanetProps {
  /* videoSrc se mantiene en la API por compat con Collections — ya no se
     usa (la zapa ahora es el GLB 3D Balenciaga 3XL, misma tecnica que
     MeteoriteSection). El accent sigue cambiando lighting/rings/material. */
  videoSrc?: string;
  accent?: Accent;
  posterSrc?: string;
}

/* ============================================================================
   ARTIFACT — GLB 3D REAL (Balenciaga 3XL), misma tecnica que MeteoriteSection.
   ============================================================================
   Sustituye el viejo plane con video texture por geometria 3D real:
     - useGLTF carga el .glb (Draco decoded, ya optimizado a 1.21 MB)
     - scene.clone(true) -> instance independiente por mount (permite tener
       2 escenas del mismo modelo si haria falta)
     - bbox fit a TARGET_SIZE para que la zapa quepa dentro del cristal
     - envMapIntensity boost segun accent -> reflejos del HDRI mas/menos
       intensos (gold mas intenso, silver medio, white neutral)
     - Float (drei) hace el motion organico (Y bobbing + slight tilt)
     - useFrame rotation Y continua -> "spin" del producto
   ============================================================================ */
function Artifact({ accent, isMobile }: { accent: Accent; isMobile: boolean }) {
  const { scene } = useGLTF(ARTIFACT_SRC);
  const groupRef = useRef<THREE.Group>(null);

  /* Boost por accent: gold +50%, silver +30%, white neutral. */
  const envBoost = accent === "gold" ? 1.55 : accent === "silver" ? 1.30 : 1.05;
  /* Tamano: que entre comodo en la sphere (radio 1.55). 1.55 wide deja
     ~0.05 de margen. */
  const TARGET = 1.55;

  const cloned = useMemo(() => {
    const c = scene.clone(true);
    c.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(c);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const longest = Math.max(size.x, size.y, size.z) || 1;
    const fitScale = TARGET / longest;
    c.scale.setScalar(fitScale);
    c.updateMatrixWorld(true);
    bbox.setFromObject(c);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    c.position.sub(center);

    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const mesh = o as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = false;
        const mat = mesh.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const apply = (m: THREE.MeshStandardMaterial) => {
          if ((m as THREE.MeshStandardMaterial).isMeshStandardMaterial) {
            m.envMapIntensity = envBoost;
          }
        };
        if (Array.isArray(mat)) mat.forEach(apply);
        else apply(mat as THREE.MeshStandardMaterial);
      }
    });
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, envBoost]);

  /* Spin continuo sobre Y (mostrar todas las caras del producto). */
  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.35;
  });

  return (
    <Float
      speed={isMobile ? 0 : 1.4}
      rotationIntensity={isMobile ? 0 : 0.25}
      floatIntensity={isMobile ? 0 : 0.35}
      floatingRange={[-0.05, 0.05]}
    >
      <group ref={groupRef}>
        <primitive object={cloned} />
      </group>
    </Float>
  );
}

/* ============================================================================
   REFLECTIVE FLOOR — piso espejado bajo el producto. Mismo recipe que
   MeteoriteSection pero a escala porthole.
   ============================================================================ */
function ReflectiveFloor({ isMobile }: { isMobile: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.0, 0]}>
      <planeGeometry args={[8, 8]} />
      <MeshReflectorMaterial
        blur={isMobile ? [100, 50] : [280, 100]}
        resolution={isMobile ? 256 : 512}
        mixBlur={1.3}
        mixStrength={0.95}
        roughness={0.92}
        depthScale={0.6}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#0a0a0e"
        metalness={0.55}
        mirror={0}
      />
    </mesh>
  );
}

/* ============================================================================
   GLASS SPHERE — cristal premium SIN distortion/chromatic (eso lo hacia
   verse "amateur"). Solo highlights y attenuation tinted.
   ============================================================================ */
function GlassSphere({
  accent,
  isMobile,
}: {
  accent: Accent;
  isMobile: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const c = ACCENT[accent];

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });

  if (isMobile) {
    return (
      <mesh ref={ref} renderOrder={5}>
        <sphereGeometry args={[1.55, 32, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0}
          roughness={0.10}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.10}
          envMapIntensity={1.0}
          transparent
          opacity={0.16}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  return (
    <mesh ref={ref} renderOrder={5}>
      <sphereGeometry args={[1.55, 80, 80]} />
      <MeshTransmissionMaterial
        backside={false}
        samples={6}
        thickness={0.20}
        chromaticAberration={0}
        anisotropy={0.10}
        distortion={0}
        distortionScale={0}
        temporalDistortion={0}
        roughness={0.04}
        ior={1.25}
        attenuationColor={c.ring}
        attenuationDistance={4.5}
        color="#ffffff"
        transmission={1}
        clearcoat={1}
        clearcoatRoughness={0.06}
      />
    </mesh>
  );
}

/* ============================================================================
   ORBIT RING — anillo Saturno cerca de la equatorial. Sin tick extra (era
   la causa de las "rajaduras" diagonales del v1).
   ============================================================================ */
function OrbitRing({
  radius,
  thickness,
  tilt,
  speed,
  color,
  emissiveBoost = 1,
  segments = 160,
}: {
  radius: number;
  thickness: number;
  tilt: [number, number, number];
  speed: number;
  color: string;
  emissiveBoost?: number;
  segments?: number;
}) {
  const ref = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * speed;
  });

  return (
    <group rotation={tilt}>
      <group ref={ref}>
        <mesh renderOrder={-5}>
          <torusGeometry args={[radius, thickness, 32, segments]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.65 * emissiveBoost}
            metalness={0.90}
            roughness={0.18}
            transparent
            opacity={0.78}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================================
   PARALLAX RIG — camera lerp suave con mouse.
   ============================================================================ */
function ParallaxRig({ isMobile }: { isMobile: boolean }) {
  const { camera, mouse } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 4.7));

  useFrame(() => {
    if (isMobile) return;
    target.current.x = mouse.x * 0.32;
    target.current.y = mouse.y * 0.22;
    target.current.z = 4.7;
    camera.position.lerp(target.current, 0.04);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ============================================================================
   BACKDROP — fondo oscuro tonal dentro del scene (mejor que Canvas style bg
   porque permite radial gradient real via shader).
   ============================================================================ */
function Backdrop({ accent }: { accent: Accent }) {
  const c = ACCENT[accent];
  const { scene } = useThree();
  /* Set scene.background directo a un color tonal accent. */
  useMemo(() => {
    scene.background = new THREE.Color(c.bg);
    return () => {
      scene.background = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.bg]);
  return null;
}

/* ============================================================================
   SCENE
   ============================================================================ */
function Scene({
  accent,
  isMobile,
  perfDegraded,
}: {
  accent: Accent;
  isMobile: boolean;
  perfDegraded: boolean;
}) {
  const c = ACCENT[accent];
  const lowQuality = isMobile || perfDegraded;

  return (
    <>
      <Backdrop accent={accent} />

      {/* === LIGHTING - 3 sources solo (key + fill + Environment) === */}
      <ambientLight intensity={0.30} />
      <directionalLight
        position={[3.5, 4, 4]}
        intensity={1.1}
        color={c.key}
        castShadow={false}
      />
      <directionalLight
        position={[-2.5, 1.5, 2]}
        intensity={0.35}
        color={c.rim}
      />

      {/* === HDRI - "studio" da reflejos limpios para producto luxury.
              "city" era mas "city street" - mas sucio.                 */}
      {!lowQuality && <Environment preset="studio" />}

      {/* === STARS de fondo, mucho mas sutiles que v1 (eran 1200) === */}
      <Stars
        radius={28}
        depth={16}
        count={lowQuality ? 180 : 520}
        factor={1.4}
        saturation={0}
        fade
        speed={0.18}
      />

      {/* === 2 ANILLOS cerca de la equatorial — pasan POR DETRAS del zapa
              en el frente y POR DELANTE atras. Tilts chicos (PI/2 ± 0.18)
              dejan el centro horizontal libre, la zapa no es cruzada.   */}
      <OrbitRing
        radius={2.05}
        thickness={0.008}
        tilt={[Math.PI / 2 + 0.18, 0.0, 0.05]}
        speed={0.06}
        color={c.ring}
        emissiveBoost={1.0}
        segments={lowQuality ? 96 : 200}
      />
      <OrbitRing
        radius={2.55}
        thickness={0.005}
        tilt={[Math.PI / 2 - 0.22, 0.18, -0.04]}
        speed={-0.04}
        color={c.ring}
        emissiveBoost={0.75}
        segments={lowQuality ? 96 : 200}
      />

      {/* === GLASS SPHERE (renderOrder 5) === */}
      <GlassSphere accent={accent} isMobile={lowQuality} />

      {/* === PISO ESPEJADO debajo de la zapa (replica MeteoriteSection) === */}
      <ReflectiveFloor isMobile={lowQuality} />

      {/* === CONTACT SHADOW extra para reforzar el grounding sobre el piso === */}
      {!lowQuality && (
        <ContactShadows
          position={[0, -0.99, 0]}
          opacity={0.55}
          scale={3.5}
          blur={2.4}
          far={3}
          resolution={256}
          color="#000000"
        />
      )}

      {/* === PARTICULAS muy sutiles, casi solo polvo === */}
      <Sparkles
        count={lowQuality ? 28 : 75}
        scale={[5, 4, 5]}
        size={lowQuality ? 1.0 : 1.6}
        speed={0.18}
        opacity={0.55}
        color={c.particles}
      />

      {/* === ARTIFACT GLB 3D real (misma tecnica que MeteoriteSection) === */}
      <Artifact accent={accent} isMobile={lowQuality} />

      {/* === POSTPROC - Bloom MUY sutil + Vignette. Sin chromatic ab. === */}
      {!lowQuality && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={0.22}
            luminanceThreshold={0.62}
            luminanceSmoothing={0.18}
            mipmapBlur
            radius={0.65}
          />
          <Vignette eskil={false} offset={0.38} darkness={0.62} />
        </EffectComposer>
      )}
    </>
  );
}

/* ============================================================================
   ROOT — wrapper circular clipado (porthole)
   ============================================================================ */
function SneakerPlanetImpl({
  accent = "gold",
  posterSrc,
}: SneakerPlanetProps) {
  const isMobile = useIsMobile();
  const [perfDegraded, setPerfDegraded] = useState(false);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        /* PORTHOLE: clipado circular del canvas oscuro sobre el pearl bg de
           la seccion. Sin este clip el cuadrado oscuro del scene cortaba el
           layout. Borde sutil para definir el orbe.                        */
        borderRadius: "50%",
        overflow: "hidden",
        background: posterSrc
          ? `center / contain no-repeat url(${posterSrc}), #0a0b0f`
          : "#0a0b0f",
        boxShadow:
          "inset 0 0 0 1px rgba(255,255,255,0.06), 0 30px 60px -20px rgba(20,18,15,0.35)",
      }}
    >
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{
          antialias: !isMobile,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0, 4.7], fov: 36, near: 0.1, far: 60 }}
        frameloop="always"
      >
        <Suspense fallback={null}>
          <PerformanceMonitor
            onDecline={() => setPerfDegraded(true)}
            onIncline={() => setPerfDegraded(false)}
            ms={250}
          />
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <ParallaxRig isMobile={isMobile} />
          <Scene
            accent={accent}
            isMobile={isMobile}
            perfDegraded={perfDegraded}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

const SneakerPlanet = memo(SneakerPlanetImpl);
export default SneakerPlanet;
