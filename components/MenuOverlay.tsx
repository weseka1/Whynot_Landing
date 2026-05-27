"use client";

/* ============================================================================
   MENU OVERLAY
   Menú hamburguesa fullscreen.
   - Abre con animación de cortina desde arriba.
   - Lista de items viene de data/site.ts → nav.
   - Cerrar con tecla ESC o botón X.
   ============================================================================ */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import ProtocolModal from "./ProtocolModal";

type Props = { open: boolean; onClose: () => void };

export default function MenuOverlay({ open, onClose }: Props) {
  const [protocolOpen, setProtocolOpen] = useState(false);
  // ESC cierra el menú
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "var(--color-bg)",
            borderBottom: "1px solid var(--color-line)",
            display: "flex",
            flexDirection: "column",
            padding: "var(--space-lg) var(--container-pad)",
          }}
        >
          {/* Top bar dentro del menú */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--space-xl)",
            }}
          >
            <span className="system-text">D://DATA_CORE / MENU</span>
            <button onClick={onClose} aria-label="Close menu" className="system-text">
              CLOSE  ✕
            </button>
          </div>

          {/* Lista de navegación */}
          <nav>
            <ul
              style={{
                listStyle: "none",
                display: "grid",
                gap: "var(--space-sm)",
              }}
            >
              {site.nav.map((item, i) => (
                <motion.li
                  key={item.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, duration: 0.5 }}
                >
                  <a
                    href={item.href}
                    onClick={onClose}
                    className="display"
                    style={{
                      fontSize: "clamp(2rem, 7vw, 5rem)",
                      display: "inline-block",
                    }}
                  >
                    <span className="system-text" style={{ marginRight: 16 }}>
                      0{i + 1}
                    </span>
                    {item.label}
                  </a>
                </motion.li>
              ))}

              {/* Item 05 — D://DATA_CORE / PROTOCOL. No es link sino boton:
                  abre el ProtocolModal con las 4 politicas en acordeon. No
                  figura en el inicio — el unico acceso es desde aca.
                  fontSize bajado para que entre en una sola linea (vs los
                  items 01-04 que son palabras cortas). whiteSpace nowrap
                  garantiza que no rompa a 2 lineas en mobile.                */}
              <motion.li
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.1 + site.nav.length * 0.06,
                  duration: 0.5,
                }}
              >
                <button
                  onClick={() => setProtocolOpen(true)}
                  className="display"
                  style={{
                    fontSize: "clamp(1.05rem, 3.2vw, 2rem)",
                    display: "inline-flex",
                    alignItems: "baseline",
                    background: "transparent",
                    border: 0,
                    padding: 0,
                    cursor: "pointer",
                    color: "var(--color-fg)",
                    whiteSpace: "nowrap",
                    fontFamily: "var(--font-marquee)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <span
                    className="system-text"
                    style={{ marginRight: 16, flexShrink: 0 }}
                  >
                    05
                  </span>
                  D://DATA_CORE / PROTOCOL
                </button>
              </motion.li>
            </ul>
          </nav>

          <div style={{ flex: 1 }} />

          {/* Footer del menú */}
          <div
            className="system-text"
            style={{
              display: "flex",
              justifyContent: "space-between",
              borderTop: "1px solid var(--color-line)",
              paddingTop: "var(--space-md)",
            }}
          >
            <span>{site.brand.name} / {site.hero.metaLeft}</span>
            <span>{site.hero.metaRight}</span>
          </div>
        </motion.div>
      )}
      {/* ProtocolModal vive afuera del menu pero dentro del AnimatePresence
          padre asi puede abrirse encima del menu (zIndex 80 vs 60 del menu).
          Cuando el usuario cierra el modal, vuelve a ver el menu — y desde
          alli puede seguir navegando o cerrarlo.                            */}
      <ProtocolModal
        open={protocolOpen}
        onClose={() => setProtocolOpen(false)}
      />
    </AnimatePresence>
  );
}
