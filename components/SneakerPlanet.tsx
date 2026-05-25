"use client";

/* ============================================================================
   SneakerPlanet — escena WebGL cinematografica para la AR capsule.
   ============================================================================
   La zapatilla (video WebM con alpha) se renderiza como un plane billboarded
   en el centro de la escena. Alrededor:
     - Esfera de cristal translucida (MeshPhysicalMaterial con transmission)
     - 3 anillos orbitales tipo Saturno, tilt distinto, contra-rotacion
     - Campo de particulas (drei Sparkles) + estrellas de fondo
     - Iluminacion premium: ambient + key warm/cool dir + rim + Environment HDRI
     - Postprocessing: Bloom selectivo + ChromaticAberration sutil + Vignette
     - Camera con parallax mouse (lerp suave)
     - Pause cuando off-viewport (frameloop="demand" + useFrame stop)

   REGLA CLAVE: la zapatilla SIEMPRE visible. El plane usa renderOrder alto
   + depthTest:false → nunca es ocluido por anillos / sphere / particulas.

   Mobile fallback:
     - DPR cap 1.5
     - Postprocessing desactivado
     - Particulas /4
     - Anillos con material simple (no metalness)
     - Transmission desactivada (transmission=0 → opaco)
   ============================================================================ */

import {
  Suspense,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Sparkles,
  Stars,
  Billboard,
  MeshTransmissionMaterial,
  AdaptiveDpr,
  AdaptiveEvents,
  PerformanceMonitor,
} from "@react-three/drei";
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

type Accent = "white" | "silver" | "gold";

const ACCENT: Record<Accent, { key: string; rim: string; ring: string; glow: string }> = {
  /* key = luz frontal calida; rim = back-light frio; ring = emisivo anillos;
     glow = bloom tint. Tonos pensados sobre fondo pearl con bloom suave. */
  white:  { key: "#fff8ee", rim: "#9eb6c8", ring: "#dfe6ee", glow: "#ffffff" },
  silver: { key: "#f0f3f7", rim: "#7a93ad", ring: "#c8d3df", glow: "#e6ecf2" },
  gold:   { key: "#ffe7b5", rim: "#5d7390", ring: "#d8b46c", glow: "#f6d394" },
};

interface SneakerPlanetProps {
  videoSrc: string;
  accent?: Accent;
  /* poster opcional → primer frame en CSS background mientras carga el WebGL */
  posterSrc?: string;
}

/* ============================================================================
   VIDEO TEXTURE — toma el WebM y lo convierte en THREE.VideoTexture.
   El video <element> se monta fuera del DOM (offscreen) y se reusa entre
   re-renders del mismo src. Cuando cambia el src, se reemplaza limpiamente.
   ============================================================================ */
function useVideoTexture(src: string): THREE.VideoTexture | null {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = src;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";
    /* Forzar play en navegadores que requieren user gesture: ya esta muted */
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => { /* fallback al poster */ });
    }

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    /* premultiplyAlpha=false → respetar el alpha del webm yuva420p */
    tex.premultiplyAlpha = false;

    setTexture(tex);

    return () => {
      tex.dispose();
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return texture;
}

/* ============================================================================
   SNEAKER PLANE — el plane billboarded con el video texture.
   ============================================================================ */
function Sneaker({ videoSrc }: { videoSrc: string }) {
  const texture = useVideoTexture(videoSrc);
  const ref = useRef<THREE.Mesh>(null);

  /* Floating organic motion: 2 senos desincronizados sobre y + leve tilt z */
  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 0.6) * 0.06;
    ref.current.rotation.z = Math.sin(t * 0.45) * 0.012;
  });

  if (!texture) return null;

  /* Tamano de la zapa para que quepa COMODA adentro de la sphere
     (radio ~1.45). Mantengo 4:3 del webm. */
  const W = 1.45;
  const H = 1.09;

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <mesh ref={ref} renderOrder={2}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial
          map={texture}
          transparent
          /* depthTest TRUE: la sphere con transmission refracta correctamente
             la zapa que esta DETRAS de su cara frontal -> efecto "planeta
             adentro del cristal". depthWrite false porque es alpha. */
          depthTest
          depthWrite={false}
          toneMapped={false}
          alphaTest={0.02}
        />
      </mesh>
    </Billboard>
  );
}

/* ============================================================================
   GLASS SPHERE — esfera translucida con transmission (refraccion tipo cristal).
   En mobile cae a un material physical simple con bajo opacity para no quemar
   la GPU (transmission requiere render-to-texture extra).
   ============================================================================ */
function GlassSphere({ accent, isMobile }: { accent: Accent; isMobile: boolean }) {
  const ref = useRef<THREE.Mesh>(null);
  const c = ACCENT[accent];

  /* Sutil rotacion para que los reflejos del HDRI roten y "vivan" */
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.05;
  });

  /* Mobile fallback: meshPhysicalMaterial simple sin transmission (que
     hace render-to-target costoso). Desktop: MeshTransmissionMaterial
     de drei → cristal real con refraccion verdadera de la zapa adentro. */
  if (isMobile) {
    return (
      <mesh ref={ref} renderOrder={5}>
        <sphereGeometry args={[1.45, 32, 32]} />
        <meshPhysicalMaterial
          color="#ffffff"
          transmission={0}
          roughness={0.10}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.10}
          envMapIntensity={1.0}
          transparent
          opacity={0.18}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

  /* Desktop: cristal premium con refraccion real. La sphere es CHICA
     (radio 1.45) → contiene la zapa (1.45x1.09) sin sobrar mucho.
     thickness controla cuanto se ve refractado el contenido.            */
  return (
    <mesh ref={ref} renderOrder={5}>
      <sphereGeometry args={[1.45, 64, 64]} />
      <MeshTransmissionMaterial
        backside={false}
        samples={6}
        thickness={0.35}
        chromaticAberration={0.04}
        anisotropy={0.18}
        distortion={0.10}
        distortionScale={0.30}
        temporalDistortion={0.10}
        roughness={0.05}
        ior={1.35}
        attenuationColor={c.ring}
        attenuationDistance={2.5}
        color="#ffffff"
        transmission={1}
        clearcoat={1}
        clearcoatRoughness={0.08}
      />
    </mesh>
  );
}

/* ============================================================================
   ORBIT RING — anillo tipo Saturno. Tilt fijo via group, rotacion sobre Y
   propio para que parezca "girando" alrededor del eje del anillo.
   ============================================================================ */
function OrbitRing({
  radius,
  thickness = 0.012,
  tilt,
  speed,
  color,
  emissiveBoost = 1,
  segments = 128,
}: {
  radius: number;
  thickness?: number;
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

  /* Anillo principal + 1 anillo "data tick" externo muy fino → look Saturno HUD */
  return (
    <group rotation={tilt}>
      <group ref={ref}>
        <mesh>
          <torusGeometry args={[radius, thickness, 16, segments]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.55 * emissiveBoost}
            metalness={0.85}
            roughness={0.25}
            transparent
            opacity={0.85}
            depthWrite={false}
          />
        </mesh>
        {/* tick exterior delgadisimo */}
        <mesh>
          <torusGeometry args={[radius + thickness * 6, thickness * 0.35, 8, segments]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.55}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

/* ============================================================================
   PARALLAX RIG — mueve la camara levemente segun mouse (lerp).
   Touch devices: skip (no mouse).
   ============================================================================ */
function ParallaxRig({ isMobile }: { isMobile: boolean }) {
  const { camera, mouse } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 4.6));

  useFrame(() => {
    if (isMobile) return;
    /* mouse: [-1, 1] normalizado. Amplifico chico (parallax sutil). */
    target.current.x = mouse.x * 0.45;
    target.current.y = mouse.y * 0.30;
    target.current.z = 4.6;
    camera.position.lerp(target.current, 0.045);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ============================================================================
   SCENE — todo lo que va dentro del Canvas.
   ============================================================================ */
function Scene({
  videoSrc,
  accent,
  isMobile,
  perfDegraded,
}: {
  videoSrc: string;
  accent: Accent;
  isMobile: boolean;
  perfDegraded: boolean;
}) {
  const c = ACCENT[accent];
  const lowQuality = isMobile || perfDegraded;

  return (
    <>
      {/* === LIGHTING MANAGER === */}
      <ambientLight intensity={0.45} />
      {/* key light calida (frente derecha-arriba) */}
      <directionalLight
        position={[3.5, 4, 3]}
        intensity={1.4}
        color={c.key}
        castShadow={false}
      />
      {/* rim fria (atras izquierda) → separacion del producto del bg */}
      <pointLight position={[-3.5, -1.5, -2]} intensity={1.1} color={c.rim} />
      {/* fill suave bajo */}
      <pointLight position={[0, -3, 2]} intensity={0.35} color="#ffffff" />

      {/* === ENVIRONMENT HDRI === */}
      {!lowQuality && <Environment preset="city" />}

      {/* === BG STARS muy sutiles, lejos === */}
      <Stars
        radius={50}
        depth={30}
        count={lowQuality ? 400 : 1200}
        factor={2.5}
        saturation={0}
        fade
        speed={0.3}
      />

      {/* === ORBITAL RINGS (renderOrder bajo → detras del producto) ===
          Tilts pensados para que la "tapa" frontal de cada anillo pase ARRIBA
          o ABAJO de la silueta del zapa, nunca cruzando por el centro. */}
      <OrbitRing
        radius={1.85}
        thickness={0.010}
        tilt={[Math.PI * 0.38, 0.12, 0.05]}
        speed={0.08}
        color={c.ring}
        emissiveBoost={1.1}
        segments={lowQuality ? 64 : 160}
      />
      <OrbitRing
        radius={2.15}
        thickness={0.007}
        tilt={[-Math.PI * 0.32, -0.25, 0.08]}
        speed={-0.05}
        color={c.ring}
        emissiveBoost={0.85}
        segments={lowQuality ? 64 : 160}
      />
      <OrbitRing
        radius={2.45}
        thickness={0.005}
        tilt={[Math.PI * 0.22, 0.45, -0.10]}
        speed={0.035}
        color={c.glow}
        emissiveBoost={0.7}
        segments={lowQuality ? 64 : 160}
      />

      {/* === GLASS SPHERE (renderOrder 1) === */}
      <GlassSphere accent={accent} isMobile={lowQuality} />

      {/* === PARTICLE FIELD === */}
      <Sparkles
        count={lowQuality ? 35 : 110}
        scale={[6, 4.5, 6]}
        size={lowQuality ? 1.4 : 2.2}
        speed={0.25}
        opacity={0.85}
        color={c.glow}
      />

      {/* === SNEAKER PLANE (renderOrder 100, depthTest:false → siempre visible) === */}
      <Sneaker videoSrc={videoSrc} />

      {/* === POSTPROCESSING === */}
      {!lowQuality && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom
            intensity={0.55}
            luminanceThreshold={0.55}
            luminanceSmoothing={0.22}
            mipmapBlur
          />
          <ChromaticAberration
            blendFunction={BlendFunction.NORMAL}
            offset={new THREE.Vector2(0.0006, 0.0010)}
            radialModulation={false}
            modulationOffset={0}
          />
          <Vignette eskil={false} offset={0.42} darkness={0.55} />
        </EffectComposer>
      )}
    </>
  );
}

/* ============================================================================
   ROOT — SneakerPlanet
   ============================================================================ */
function SneakerPlanetImpl({
  videoSrc,
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
        borderRadius: "inherit",
        background: posterSrc
          ? `center / contain no-repeat url(${posterSrc})`
          : undefined,
      }}
    >
      <Canvas
        dpr={[1, isMobile ? 1.5 : 2]}
        gl={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0, 4.6], fov: 38, near: 0.1, far: 100 }}
        frameloop="always"
        style={{ background: "transparent" }}
      >
        <Suspense fallback={null}>
          {/* Adaptive perf: si baja de 45fps activamos modo lowQuality */}
          <PerformanceMonitor
            onDecline={() => setPerfDegraded(true)}
            onIncline={() => setPerfDegraded(false)}
            ms={250}
          />
          <AdaptiveDpr pixelated />
          <AdaptiveEvents />
          <ParallaxRig isMobile={isMobile} />
          <Scene
            videoSrc={videoSrc}
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
