/* ============================================================================
   THREE / DREI SETUP — Draco decoder local
   ----------------------------------------------------------------------------
   drei (y three-stdlib) bajan el Draco decoder de https://www.gstatic.com/
   por default. En redes mobile flojas (3G argentino, redes corporativas,
   adblockers) gstatic a veces no responde → ningun GLB con Draco compresion
   puede parsearse → modelos no cargan.

   Fix: copiar el decoder a /public/draco/ y apuntar drei a ese path local.
   Los assets de public/ tienen Cache-Control immutable 1 año (render.yaml),
   asi que el decoder se descarga UNA vez y queda en cache para siempre.

   Importar este modulo en cualquier component que llame useGLTF (efecto
   side-only). Es idempotente — llamar a setDecoderPath multiples veces
   con el mismo path no rompe nada.
   ============================================================================ */

import { useGLTF } from "@react-three/drei";

/* Path local del decoder Draco — sin trailing slash drei lo concatena con
   "/draco_decoder.wasm" sin separador. CON trailing slash es seguro.       */
export const DRACO_DECODER_PATH = "/draco/";

/* setDecoderPath es estatico en drei.useGLTF — affecta el GLTFLoader
   interno que drei crea bajo useLoader. Una sola llamada cubre TODA la
   app: cualquier futura llamada useGLTF (o useGLTF.preload) usa el path
   local. Guarded por typeof por si la version de drei cambia la API.      */
if (typeof (useGLTF as any).setDecoderPath === "function") {
  (useGLTF as any).setDecoderPath(DRACO_DECODER_PATH);
}
