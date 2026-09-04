"use client";

/* ============================================================================
   CHANNEL BUTTONS — pills de canal (WhatsApp, canal de WhatsApp, web).
   ----------------------------------------------------------------------------
   Extraido de Mission.tsx el 4-sep-2026 cuando Mission paso a ser una seccion
   pinneada: el componente no cambio, solo vive en su propio archivo.
   Iconos SVG inline (sin deps), borde + glow-on-hover via CSS.
   ============================================================================ */

/* ----------------------------------------------------------------------------
   ChannelButtons — pills futuristas para los 4 tipos de canal:
     - instagram, whatsapp, web, whatsapp-channel
   Iconos SVG inline (sin deps), borde + glow-on-hover via CSS.
   ---------------------------------------------------------------------------- */
export type Channel = {
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

export default function ChannelButtons({ channels }: { channels: Channel[] }) {
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
