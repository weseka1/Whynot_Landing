/* ============================================================================
   ENTRADA — la bienvenida se muestra UNA vez por visita.
   ----------------------------------------------------------------------------
   Lo comparten el Preloader (la lámina de vidrio) y el PixelReveal (la grilla
   que se abre desde el centro). Los dos son parte del mismo momento: la
   primera vez que se pisa la web en esta pestaña. Al volver de una ficha de
   producto no se repiten — ahí el visitante quiere su scroll de vuelta, no
   otra bienvenida.

   Vive acá y no en el Preloader para que no haya dos definiciones de "ya
   entró" que puedan desincronizarse.
   ============================================================================ */

const CLAVE = "whynot.entro.v1";

/** Bandera en memoria: sobrevive aunque sessionStorage esté bloqueado y, sobre
    todo, permite consultar el estado sin depender de haber escuchado el evento
    (los listeners que se registran tarde se lo pierden). */
declare global {
  interface Window {
    __whynotEntrada?: boolean;
  }
}

/** ¿Es la primera vez que se pisa la web en esta pestaña? */
export function esPrimeraVisita(): boolean {
  if (typeof window === "undefined") return true;
  if (window.__whynotEntrada) return false;
  try {
    return sessionStorage.getItem(CLAVE) !== "1";
  } catch {
    /* incógnito o storage bloqueado: mostramos la bienvenida, es lo seguro */
    return true;
  }
}

/** Marca que ya se entró: sessionStorage + memoria + la clase que lee el CSS. */
export function marcarEntrada(): void {
  if (typeof window === "undefined") return;
  window.__whynotEntrada = true;
  try {
    sessionStorage.setItem(CLAVE, "1");
    document.documentElement.classList.add("ya-entro");
  } catch {
    /* noop */
  }
}

/** El evento que despierta a PixelReveal cuando la bienvenida terminó. */
export const EVENTO_ENTRADA = "whynot:preloader-hidden";
