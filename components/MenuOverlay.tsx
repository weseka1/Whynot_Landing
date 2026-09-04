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

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import { WHATSAPP } from "@/lib/carrito";
import ProtocolModal from "./ProtocolModal";

type Props = { open: boolean; onClose: () => void };

/* Que hay en cada lugar. La clave es el href de site.nav. */
const DESCRIPCION: Record<string, string> = {
  "/#hero": "Volver arriba",
  "/#tienda": "Más vendidos y nuevos ingresos, con precio y talles",
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

export default function MenuOverlay({ open, onClose }: Props) {
  const [protocolOpen, setProtocolOpen] = useState(false);

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
                background: rgba(6, 5, 4, 0.62);
                backdrop-filter: blur(14px);
                -webkit-backdrop-filter: blur(14px);
                display: flex;
                align-items: flex-start;
                justify-content: center;
                /* El header fijo queda encima (su toggle MENU también cierra):
                   la lámina arranca debajo de él, no tapada. */
                padding: calc(78px + env(safe-area-inset-top)) 10px 10px;
                overflow-y: auto;
              }
              :global(.lamina) {
                width: min(520px, 100%);
                max-height: calc(100svh - 88px - env(safe-area-inset-top));
                display: flex;
                flex-direction: column;
                gap: 14px;
                padding: 16px 16px max(16px, env(safe-area-inset-bottom));
                border-radius: 28px;
                background: rgba(19, 16, 13, 0.78);
                backdrop-filter: blur(26px) saturate(180%);
                -webkit-backdrop-filter: blur(26px) saturate(180%);
                border: 1px solid rgba(243, 236, 225, 0.14);
                box-shadow: 0 30px 80px -30px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(243, 236, 225, 0.18);
                color: var(--color-fg, #f3ece1);
                overflow-y: auto;
                overscroll-behavior: contain;
              }
              .barra {
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
              .cerrar {
                width: 40px;
                height: 40px;
                border-radius: 12px;
                border: 1px solid rgba(243, 236, 225, 0.16);
                background: rgba(243, 236, 225, 0.06);
                color: inherit;
                font-size: 0.9rem;
                cursor: pointer;
              }

              .items {
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
                background: rgba(243, 236, 225, 0.05);
                border: 1px solid rgba(243, 236, 225, 0.09);
                box-shadow: inset 0 1px 0 rgba(243, 236, 225, 0.1);
                color: inherit;
                text-decoration: none;
                text-align: left;
                cursor: pointer;
                font: inherit;
                transition: background 200ms, transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
              }
              .items :global(.item:hover) {
                background: rgba(243, 236, 225, 0.1);
                transform: translateX(2px);
              }
              .items :global(.item:focus-visible) {
                outline: 2px solid var(--color-gold-soft, #c9ad6b);
                outline-offset: 2px;
              }
              .items :global(.item.destacado) {
                background: rgba(201, 173, 107, 0.14);
                border-color: rgba(201, 173, 107, 0.36);
              }
              .ico {
                flex: 0 0 auto;
                width: 40px;
                height: 40px;
                display: grid;
                place-items: center;
                border-radius: 12px;
                background: rgba(243, 236, 225, 0.07);
                color: var(--color-fg, #f3ece1);
              }
              .items :global(.item.destacado) .ico {
                color: var(--color-gold-soft, #c9ad6b);
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
                color: var(--color-muted, #a89a85);
                overflow-wrap: anywhere;
              }
              .chev {
                flex: 0 0 auto;
                color: var(--color-muted, #a89a85);
              }

              .wa {
                display: flex;
                align-items: center;
                justify-content: center;
                min-height: 52px;
                margin-top: 4px;
                border-radius: 16px;
                background: var(--color-fg, #f3ece1);
                color: #0a0908;
                font-weight: 700;
                text-decoration: none;
              }
              .wa:focus-visible {
                outline: 2px solid var(--color-gold-soft, #c9ad6b);
                outline-offset: 3px;
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
