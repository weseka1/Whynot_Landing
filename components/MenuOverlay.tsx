"use client";

/* ============================================================================
   MENU OVERLAY — el mapa de la tienda, en vidrio.
   ----------------------------------------------------------------------------
   Antes: lista de palabras a 5rem sobre fondo solido (plantilla DICH). En el
   celu no entraba y no decia que habia detras de cada palabra. Juani, 4-sep:
   "mas didactico, mas facil de encontrar... para ir al catalogo".

   Ahora: una lamina de vidrio oscuro que baja desde arriba con tarjetas, cada
   una con icono, nombre y UNA linea que dice que vas a encontrar. Catalogo
   tiene su entrada propia (la pagina con el buscador de marcas) y WhatsApp
   cierra el menu como CTA. Las anclas son absolutas (/#tienda) para que el
   menu sirva desde cualquier pagina, no solo desde la home.

   ProtocolModal (politicas) sigue como hermano del AnimatePresence: meterlo
   adentro rompia su propio mount/unmount. Z 80 vs 60 del menu.
   ============================================================================ */

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import { WHATSAPP } from "@/lib/carrito";
import {
  getAllBrandSlugs,
  brandNameFromSlug,
  getEntriesByBrandSlug,
  posterUrl,
} from "@/data/catalog";
import ProtocolModal from "./ProtocolModal";

type Props = { open: boolean; onClose: () => void };

/* ── Las marcas, adentro del menú (4-sep-2026) ──────────────────────────
   Juani: "acá tiene que estar el catálogo de marcas para ver por par" y
   "tampoco agregaste la sección CATÁLOGO y que te lleve al menú para elegir
   las marcas".

   Antes el menú tenía un item "Catálogo" que te mandaba a OTRA página a
   elegir marca. Un paso de más para lo que la gente viene a hacer. Ahora las
   marcas están acá: abrís el menú y entrás directo a la que buscás.

   Se calcula a nivel de módulo (una vez, no por apertura) y se ordena por
   surtido, que es el orden en que conviene ofrecerlas. La portada es el
   primer 360 de la marca — se ve mejor que una foto suelta. */
type MarcaMenu = { slug: string; nombre: string; portada: string };

const MARCAS: MarcaMenu[] = getAllBrandSlugs()
  .map((slug) => {
    const entries = getEntriesByBrandSlug(slug);
    const portada = entries.find((e) => e.type === "360") ?? entries[0];
    return {
      slug,
      nombre: brandNameFromSlug(slug) ?? slug,
      portada: portada ? posterUrl(portada) : "",
      peso: entries.length,
    };
  })
  .filter((m) => m.peso > 0)
  .sort((a, b) => b.peso - a.peso || a.nombre.localeCompare(b.nombre))
  .map(({ slug, nombre, portada }) => ({ slug, nombre, portada }));

/* Cuántas se muestran antes del "ver todas". Ocho entran en cuatro filas de
   dos en un iPhone sin que el menú se vuelva una lista infinita. */
const MARCAS_VISIBLES = 8;

/* Que hay en cada lugar. La clave es el href de site.nav. */
const DESCRIPCION: Record<string, string> = {
  "/#hero": "Volver arriba",
  "/#tienda": "Más vendidos y nuevos ingresos, con talles",
  "/catalog/": "Buscá por marca: todos los modelos, la mayoría en 360°",
  "/#section-past-drop": "Las zapas girando en 360°",
  "/#section-como-comprar": "Tres pasos, envíos y pago al recibir",
  "/#section-collections": "La colección de la casa",
  "/#section-mission": "Quiénes somos y cómo trabajamos",
};

function Icono({ href }: { href: string }) {
  const b = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (href) {
    case "/#tienda":
      return <svg {...b}><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8a3 3 0 0 1 6 0" /></svg>;
    case "/catalog/":
      return <svg {...b}><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></svg>;
    case "/#section-past-drop":
      return <svg {...b}><circle cx="12" cy="12" r="8" /><path d="M4.5 12a7.5 3 0 0 0 15 0" /></svg>;
    case "/#section-como-comprar":
      return <svg {...b}><circle cx="12" cy="12" r="8.5" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5" /><path d="M12 17h.01" /></svg>;
    case "/#section-mission":
      return <svg {...b}><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
    case "/#section-collections":
      return <svg {...b}><path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8L12 3.5Z" /></svg>;
    default:
      return <svg {...b}><path d="M4 11.5 12 5l8 6.5" /><path d="M6.5 10.5V19h11v-8.5" /></svg>;
  }
}

/** Para comparar sin que molesten mayusculas ni acentos. */
function normalizar(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export default function MenuOverlay({ open, onClose }: Props) {
  const [protocolOpen, setProtocolOpen] = useState(false);
  /* ── Buscar la marca acá mismo (4-sep-2026) ─────────────────────────
     Juani: "necesito que la experiencia de compra sea fácil, si quiero
     buscar marcas en específico no tengo ganas de buscar 1 hora al pedo".

     Con solo la grilla de las 8 mas surtidas, quien busca una marca puntual
     que no esta ahi tiene que salir a otra pagina. Con el input, escribis
     tres letras y la tenes. Sin resultados, el link a WhatsApp: si no la
     tenemos en el catalogo, la conseguimos a pedido — eso tambien es una
     venta. */
  const [q, setQ] = useState("");
  const marcasFiltradas = useMemo(() => {
    const n = normalizar(q);
    if (!n) return MARCAS.slice(0, MARCAS_VISIBLES);
    return MARCAS.filter(
      (m) => normalizar(m.nombre).includes(n) || normalizar(m.slug).includes(n),
    );
  }, [q]);
  /* Al cerrar el menu se limpia: abrirlo de nuevo no arrastra la busqueda
     anterior. */
  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  /* ESC cierra + body scroll lock mientras esta abierto. */
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previo;
    };
  }, [open, onClose]);

  /* Los items que no son de la home (/catalog/) van con Link; las anclas con
     <a>: un Link a /#tienda estando en la home no hace scroll al hash. */
  const esRuta = (href: string) => href.startsWith("/") && !href.startsWith("/#");

  /* Portal al body (4-sep-2026): este componente se monta ADENTRO del
     <header> fijo, que tiene backdrop-filter — y un ancestro con filter o
     transform convierte position:fixed en relativo a el. El overlay cubria
     solo el alto del header y la lamina salia cortada por debajo ("Inicio"
     tapado, hero visible sin blur). Renderizado en el body, fixed es fixed. */
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  useEffect(() => setPortal(document.body), []);
  if (!portal) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28 }}
            onClick={onClose}
            role="presentation"
          >
            <motion.div
              className="lamina"
              initial={{ y: -28, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -18, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label="Menú"
            >
              <div className="barra">
                <span className="marca">{site.brand.name}</span>
                <button type="button" className="cerrar" onClick={onClose} aria-label="Cerrar menú">
                  ✕
                </button>
              </div>

              {/* ── COMPRÁ POR MARCA — va PRIMERO ────────────────────
                  El catálogo entra acá adentro, no como un link a otra
                  página: cada marca es una tarjeta con su foto real y te
                  lleva directo a sus modelos.

                  Y va arriba de la navegación, no abajo. Juani: "necesito
                  que la experiencia de compra sea fácil, si quiero buscar
                  marcas en específico no tengo ganas de buscar 1 hora al
                  pedo". Lo primero que ve quien abre el menú es el campo
                  para escribir su marca — no siete filas de secciones que
                  hay que pasar antes de llegar a comprar. */}
              <section className="marcas" aria-label="Comprá por marca">
                <p className="tituloSec">
                  <span>Comprá por marca</span>
                  <Link href="/catalog/" className="verTodas" onClick={onClose}>
                    Ver todas →
                  </Link>
                </p>
                <label className="buscarMarca">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5" />
                    <path d="m16 16 4 4" />
                  </svg>
                  <input
                    type="search"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscá tu marca: Jordan, Nike…"
                    autoComplete="off"
                    enterKeyHint="search"
                    aria-label="Buscar marca"
                  />
                  {q && (
                    <button type="button" onClick={() => setQ("")} aria-label="Borrar búsqueda">
                      ✕
                    </button>
                  )}
                </label>

                {marcasFiltradas.length === 0 ? (
                  <p className="sinMarca">
                    No la tenemos en el catálogo.{" "}
                    <a
                      href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(`Hola! Busco zapatillas ${q.trim()}, ¿las consiguen?`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Se la conseguimos a pedido →
                    </a>
                  </p>
                ) : (
                <ul className="grillaMarcas">
                  {marcasFiltradas.map((m, i) => (
                    <motion.li
                      key={m.slug}
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      /* Stagger corto: entran acompañando la apertura, no
                         después de ella. */
                      transition={{
                        delay: 0.14 + i * 0.035,
                        duration: 0.4,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                    >
                      <Link
                        href={`/catalog/${m.slug}/`}
                        className="marcaCard"
                        onClick={onClose}
                      >
                        <span className="marcaFoto">
                          {m.portada && (
                            <img src={m.portada} alt="" loading="lazy" decoding="async" />
                          )}
                        </span>
                        <span className="marcaNombre">{m.nombre}</span>
                      </Link>
                    </motion.li>
                  ))}
                </ul>
                )}
              </section>

              <nav>
                <ul className="items">
                  {site.nav.map((item, i) => {
                    const inner = (
                      <>
                        <span className="ico">
                          <Icono href={item.href} />
                        </span>
                        <span className="txt">
                          <span className="lbl">{item.label}</span>
                          {DESCRIPCION[item.href] && <span className="desc">{DESCRIPCION[item.href]}</span>}
                        </span>
                        <span className="chev" aria-hidden="true">
                          →
                        </span>
                      </>
                    );
                    return (
                      <motion.li
                        key={item.href}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.06 + i * 0.05, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                      >
                        {esRuta(item.href) ? (
                          <Link href={item.href} className="item destacado" onClick={onClose}>
                            {inner}
                          </Link>
                        ) : (
                          <a href={item.href} className="item" onClick={onClose}>
                            {inner}
                          </a>
                        )}
                      </motion.li>
                    );
                  })}

                  <motion.li
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.06 + site.nav.length * 0.05, duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <button type="button" className="item" onClick={() => setProtocolOpen(true)}>
                      <span className="ico">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M7 3.5h7l4 4v13H7z" />
                          <path d="M14 3.5v4h4M9.5 12h5M9.5 15.5h5" />
                        </svg>
                      </span>
                      <span className="txt">
                        <span className="lbl">Políticas de compra</span>
                        <span className="desc">Envíos, pagos, cambios y canales oficiales</span>
                      </span>
                      <span className="chev" aria-hidden="true">
                        ↗
                      </span>
                    </button>
                  </motion.li>
                </ul>
              </nav>


              <a className="wa" href={`https://wa.me/${WHATSAPP}`} target="_blank" rel="noopener noreferrer">
                Escribinos por WhatsApp
              </a>
            </motion.div>

            <style jsx>{`
              /* :global: .menu y .lamina son motion.div (componentes): sin
                 esto no eran fixed, la lamina no tenia fondo ni scroll y
                 'Inicio' quedaba cortado bajo el header (medido 4-sep). */
              :global(.menu) {
                position: fixed;
                inset: 0;
                z-index: 60;
                background: rgba(24, 16, 38, 0.44);
                backdrop-filter: blur(18px) saturate(140%);
                -webkit-backdrop-filter: blur(18px) saturate(140%);
                display: flex;
                /* Centrado de verdad. Antes era flex-start con 78px de
                   padding-top: en el celu la lámina arrancaba pegada al
                   header y el título del menú se cruzaba con el "why not"
                   del logo. Ahora la lámina se centra en el hueco que queda
                   libre y el padding sólo garantiza que nunca lo invada. */
                align-items: center;
                justify-content: center;
                padding: calc(74px + env(safe-area-inset-top)) 12px
                  calc(16px + env(safe-area-inset-bottom));
                overflow-y: auto;
              }
              /* ── Liquid glass de verdad (4-sep-2026) ────────────────────
                 Esto era rgba(19,16,13,.78): un panel marrón oscuro. Juani:
                 "te pedí que el menú sea liquid glass estilo iPhone y sigue
                 marrón caca". Tenía razón — el vidrio de iOS es CLARO y deja
                 pasar el color de atrás, no lo tapa con barro.

                 El truco es el mismo que usa nuestra web: el borde no es un
                 color plano, es un SEGUNDO gradiente pintado en border-box.
                 Eso da el canto biselado que hace que se lea como vidrio y
                 no como una caja translúcida. */
              :global(.lamina) {
                width: min(520px, 100%);
                max-height: calc(100svh - 104px - env(safe-area-inset-top));
                display: flex;
                flex-direction: column;
                gap: 12px;
                padding: 16px 16px max(16px, env(safe-area-inset-bottom));
                border: 1px solid transparent;
                border-radius: 30px;
                background:
                  linear-gradient(
                      168deg,
                      rgba(255, 253, 250, 0.82),
                      rgba(240, 232, 252, 0.62)
                    )
                    padding-box,
                  linear-gradient(
                      140deg,
                      rgba(255, 255, 255, 0.95),
                      rgba(255, 255, 255, 0.2) 38%,
                      rgba(255, 255, 255, 0.08) 64%,
                      rgba(126, 88, 190, 0.42)
                    )
                    border-box;
                backdrop-filter: blur(30px) saturate(190%);
                -webkit-backdrop-filter: blur(30px) saturate(190%);
                box-shadow:
                  0 40px 90px -30px rgba(38, 20, 66, 0.5),
                  0 4px 16px rgba(38, 20, 66, 0.16),
                  inset 0 1px 0 rgba(255, 255, 255, 0.75);
                color: #17121f;
                overflow-y: auto;
                overscroll-behavior: contain;
                position: relative;
                isolation: isolate;
              }
              /* La luz que entra por arriba del vidrio: es lo que separa
                 "panel translúcido" de "vidrio". */
              :global(.lamina)::before {
                content: "";
                position: absolute;
                left: 0;
                right: 0;
                top: 0;
                height: 42%;
                pointer-events: none;
                background: linear-gradient(
                  180deg,
                  rgba(255, 255, 255, 0.5),
                  transparent
                );
                z-index: 0;
              }
              .barra {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 4px 4px 0 8px;
              }
              .marca {
                font-family: var(--font-marquee);
                font-weight: 900;
                font-size: 1.05rem;
                letter-spacing: -0.02em;
                text-transform: lowercase;
              }
              /* Todo lo de abajo pasa a paleta CLARA: los valores viejos
                 eran crema al 6-16% de opacidad, pensados para leerse sobre
                 el panel marron. Sobre vidrio claro son invisibles. */
              .cerrar {
                width: 40px;
                height: 40px;
                border-radius: 12px;
                border: 1px solid rgba(38, 20, 66, 0.14);
                background: rgba(255, 255, 255, 0.55);
                color: inherit;
                font-size: 0.9rem;
                cursor: pointer;
              }

              .items {
                position: relative;
                z-index: 1;
                list-style: none;
                margin: 0;
                padding: 0;
                display: grid;
                gap: 8px;
              }
              /* :global(.item): styled-jsx solo agrega su clase scoped a
                 elementos nativos, NO a componentes. El item "Catálogo" es un
                 <Link> y salía sin tarjeta (medido 4-sep). Con :global dentro
                 de .items (que sí está scoped) aplica a los dos casos. */
              .items :global(.item) {
                display: flex;
                align-items: center;
                gap: 14px;
                width: 100%;
                min-height: 64px;
                padding: 12px 14px;
                border-radius: 18px;
                background: rgba(255, 255, 255, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.85);
                box-shadow:
                  0 2px 10px rgba(38, 20, 66, 0.06),
                  inset 0 1px 0 rgba(255, 255, 255, 0.9);
                color: inherit;
                text-decoration: none;
                text-align: left;
                cursor: pointer;
                font: inherit;
                transition: background 200ms, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
              }
              .items :global(.item:hover) {
                background: rgba(255, 255, 255, 0.78);
                transform: translateX(2px);
              }
              .items :global(.item:focus-visible) {
                outline: 2px solid var(--color-gold-soft, #c9ad6b);
                outline-offset: 2px;
              }
              .items :global(.item.destacado) {
                background: linear-gradient(
                  135deg,
                  rgba(146, 104, 214, 0.2),
                  rgba(255, 255, 255, 0.6)
                );
                border-color: rgba(126, 88, 190, 0.42);
              }
              .ico {
                flex: 0 0 auto;
                width: 40px;
                height: 40px;
                display: grid;
                place-items: center;
                border-radius: 12px;
                background: rgba(126, 88, 190, 0.1);
                color: #4a2f7a;
              }
              .items :global(.item.destacado) .ico {
                background: rgba(126, 88, 190, 0.2);
                color: #3d2266;
              }
              .txt {
                flex: 1;
                min-width: 0;
                display: grid;
                gap: 2px;
              }
              .lbl {
                font-size: 1.02rem;
                font-weight: 700;
                letter-spacing: -0.01em;
              }
              .desc {
                font-size: 0.8rem;
                line-height: 1.35;
                color: rgba(38, 20, 66, 0.62);
                overflow-wrap: anywhere;
              }
              .chev {
                flex: 0 0 auto;
                color: rgba(38, 20, 66, 0.4);
              }

              .wa {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 52px;
                margin-top: 4px;
                border-radius: 16px;
                background: #1d1230;
                color: #f6f2ff;
                font-weight: 700;
                text-decoration: none;
                box-shadow: 0 10px 24px -10px rgba(29, 18, 48, 0.7);
              }
              .wa:focus-visible {
                outline: 2px solid var(--color-gold-soft, #c9ad6b);
                outline-offset: 3px;
              }

              /* ── Comprá por marca ───────────────────────────────── */
              .marcas {
                position: relative;
                z-index: 1;
                display: grid;
                gap: 8px;
              }
              .tituloSec {
                display: flex;
                align-items: baseline;
                justify-content: space-between;
                gap: 10px;
                margin: 2px 4px 0;
                font-family: var(--font-mono, ui-monospace, monospace);
                font-size: 0.64rem;
                letter-spacing: 0.22em;
                text-transform: uppercase;
                color: rgba(38, 20, 66, 0.55);
              }
              .verTodas {
                color: #4a2f7a;
                font-weight: 700;
                text-decoration: none;
                white-space: nowrap;
              }
              .buscarMarca {
                display: flex;
                align-items: center;
                gap: 9px;
                padding: 0 12px;
                border-radius: 14px;
                background: rgba(255, 255, 255, 0.62);
                border: 1px solid rgba(255, 255, 255, 0.9);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
                color: rgba(38, 20, 66, 0.5);
              }
              .buscarMarca input {
                flex: 1;
                min-width: 0;
                border: 0;
                background: none;
                outline: none;
                color: #17121f;
                /* 16px CLAVADO: con menos, iOS Safari hace zoom a toda la
                   pagina al enfocar el input y se descoloca el overlay. */
                font-size: 16px;
                padding: 12px 0;
                font-family: inherit;
              }
              .buscarMarca input::placeholder {
                color: rgba(38, 20, 66, 0.42);
              }
              .buscarMarca input::-webkit-search-cancel-button {
                display: none;
              }
              .buscarMarca button {
                border: 0;
                background: none;
                color: inherit;
                font: inherit;
                cursor: pointer;
                padding: 4px;
              }
              .sinMarca {
                margin: 2px 4px;
                font-size: 0.82rem;
                line-height: 1.4;
                color: rgba(38, 20, 66, 0.62);
              }
              .sinMarca a {
                color: #4a2f7a;
                font-weight: 700;
              }
              .grillaMarcas {
                list-style: none;
                margin: 0;
                padding: 0;
                /* Dos columnas en el celu, cuatro cuando hay lugar. */
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 8px;
              }
              @media (min-width: 460px) {
                .grillaMarcas {
                  grid-template-columns: repeat(4, minmax(0, 1fr));
                }
              }
              .grillaMarcas :global(.marcaCard) {
                display: grid;
                gap: 6px;
                padding: 8px 8px 10px;
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.55);
                border: 1px solid rgba(255, 255, 255, 0.85);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
                color: inherit;
                text-decoration: none;
                /* 44px es el mínimo táctil; con la foto arriba sobra. */
                min-height: 44px;
                transition: background 200ms, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
              }
              .grillaMarcas :global(.marcaCard:hover) {
                background: rgba(255, 255, 255, 0.82);
                transform: translateY(-2px);
              }
              .grillaMarcas :global(.marcaCard:focus-visible) {
                outline: 2px solid #7e58be;
                outline-offset: 2px;
              }
              .marcaFoto {
                display: block;
                aspect-ratio: 4 / 3;
                border-radius: 10px;
                overflow: hidden;
                background: rgba(255, 255, 255, 0.7);
              }
              .marcaFoto img {
                width: 100%;
                height: 100%;
                object-fit: contain;
              }
              .marcaNombre {
                font-size: 0.72rem;
                font-weight: 700;
                line-height: 1.15;
                letter-spacing: -0.01em;
                text-transform: uppercase;
                /* Dos líneas como techo: hay marcas de nombre largo
                   (LOUIS VUITTON, MAISON MARGIELA) y sin esto empujan la
                   tarjeta y desalinean la grilla. */
                display: -webkit-box;
                -webkit-line-clamp: 2;
                -webkit-box-orient: vertical;
                overflow: hidden;
              }

              @media (prefers-reduced-motion: reduce) {
                .items :global(.item) {
                  transition: none;
                }
                .items :global(.item:hover) {
                  transform: none;
                }
              }
            `}</style>
          </motion.div>
        )}
      </AnimatePresence>

      <ProtocolModal open={protocolOpen} onClose={() => setProtocolOpen(false)} />
    </>,
    portal
  );
}
