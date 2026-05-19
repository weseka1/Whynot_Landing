"use client";

/* ============================================================================
   GLASS ORB 3D — Esfera de vidrio REAL con WebGL (R3F + Three.js)
   --------------------------------------------------------------------------
   - Sphere geometry + MeshTransmissionMaterial (vidrio refractante real)
   - Environment preset (HDR) para reflejos del cristal
   - 3 luces (key warm + fill cool + point fill)
   - <Float> para flotacion sutil del producto
   - <ContactShadows> sombra de contacto bajo la esfera
   - frameloop condicional por viewport

   IMAGEN DEL PRODUCTO:
     Recomendado: PNG TRANSPARENTE (sin fondo). El plano texturizado dentro
     de la esfera solo muestra los pixeles no-transparentes → producto se
     ve flotando, sin rectangulo.

     Si la imagen tiene fondo (blanco u otro): pasar prop `chromaKey="#fff"`
     (o el color que sea). Se procesa en runtime con un offscreen canvas:
     todos los pixeles cercanos al color clave se vuelven transparentes
     con feathering en el edge → simula PNG transparente sin necesidad de
     editar el asset.
   ============================================================================ */

import { useEffect, useState, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import {
  MeshTransmissionMaterial,
  Environment,
  Float,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

const VIDEO_EXTENSIONS = [".mp4", ".webm", ".mov"];
function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return VIDEO_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/* ---------------- helpers ---------------- */

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").padStart(6, "0");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/* useProcessedTexture
   Carga `url` y devuelve un THREE.Texture. Si `chromaKey` es null usa la
   imagen tal cual. Si tiene color, procesa en un offscreen canvas
   eliminando los pixeles cercanos a ese color (con feather suave).
   Retorna {texture, aspect}. aspect = naturalWidth / naturalHeight para
   dimensionar el plane proporcional al producto.                        */
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

      // Sin chroma key: usar la imagen directa (PNG transparente, idealmente)
      if (!chromaKey) {
        const t = new THREE.Texture(img);
        t.needsUpdate = true;
        t.colorSpace = THREE.SRGBColorSpace;
        setData({ texture: t, aspect });
        return;
      }

      // Con chroma key: procesar offscreen
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
          // Bajo tolerancia: pixel totalmente transparente
          px[i + 3] = 0;
        } else if (dSq < featSq) {
          // En la franja de feather: alpha proporcional (edge suave)
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

    img.onerror = () => {
      console.warn(`GlassOrb3D: no pude cargar ${url}`);
    };
    img.src = url;

    return () => { cancelled = true; };
  }, [url, chromaKey, tolerance, feather]);

  return data;
}

/* ---------------- Plane del producto: imagen (offscreen canvas chroma) -- */

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
  const w = SCALE * data.aspect;
  const h = SCALE;

  return (
    <mesh>
      <planeGeometry args={[w, h]} />
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

/* ---------------- Plane del producto: video (chroma key en shader) ------
   El chroma key se hace por frame en GPU (fragment shader) con
   onBeforeCompile + smoothstep para feather. Casi 0 costo CPU.        */

function ProductVideoPlane({
  url,
  chromaKey,
  tolerance = 0.34,
  feather = 0.08,
}: {
  url: string;
  chromaKey: string | null;
  tolerance?: number;
  feather?: number;
}) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const [aspect, setAspect] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = url;
    video.crossOrigin = "anonymous";
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    // @ts-ignore disablePictureInPicture no esta en types pero browsers lo respetan
    video.disablePictureInPicture = true;
    video.preload = "auto";
    videoRef.current = video;

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
    video.play().catch(() => {
      /* autoplay puede ser bloqueado en algunos browsers — el video
         queda cargado pero no reproduciendose. Igual seteamos textura. */
    });

    return () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [url]);

  /* Shader inject: chroma key + feather en el fragment del meshBasicMaterial.
     Usamos onBeforeCompile para inyectar 3 uniforms + logica despues del
     `<map_fragment>` chunk de three.js.                                 */
  const uniformsRef = useRef({
    uChromaKey: { value: new THREE.Vector3(1, 1, 1) },
    uTolerance: { value: tolerance },
    uFeather:   { value: feather },
  });

  /* Update uniforms si cambian los props */
  useEffect(() => {
    if (chromaKey) {
      const [r, g, b] = hexToRgb(chromaKey);
      uniformsRef.current.uChromaKey.value.set(r / 255, g / 255, b / 255);
    }
    uniformsRef.current.uTolerance.value = tolerance;
    uniformsRef.current.uFeather.value = feather;
  }, [chromaKey, tolerance, feather]);

  const onBeforeCompile = useMemo(() => {
    return (shader: any) => {
      shader.uniforms.uChromaKey = uniformsRef.current.uChromaKey;
      shader.uniforms.uTolerance = uniformsRef.current.uTolerance;
      shader.uniforms.uFeather   = uniformsRef.current.uFeather;

      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `
            #include <common>
            uniform vec3 uChromaKey;
            uniform float uTolerance;
            uniform float uFeather;
          `
        )
        // Despues de aplicar el map, evaluamos distancia al chroma key
        // y modulamos el alpha. smoothstep da feather suave.
        .replace(
          "#include <map_fragment>",
          `
            #include <map_fragment>
            #ifdef USE_MAP
              float chromaDist = distance(diffuseColor.rgb, uChromaKey);
              float chromaAlpha = smoothstep(uTolerance, uTolerance + uFeather, chromaDist);
              diffuseColor.a *= chromaAlpha;
              if (diffuseColor.a < 0.02) discard;
            #endif
          `
        );
    };
  }, []);

  if (!texture || !chromaKey) {
    if (!texture) return null;
    // Sin chroma key: render directo
    const SCALE = 1.4;
    return (
      <mesh>
        <planeGeometry args={[SCALE * aspect, SCALE]} />
        <meshBasicMaterial
          map={texture}
          transparent
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    );
  }

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

/* ---------------- Switcher: decide imagen vs video segun extension ---- */

function ProductPlane({
  url,
  chromaKey,
}: {
  url: string;
  chromaKey: string | null;
}) {
  if (isVideoUrl(url)) {
    return <ProductVideoPlane url={url} chromaKey={chromaKey} />;
  }
  return <ProductImagePlane url={url} chromaKey={chromaKey} />;
}

/* ---------------- Esfera de cristal ---------------- */

function GlassSphere({ isMobile }: { isMobile: boolean }) {
  /* Parametros ajustados para que el cristal NO deforme la zapatilla:
     - transmission alto pero thickness y ior muy bajos → casi sin
       refraccion (la zapatilla se ve nitida, no como pez ojo)
     - chromaticAberration y distortion en cero → sin fringes RGB
     - clearcoat alto → reflejos pulidos en la superficie
     - envMapIntensity baja → el HDR no domina visualmente            */
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

/* ---------------- Componente principal ---------------- */

interface Props {
  productImage: string;
  chromaKey?: string | null;
  isInView?: boolean;
}

export default function GlassOrb3D({
  productImage,
  chromaKey = null,
  isInView = true,
}: Props) {
  const isMobile = useIsMobile();

  return (
    <Canvas
      /* Pausa render cuando sale del viewport → 0 CPU/GPU */
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
      {/* Luces */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[-2.5, 3, 4]} intensity={1.4} color="#fff5e8" />
      <directionalLight position={[3, 1, -2]} intensity={0.6} color="#d4e2ff" />
      <pointLight position={[0, 0, 4]} intensity={0.35} color="#ffffff" />

      {/* HDR environment SOLO para reflejos del cristal — no como background.
          "apartment" es un HDR interior claro / neutro: el cristal refleja
          tonos blancos/grises calidos en vez de rascacielos.            */}
      {!isMobile && <Environment preset="apartment" background={false} />}

      {/* Producto adentro del cristal: posicionado en z=-0.3 (atras del
          centro) para que la sphere tenga "aire" delante y el producto
          se sienta dentro de la burbuja, no pegado al vidrio frontal. */}
      <Float
        speed={1.3}
        rotationIntensity={0.12}
        floatIntensity={0.4}
        floatingRange={[-0.06, 0.06]}
      >
        <group position={[0, 0, -0.3]}>
          <ProductPlane url={productImage} chromaKey={chromaKey} />
        </group>
      </Float>

      {/* Esfera de cristal envolviendo al producto */}
      <GlassSphere isMobile={isMobile} />

      {/* Sombra de contacto bajo la esfera (skipped en mobile) */}
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
