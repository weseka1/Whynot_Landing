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
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

type Accent = "white" | "silver" | "gold";

/* Paleta tonal pensada para escena oscura (#0a0a0e bg):
     key = warm directional, rim = cool emisivo anillos,
     bg  = backdrop circular oscuro tonalmente con accent */
/* bg UNIFORME para los 3 accents -> ningun lado del sphere muestra un
   color distinto cuando el parallax o la rotacion exponen un crescent.
   Antes silver=#0a0b0f, gold=#0e0c08 -> variaciones sutiles pero visibles
   al lado del orbe iluminado. Todos a #0c0e12 (matchea con white que era
   el que el usuario decia que se veia perfecto).                           */
const SCENE_BG = "#0c0e12";

const ACCENT: Record<
  Accent,
  { key: string; rim: string; ring: string; particles: string }
> = {
  white:  { key: "#fbf6ec", rim: "#cad7e2", ring: "#e6edf4", particles: "#f0f3f8" },
  silver: { key: "#f3f4f6", rim: "#aebdce", ring: "#cdd5de", particles: "#dde2ea" },
  gold:   { key: "#ffe6b8", rim: "#b7977a", ring: "#d3aa6d", particles: "#e8c98c" },
};

interface SneakerPlanetProps {
  videoSrc: string;
  accent?: Accent;
  posterSrc?: string;
}

/* ============================================================================
   VIDEO TEXTURE — Golden Goose webm como THREE.VideoTexture. La zapa real
   del producto, no un GLB generico.
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
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
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
   SNEAKER — plane billboarded con video Golden Goose (alpha real).
   - depthTest:false + renderOrder=100 -> SIEMPRE visible
   - toneMapped:true -> entra al pipeline, no satura el bloom
   ============================================================================ */
function Sneaker({ videoSrc }: { videoSrc: string }) {
  const texture = useVideoTexture(videoSrc);
  const ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    /* Z fijo en 0.4 -> zapa adelantada hacia el frente del orbe (sphere
       front face = z 1.55). Menos vidrio entre la zapa y la camara -> el
       ghost de refraccion casi desaparece, sigue "adentro" del cristal.  */
    ref.current.position.y = Math.sin(t * 0.5) * 0.05;
    ref.current.position.z = 0.4;
    ref.current.rotation.z = Math.sin(t * 0.4) * 0.01;
  });

  if (!texture) return null;

  const W = 1.85;
  const H = 1.388;

  return (
    <Billboard follow lockX={false} lockY={false} lockZ={false}>
      <mesh ref={ref} renderOrder={100}>
        <planeGeometry args={[W, H]} />
        <meshBasicMaterial
          map={texture}
          transparent
          depthTest={false}
          depthWrite={false}
          toneMapped
          alphaTest={0.04}
        />
      </mesh>
    </Billboard>
  );
}

/* ============================================================================
   GLASS SPHERE — cristal premium SIN distortion/chromatic (eso lo hacia
   verse "amateur"). Solo highlights y attenuation tinted.
   ============================================================================ */
function GlassSphere({ isMobile }: { isMobile: boolean }) {
  const ref = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });

  if (isMobile) {
    return (
      <mesh ref={ref} renderOrder={5}>
        <sphereGeometry args={[1.85, 32, 32]} />
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

  /* Cristal MAS SUTIL para matar el fantasma de la zapa refractada:
     - transmission 1 -> 0.55  (menos refraccion = menos ghost visible)
     - samples 6 -> 3          (menos bounces de refraccion interna)
     - thickness 0.20 -> 0.08  (cristal mas fino, casi una piel de orbe)
     - roughness 0.04 -> 0.10  (levemente frosted, suaviza cualquier residuo)
     El attenuationColor tinted + clearcoat 1 conservan el "look luxury"
     premium, pero el sphere es ahora mas highlight/halo y menos lente.   */
  /* attenuationColor FIJO neutro-blanco para los 3 accents. Antes usaba
     c.ring (silver=gris frio, gold=dorado calido) -> el lado no iluminado
     de la sphere quedaba oscuro/saturado, que era la "parte negra" que el
     usuario notaba en 02/03 vs 01. Ahora las 3 spheres son iguales
     opticamente; el accent solo cambia luces, particulas y anillos.       */
  /* Sphere radius 1.55 -> 1.85: ahora SOBREPASA el viewport del canvas
     (camera z=4.7, fov=36 -> visible half-height = 4.7*tan(18deg) = 1.53).
     Sphere diametro 3.7 vs viewport 3.06 -> el sphere overshoots el canvas
     en todos los costados, garantizando que NUNCA se vea el bg dark
     crescent al lado del orbe (que era la "parte negra" que el usuario
     veia en 02/03 cuando el parallax o la rotacion del sphere exponian
     el bg).                                                                */
  return (
    <mesh ref={ref} renderOrder={5}>
      <sphereGeometry args={[1.85, 80, 80]} />
      <MeshTransmissionMaterial
        backside={false}
        samples={3}
        thickness={0.08}
        chromaticAberration={0}
        anisotropy={0.08}
        distortion={0}
        distortionScale={0}
        temporalDistortion={0}
        roughness={0.10}
        ior={1.20}
        attenuationColor="#f0f3f8"
        attenuationDistance={6.0}
        color="#ffffff"
        transmission={0.55}
        clearcoat={1}
        clearcoatRoughness={0.06}
      />
    </mesh>
  );
}

/* ============================================================================
   ORBIT RINGS — 3 toruses delgados rotando en ejes desincronizados. EXACTO
   recipe que MeteoriteSection (orange / blue / white, meshBasicMaterial,
   tilts fijos en el group + rotation animada en el mesh propio).
   Misma estetica HUD 3D sutil que la seccion del 3xl al final de la pagina.
   ============================================================================ */
function OrbitRings({ isMobile }: { isMobile: boolean }) {
  const a = useRef<THREE.Mesh>(null);
  const b = useRef<THREE.Mesh>(null);
  const c = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (a.current) a.current.rotation.z += dt * 0.18;
    if (b.current) b.current.rotation.x += dt * 0.22;
    if (c.current) c.current.rotation.y += dt * 0.10;
  });

  return (
    <group>
      <mesh ref={a} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[2.2, 0.005, 8, 96]} />
        <meshBasicMaterial color="#f4a982" transparent opacity={0.55} />
      </mesh>
      {/* Anillo AZUL en FRENTE de la zapa: renderOrder 200 (despues de la
         zapa que va en 100) + depthTest:false -> el arco azul cruza por
         delante de la silueta del producto, dando el look "ring orbiting
         around it" del que pidio el usuario.                              */}
      {!isMobile && (
        <mesh ref={b} rotation={[Math.PI / 3, Math.PI / 6, 0]} renderOrder={200}>
          <torusGeometry args={[2.6, 0.004, 8, 96]} />
          <meshBasicMaterial
            color="#5da3ff"
            transparent
            opacity={0.55}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh ref={c} rotation={[0, 0, Math.PI / 4]}>
        <torusGeometry args={[3.0, 0.003, 8, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.18} />
      </mesh>
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
    /* Parallax MUY sutil. Antes 0.32/0.22 -> exponia el bg crescent al
       lado del sphere cuando el mouse iba al borde. Ahora 0.15/0.10
       conserva el efecto cinematografico pero sin chance de mover el
       sphere fuera del viewport.                                        */
    target.current.x = mouse.x * 0.15;
    target.current.y = mouse.y * 0.10;
    target.current.z = 4.7;
    camera.position.lerp(target.current, 0.04);
    camera.lookAt(0, 0, 0);
  });
  return null;
}

/* ============================================================================
   BACKDROP — fondo oscuro UNIFORME para los 3 accents (matchea el wrapper
   porthole, evita el crescent dark visible cuando el sphere no llena 100%).
   ============================================================================ */
function Backdrop() {
  const { scene } = useThree();
  useMemo(() => {
    scene.background = new THREE.Color(SCENE_BG);
    return () => {
      scene.background = null;
    };
  }, [scene]);
  return null;
}

/* ============================================================================
   SCENE
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
      <Backdrop />

      {/* === LIGHTING — mismo recipe que MeteoriteSection (key warm + rim
              fria + fill warm bajo). Tinted con el accent.                */}
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
      {/* point light calida atras-abajo, replica del 3xl */}
      <pointLight position={[0, 1.0, -3]} intensity={0.55} color="#f4a982" />

      {/* === HDRI "city" — mismo preset que el 3xl, para que los reflejos
              en el cristal se sientan iguales en las 2 escenas.            */}
      {!lowQuality && <Environment preset="city" background={false} />}

      {/* === STARS — config IDENTICA al 3xl: radius 50, depth 50,
              count 1200, factor 3, speed 0.4 (en desktop). */}
      <Stars
        radius={50}
        depth={50}
        count={lowQuality ? 300 : 1200}
        factor={3}
        saturation={0}
        fade
        speed={lowQuality ? 0 : 0.4}
      />

      {/* === SPARKLES — "pintitas tipo estrellas" igual al 3xl: color
              naranja calido #f4a982, size 3, opacity 0.7, count 70. */}
      <Sparkles
        count={lowQuality ? 30 : 70}
        scale={[6, 4, 6]}
        size={3}
        speed={0.35}
        opacity={0.7}
        color="#f4a982"
      />

      {/* === ANILLOS — 3 toruses orange/blue/white EXACTOS al 3xl === */}
      <OrbitRings isMobile={lowQuality} />

      {/* === GLASS SPHERE — envuelve al producto en el porthole === */}
      <GlassSphere isMobile={lowQuality} />

      {/* Removed: ReflectiveFloor + ContactShadows. Generaban el "puddle"
         oscuro en la mitad inferior del orbe (el sphere via transmission
         reflejaba el piso #0a0a0e + las sombras de contacto). Sin floor,
         la sphere queda uniformemente iluminada por el HDRI.              */}

      {/* === SNEAKER Golden Goose (video texture, alpha real) === */}
      <Sneaker videoSrc={videoSrc} />

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
      {/* Overlay radial pearl-edge: cubre el dark crescent al borde del
         porthole, sin tocar la sphere ni el render 3D.
         CLAVE: "circle 50% at center" → el 100% del gradient queda atado
         al borde INSCRITO del circulo (porthole edge), no a la esquina
         del cuadrado. Sin esto, el pearl quedaba en las esquinas
         clipeadas por el borderRadius:50% y casi nada llegaba al edge
         visible del porthole.
         Stops: transparente al 65% (sphere vive ahi sin tocar), fade
         denso hasta pearl al 92% -> cubre la franja oscura entre sphere
         y borde con un transition suave que se siente como vineta.       */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(circle 50% at center, transparent 65%, var(--color-pearl) 92%)",
          zIndex: 2,
        }}
      />
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
        style={{ position: "relative", zIndex: 1 }}
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
