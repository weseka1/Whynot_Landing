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
   ChannelButtons — pills futuristas para los 4 tipos de canal:
     - instagram, whatsapp, web, whatsapp-channel
   Iconos SVG inline (sin deps), borde + glow-on-hover via CSS.
   ---------------------------------------------------------------------------- */
type Channel = {
  type:    "whatsapp" | "instagram" | "web" | "whatsapp-channel";
  display: string;
  url:     string;
  /* Descripcion corta opcional debajo del pill (ej: lo que vas a encontrar
     en ese canal). Se renderea con tipografia mono fina para no competir
     con el pill principal.                                                */
  note?:   string;
};

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
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 11l13 -6v14l-13 -6z" />
      <path d="M16 8a4 4 0 0 1 0 8" />
      <path d="M8 11v2a4 4 0 0 0 4 4" />
    </svg>
  );
}

function ChannelIcon({ type }: { type: Channel["type"] }) {
  switch (type) {
    case "instagram":        return <InstagramIcon />;
    case "whatsapp":         return <WhatsAppIcon />;
    case "web":              return <WebIcon />;
    case "whatsapp-channel": return <WhatsAppChannelIcon />;
  }
}

function ChannelButtons({ channels }: { channels: Channel[] }) {
  /* Mapea el type a la suffix del className para que el CSS existente
     (mission-social-ig / mission-social-wa en globals.css) siga funcionando
     y los nuevos (mission-social-web / mission-social-wa-channel) puedan
     estilarse si hace falta. */
  const cls: Record<Channel["type"], string> = {
    instagram:          "mission-social-ig",
    whatsapp:           "mission-social-wa",
    web:                "mission-social-web",
    "whatsapp-channel": "mission-social-wa-channel",
  };

  /* Si alguno de los channels trae `note`, cambiamos el layout a columna
     (cada pill apilado con su descripcion debajo). Si no, mantenemos el
     row con wrap (comportamiento original).                              */
  const hasNotes = channels.some((c) => c.note);

  return (
    <div
      style={{
        marginTop: "var(--space-md)",
        display: "flex",
        flexDirection: hasNotes ? "column" : "row",
        flexWrap: "wrap",
        gap: hasNotes ? "1rem" : "0.85rem",
        alignItems: hasNotes ? "flex-start" : "stretch",
      }}
    >
      {channels.map((c) => (
        <div
          key={c.type + c.url}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            maxWidth: 460,
          }}
        >
          <a
            href={c.url}
            target="_blank"
            rel="noopener noreferrer"
            data-sound-hover
            aria-label={`${c.type} ${c.display}`}
            className={`mission-social-pill ${cls[c.type]}`}
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
              alignSelf: "flex-start",
            }}
          >
            <ChannelIcon type={c.type} />
            <span>{c.display}</span>
          </a>
          {c.note && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: "0.78rem",
                lineHeight: 1.4,
                color: "rgba(10,10,20,0.62)",
                letterSpacing: "0.02em",
                paddingLeft: "0.4rem",
              }}
            >
              {c.note}
            </span>
          )}
        </div>
      ))}
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
        /* Mission queda FUERA del sweep DICH (pedido del usuario): los
           monos 3D que caen desde arriba entraban al viewport con el
           fondo de la seccion anterior (Meteorite oscuro) y cambiaban
           al lila solo despues de cruzar el 50%. Se veian "cambiando
           de color". Ahora Mission tiene su lila fijo y los monos
           siempre estan sobre el mismo fondo.                            */
        background: "#cdb5f0",
        color: "#0a0a14",
      }}
    >
      <XDecoration seed={7} count={20} />

      <div style={{ position: "relative", zIndex: 2 }}>
        {/* Header del Mission section: texto "SOMOS WHYNOT" a la izquierda
            (50%) + mono dorado 3D a la derecha (50%). Mismo layout
            two-column que los pilares — asegura consistencia visual y que
            el mono se vea con la misma escala que los otros 4. */}
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "stretch",
          }}
        >
          {/* COLUMNA IZQUIERDA — eyebrow + título + subtitle */}
          <div
            style={{
              flex: "1 1 50%",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              padding: "var(--space-md) var(--container-pad)",
            }}
          >
            <span className="system-text">{site.mission.eyebrow}</span>
            {/* Título "SOMOS WHYNOT" en T-12 negro plano sobre lavanda. */}
            <h2
              style={{
                fontFamily: "var(--font-marquee)",
                fontWeight: 900,
                fontSize: "clamp(3rem, 9vw, 8rem)",
                lineHeight: 0.9,
                letterSpacing: "-0.04em",
                textTransform: "uppercase",
                marginTop: "var(--space-sm)",
                color: "#000",
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

          {/* COLUMNA DERECHA — mono dorado, dispara animacion al entrar */}
          <div
            style={{
              flex: "1 1 50%",
              position: "relative",
              pointerEvents: "none",
            }}
            aria-hidden
          >
            <MissionPillarMonkey modelSrc="/assets/3d/mono-dorado.glb" />
          </div>
        </div>

        {/* 4 pilares: texto a la izquierda (50%), mono 3D a la derecha (50%).
            Cada pilar se autoanima al entrar al viewport. Layout flex
            two-column con vertical-center del texto. */}
        {site.mission.pillars.map((p, i) => (
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

              {p.channels && p.channels.length > 0 ? (
                <ChannelButtons channels={p.channels} />
              ) : null}

              {/* Parrafo de cierre opcional debajo de los pills (ej: CTA
                  "querés ser exclusivo como nosotros..." en el pilar de
                  canales).                                                  */}
              {p.closing && (
                <p
                  style={{
                    marginTop: "var(--space-md)",
                    fontSize: "0.98rem",
                    lineHeight: 1.55,
                    color: "rgba(10,10,20,0.72)",
                    maxWidth: 480,
                    fontStyle: "italic",
                  }}
                >
                  {p.closing}
                </p>
              )}
            </div>

            {/* COLUMNA DERECHA — mono 3D embedded en el pilar. Se desplaza
                con el scroll (no es sticky); cada instancia dispara su
                animacion cuando este pilar entra al viewport.

                Asignacion por pilar (orden actual, 5 pilares):
                  - .001 COMPRA     (i=0): default (Midnight Gorilla rigged)
                  - .002 CANALES    (i=1): mono blanco-dorado (LV Ape, rigged
                                          via transfer-rig-to-obj.py + FBX
                                          Mixamo Falling To Landing)
                  - .003 CABA       (i=2): mono blanco (Supreme Simian)
                  - .004 ARGENTINA  (i=3): gorila streetwear (Esenssial)
                  - .005 DUDAS      (i=4): mono Louis Vuitton
                Header de Mission y closing siguen con mono dorado. */}
            <div
              data-pillar-monkey
              style={{
                flex: "1 1 50%",
                position: "relative",
                pointerEvents: "none",
              }}
              aria-hidden
            >
              <MissionPillarMonkey
                modelSrc={
                  i === 1
                    ? "/assets/3d/mono-blanco-dorado.glb"
                    : i === 2
                    ? "/assets/3d/mono-blanco.glb"
                    : i === 3
                    ? "/assets/3d/gotila-esenssial.glb"
                    : i === 4
                    ? "/assets/3d/mono-louis.glb"
                    : undefined /* i=0 (.001 COMPRA) → default rigged */
                }
              />
            </div>
          </motion.div>
        ))}

        {/* CIERRE — mono dorado solo y centrado + frase grande abajo.
            Funciona como sello/firma despues de los 5 pilares. */}
        <motion.div
          data-mission-closing
          initial={{ opacity: 0, y: 60 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "var(--space-xl) var(--container-pad)",
            borderTop: "1px solid var(--color-line)",
            textAlign: "center",
          }}
        >
          {/* Mono dorado solo, centrado y mas grande que en los pilares */}
          <div
            style={{
              width: "min(560px, 70vw)",
              height: "min(560px, 60vh)",
              position: "relative",
              pointerEvents: "none",
              marginBottom: "var(--space-lg)",
            }}
            aria-hidden
          >
            <MissionPillarMonkey modelSrc="/assets/3d/mono-dorado.glb" />
          </div>

          <p
            style={{
              fontFamily: "var(--font-marquee)",
              fontWeight: 900,
              fontSize: "clamp(1.6rem, 3.4vw, 3rem)",
              lineHeight: 1.15,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: "#000",
              maxWidth: 900,
            }}
          >
            {site.mission.closing.phrase}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
