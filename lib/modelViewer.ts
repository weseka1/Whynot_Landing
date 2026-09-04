/* ============================================================================
   MODEL VIEWER — carga del custom element, a pedido.
   ----------------------------------------------------------------------------
   `<model-viewer>` son 248 KB de módulo que se parsean en el hilo principal.
   Antes se cargaba desde el layout con `strategy="afterInteractive"`: entraba
   en plena carga inicial y era parte de los 9,7 s de bloqueo medidos el
   4-sep-2026 (FCP a los 10,1 s en desktop).

   Pasarlo a `lazyOnload` fue peor y por eso existe este archivo: Next
   directamente NO lo pedía nunca (medido: 0 requests al script, custom element
   sin definir, el <model-viewer> quedaba como un tag vacío sin upgrade). El
   mono desaparecía.

   Solución: lo carga QUIEN lo necesita, en el momento en que lo necesita.
   Idempotente — la promesa se cachea, así los tres componentes que usan
   model-viewer (Hero, MonoMascot, MissionPillarMonkey) comparten una sola
   descarga.
   ============================================================================ */

const CDN = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";

let promesa: Promise<void> | null = null;

/**
 * Carga `<model-viewer>` una sola vez y resuelve cuando el custom element
 * quedó definido. Nunca rechaza: si el CDN falla, resuelve igual y el
 * componente que lo pidió muestra su fallback en vez de romper la página.
 */
export function cargarModelViewer(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (promesa) return promesa;

  promesa = new Promise<void>((resolve) => {
    /* Ya definido (otra carga, o el script vino por otro lado). */
    if (customElements.get("model-viewer")) {
      resolve();
      return;
    }

    const listo = () => customElements.whenDefined("model-viewer").then(() => resolve());

    const previo = document.querySelector<HTMLScriptElement>(`script[src="${CDN}"]`);
    if (previo) {
      listo();
      return;
    }

    const s = document.createElement("script");
    s.type = "module";
    s.src = CDN;
    s.async = true;
    s.onload = listo;
    s.onerror = () => {
      console.warn("[model-viewer] no se pudo cargar el script; el 3D no se muestra");
      resolve();
    };
    document.head.appendChild(s);
  });

  return promesa;
}
