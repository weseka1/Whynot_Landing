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

import { useEffect, useState, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import {
  MeshTransmissionMaterial,
  Environment,
  Float,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";
import { useIsMobile } from "./useIsMobile";

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
  tolerance = 70,
  feather = 50
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

/* ---------------- Plane del producto dentro de la esfera ---------------- */

function ProductPlane({
  url,
  chromaKey,
}: {
  url: string;
  chromaKey: string | null;
}) {
  const data = useProcessedTexture(url, chromaKey);
  if (!data) return null;

  /* Plane proporcional al aspect del producto, escalado para caber en una
     esfera de radio 1.2. Ajustar este multiplicador para que la zapatilla
     ocupe mas/menos espacio dentro del cristal.                          */
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

/* ---------------- Esfera de cristal ---------------- */

function GlassSphere({ isMobile }: { isMobile: boolean }) {
  /* Parametros pensados para look "luxury sneaker scanner premium":
     - thickness moderado para refraccion visible pero no excesiva
     - clearcoat alto: capa exterior bien pulida
     - chromaticAberration sutil: dispersion cromatica en los bordes
     - anisotropy + distortion bajos: deformacion suave del producto
     - color blanco apenas teñido warm                                    */
  return (
    <mesh>
      <sphereGeometry args={[1.2, isMobile ? 48 : 96, isMobile ? 48 : 96]} />
      <MeshTransmissionMaterial
        backside
        backsideThickness={0.4}
        thickness={0.45}
        transmission={1}
        roughness={0.05}
        ior={1.32}
        chromaticAberration={0.04}
        anisotropy={0.18}
        distortion={0.06}
        distortionScale={0.4}
        temporalDistortion={0.04}
        clearcoat={1}
        clearcoatRoughness={0.04}
        attenuationColor="#fffefb"
        attenuationDistance={3.2}
        color="#ffffff"
        envMapIntensity={1.4}
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

      {/* HDR environment para los reflejos del cristal (solo desktop por
          performance — en mobile el cristal queda solo con las luces). */}
      {!isMobile && <Environment preset="city" />}

      {/* Producto adentro, flotando con Float */}
      <Float
        speed={1.3}
        rotationIntensity={0.12}
        floatIntensity={0.4}
        floatingRange={[-0.06, 0.06]}
      >
        <ProductPlane url={productImage} chromaKey={chromaKey} />
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
