"use client";

/* ============================================================================
   MENU OVERLAY
   Menú hamburguesa fullscreen.
   - Abre con animación de cortina desde arriba.
   - Lista de items viene de data/site.ts → nav.
   - Cerrar con tecla ESC o botón X.
   ============================================================================ */

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";

type Props = { open: boolean; onClose: () => void };

export default function MenuOverlay({ open, onClose }: Props) {
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
    </AnimatePresence>
  );
}
