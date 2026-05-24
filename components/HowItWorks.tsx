"use client";

/* ============================================================================
   HOW IT WORKS — 5 bloques que extienden la Mission section.

   Visual igual que Mission.pillars: cada bloque 100vh, texto a la izquierda
   (50%), mono dorado 3D a la derecha (50%). Fondo lavanda igual al de
   Mission para continuidad visual. El mono dorado "se repite" porque cada
   bloque tiene su propio MissionPillarMonkey (mismo patron de Mission, 1
   canvas R3F por bloque, dispara animacion al entrar al viewport).

   Lo unico distinto vs Mission: cada bloque opcionalmente tiene channels[]
   que se renderizan como pills (IG, WhatsApp, Web, Canal de WhatsApp).
   ============================================================================ */

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { site } from "@/data/site";
import XDecoration from "./XDecoration";

const MissionPillarMonkey = dynamic(() => import("./MissionPillarMonkey"), {
  ssr: false,
  loading: () => null,
});

/* ----------------------------------------------------------------------------
   Icons SVG inline (sin deps externas). IG + WhatsApp son identicos a los
   de Mission.tsx; Web (globo) y Canal de WhatsApp (megafono) son nuevos.
   ---------------------------------------------------------------------------- */
function InstagramIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <path d="M16 11.37a4 4 0 1 1-4.74-4.74A4 4 0 0 1 16 11.37z" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WhatsAppIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.6 6.32A8.78 8.78 0 0 0 12.05 4a8.85 8.85 0 0 0-8.85 8.85c0 1.56.41 3.08 1.18 4.42L3.13 21.5l4.34-1.14a8.84 8.84 0 0 0 4.58 1.25h.01a8.85 8.85 0 0 0 8.85-8.85 8.78 8.78 0 0 0-2.31-5.94zm-5.55 13.6h-.01a7.36 7.36 0 0 1-3.74-1.03l-.27-.16-2.78.73.75-2.72-.17-.28a7.37 7.37 0 0 1-1.13-3.91 7.36 7.36 0 0 1 12.56-5.2 7.3 7.3 0 0 1 2.15 5.2 7.36 7.36 0 0 1-7.36 7.36zm4.04-5.5c-.22-.11-1.31-.65-1.52-.72-.2-.07-.35-.11-.5.11s-.57.72-.7.87c-.13.15-.26.17-.48.06a6.05 6.05 0 0 1-1.79-1.1 6.68 6.68 0 0 1-1.24-1.54c-.13-.22-.01-.34.1-.45.1-.1.22-.26.33-.39.11-.13.15-.22.22-.37.07-.15.04-.28-.02-.39-.06-.11-.5-1.2-.68-1.64-.18-.43-.36-.37-.5-.38h-.42c-.15 0-.39.06-.59.28-.2.22-.78.76-.78 1.85s.8 2.15.91 2.3c.11.15 1.57 2.4 3.8 3.36.53.23.94.36 1.27.46.53.17 1.01.15 1.4.09.43-.06 1.31-.54 1.5-1.05.18-.52.18-.96.13-1.05-.05-.09-.2-.15-.42-.26z" />
    </svg>
  );
}

function WebIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13 13 0 0 1 0 18a13 13 0 0 1 0 -18" />
    </svg>
  );
}

function WhatsAppChannelIcon({ size = 22 }: { size?: number }) {
  /* Megafono / canal de difusion. */
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11l13 -6v14l-13 -6z" />
      <path d="M16 8a4 4 0 0 1 0 8" />
      <path d="M8 11v2a4 4 0 0 0 4 4" />
    </svg>
  );
}

type Channel = {
  type:    "whatsapp" | "instagram" | "web" | "whatsapp-channel";
  display: string;
  url:     string;
};

function ChannelIcon({ type }: { type: Channel["type"] }) {
  switch (type) {
    case "instagram":        return <InstagramIcon />;
    case "whatsapp":         return <WhatsAppIcon />;
    case "web":              return <WebIcon />;
    case "whatsapp-channel": return <WhatsAppChannelIcon />;
  }
}

function ChannelButtons({ channels }: { channels: Channel[] }) {
  return (
    <div
      style={{
        marginTop: "var(--space-md)",
        display: "flex",
        flexWrap: "wrap",
        gap: "0.85rem",
      }}
    >
      {channels.map((c) => (
        <a
          key={c.type + c.url}
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          data-sound-hover
          aria-label={`${c.type} ${c.display}`}
          className={`mission-social-pill mission-social-${c.type === "instagram" ? "ig" : c.type === "whatsapp" ? "wa" : c.type === "web" ? "web" : "wa-channel"}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "10px 18px 10px 14px",
            borderRadius: 999,
            border: "1px solid currentColor",
            background: "linear-gradient(135deg, rgba(255,255,255,0.04), rgba(255,255,255,0.0))",
            color: "#0a0a14",
            fontFamily: "var(--font-mono)",
            fontSize: "0.85rem",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            textDecoration: "none",
            position: "relative",
            overflow: "hidden",
            transition: "transform var(--speed-fast, 0.15s), box-shadow var(--speed-fast, 0.15s), color var(--speed-fast, 0.15s)",
          }}
        >
          <ChannelIcon type={c.type} />
          <span>{c.display}</span>
        </a>
      ))}
    </div>
  );
}

export default function HowItWorks() {
  return (
    <section
      id="section-how-it-works"
      style={{
        position: "relative",
        background: "#cdb5f0",
        color: "#0a0a14",
      }}
    >
      <XDecoration seed={11} count={20} />

      <div style={{ position: "relative", zIndex: 2 }}>
        {site.howItWorks.blocks.map((b) => (
          <motion.div
            key={b.id}
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
            {/* COLUMNA IZQUIERDA — pregunta + copy + channels */}
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
                {b.id}
              </span>

              <h3
                style={{
                  fontFamily: "var(--font-marquee)",
                  fontWeight: 900,
                  fontSize: "clamp(2rem, 5vw, 4rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.02em",
                  textTransform: "uppercase",
                  marginBottom: "var(--space-md)",
                  color: "#000",
                }}
              >
                {b.label}
              </h3>

              <p
                style={{
                  fontSize: "clamp(1rem, 1.4vw, 1.25rem)",
                  lineHeight: 1.55,
                  maxWidth: 560,
                  color: "rgba(10,10,20,0.78)",
                }}
              >
                {b.copy}
              </p>

              {b.channels && b.channels.length > 0 && (
                <ChannelButtons channels={b.channels} />
              )}
            </div>

            {/* COLUMNA DERECHA — mono dorado 3D (mismo modelo que Mission) */}
            <div
              data-pillar-monkey
              style={{
                flex: "1 1 50%",
                position: "relative",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <MissionPillarMonkey modelSrc="/assets/3d/mono-dorado.glb" />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
