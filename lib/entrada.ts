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

/* ── La bienvenida vuelve después de un rato (5-sep-2026) ─────────────────
   Juani: "que la página no quede cacheada cuando se vuelve a entrar después
   de horas de estar afuera, que vuelva a iniciar".

   Antes la marca era booleana y vivía todo lo que durara la pestaña. Alguien
   que deja la web abierta en una pestaña de fondo y vuelve al otro día no
   veía la entrada nunca más — y esa entrada ES la marca.

   Con 45 minutos: volver de una ficha de producto (segundos) no repite nada,
   que es el motivo por el que existe la marca; volver después de un rato sí,
   porque ya es otra visita. */
const VIGENCIA_MS = 45 * 60 * 1000;

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
  /* La marca en memoria sólo vale dentro de esta misma carga de página: es
     para que dos componentes no se peleen, no para recordar entre visitas. */
  if (window.__whynotEntrada) return false;
  try {
    const marca = sessionStorage.getItem(CLAVE);
    if (!marca) return true;
    const cuando = Number(marca);
    /* Compatibilidad con la marca vieja, que era el string "1": si no es un
       número, se trata como vencida y se vuelve a mostrar la entrada. */
    if (!Number.isFinite(cuando) || cuando <= 0) return true;
    return Date.now() - cuando > VIGENCIA_MS;
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
    sessionStorage.setItem(CLAVE, String(Date.now()));
    document.documentElement.classList.add("ya-entro");
  } catch {
    /* noop */
  }
}

/** El evento que despierta a PixelReveal cuando la bienvenida terminó. */
export const EVENTO_ENTRADA = "whynot:preloader-hidden";
