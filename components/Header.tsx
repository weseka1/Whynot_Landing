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
      <header
        className="site-header"
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          padding: "var(--space-sm) var(--container-pad)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          /* mix-blend-mode movido a CSS .site-header — solo desktop, en
             mobile usamos blur+gradient (mas barato, mejor legibilidad). */
        }}
      >
        <span className="system-text">{site.brand.tagline.toUpperCase()}</span>

        <a
          href="#hero"
          aria-label="Home"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.4rem",
            letterSpacing: "0.04em",
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {site.brand.name.toLowerCase()}
        </a>

        {/* Right cluster: sound toggle + menu toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
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

          {/* Menu toggle — label "MENU" + switch visual a la derecha. El
              switch sigue mostrando el state (animacion del dot) pero ya
              no hay texto OFF/ON laterales: el label MENU dice qué hace
              el boton.                                                     */}
          <button
            onClick={() => setOpen(true)}
            data-sound-hover
            aria-label="Open menu"
            aria-expanded={open}
            className="system-text"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              padding: "6px 12px",
              border: "1px solid currentColor",
              borderRadius: "var(--radius-pill)",
            }}
          >
          <span>MENU</span>
          <span
            style={{
              width: 24,
              height: 12,
              borderRadius: "var(--radius-pill)",
              background: "currentColor",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 1,
                left: open ? 13 : 1,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--color-bg)",
                transition: "left var(--speed-fast)",
              }}
            />
          </span>
        </button>
        </div>
      </header>

      <MenuOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
