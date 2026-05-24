"use client";

/* ============================================================================
   PRELOADER — version REAL (no fake timer)
   - Espera a que carguen los assets criticos del Hero (sky, marquee, GLB)
     + fonts (document.fonts.ready).
   - Progreso atado a la fraccion de assets ya completos.
   - MIN_TIME: minimo 1.2s en pantalla (evita flash si la red es muy rapida).
   - MAX_TIME: hard timeout 5s (si la red esta saturada igual liberamos UI).
   - Conserva el look: corners SVG, scanline, % grande, logs de boot.
   ============================================================================ */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import CornerFrame from "./CornerFrame";

/* MIN_TIME 800ms (antes 1200): pantalla minima del preloader para no
   flashear si la red es muy rapida. Bajado para reducir delay percibido.
   MAX_TIME 3500ms (antes 5000): hard timeout si la red esta saturada.
   3.5s es suficiente para 3G/4G, evita que el usuario espere de mas. */
const MIN_TIME = 800;
const MAX_TIME = 3500;

/* Helpers de precarga — cada uno resuelve cuando el asset esta listo. */
function loadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve(); // fallar no debe trabar el preloader
    img.src = src;
  });
}

function fetchAsset(src: string): Promise<void> {
  return new Promise((resolve) => {
    fetch(src, { cache: "force-cache" })
      .then((r) => r.blob())
      .then(() => resolve())
      .catch(() => resolve());
  });
}

function fontsReady(): Promise<void> {
  if (typeof document !== "undefined" && (document as any).fonts?.ready) {
    return (document as any).fonts.ready.then(() => undefined);
  }
  return Promise.resolve();
}

export default function Preloader() {
  const [pct, setPct] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const start = performance.now();

    /* Lista de "trabajos" — cada uno aporta 1/N al progreso. */
    const jobs: Promise<void>[] = [
      loadImage(site.hero.bgImage),
      loadImage("/assets/marquee/whynot-text.webp"),
      fetchAsset(site.hero.model),
      fontsReady(),
    ];

    let done = 0;
    const total = jobs.length;
    let cancelled = false;

    /* Update visual del % conforme jobs completan. */
    const tick = () => {
      if (cancelled) return;
      const target = Math.round((done / total) * 100);
      setPct((p) => (p < target ? Math.min(target, p + 2) : p));
      if (done < total) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    /* Cuando cada job termina, sumamos al contador. */
    jobs.forEach((p) => p.then(() => { done++; }));

    /* Helper: cierra el preloader y, una vez que el fade-out de
       framer-motion (500ms) termina, avisa al PixelReveal para que
       arranque su ola de revelado. Asi quedan secuenciales: primero el
       preloader se va, despues la grilla se abre desde el centro. */
    const close = () => {
      if (cancelled) return;
      setPct(100);
      setTimeout(() => {
        if (cancelled) return;
        setVisible(false);
        /* 500ms = duracion del exit fade del AnimatePresence de abajo. */
        setTimeout(() => {
          if (cancelled) return;
          window.dispatchEvent(new CustomEvent("whynot:preloader-hidden"));
        }, 500);
      }, 350);
    };

    /* Cierre: cuando todos terminaron Y paso MIN_TIME. */
    Promise.all(jobs).then(() => {
      if (cancelled) return;
      const elapsed = performance.now() - start;
      const wait = Math.max(0, MIN_TIME - elapsed);
      setTimeout(close, wait);
    });

    /* Hard timeout: si la red tarda demasiado, cerramos igual. */
    const hard = setTimeout(close, MAX_TIME);

    return () => {
      cancelled = true;
      clearTimeout(hard);
    };
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
