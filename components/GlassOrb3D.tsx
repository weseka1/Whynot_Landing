"use client";

/* ============================================================================
   GLASS ORB 3D — Planet-like semi-translucent sphere (R3F + Three.js)
   --------------------------------------------------------------------------
   Estetica: esfera de cristal con look de PLANETA — capa de atmosfera con
   rim glow fresnel, esfera principal con iridescencia + transmision, glow
   interior radial. El producto va DENTRO como plano texturizado.

   Capas (z-order del interno al externo):
     1. InnerGlow      — sprite/disco luminoso detras del producto (alma)
     2. ProductPlane   — el plano texturizado (video webm con alpha o PNG)
     3. GlassSphere    — esfera principal con MeshTransmissionMaterial
     4. AtmosphereShell — capa exterior con fresnel rim glow (additive)

   El orb completo (sphere+atmosphere+glow) rota lentamente en Y para dar
   sensacion de planeta vivo. El producto plano se mantiene estatico — la
   rotacion 360 ya viene horneada en el video webm de la zapatilla.

   FUENTES DE CONTENIDO SOPORTADAS:
     - .webm con alpha real (VP9 yuva420p) — preferido, sin chroma key.
     - .mp4/.mov con fondo (chroma key opcional via shader) — fallback.
     - .png/.webp/.jpg — imagen estatica con chroma key opcional.
     - PNG sequence — fallback Safari para WebM alpha.
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

function supportsWebMAlpha(): boolean {
  if (typeof window === "undefined") return false;
  const v = document.createElement("video");
  const canVP9 = v.canPlayType('video/webm; codecs="vp9"');
  return canVP9 !== "";
}

/* ============================================================================
   ProductImagePlane — imagen estatica (.png/.webp/.jpg)
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
   ProductVideoAlphaPlane — video .webm VP9 con alpha real
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
  const SCALE = 1.5;
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
   ProductVideoChromaPlane — fallback chroma key shader
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
  const SCALE = 1.5;
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
   ProductPngSequencePlane — Safari fallback con PNG sequence
   ============================================================================ */

function ProductPngSequencePlane({
  base,
  count,
  fps = 24,
}: {
  base: string;
  count: number;
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
  const SCALE = 1.5;
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

  if (webmAlphaSupported === null) return null;

  if (ext === "webm") {
    if (webmAlphaSupported) return <ProductVideoAlphaPlane url={url} />;
    if (pngSequence) {
      return <ProductPngSequencePlane base={pngSequence.base} count={pngSequence.count} fps={pngSequence.fps ?? 24} />;
    }
    return <ProductVideoAlphaPlane url={url} />;
  }

  if (ext === "mp4" || ext === "mov") {
    return <ProductVideoChromaPlane url={url} chromaKey={chromaKey || "#ffffff"} />;
  }

  return <ProductImagePlane url={url} chromaKey={chromaKey} />;
}

/* ============================================================================
   InnerGlow — disco radial luminoso detras del producto
   --------------------------------------------------------------------------
   Da "alma" al planeta: el producto parece flotar dentro de una atmosfera
   luminosa. Geometria plane con shader radial gradient additive.
   ============================================================================ */

function InnerGlow() {
  const uniforms = useMemo(
    () => ({
      uColorCore: { value: new THREE.Color("#fff5e0") },
      uColorEdge: { value: new THREE.Color("#9bb5d6") },
      uIntensity: { value: 0.55 },
    }),
    []
  );

  const fragment = `
    varying vec2 vUv;
    uniform vec3 uColorCore;
    uniform vec3 uColorEdge;
    uniform float uIntensity;
    void main() {
      vec2 c = vUv - 0.5;
      float d = length(c) * 2.0;
      float core = smoothstep(1.0, 0.0, d);          // mas brillante al centro
      float edge = smoothstep(0.95, 0.4, d);         // halo medio
      float a = pow(core, 1.6) * 0.85 + pow(edge, 3.0) * 0.25;
      vec3 col = mix(uColorEdge, uColorCore, pow(core, 1.4));
      gl_FragColor = vec4(col, a * uIntensity);
    }
  `;
  const vertex = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;

  return (
    <mesh position={[0, 0, -0.4]}>
      <planeGeometry args={[2.6, 2.6]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ============================================================================
   AtmosphereShell — capa exterior con fresnel rim glow (efecto planeta)
   --------------------------------------------------------------------------
   Esfera ligeramente mayor que la principal, con material custom que
   ilumina solo los bordes (alta en grazing angles, baja al centro). Da
   esa banda atmosferica luminosa caracteristica de los planetas.
   ============================================================================ */

function AtmosphereShell({ isMobile }: { isMobile: boolean }) {
  const uniforms = useMemo(
    () => ({
      uColorRim:   { value: new THREE.Color("#cce4ff") },   // azul atmosfera
      uColorInner: { value: new THREE.Color("#fff2d6") },   // calido al interior
      uPower:      { value: 2.6 },
      uIntensity:  { value: 0.85 },
    }),
    []
  );

  const vertex = `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewDir = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }
  `;
  const fragment = `
    varying vec3 vNormal;
    varying vec3 vViewDir;
    uniform vec3 uColorRim;
    uniform vec3 uColorInner;
    uniform float uPower;
    uniform float uIntensity;
    void main() {
      float ndv = max(0.0, dot(normalize(vNormal), normalize(vViewDir)));
      float rim = pow(1.0 - ndv, uPower);          // 1 en bordes, 0 al centro
      vec3 col = mix(uColorInner, uColorRim, rim);
      float a = rim * uIntensity;
      gl_FragColor = vec4(col, a);
    }
  `;

  return (
    <mesh scale={1.085}>
      <sphereGeometry args={[1.2, isMobile ? 48 : 80, isMobile ? 48 : 80]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.FrontSide}
        toneMapped={false}
      />
    </mesh>
  );
}

/* ============================================================================
   GlassSphere — esfera principal de cristal con iridescence + transmission
   ============================================================================ */

function GlassSphere({ isMobile }: { isMobile: boolean }) {
  return (
    <mesh>
      <sphereGeometry args={[1.2, isMobile ? 56 : 96, isMobile ? 56 : 96]} />
      <MeshTransmissionMaterial
        backside
        backsideThickness={0.06}
        thickness={0.12}
        transmission={0.94}
        roughness={0.05}
        ior={1.1}
        chromaticAberration={0.018}
        anisotropy={0.08}
        distortion={0.05}
        distortionScale={0.12}
        temporalDistortion={0.02}
        clearcoat={1}
        clearcoatRoughness={0.04}
        attenuationColor="#dde9ff"
        attenuationDistance={6}
        color="#ffffff"
        envMapIntensity={0.45}
      />
    </mesh>
  );
}

/* ============================================================================
   PlanetGroup — agrupa orb + atmosfera + glow, rota lento en Y
   --------------------------------------------------------------------------
   El producto plano va aparte (estatico): la rotacion 360 ya viene en el
   video webm. Esto evita que la zapatilla se vea "girando dos veces".
   ============================================================================ */

function PlanetGroup({ isMobile }: { isMobile: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (ref.current) {
      // rotacion super lenta en Y — efecto planeta
      ref.current.rotation.y += dt * 0.08;
    }
  });
  return (
    <group ref={ref}>
      <GlassSphere isMobile={isMobile} />
      <AtmosphereShell isMobile={isMobile} />
    </group>
  );
}

/* ============================================================================
   Componente principal
   ============================================================================ */

interface Props {
  productImage: string;
  chromaKey?: string | null;
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
      {/* Setup luminico — key warm + rim cool + bounce */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[-2.5, 3, 4]} intensity={1.6} color="#fff5e8" />
      <directionalLight position={[3, 1, -2]} intensity={0.8} color="#c8d8ff" />
      <pointLight position={[0, 0, 4]} intensity={0.4} color="#ffffff" />
      <pointLight position={[0, -1.5, 1]} intensity={0.25} color="#ffd9a8" />

      {!isMobile && <Environment preset="city" background={false} />}

      {/* Glow interior (detras del producto) — additive */}
      <InnerGlow />

      {/* Producto plano flotante. Sin rotacion: el video webm ya tiene 360. */}
      <Float
        speed={1.2}
        rotationIntensity={0.08}
        floatIntensity={0.35}
        floatingRange={[-0.05, 0.05]}
      >
        <group position={[0, 0, -0.1]}>
          <ProductPlane url={productImage} chromaKey={chromaKey} pngSequence={pngSequence} />
        </group>
      </Float>

      {/* Esfera + atmosfera (rotan juntas lento en Y) */}
      <PlanetGroup isMobile={isMobile} />

      {/* Sombra al piso debajo del planeta */}
      {!isMobile && (
        <ContactShadows
          position={[0, -1.4, 0]}
          opacity={0.4}
          scale={3.8}
          blur={2.8}
          far={2.4}
          color="#1a1814"
        />
      )}
    </Canvas>
  );
}
