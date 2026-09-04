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
  useCallback,
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
import { useInViewport } from "./useInViewport";

type Accent = "white" | "silver" | "gold";

/* Paleta tonal pensada para escena oscura (#0a0a0e bg):
     key = warm directional, rim = cool emisivo anillos,
     bg  = backdrop circular oscuro tonalmente con accent */
/* bg UNIFORME para los 3 accents -> ningun lado del sphere muestra un
   color distinto cuando el parallax o la rotacion exponen un crescent.
   Antes silver=#0a0b0f, gold=#0e0c08 -> variaciones sutiles pero visibles
   al lado del orbe iluminado. Todos a #0c0e12 (matchea con white que era
   el que el usuario decia que se veia perfecto).                           */

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
function useVideoTexture(
  src: string,
  onReady?: () => void
): THREE.VideoTexture | null {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  /* Ref para que el effect no se re-corra si el padre pasa una callback
     nueva en cada render — solo nos importa que apunte a la mas reciente. */
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

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

    /* Notificar cuando el video tiene al menos el primer frame decodificado
       (readyState >= 2 = HAVE_CURRENT_DATA). Antes de esto la videoTexture
       existe pero no tiene contenido — pintarla daria un frame negro/raro
       y producia el flash de "esfera negra sin zapatilla" que el usuario
       reportaba.                                                            */
    const fireReady = () => onReadyRef.current?.();
    if (video.readyState >= 2) {
      /* Si el video ya estaba cached (segunda visita) disparamos en el
         proximo microtask para no chocar con el ciclo de mount.            */
      queueMicrotask(fireReady);
    } else {
      video.addEventListener("loadeddata", fireReady, { once: true });
    }

    return () => {
      video.removeEventListener("loadeddata", fireReady);
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
function Sneaker({
  videoSrc,
  onReady,
}: {
  videoSrc: string;
  onReady?: () => void;
}) {
  const texture = useVideoTexture(videoSrc, onReady);
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
   BACKDROP — el canvas es TRANSPARENTE (4-sep-2026).
   ----------------------------------------------------------------------------
   Antes esto pintaba un fondo oscuro solido, y para taparlo hacia falta una
   esfera mas grande que el viewport MAS un gradiente pearl encima del borde.
   Tres capas peleandose: el resultado se veia como un disco gris opaco, no
   como vidrio.

   Ahora la escena no tiene fondo propio: se ve la seccion detras. La esfera
   refracta el fondo REAL de la pagina, que es lo que hace que se lea como
   cristal y no como una bola de plastilina.
   ============================================================================ */
/* Sin fondo de escena: el canvas es transparente y la zapatilla se apoya
   sobre el fondo real de la seccion. El color pearl que se pintaba aca
   existia para que la esfera tuviera algo claro que refractar; sin esfera,
   solo tapaba. */
function Backdrop() {
  const { scene } = useThree();
  useMemo(() => {
    scene.background = null;
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
  onReady,
}: {
  videoSrc: string;
  accent: Accent;
  isMobile: boolean;
  perfDegraded: boolean;
  onReady?: () => void;
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

      {/* === STARS — solo desktop. En mobile el viewport del porthole es
              tan chico que las stars apenas se ven y costaban ~3-5ms/frame
              extra (vertex shader + alpha blend de 300+ points).            */}
      {!lowQuality && (
        <Stars
          radius={50}
          depth={50}
          count={1200}
          factor={3}
          saturation={0}
          fade
          speed={0.4}
        />
      )}

      {/* === SPARKLES — idem stars: en mobile lo omitimos completamente.
              El bloom desktop hace la mayor parte del look "luminoso", y
              sin bloom las sparkles solas se ven planas.                  */}
      {!lowQuality && (
        <Sparkles
          count={70}
          scale={[6, 4, 6]}
          size={3}
          speed={0.35}
          opacity={0.7}
          color="#f4a982"
        />
      )}

      {/* Los anillos tipo Saturno tambien salen: sin la esfera quedaban como
          aros flotando alrededor de una zapatilla, puro adorno sci-fi de la
          plantilla. */}

      {/* La esfera se saco el 4-sep-2026. Envolver la zapatilla en una
          burbuja de cristal la tapaba, le bajaba la nitidez (todo el producto
          pasaba por la refraccion) y se leia como efecto por el efecto mismo:
          "el efecto ese es extremadamente IA y horrible, ademas baja mucho la
          calidad" (Juani, viendolo en su iPhone). El producto se muestra, no
          se decora. */}

      {/* Removed: ReflectiveFloor + ContactShadows. Generaban el "puddle"
         oscuro en la mitad inferior del orbe (el sphere via transmission
         reflejaba el piso #0a0a0e + las sombras de contacto). Sin floor,
         la sphere queda uniformemente iluminada por el HDRI.              */}

      {/* === SNEAKER Golden Goose (video texture, alpha real) === */}
      <Sneaker videoSrc={videoSrc} onReady={onReady} />

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
  /* sceneReady = video tiene su primer frame decodificado (HAVE_CURRENT_DATA).
     Hasta entonces el porthole queda invisible (opacity 0) — antes se veia
     el orbe oscuro sin la zapatilla, y el usuario reportaba que ese estado
     "intermedio" se veia feo. Cuando el frame esta listo, fade-in suave.
     Reseteo al cambiar de item (videoSrc cambia) -> cada Golden Goose
     entra con su propio fade.                                              */
  const [sceneReady, setSceneReady] = useState(false);
  useEffect(() => {
    setSceneReady(false);
  }, [videoSrc]);
  const handleSceneReady = useCallback(() => setSceneReady(true), []);
  /* Frameloop "demand"/never cuando el porthole esta fuera de viewport.
     Pausa: video texture, sphere rotation, parallax, postproc.
     En mobile el ahorro es critico — sin esto el Canvas seguia tirando
     ~16ms/frame aun con el usuario mirando otra seccion.                 */
  const { ref: wrapperRef, isInView } = useInViewport<HTMLDivElement>({
    rootMargin: "150px",
  });

  /* Defensa contra el bug del dark crescent intermitente: R3F a veces
     mide el canvas mientras el motion.div padre todavia tiene scale
     animandose. CSS transforms NO disparan ResizeObserver, asi que el
     canvas queda atascado en el size medido al inicio (chico). Forzamos
     un resize manual al montar y de nuevo despues de 600ms para cubrir
     cualquier animacion de entrada residual.                            */
  useEffect(() => {
    const fire = () => window.dispatchEvent(new Event("resize"));
    fire();
    const t = setTimeout(fire, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "absolute",
        inset: 0,
        /* Sin porthole (4-sep-2026): era un disco oscuro recortado en circulo
           para contener la escena. Con la esfera afuera quedaba un circulo
           negro con la zapatilla adentro — que es justo lo que se veia en el
           iPhone de Juani. Ahora el canvas es transparente y la zapatilla
           flota sobre el fondo claro de la seccion, sin marco. */
        background: "transparent",
        opacity: sceneReady ? 1 : 0,
        transition: "opacity 380ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      {/* El overlay radial pearl que iba aca se saco el 4-sep-2026: existia
          para tapar el "dark crescent" entre la esfera y el borde del
          porthole. Con el canvas transparente ese crescent no existe, y el
          gradiente solo servia para ensuciar el borde del vidrio. */}
      <Canvas
        /* dpr: en mobile el cap de 1.5x daba canvas de hasta 720k pixels
           por porthole de 480x480. Bajamos a 1 fijo (240k pixels) —
           imperceptible visualmente a esa distancia y mitad de fillrate.  */
        dpr={isMobile ? 1 : [1, 2]}
        gl={{
          antialias: !isMobile,
          /* true: sin esto el canvas pinta negro donde no hay geometria y
             vuelve el "disco opaco". Con alpha, la esfera flota sobre la
             seccion. */
          alpha: true,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        camera={{ position: [0, 0, 4.7], fov: 36, near: 0.1, far: 60 }}
        /* frameloop: pausa el render cuando el porthole esta fuera de
           viewport (mismo patron que MeteoriteSection/GlassOrb3D).        */
        frameloop={isInView ? "always" : "never"}
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
            onReady={handleSceneReady}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}

const SneakerPlanet = memo(SneakerPlanetImpl);
export default SneakerPlanet;
