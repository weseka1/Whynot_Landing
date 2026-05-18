"use client";

/* ============================================================================
   HEADER
   Nav fija con:
     - System text izq.
     - Logo centrado (display)
     - Toggle OFF / ON (hamburguesa)
   ============================================================================ */

import { useState } from "react";
import { site } from "@/data/site";
import MenuOverlay from "./MenuOverlay";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <header
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
          mixBlendMode: "difference",
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

        {/* Toggle OFF / ON */}
        <button
          onClick={() => setOpen(true)}
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
          <span style={{ opacity: open ? 0.4 : 1 }}>OFF</span>
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
          <span style={{ opacity: open ? 1 : 0.4 }}>ON</span>
        </button>
      </header>

      <MenuOverlay open={open} onClose={() => setOpen(false)} />
    </>
  );
}
