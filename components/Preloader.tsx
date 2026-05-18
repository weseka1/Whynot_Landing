"use client";

/* ============================================================================
   PRELOADER
   - Pantalla de boot a fullscreen, fondo dark.
   - Contador 0% → 100% (~ --speed-preload).
   - Corners SVG en las 4 esquinas.
   - Secuencia de logs tipo terminal.
   ============================================================================ */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import CornerFrame from "./CornerFrame";

export default function Preloader() {
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const total = 3000; // = --speed-preload
    const step = 30;
    const inc = (step / total) * 100;

    const id = setInterval(() => {
      setPct((p) => {
        const next = p + inc;
        if (next >= 100) {
          clearInterval(id);
          setTimeout(() => setVisible(false), 400);
          return 100;
        }
        return next;
      });
    }, step);

    return () => clearInterval(id);
  }, []);

  const logs = [
    site.preloader.label,
    site.preloader.decrypt,
    site.preloader.granted,
    site.preloader.decrypted,
  ];

  // qué línea está activa según el progreso
  const activeLog = Math.min(Math.floor((pct / 100) * logs.length), logs.length - 1);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.5 } }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "var(--color-bg)",
            overflow: "hidden",
          }}
        >
          {/* Corners */}
          <CornerFrame position="top-left"     size={48} />
          <CornerFrame position="top-right"    size={48} />
          <CornerFrame position="bottom-left"  size={48} />
          <CornerFrame position="bottom-right" size={48} />

          {/* Scanline */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, transparent 0%, rgba(244,169,130,0.06) 50%, transparent 100%)",
              height: "30%",
              animation: "scan 2.4s linear infinite",
            }}
          />

          {/* Contenido central */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: "var(--container-pad)",
            }}
          >
            <div style={{ textAlign: "center", display: "grid", gap: "var(--space-md)" }}>
              <span className="system-text">{site.brand.name} / BOOT SEQUENCE</span>

              <div
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "clamp(4rem, 14vw, 12rem)",
                  lineHeight: 1,
                  color: "var(--color-accent)",
                }}
              >
                {Math.floor(pct).toString().padStart(3, "0")}%
              </div>

              <div style={{ display: "grid", gap: 4, justifyContent: "center" }}>
                {logs.map((l, i) => (
                  <span
                    key={l}
                    className="system-text"
                    style={{
                      opacity: i <= activeLog ? 1 : 0.2,
                      color:
                        i === logs.length - 1 && i <= activeLog
                          ? "var(--color-accent)"
                          : "var(--color-fg)",
                    }}
                  >
                    › <span className={i === activeLog ? "caret" : ""}>{l}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
