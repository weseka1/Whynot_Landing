"use client";

/* ============================================================================
   HEADER
   Nav fija con:
     - System text izq.
     - Logo centrado (display)
     - Toggle OFF / ON (hamburguesa)
   ============================================================================ */

import { useEffect, useState } from "react";
import { site } from "@/data/site";
import MenuOverlay from "./MenuOverlay";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  /* Sync con el SoundController: cuando emite "whynot:sound-state",
     actualizamos el icono. El toggle se dispara via "whynot:sound-toggle". */
  useEffect(() => {
    const onState = (e: Event) => {
      const ce = e as CustomEvent<{ on: boolean }>;
      setSoundOn(!!ce.detail?.on);
    };
    window.addEventListener("whynot:sound-state", onState);
    return () => window.removeEventListener("whynot:sound-state", onState);
  }, []);

  const toggleSound = () => {
    window.dispatchEvent(new CustomEvent("whynot:sound-toggle"));
  };

  return (
    <>
      {/* ── El header es un GRID de tres zonas (5-sep-2026) ─────────────────
          El logo estaba en position:absolute con left:50% — centrado en la
          VENTANA, sin saber qué había al lado. Los botones vivían en flujo
          normal a la derecha. En un celu angosto el centro invadía el
          cluster derecho y "why not" se montaba sobre la píldora del MENU.
          Juani lo marcó tres veces, con captura y todo.

          Un margen o un padding no lo arregla: el punto de choque se corre
          con cada ancho de pantalla, así que siempre hay un teléfono donde
          vuelve a pasar. Con tres columnas de grid cada zona tiene su
          espacio propio y la superposición pasa a ser imposible — no
          evitada, imposible.

          En mobile son dos zonas: el logo a la izquierda y los botones a la
          derecha, que es lo que hace Nike y cualquier tienda seria en
          celular. El tagline se oculta (ya lo hacía globals.css) porque no
          aporta y roba el ancho que necesita el logo. */}
      <header
        className="site-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "var(--space-sm) var(--container-pad)",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          columnGap: "var(--space-sm)",
          /* mix-blend-mode movido a CSS .site-header — solo desktop, en
             mobile usamos blur+gradient (mas barato, mejor legibilidad). */
        }}
      >
        <span className="system-text hdr-tagline">{site.brand.tagline.toUpperCase()}</span>

        <a
          href="#hero"
          aria-label="Home"
          className="hdr-logo"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.4rem",
            letterSpacing: "0.04em",
            justifySelf: "center",
            whiteSpace: "nowrap",
          }}
        >
          {site.brand.name.toLowerCase()}
        </a>

        {/* Right cluster: sound toggle + menu toggle */}
        <div
          className="hdr-acciones"
          style={{
            display: "flex",
            alignItems: "center",
            justifySelf: "end",
            gap: "var(--space-xs)",
          }}
        >
          {/* Sound toggle — speaker icon. data-sound-skip evita que el
              propio click toggle dispare ademas el click sound. */}
          <button
            onClick={toggleSound}
            data-sound-skip
            data-sound-hover
            aria-label={soundOn ? "Mute sound" : "Enable sound"}
            aria-pressed={soundOn}
            className="system-text"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              border: "1px solid currentColor",
              borderRadius: "50%",
              padding: 0,
              background: "transparent",
              color: "currentColor",
              cursor: "pointer",
            }}
          >
            {soundOn ? (
              /* Speaker ON: 3 ondas */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15.54 8.46a5 5 0 010 7.07" />
                <path d="M19.07 4.93a10 10 0 010 14.14" />
              </svg>
            ) : (
              /* Speaker OFF: muted */
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>

          {/* Boton de menu. Antes era un switch tipo interruptor (pastilla
              con un dot que se movia de lado): parecia un apagado/prendido y
              no un menu — "tiene una tecla como de apagado y prendido que no
              tiene sentido" (Juani, 4-sep-2026). Ahora es lo que la gente ya
              sabe leer: tres lineas que se cruzan al abrir. */}
          <button
            onClick={() => setOpen((v) => !v)}
            data-sound-hover
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="system-text"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "8px 14px",
              border: "1px solid currentColor",
              borderRadius: "var(--radius-pill)",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <span>{open ? "CERRAR" : "MENU"}</span>
            <span aria-hidden style={{ position: "relative", width: 18, height: 12, flexShrink: 0 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    left: 0,
                    width: 18,
                    height: 1.5,
                    borderRadius: 2,
                    background: "currentColor",
                    /* abierto: arriba y abajo se cruzan en el centro, la del
                       medio se apaga */
                    top: open ? 5 : i * 5,
                    opacity: open && i === 1 ? 0 : 1,
                    transform: open
                      ? i === 0
                        ? "rotate(45deg)"
                        : i === 2
                          ? "rotate(-45deg)"
                          : "none"
                      : "none",
                    transition:
                      "top .28s cubic-bezier(.16,1,.3,1), transform .28s cubic-bezier(.16,1,.3,1), opacity .18s ease",
                  }}
                />
              ))}
            </span>
          </button>
        </div>
      </header>

      <MenuOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
