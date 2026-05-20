"use client";

/* ============================================================================
   GLASS ORB 3D — Esfera de vidrio REAL con WebGL (R3F + Three.js)
   --------------------------------------------------------------------------
   Renderiza una esfera transparente con material refractante real y el
   producto adentro como plano texturizado, flotando.

   FUENTES DE CONTENIDO SOPORTADAS:
     - .webm con alpha real (VP9 yuva420p) — preferido. Sin chroma key.
       Generado offline con `npm run bg:process`. Safari NO soporta VP9
       alpha → fallback automatico a PNG sequence si se pasa pngSequence.
     - .mp4/.mov con fondo (chroma key opcional via shader) — fallback
       backward-compat para videos sin pre-procesar.
     - .png/.webp/.jpg — imagen estatica, con chroma key opcional
       (offscreen canvas, una sola vez al cargar).
     - PNG sequence — fallback para Safari cuando no soporta WebM alpha.

   El switcher decide qué subcomponente usar segun la URL + capability.
   ============================================================================ */

import { useEffect, useState, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  MeshTransmissionMaterial,
  Environment,
  Float,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

/* ============================================================================
   Helpers
   ============================================================================ */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").padStart(6, "0");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function getExt(url: string): string {
  const m = url.toLowerCase().match(/\.([a-z0-9]+)(?:\?|#|$)/);
  return m ? m[1] : "";
}

/* Detecta si el browser soporta VP9 con alpha en WebM (Chrome/Firefox/Edge
   YES, Safari NO). Devuelve true conservadoramente cuando canPlayType
   indica al menos "maybe".                                              */
function supportsWebMAlpha(): boolean {
  if (typeof window === "undefined") return false;
  const v = document.createElement("video");
  const canVP9 = v.canPlayType('video/webm; codecs="vp9"');
  // Safari devuelve "" para VP9 webm. Resto: "probably" o "maybe".
  return canVP9 !== "";
}

/* ============================================================================
   ProductImagePlane — imagen estatica (.png/.webp/.jpg)
   Si tiene chromaKey, procesa con offscreen canvas (una sola vez).
   ============================================================================ */

function useProcessedTexture(
  url: string,
  chromaKey: string | null,
  tolerance = 100,
  feather = 25
) {
  const [data, setData] = useState<{ texture: THREE.Texture; aspect: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const aspect = w / h;

      if (!chromaKey) {
        const t = new THREE.Texture(img);
        t.needsUpdate = true;
        t.colorSpace = THREE.SRGBColorSpace;
        setData({ texture: t, aspect });
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const imgData = ctx.getImageData(0, 0, w, h);
      const px = imgData.data;
      const [kr, kg, kb] = hexToRgb(chromaKey);
      const tolSq = tolerance * tolerance;
      const featSq = (tolerance + feather) * (tolerance + feather);

      for (let i = 0; i < px.length; i += 4) {
        const dr = px[i] - kr;
        const dg = px[i + 1] - kg;
        const db = px[i + 2] - kb;
        const dSq = dr * dr + dg * dg + db * db;
        if (dSq < tolSq) {
          px[i + 3] = 0;
        } else if (dSq < featSq) {
          const d = Math.sqrt(dSq);
          const t = (d - tolerance) / feather;
          px[i + 3] = Math.round(px[i + 3] * t);
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const t = new THREE.CanvasTexture(canvas);
      t.colorSpace = THREE.SRGBColorSpace;
      setData({ texture: t, aspect });
    };
    img.onerror = () => console.warn(`GlassOrb3D: cannot load ${url}`);
    img.src = url;
    return () => { cancelled = true; };
  }, [url, chromaKey, tolerance, feather]);

  return data;
}

function ProductImagePlane({
  url,
  chromaKey,
}: {
  url: string;
  chromaKey: string | null;
}) {
  const data = useProcessedTexture(url, chromaKey);
  if (!data) return null;
  const SCALE = 1.4;
  return (
    <mesh>
      <planeGeometry args={[SCALE * data.aspect, SCALE]} />
      <meshBasicMaterial
        map={data.texture}
        transparent
        alphaTest={0.05}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================================================================
   ProductVideoAlphaPlane — video .webm VP9 con alpha real (sin shader chroma)
   El asset ya tiene alpha horneado (preprocesado con rembg). Solo VideoTexture
   + meshBasicMaterial transparent. Costo: cero.
   ============================================================================ */

function ProductVideoAlphaPlane({ url }: { url: string }) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";

    const onLoaded = () => {
      setAspect(video.videoWidth / video.videoHeight || 1);
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      setTexture(tex);
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.play().catch(() => {});

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  if (!texture) return null;
  const SCALE = 1.4;
  return (
    <mesh>
      <planeGeometry args={[SCALE * aspect, SCALE]} />
      <meshBasicMaterial
        map={texture}
        transparent
        alphaTest={0.02}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================================================================
   ProductVideoChromaPlane — video .mp4/.mov con fondo (chroma key en shader)
   Backward compat para videos sin pre-procesar (silver, gold).
   ============================================================================ */

function ProductVideoChromaPlane({
  url,
  chromaKey,
  tolerance = 0.34,
  feather = 0.08,
}: {
  url: string;
  chromaKey: string;
  tolerance?: number;
  feather?: number;
}) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const [aspect, setAspect] = useState(1);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.preload = "auto";

    const onLoaded = () => {
      setAspect(video.videoWidth / video.videoHeight || 1);
      const tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      setTexture(tex);
    };

    video.addEventListener("loadedmetadata", onLoaded);
    video.play().catch(() => {});
    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  const uniformsRef = useRef({
    uChromaKey: { value: new THREE.Vector3(1, 1, 1) },
    uTolerance: { value: tolerance },
    uFeather:   { value: feather },
  });

  useEffect(() => {
    const [r, g, b] = hexToRgb(chromaKey);
    uniformsRef.current.uChromaKey.value.set(r / 255, g / 255, b / 255);
    uniformsRef.current.uTolerance.value = tolerance;
    uniformsRef.current.uFeather.value = feather;
  }, [chromaKey, tolerance, feather]);

  const onBeforeCompile = useMemo(() => {
    return (shader: any) => {
      shader.uniforms.uChromaKey = uniformsRef.current.uChromaKey;
      shader.uniforms.uTolerance = uniformsRef.current.uTolerance;
      shader.uniforms.uFeather   = uniformsRef.current.uFeather;
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `
          #include <common>
          uniform vec3 uChromaKey;
          uniform float uTolerance;
          uniform float uFeather;
        `)
        .replace("#include <map_fragment>", `
          #include <map_fragment>
          #ifdef USE_MAP
            float chromaDist = distance(diffuseColor.rgb, uChromaKey);
            float chromaAlpha = smoothstep(uTolerance, uTolerance + uFeather, chromaDist);
            diffuseColor.a *= chromaAlpha;
            if (diffuseColor.a < 0.02) discard;
          #endif
        `);
    };
  }, []);

  if (!texture) return null;
  const SCALE = 1.4;
  return (
    <mesh>
      <planeGeometry args={[SCALE * aspect, SCALE]} />
      <meshBasicMaterial
        map={texture}
        transparent
        toneMapped={false}
        side={THREE.DoubleSide}
        onBeforeCompile={onBeforeCompile}
      />
    </mesh>
  );
}

/* ============================================================================
   ProductPngSequencePlane — anima PNG sequence con alpha real (Safari fallback)
   Carga N frames .png, los precachea como Texture y los cicla por frame
   a fps configurado. Cada texture tiene alpha horneado del rembg.
   ============================================================================ */

function ProductPngSequencePlane({
  base,
  count,
  fps = 24,
}: {
  base: string;      // ej: "/assets/hero/golden-goose-frames/"
  count: number;     // cantidad de PNGs disponibles
  fps?: number;
}) {
  const [textures, setTextures] = useState<THREE.Texture[] | null>(null);
  const [aspect, setAspect] = useState(1);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const frameRef = useRef(0);
  const timeRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = "anonymous";

    const urls = Array.from({ length: count }, (_, i) => {
      const padded = String(i).padStart(4, "0");
      return `${base.replace(/\/?$/, "/")}frame_${padded}.png`;
    });

    Promise.all(
      urls.map(
        (u) =>
          new Promise<THREE.Texture | null>((resolve) => {
            loader.load(
              u,
              (t) => {
                t.colorSpace = THREE.SRGBColorSpace;
                t.minFilter = THREE.LinearFilter;
                t.magFilter = THREE.LinearFilter;
                t.generateMipmaps = false;
                resolve(t);
              },
              undefined,
              () => resolve(null)
            );
          })
      )
    ).then((loaded) => {
      if (cancelled) return;
      const valid = loaded.filter((t): t is THREE.Texture => t !== null);
      if (valid.length > 0 && valid[0].image) {
        const img = valid[0].image as { width: number; height: number };
        setAspect(img.width / img.height);
      }
      setTextures(valid);
    });

    return () => { cancelled = true; };
  }, [base, count]);

  /* Avance del frame index segun fps + delta time del rAF de R3F */
  useFrame((_, dt) => {
    if (!textures || textures.length === 0 || !matRef.current) return;
    timeRef.current += dt;
    const target = Math.floor(timeRef.current * fps) % textures.length;
    if (target !== frameRef.current) {
      frameRef.current = target;
      matRef.current.map = textures[target];
      matRef.current.needsUpdate = true;
    }
  });

  if (!textures || textures.length === 0) return null;
  const SCALE = 1.4;
  return (
    <mesh>
      <planeGeometry args={[SCALE * aspect, SCALE]} />
      <meshBasicMaterial
        ref={matRef}
        map={textures[0]}
        transparent
        alphaTest={0.02}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/* ============================================================================
   ProductPlane — switcher segun URL + capability del browser
   ============================================================================ */

interface ProductPlaneProps {
  url: string;
  chromaKey: string | null;
  pngSequence?: { base: string; count: number; fps?: number };
}

function ProductPlane({ url, chromaKey, pngSequence }: ProductPlaneProps) {
  const ext = getExt(url);
  const [webmAlphaSupported, setWebmAlphaSupported] = useState<boolean | null>(null);

  useEffect(() => {
    setWebmAlphaSupported(supportsWebMAlpha());
  }, []);

  // Evitamos render en SSR / antes de la deteccion
  if (webmAlphaSupported === null) return null;

  // .webm: alpha real horneado. Si el browser soporta -> usar. Sino, fallback.
  if (ext === "webm") {
    if (webmAlphaSupported) return <ProductVideoAlphaPlane url={url} />;
    if (pngSequence) {
      return <ProductPngSequencePlane base={pngSequence.base} count={pngSequence.count} fps={pngSequence.fps ?? 24} />;
    }
    // Sin fallback: intenta cargarlo igual (Safari mostrara el primer frame)
    return <ProductVideoAlphaPlane url={url} />;
  }

  // .mp4/.mov: backward compat con shader chroma key (silver, gold)
  if (ext === "mp4" || ext === "mov") {
    return <ProductVideoChromaPlane url={url} chromaKey={chromaKey || "#ffffff"} />;
  }

  // Imagen estatica
  return <ProductImagePlane url={url} chromaKey={chromaKey} />;
}

/* ============================================================================
   GlassSphere — la esfera de cristal en si
   ============================================================================ */

function GlassSphere({ isMobile }: { isMobile: boolean }) {
  return (
    <mesh>
      <sphereGeometry args={[1.2, isMobile ? 48 : 96, isMobile ? 48 : 96]} />
      <MeshTransmissionMaterial
        backside
        backsideThickness={0.05}
        thickness={0.1}
        transmission={0.95}
        roughness={0.04}
        ior={1.08}
        chromaticAberration={0}
        anisotropy={0}
        distortion={0}
        distortionScale={0}
        temporalDistortion={0}
        clearcoat={1}
        clearcoatRoughness={0.06}
        attenuationColor="#ffffff"
        attenuationDistance={8}
        color="#ffffff"
        envMapIntensity={0.25}
      />
    </mesh>
  );
}

/* ============================================================================
   Componente principal
   ============================================================================ */

interface Props {
  productImage: string;
  chromaKey?: string | null;
  /* Fallback Safari: secuencia PNG decimada del mismo producto que tiene
     .webm con alpha. Si no se pasa y el browser no soporta WebM alpha,
     el componente intenta cargar el .webm igual (degradacion silenciosa).  */
  pngSequence?: { base: string; count: number; fps?: number };
  isInView?: boolean;
}

export default function GlassOrb3D({
  productImage,
  chromaKey = null,
  pngSequence,
  isInView = true,
}: Props) {
  const isMobile = useIsMobile();

  return (
    <Canvas
      frameloop={isInView ? "always" : "never"}
      camera={{ position: [0, 0, 3.6], fov: 36 }}
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
      <ambientLight intensity={0.5} />
      <directionalLight position={[-2.5, 3, 4]} intensity={1.4} color="#fff5e8" />
      <directionalLight position={[3, 1, -2]} intensity={0.6} color="#d4e2ff" />
      <pointLight position={[0, 0, 4]} intensity={0.35} color="#ffffff" />

      {!isMobile && <Environment preset="apartment" background={false} />}

      <Float
        speed={1.3}
        rotationIntensity={0.12}
        floatIntensity={0.4}
        floatingRange={[-0.06, 0.06]}
      >
        <group position={[0, 0, -0.3]}>
          <ProductPlane url={productImage} chromaKey={chromaKey} pngSequence={pngSequence} />
        </group>
      </Float>

      <GlassSphere isMobile={isMobile} />

      {!isMobile && (
        <ContactShadows
          position={[0, -1.35, 0]}
          opacity={0.35}
          scale={3.5}
          blur={2.6}
          far={2.2}
          color="#1a1814"
        />
      )}
    </Canvas>
  );
}
