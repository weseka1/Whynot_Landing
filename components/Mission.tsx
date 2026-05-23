"use client";

/* ============================================================================
   MISSION — 4 pilares con texto a la izquierda y un MONO 3D embedded a la
   derecha de cada pilar.

   Layout:
     - Título arriba: 100vh, "Our Mission"
     - 4 pilares 100vh stack vertical:
         · texto a la izquierda
         · mono 3D a la derecha (in-DOM, NO sticky)
     - Cada mono dispara su animacion una vez al entrar al viewport.
       Cuando el pilar sale del viewport por arriba, el mono se va con el.

   El approach sticky-overlay anterior se descarto — el usuario queria que
   el mono se DESPLACE con el pilar (parte del DOM, no fixed al viewport).
   ============================================================================ */

import { useRef } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { site } from "@/data/site";
import XDecoration from "./XDecoration";

/* MissionPillarMonkey: 1 canvas R3F por pilar, dispara animacion al entrar
   al viewport (>= 30% visible). Cargado lazy + SSR off porque three.js
   solo corre en el browser. */
const MissionPillarMonkey = dynamic(() => import("./MissionPillarMonkey"), {
  ssr: false,
  loading: () => null,
});

/* ----------------------------------------------------------------------------
   SocialButtons — pills futuristas para Instagram + WhatsApp. Solo se
   renderiza en el pilar que tiene data.social en site.ts (.003 RELEASE).
   - Pills con borde + glow-on-hover (box-shadow expandida)
   - Iconos SVG inline (sin deps, sin font icons)
   - Scanline interno (gradient repeat) para textura "transmision"
   - Color: cyan-ish para IG, neon-green oficial para WA, los dos sobre
     fondo translucido. Hover: glow + slide del label.
   ---------------------------------------------------------------------------- */
type SocialData = {
  instagram?: { handle: string; url: string };
  whatsapp?:  { display: string; url: string };
};

function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37a4 4 0 1 1-4.74-4.74A4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M17.6 6.32A8.78 8.78 0 0 0 12.05 4a8.85 8.85 0 0 0-8.85 8.85c0 1.56.41 3.08 1.18 4.42L3.13 21.5l4.34-1.14a8.84 8.84 0 0 0 4.58 1.25h.01a8.85 8.85 0 0 0 8.85-8.85 8.78 8.78 0 0 0-2.31-5.94zm-5.55 13.6h-.01a7.36 7.36 0 0 1-3.74-1.03l-.27-.16-2.78.73.75-2.72-.17-.28a7.37 7.37 0 0 1-1.13-3.91 7.36 7.36 0 0 1 12.56-5.2 7.3 7.3 0 0 1 2.15 5.2 7.36 7.36 0 0 1-7.36 7.36zm4.04-5.5c-.22-.11-1.31-.65-1.52-.72-.2-.07-.35-.11-.5.11s-.57.72-.7.87c-.13.15-.26.17-.48.06a6.05 6.05 0 0 1-1.79-1.1 6.68 6.68 0 0 1-1.24-1.54c-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.2-.68-1.64-.18-.43-.36-.37-.5-.38h-.42c-.15 0-.39.06-.59.28-.2.22-.78.76-.78 1.85s.8 2.15.91 2.3c.11.15 1.57 2.4 3.8 3.36.53.23.94.36 1.27.46.53.17 1.01.15 1.4.09.43-.06 1.31-.54 1.5-1.05.18-.52.18-.96.13-1.05-.05-.09-.2-.15-.42-.26z" />
    </svg>
  );
}

function SocialButtons({ social }: { social: SocialData }) {
  return (
    <div
      style={{
        marginTop: "var(--space-md)",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.85rem",
      }}
    >
      {social?.instagram && (
        <a
          href={social.instagram.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Instagram ${social.instagram.handle}`}
          className="mission-social-pill mission-social-ig"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px 10px 14px",
            borderRadius: 999,
            border: "1px solid currentColor",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.0))",
            color: "#0a0a14",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
            position: "relative",
            overflow: "hidden",
            transition:
              "transform var(--speed-fast, 0.15s), box-shadow var(--speed-fast, 0.15s), color var(--speed-fast, 0.15s)",
          }}
        >
          <InstagramIcon />
          <span>{social.instagram.handle}</span>
        </a>
      )}

      {social?.whatsapp && (
        <a
          href={social.whatsapp.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${social.whatsapp.display}`}
          className="mission-social-pill mission-social-wa"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px 10px 14px",
            borderRadius: 999,
            border: "1px solid currentColor",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.0))",
            color: "#0a0a14",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
            position: "relative",
            overflow: "hidden",
            transition:
              "transform var(--speed-fast, 0.15s), box-shadow var(--speed-fast, 0.15s), color var(--speed-fast, 0.15s)",
          }}
        >
          <WhatsAppIcon />
          <span>{social.whatsapp.display}</span>
        </a>
      )}
    </div>
  );
}

export default function Mission() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section
      id="section-mission"
      ref={sectionRef}
      style={{
        position: "relative",
        background: "#cdb5f0",
        color: "#0a0a14",
      }}
    >
      <XDecoration seed={7} count={20} />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Título arriba — minHeight 100vh, vertical-centrado. */}
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "var(--space-md) var(--container-pad)",
            maxWidth: "50%",
          }}
        >
          <span className="system-text">{site.mission.eyebrow}</span>
          <h2
            style={{
              fontFamily: "var(--font-marquee)",
              fontWeight: 900,
              fontSize: "clamp(3rem, 9vw, 8rem)",
              lineHeight: 0.9,
              letterSpacing: "-0.04em",
              textTransform: "uppercase",
              marginTop: "var(--space-sm)",
              color: "var(--color-accent)",
            }}
          >
            {site.mission.title}
          </h2>
          {site.mission.subtitle && (
            <p
              style={{
                marginTop: "var(--space-md)",
                maxWidth: 520,
                fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
                lineHeight: 1.5,
                color: "rgba(10,10,20,0.7)",
              }}
            >
              {site.mission.subtitle}
            </p>
          )}
        </div>

        {/* 4 pilares: texto a la izquierda (50%), mono 3D a la derecha (50%).
            Cada pilar se autoanima al entrar al viewport. Layout flex
            two-column con vertical-center del texto. */}
        {site.mission.pillars.map((p) => (
          <motion.div
            key={p.id}
            data-pillar
            initial={{ opacity: 0, y: 60 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.35 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "stretch",
              borderTop: "1px solid var(--color-line)",
            }}
          >
            {/* COLUMNA IZQUIERDA — texto del pilar (vertical-centered). */}
            <div
              data-pillar-text
              style={{
                flex: "1 1 50%",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                paddingInline: "var(--container-pad)",
                textAlign: "left",
              }}
            >
              <span
                className="system-text"
                style={{
                  color: "var(--color-accent)",
                  marginBottom: "var(--space-sm)",
                  fontSize: "1.4rem",
                  display: "block",
                }}
              >
                {p.id}
              </span>
              <h3
                style={{
                  fontFamily: "var(--font-marquee)",
                  fontWeight: 900,
                  fontSize: "clamp(2.5rem, 6vw, 5rem)",
                  lineHeight: 0.95,
                  marginBottom: "var(--space-md)",
                  letterSpacing: "-0.03em",
                  textTransform: "uppercase",
                  maxWidth: 600,
                }}
              >
                {p.label}
              </h3>
              <p
                style={{
                  fontSize: "1.1rem",
                  lineHeight: 1.55,
                  color: "var(--color-muted)",
                  maxWidth: 460,
                }}
              >
                {p.copy}
              </p>

              {"social" in p && p.social ? (
                <SocialButtons social={p.social} />
              ) : null}
            </div>

            {/* COLUMNA DERECHA — mono 3D embedded en el pilar. Se desplaza
                con el scroll (no es sticky); cada instancia dispara su
                animacion cuando este pilar entra al viewport. */}
            <div
              data-pillar-monkey
              style={{
                flex: "1 1 50%",
                position: "relative",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <MissionPillarMonkey />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
