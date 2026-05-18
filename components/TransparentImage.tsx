"use client";

/* ============================================================================
   TRANSPARENT IMAGE  (chroma-key en runtime)
   Toma un PNG/JPG y elimina el "fondo" detectándolo automáticamente a partir
   de los 4 píxeles de las esquinas (asumimos que las esquinas SON fondo).

   Utilidad: PNGs que parecen transparentes pero en realidad tienen el
   checker / fondo blanco "horneado" como pixeles sólidos.

   Cómo funciona:
     1) Carga la imagen en un <canvas> oculto.
     2) Sample de los 4 píxeles esquina → muestras de color de fondo.
     3) Recorre todos los píxeles: si el color de un píxel está cerca de
        cualquiera de las muestras (distancia < tolerance) → alpha = 0.
     4) Píxeles en el "borde" reciben alpha proporcional → edge suave.
     5) El canvas resultante se exporta a data-URL y se renderiza como <img>.

   Props:
     - src         → ruta de la imagen original
     - tolerance   → 0-441 (cuán parecido tiene que ser el color para
                     considerarlo fondo). Default 60.
     - feather     → suaviza el borde entre cloud y fondo. Default 30.
     - corners     → cuántas esquinas samplear (default 4)

   Performance: corre 1 sola vez al montar. La imagen procesada queda
   cacheada en estado mientras el componente vive.
   ============================================================================ */

import { useEffect, useState } from "react";

type Props = {
  src: string;
  alt?: string;
  tolerance?: number;
  feather?: number;
  style?: React.CSSProperties;
  className?: string;
};

export default function TransparentImage({
  src,
  alt = "",
  tolerance = 60,
  feather = 30,
  style,
  className,
}: Props) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (cancelled) return;

      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      let imgData: ImageData;
      try {
        imgData = ctx.getImageData(0, 0, w, h);
      } catch {
        // Si hay error de CORS, fallback al src original
        setDataUrl(src);
        return;
      }

      const px = imgData.data;
      const samplePx = (x: number, y: number): [number, number, number] => {
        const i = (y * w + x) * 4;
        return [px[i], px[i + 1], px[i + 2]];
      };

      // 4 esquinas como muestras de fondo
      const samples: [number, number, number][] = [
        samplePx(0,      0),
        samplePx(w - 1,  0),
        samplePx(0,      h - 1),
        samplePx(w - 1,  h - 1),
      ];

      const distSq = (r: number, g: number, b: number, s: [number, number, number]) => {
        const dr = r - s[0];
        const dg = g - s[1];
        const db = b - s[2];
        return dr * dr + dg * dg + db * db;
      };

      const tolSq      = tolerance * tolerance;
      const tolFeatSq  = (tolerance + feather) * (tolerance + feather);

      for (let i = 0; i < px.length; i += 4) {
        const r = px[i], g = px[i + 1], b = px[i + 2];

        // Distancia al sample más cercano
        let minD = Infinity;
        for (let s = 0; s < samples.length; s++) {
          const d = distSq(r, g, b, samples[s]);
          if (d < minD) minD = d;
        }

        if (minD < tolSq) {
          px[i + 3] = 0;
        } else if (minD < tolFeatSq) {
          // Edge feather: alpha proporcional
          const d = Math.sqrt(minD);
          const t = (d - tolerance) / feather;
          px[i + 3] = Math.round(px[i + 3] * t);
        }
      }

      ctx.putImageData(imgData, 0, 0);

      if (!cancelled) setDataUrl(canvas.toDataURL("image/png"));
    };

    img.src = src;

    return () => { cancelled = true; };
  }, [src, tolerance, feather]);

  // Mientras procesa no renderiza nada (evita flash del PNG con bg sólido)
  if (!dataUrl) return null;

  return <img src={dataUrl} alt={alt} style={style} className={className} />;
}
