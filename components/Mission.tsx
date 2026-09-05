"use client";

/* ============================================================================
   MISSION — una pantalla pinneada, seis pasos, un solo mono.
   ----------------------------------------------------------------------------
   Antes: 7 bloques de 100vh apilados (intro + 5 pilares + cierre), cada uno
   con SU PROPIO Canvas R3F y su GLB. Siete pantallas para leer cinco datos
   y siete contextos WebGL vivos. Juani, 4-sep-2026: "no gastar tanta pagina
   basicamente en blanco", "que sea un scrolling en el mismo lugar",
   "que no parezca un PDF en website con firuletes".

   Ahora: la seccion es un RIEL de scroll (N pasos x --paso de alto) y adentro
   hay UNA pantalla `position: sticky` que se queda quieta mientras el
   visitante baja. Lo que cambia con el scroll es el contenido de esa
   pantalla: el texto del paso hace crossfade, el mono cambia de modelo y se
   vuelve a animar, el halo del fondo se desplaza. Un Canvas, no siete.

   Distinto del "sticky-overlay" que se descarto antes: aquel era un mono
   fijo y muerto encima de texto que scrolleaba. Este es scrollytelling — el
   mono es protagonista de cada paso y se re-anima en cada cambio.

   El progreso continuo (0..1) NO pasa por React: va a una CSS var (--p) del
   section, y el halo/hint la leen desde CSS. React solo se entera cuando
   cambia el paso activo (6 renders en toda la seccion, no uno por frame).
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { site } from "@/data/site";
import ChannelButtons from "./ChannelButtons";

const MissionPillarMonkey = dynamic(() => import("./MissionPillarMonkey"), {
  ssr: false,
  loading: () => null,
});

/* Un mono por paso. El orden respeta la asignacion que ya existia por pilar;
   el dorado abre (era el del header). */
const MONOS = [
  "/assets/3d/mono-dorado.glb",        // 0 · Somos Why Not
  "/assets/3d/mono-rigged.glb",        // 1 · Compra
  "/assets/3d/mono-blanco-dorado.glb", // 2 · Canales
  "/assets/3d/mono-blanco.glb",        // 3 · CABA / GBA
  "/assets/3d/gotila-esenssial.glb",   // 4 · Todo el pais
  "/assets/3d/mono-louis.glb",         // 5 · Dudas
];

type Paso = {
  numero: string;
  tag: string;
  titulo: string;
  copy: string;
  channels?: (typeof site.mission.pillars)[number]["channels"];
  closing?: string;
  remate?: string;
};

/* ── Burbujas ─────────────────────────────────────────────────────────────
   Juani, 4-sep: "muy VACÍO... que con efectos burbuja liquid glass vayan
   saliendo la info junto con los monos". Tres datos por paso, todos sacados
   de lo que YA dice site.ts y politicas (OCA, Correo, en el día en CABA,
   pago al recibir, unboxing). Nada inventado: ni talles, ni stock, ni
   "original". Entran escalonadas alrededor del mono cuando cambia el paso.
   Iconos SVG propios de trazo 1.5 — nunca emojis como íconos. */
type Icono = "paquete" | "chat" | "mapa" | "check" | "camion" | "reloj" | "estrella" | "video";
type Burbuja = { icono: Icono; texto: string };

const BURBUJAS: Burbuja[][] = [
  [
    { icono: "paquete", texto: "Sneakers importados" },
    { icono: "chat", texto: "Pedidos por WhatsApp" },
    { icono: "mapa", texto: "Envíos a todo el país" },
  ],
  [
    { icono: "check", texto: "Elegís tu par y el talle" },
    { icono: "chat", texto: "Nos escribís por WhatsApp" },
    { icono: "camion", texto: "Coordinamos entrega y pago" },
  ],
  [
    { icono: "estrella", texto: "Drops semanales" },
    { icono: "paquete", texto: "Avisos de stock y re-stock" },
    { icono: "video", texto: "Unboxings y detrás de cámara" },
  ],
  [
    { icono: "reloj", texto: "Envío en el día" },
    { icono: "check", texto: "Pagás al recibir" },
    { icono: "mapa", texto: "CABA y GBA" },
  ],
  [
    { icono: "camion", texto: "OCA y Correo Argentino" },
    { icono: "reloj", texto: "2 a 3 días hábiles" },
    { icono: "mapa", texto: "Tierra del Fuego: 5 a 7 días" },
  ],
  [
    { icono: "chat", texto: "Asesoramiento personalizado" },
    { icono: "video", texto: "Video unboxing antes de recibirlo" },
    { icono: "check", texto: "Te ayudamos a elegir tu drop" },
  ],
];

function IconoSvg({ tipo }: { tipo: Icono }) {
  const base = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (tipo) {
    case "paquete":
      return <svg {...base}><path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9Z" /><path d="M3 7.5 12 12l9-4.5M12 12v9" /></svg>;
    case "chat":
      return <svg {...base}><path d="M4 5.5h16v10H9l-5 4v-14Z" /></svg>;
    case "mapa":
      return <svg {...base}><path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10Z" /><circle cx="12" cy="11" r="2" /></svg>;
    case "check":
      return <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></svg>;
    case "camion":
      return <svg {...base}><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.5" /><circle cx="17" cy="17.5" r="1.5" /></svg>;
    case "reloj":
      return <svg {...base}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>;
    case "estrella":
      return <svg {...base}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5Z" /></svg>;
    case "video":
      return <svg {...base}><rect x="3" y="6.5" width="13" height="11" rx="2" /><path d="m16 10 5-2.5v9L16 14" /></svg>;
  }
}

/** ".004 ARGENTINA" → "ARGENTINA". El numero lo ponemos nosotros. */
function tagDe(id: string): string {
  return id.replace(/^\.\d+\s*/, "").trim();
}

function armarPasos(): Paso[] {
  const m = site.mission;
  const intro: Paso = {
    numero: "01",
    tag: "Quiénes somos",
    titulo: m.title,
    copy: m.subtitle ?? "",
  };
  const pilares: Paso[] = m.pillars.map((p, i) => ({
    numero: String(i + 2).padStart(2, "0"),
    tag: tagDe(p.id),
    titulo: p.label,
    copy: p.copy,
    channels: p.channels,
    closing: p.closing,
    /* El cierre de la seccion vieja era una pantalla entera para una
       frase. Ahora es el remate del ultimo paso. */
    remate: i === m.pillars.length - 1 ? m.closing.phrase : undefined,
  }));
  return [intro, ...pilares];
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/* El grano va como estilo inline y NO dentro de <style jsx>: el data-URI
   (comillas + "//" de la URL del namespace SVG) rompe el parser de
   styled-jsx y se lleva puestas TODAS las reglas que vienen despues del
   selector. Costo real: la seccion entera salio sin grid, sin opacidades y
   con el titulo a 16px Helvetica, y los numeros del verificador no lo
   vieron porque el sticky (declarado antes) si andaba. */
const GRANO_SVG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E\")";

export default function Mission() {
  const pasos = useRef(armarPasos()).current;
  const N = pasos.length;
  const sectionRef = useRef<HTMLElement>(null);
  const activoRef = useRef(0);
  const [activo, setActivo] = useState(0);
  /* ── El mono cambia con el paso, en todos lados (4-sep-2026) ─────────
     Cambiar de mono remonta la escena (SkeletonUtils.clone + bbox + mixer),
     así que probé dejarlo fijo en el celu para ganar frames. Juani: "rompiste
     el 3D en el scrolling". Y tiene razón: el mono que cambia ES la sección
     — sin eso queda una lista de texto con un adorno arriba.

     Lo que sí se mantiene es esperar a que el scroll se aquiete (260 ms sin
     cambiar de paso) antes de remontar: el trabajo cae en la pausa y no en
     pleno movimiento del dedo. El texto cambia al instante igual. */
  const [modelo, setModelo] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => setModelo(activo), 260);
    return () => window.clearTimeout(t);
  }, [activo]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    let raf = 0;

    const medir = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const recorrido = el.offsetHeight - window.innerHeight;
      const p = recorrido > 0 ? clamp01(-r.top / recorrido) : 0;
      el.style.setProperty("--p", p.toFixed(4));
      /* El ultimo paso se activa un poco antes de llegar al 100%: si no,
         hay que scrollear hasta el borde exacto para verlo. */
      const idx = Math.min(N - 1, Math.floor(p * N + 0.08));
      if (idx !== activoRef.current) {
        activoRef.current = idx;
        setActivo(idx);
      }
    };
    const pedir = () => {
      if (!raf) raf = requestAnimationFrame(medir);
    };

    window.addEventListener("scroll", pedir, { passive: true });
    window.addEventListener("resize", pedir);
    medir();
    return () => {
      window.removeEventListener("scroll", pedir);
      window.removeEventListener("resize", pedir);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [N]);

  return (
    <section
      id="section-mission"
      ref={sectionRef}
      className="riel"
      /* El body acompaña el lila de la sección: sin esto se veía el
         near-black asomando arriba y abajo del sticky. */
      data-bg-color="#cdb5f0"
      data-text-color="#0a0a14"
      style={{ ["--n" as string]: N }}
    >
      <div className="pantalla">
        {/* ------------------------------------------------------------ fondo */}
        <div className="fondo" aria-hidden="true" />
        <div className="halo" aria-hidden="true" />
        <div className="grano" style={{ backgroundImage: GRANO_SVG }} aria-hidden="true" />

        {/* ------------------------------------------------------------ mono */}
        <div className="mono" aria-hidden="true">
          <div className="piso" />
          <MissionPillarMonkey modelSrc={MONOS[modelo] ?? MONOS[0]} replayKey={modelo} />
        </div>

        {/* ---------------------------------------------------------- burbujas
            key={activo}: al cambiar el paso se remontan y entran escalonadas.
            En desktop flotan alrededor del mono; en mobile son una fila
            deslizable entre el texto y el progreso. */}
        <ul className="burbujas" key={activo} aria-label="Datos del paso">
          {(BURBUJAS[activo] ?? []).map((b, i) => (
            <motion.li
              key={b.texto}
              className="burbuja"
              style={{ ["--i" as string]: i }}
              /* Se pueden agarrar y tirar (Juani: "que se pueda jugar con
                 ellas"). Al soltarlas vuelven solas con un resorte suave —
                 dragSnapToOrigin — así nunca quedan desacomodadas. */
              drag
              dragSnapToOrigin
              dragElastic={0.55}
              dragTransition={{ bounceStiffness: 260, bounceDamping: 18 }}
              whileDrag={{ scale: 1.06, zIndex: 3 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              /* Entrada corta a proposito: con delays largos, en un equipo
                 flojo (o con la GPU ocupada por el mono) las burbujas tardan
                 en aparecer y la seccion se ve vacia justo al llegar. */
              transition={{ delay: 0.06 + i * 0.07, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="brillo" aria-hidden="true" />
              <IconoSvg tipo={b.icono} />
              <span>{b.texto}</span>
            </motion.li>
          ))}
        </ul>

        {/* ------------------------------------------------------------ texto */}
        <div className="texto">
          {pasos.map((paso, i) => {
            const on = i === activo;
            return (
              <article
                key={paso.numero}
                className={`paso${on ? " on" : ""}`}
                aria-hidden={!on}
                {...(!on ? ({ inert: "" } as Record<string, string>) : {})}
              >
                <p className="eyebrow">
                  <span className="num">{paso.numero}</span>
                  <span className="sep" aria-hidden="true" />
                  <span>{paso.tag}</span>
                </p>
                <h2 className="titulo">{paso.titulo}</h2>
                {paso.copy && <p className="copy">{paso.copy}</p>}
                {paso.channels && paso.channels.length > 0 && <ChannelButtons channels={paso.channels} />}
                {paso.closing && <p className="closing">{paso.closing}</p>}
                {paso.remate && <p className="remate">{paso.remate}</p>}
              </article>
            );
          })}
        </div>

        {/* ------------------------------------------------------------ progreso */}
        <ol className="pasos" aria-label="Progreso">
          {pasos.map((paso, i) => (
            <li key={paso.numero} className={i === activo ? "on" : i < activo ? "hecho" : ""}>
              <span className="tick" aria-hidden="true" />
              <span className="lbl">{paso.tag}</span>
            </li>
          ))}
        </ol>
        <p className="hint" aria-hidden="true">
          Seguí bajando <span>↓</span>
        </p>
      </div>

      <style jsx>{`
        /* ---------------------------------------------------------------
           El riel: su alto define cuanto scroll consume la seccion. Cada
           paso pide --paso de scroll; con 6 pasos son ~4.7 pantallas de
           recorrido para 6 estados, contra 7 pantallas de antes.
           --------------------------------------------------------------- */
        .riel {
          --paso: 78svh;
          --p: 0;
          --tinta: #0a0a14;
          --tinta-2: rgba(10, 10, 20, 0.66);
          --lila-1: #e4d6fb;
          --lila-2: #cdb5f0;
          --lila-3: #b192e8;
          position: relative;
          height: calc(var(--n) * var(--paso));
          min-height: 100svh;
          color: var(--tinta);
        }
        .pantalla {
          position: sticky;
          top: 0;
          height: 100svh;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          grid-template-rows: 1fr;
          align-items: center;
          padding: 0 var(--container-pad);
        }

        /* --- fondo con profundidad ------------------------------------- */
        .fondo {
          position: absolute;
          inset: 0;
          background: linear-gradient(180deg, var(--lila-1) 0%, var(--lila-2) 52%, var(--lila-3) 100%);
        }
        /* El halo camina con el scroll: es lo que hace que el fondo no sea
           un color plano. Lee --p directo de CSS: cero renders de React. */
        /* Sin filter:blur ni will-change: un blur de 78vmax que se mueve en cada
           frame de scroll se re-pinta entero cada vez, y en PC se sentia lento
           (Juani, 4-sep). El radial-gradient ya es suave por si solo. */
        .halo {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 78vmax;
          height: 78vmax;
          border-radius: 50%;
          background: radial-gradient(
            circle,
            rgba(255, 214, 168, 0.58) 0%,
            rgba(255, 200, 160, 0.3) 22%,
            rgba(255, 190, 150, 0.12) 42%,
            rgba(255, 190, 150, 0) 64%
          );
          transform: translate(
            calc(-50% + (var(--p) - 0.5) * 46vw),
            calc(-50% + (0.5 - var(--p)) * 26vh)
          );
          pointer-events: none;
        }
        /* background-image viene inline (ver GRANO_SVG arriba) */
        /* sin mix-blend-mode: un blend a pantalla completa sobre una seccion
           pinneada es una capa de composicion cara en cada scroll */
        .grano {
          position: absolute;
          inset: 0;
          opacity: 0.04;
          pointer-events: none;
        }

        /* --- mono ------------------------------------------------------ */
        /* grid-area explicita en los dos hijos: .mono va primero en el DOM y
           con auto-placement el cursor ya paso la columna 1 cuando llega
           .texto, que caia a la FILA 2 — fuera de la pantalla pinneada. Con
           fila explicita comparten la fila 1 (medido: texto a top 883 de un
           viewport de 900 antes de esto). */
        .mono {
          position: relative;
          grid-area: 1 / 2;
          height: min(78svh, 720px);
          pointer-events: none;
        }
        .piso {
          position: absolute;
          left: 50%;
          bottom: 9%;
          width: 62%;
          height: 9%;
          transform: translateX(-50%);
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(40, 20, 70, 0.32), rgba(40, 20, 70, 0) 70%);
          filter: blur(6px);
        }

        /* --- texto: los N pasos apilados, solo el activo se ve ---------- */
        .texto {
          position: relative;
          grid-area: 1 / 1;
          align-self: center;
          min-width: 0;
          min-height: min(70svh, 640px);
          display: grid;
        }
        .paso {
          grid-area: 1 / 1;
          align-self: center;
          max-width: 46rem;
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 520ms cubic-bezier(0.16, 1, 0.3, 1), transform 620ms cubic-bezier(0.16, 1, 0.3, 1);
          pointer-events: none;
        }
        .paso.on {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }

        .eyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 0 0 14px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.7rem;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--tinta-2);
        }
        .num {
          font-variant-numeric: tabular-nums;
          color: var(--tinta);
          font-weight: 700;
        }
        .sep {
          width: 28px;
          height: 1px;
          background: currentColor;
          opacity: 0.5;
        }
        .titulo {
          margin: 0;
          font-family: var(--font-marquee);
          font-weight: 900;
          font-size: clamp(2.2rem, 6.2vw, 5.4rem);
          line-height: 0.94;
          letter-spacing: -0.035em;
          text-transform: uppercase;
          color: var(--tinta);
          /* el titulo largo (¿Cuales son nuestros canales oficiales?) no
             puede pisar al mono: se parte, no desborda */
          overflow-wrap: anywhere;
        }
        .copy {
          margin: clamp(14px, 2.2vw, 22px) 0 0;
          max-width: 34rem;
          font-size: clamp(1rem, 1.35vw, 1.18rem);
          line-height: 1.55;
          color: var(--tinta-2);
        }
        .closing {
          margin: clamp(14px, 2vw, 20px) 0 0;
          max-width: 32rem;
          font-size: 0.98rem;
          line-height: 1.55;
          font-style: italic;
          color: var(--tinta-2);
        }
        .remate {
          margin: clamp(18px, 2.4vw, 28px) 0 0;
          font-family: var(--font-marquee);
          font-weight: 900;
          font-size: clamp(1.15rem, 2.2vw, 1.8rem);
          line-height: 1.15;
          letter-spacing: -0.01em;
          text-transform: uppercase;
          color: var(--tinta);
        }

        /* --- burbujas ------------------------------------------------- */
        .burbujas {
          position: absolute;
          inset: 0;
          margin: 0;
          padding: 0;
          list-style: none;
          pointer-events: none;
        }
        /* :global: son motion.li (componentes) — styled-jsx no les pone la
           clase scoped. La entrada la maneja framer; acá queda el material. */
        .burbujas :global(.burbuja) {
          position: absolute;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          padding: 11px 16px 11px 13px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.34);
          backdrop-filter: blur(16px) saturate(160%);
          -webkit-backdrop-filter: blur(16px) saturate(160%);
          border: 1px solid rgba(255, 255, 255, 0.6);
          box-shadow: 0 14px 34px -16px rgba(40, 20, 70, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.85),
            inset 0 -6px 14px -8px rgba(120, 80, 180, 0.28);
          color: var(--tinta);
          font-size: 0.86rem;
          font-weight: 600;
          letter-spacing: -0.005em;
          white-space: nowrap;
          cursor: grab;
          overflow: hidden;
          animation: burbuja-flotar 7s ease-in-out calc(var(--i) * -1.7s) infinite alternate;
        }
        .burbujas :global(.burbuja:active) {
          cursor: grabbing;
        }
        /* El brillo que cruza el vidrio: es lo que lo hace ver mojado. */
        .brillo {
          position: absolute;
          inset: 0;
          border-radius: inherit;
          pointer-events: none;
          background: linear-gradient(
            105deg,
            transparent 30%,
            rgba(255, 255, 255, 0.75) 46%,
            rgba(255, 255, 255, 0.2) 54%,
            transparent 70%
          );
          background-size: 260% 100%;
          background-position: 180% 0;
          animation: brillo-cruza 6.5s ease-in-out calc(var(--i) * 1.1s) infinite;
        }
        @keyframes brillo-cruza {
          0%, 62% {
            background-position: 180% 0;
          }
          82%, 100% {
            background-position: -60% 0;
          }
        }
        .burbujas :global(.burbuja) svg {
          flex: 0 0 auto;
          opacity: 0.85;
        }
        /* alrededor del mono (columna derecha): arriba-izq, der-medio, abajo-izq */
        .burbujas :global(.burbuja):nth-child(1) { left: 51%; top: 17%; }
        .burbujas :global(.burbuja):nth-child(2) { right: 3%; top: 41%; }
        .burbujas :global(.burbuja):nth-child(3) { left: 53%; top: 70%; }
        .burbujas :global(.burbuja):nth-child(4) { right: 5%; top: 78%; }
        @keyframes burbuja-flotar {
          from {
            translate: 0 0;
          }
          to {
            translate: 0 -8px;
          }
        }

        /* --- progreso ------------------------------------------------- */
        .pasos {
          position: absolute;
          left: var(--container-pad);
          bottom: max(22px, env(safe-area-inset-bottom));
          margin: 0;
          padding: 0;
          list-style: none;
          display: flex;
          gap: 14px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.6rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--tinta-2);
        }
        .pasos li {
          display: flex;
          align-items: center;
          gap: 7px;
          transition: color 300ms;
        }
        .tick {
          width: 22px;
          height: 2px;
          background: currentColor;
          opacity: 0.35;
          transition: opacity 300ms, width 300ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .pasos li.hecho .tick {
          opacity: 0.7;
        }
        .pasos li.on {
          color: var(--tinta);
        }
        .pasos li.on .tick {
          width: 40px;
          opacity: 1;
        }
        .lbl {
          display: none;
        }
        .pasos li.on .lbl {
          display: inline;
        }

        .hint {
          position: absolute;
          right: var(--container-pad);
          bottom: max(22px, env(safe-area-inset-bottom));
          margin: 0;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.6rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--tinta-2);
          /* se apaga a medida que se llega al final */
          opacity: calc(1 - var(--p) * 1.35);
          pointer-events: none;
        }
        .hint span {
          display: inline-block;
          animation: bajar 1.8s ease-in-out infinite;
        }
        @keyframes bajar {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(4px);
          }
        }

        /* --- mobile: mono arriba, texto abajo -------------------------- */
        /* ── Mobile: tres filas, nada encima de nada ──────────────────
           Antes las burbujas eran absolutas al pie y el texto tenia un
           padding-bottom fijo para esquivarlas. En el paso "Canales" —el
           unico con copy + dos botones + cierre— el contenido crecia y las
           burbujas quedaban ENCIMA de los botones, con el texto cortandose
           abajo (visto en el iPhone de Juani).

           Ahora cada cosa tiene su fila propia: el mono arriba, el texto en
           el medio (con scroll interno si no entra, como un panel de iOS) y
           las burbujas abajo. Imposible que se pisen. */
        @media (max-width: 768px) {
          .riel {
            --paso: 88svh;
          }
          .pantalla {
            grid-template-columns: 1fr;
            /* 32svh: a 26 el mono quedaba de estampilla y la seccion se
               veia vacia — es el protagonista, tiene que pesar. El resto
               del alto es para el texto, que scrollea solo si no entra. */
            grid-template-rows: minmax(0, 32svh) minmax(0, 1fr) auto;
            align-items: stretch;
            padding-top: 60px;
            padding-bottom: calc(max(22px, env(safe-area-inset-bottom)) + 26px);
            row-gap: 8px;
          }
          .mono {
            grid-area: 1 / 1;
            height: 100%;
          }
          .texto {
            grid-area: 2 / 1;
            align-self: stretch;
            min-height: 0;
            padding-bottom: 0;
            overflow-y: auto;
            overscroll-behavior: contain;
            -webkit-overflow-scrolling: touch;
          }
          /* ── Centrar SIN recortar (4-sep-2026) ────────────────────────
             Con align-self:start los pasos cortos dejaban media pantalla en
             blanco. Lo pasé a center y rompí algo peor: cuando el paso es más
             alto que su fila (el de "¿Cómo comprar?", que suma copy y botón
             de WhatsApp) centrar lo desborda por ARRIBA y por abajo, y el
             desborde de arriba no se puede scrollear. Resultado en el iPhone
             de Juani: el título cortado por la mitad.

             margin auto hace las dos cosas bien, y para eso existe: los
             márgenes automáticos se reparten el espacio LIBRE, así que
             centran cuando sobra lugar y se resuelven a cero cuando falta —
             ahí manda el align-self y el bloque arranca arriba, entero. Es la
             diferencia entre centrar y recortar.

             (Ojo con los acentos graves en estos comentarios: el bloque
             style jsx es un template literal y uno solo lo corta al medio.
             Costó un build roto.) */
          .paso {
            align-self: start;
            margin-block: auto;
          }
          .titulo {
            font-size: clamp(1.75rem, 8.4vw, 2.5rem);
            line-height: 0.98;
          }
          .copy {
            font-size: 0.94rem;
            line-height: 1.45;
          }
          /* El parrafo de cierre sale en el celu: es lo secundario del paso
             y es lo que hacia que el contenido no entrara. En desktop queda. */
          .closing {
            display: none;
          }
          .halo {
            width: 120vmax;
            height: 120vmax;
          }
          /* Fila propia: fila deslizable, ya no flotando sobre el texto. */
          .burbujas {
            position: static;
            grid-area: 3 / 1;
            display: flex;
            gap: 8px;
            padding: 2px var(--container-pad) 2px;
            overflow-x: auto;
            scrollbar-width: none;
            pointer-events: auto;
            -webkit-overflow-scrolling: touch;
            /* La tercera burbuja queda cortada contra el borde y un elemento
               cortado se lee como un error de maquetado, no como "hay mas"
               (Juani ya lo marco una vez: "medio que se corta"). El degrade
               convierte el corte en la señal de que se desliza — el gesto de
               iOS. Y el snap hace que se frene en burbuja, no a la mitad. */
            mask-image: linear-gradient(to right, #000 82%, transparent 99%);
            -webkit-mask-image: linear-gradient(to right, #000 82%, transparent 99%);
            scroll-snap-type: x proximity;
            scroll-padding-left: var(--container-pad);
          }
          .burbujas::-webkit-scrollbar {
            display: none;
          }
          .burbujas :global(.burbuja) {
            position: static;
            flex: 0 0 auto;
            scroll-snap-align: start;
            font-size: 0.8rem;
            padding: 9px 13px 9px 11px;
            /* Sin backdrop-filter en el celu: tres blurs vivos dentro de una
               seccion pinneada se recomponen en cada frame de scroll, y es
               parte de "el scrolling de los monos se tilda". El fondo solido
               semitransparente se ve casi igual y no cuesta nada. */
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            background: rgba(255, 255, 255, 0.62);
            animation: none;
          }
          /* El brillo que cruza tambien se apaga: es una animacion continua
             por burbuja. */
          .brillo {
            display: none;
          }
          .burbujas :global(.burbuja):nth-child(n) {
            left: auto;
            right: auto;
            top: auto;
          }
          /* El progreso pasa al borde de la pantalla, no sobre el contenido. */
          .pasos {
            bottom: max(6px, env(safe-area-inset-bottom));
          }
          /* El "seguí bajando" se va en el celu: está anclado al mismo borde
             que la barra de pasos y a 390px se le encima — se leía
             "CANALES" y "SEGUÍ BAJANDO" uno sobre el otro. En un teléfono
             además sobra: las rayitas de progreso ya dicen que hay más, y
             nadie necesita que le expliquen que se scrollea. */
          .hint {
            display: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .paso,
          .tick,
          .pasos li {
            transition: none;
          }
          .halo {
            transform: translate(-50%, -50%);
          }
          .hint span {
            animation: none;
          }
          .burbujas :global(.burbuja) {
            animation: none;
            opacity: 1;
          }
          .brillo {
            animation: none;
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}
