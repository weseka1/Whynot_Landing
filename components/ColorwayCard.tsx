"use client";

/* ============================================================================
   COLORWAY CARD — card de un colorway en la brand page
   ----------------------------------------------------------------------------
   - Preview: para 360 usa frame_01 (garantizado); para image intenta main.jpg
     y, si falla, cae a un placeholder técnico (SPECIMEN OFFLINE).
   - Hover: scale + glow + scan line + bright border
   - Link a /catalog/[brand]/[model]/[colorway]
   ============================================================================ */

import Link from "next/link";
import { useState } from "react";
import { motion } from "framer-motion";
import { frameUrl, mainUrl, type CatalogEntry } from "@/data/catalog";

const GOLD = "#e8c468";
const GOLD_DIM = "rgba(232,196,104,0.55)";

type Props = {
  entry: CatalogEntry;
  href: string;
};

export default function ColorwayCard({ entry, href }: Props) {
  const is360 = entry.type === "360";
  const [imgFailed, setImgFailed] = useState(false);
  const previewUrl = is360 ? frameUrl(entry, 1) : mainUrl(entry);

  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "block",
      }}
    >
      <motion.article
        whileHover={{ y: -6 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: "relative",
          borderRadius: 16,
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
          border: "1px solid rgba(232,196,104,0.22)",
          overflow: "hidden",
          cursor: "pointer",
          transition: "border-color 0.3s, box-shadow 0.3s",
        }}
        className="colorway-card"
      >
        {/* Preview area — white platform with shoe */}
        <div
          style={{
            position: "relative",
            aspectRatio: "4/3",
            background: "linear-gradient(180deg, #ffffff 0%, #f4f4f0 100%)",
            overflow: "hidden",
            boxShadow: "inset 0 -25px 50px rgba(0,0,0,0.06)",
          }}
        >
          {!imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={`${entry.brand} ${entry.model} ${entry.colorway}`}
              loading="lazy"
              draggable={false}
              onError={() => setImgFailed(true)}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "contain",
                transform: "scale(0.82)",
                transformOrigin: "center",
                pointerEvents: "none",
                display: "block",
              }}
            />
          ) : (
            <OfflinePlaceholder />
          )}

          {/* Contact shadow bajo la zapa */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              bottom: "10%",
              left: "22%",
              right: "22%",
              height: 10,
              background:
                "radial-gradient(ellipse at center, rgba(0,0,0,0.22), transparent 70%)",
              filter: "blur(5px)",
              pointerEvents: "none",
            }}
          />

          {/* Corner markers */}
          <CornerL pos="tl" />
          <CornerL pos="tr" />
          <CornerL pos="bl" />
          <CornerL pos="br" />

          {/* 360 badge */}
          {is360 && (
            <div
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.55rem",
                letterSpacing: "0.25em",
                color: GOLD,
                padding: "4px 8px",
                background: "rgba(10,10,20,0.65)",
                border: "1px solid rgba(232,196,104,0.4)",
                borderRadius: 4,
                backdropFilter: "blur(4px)",
              }}
            >
              360°
            </div>
          )}

          {/* Hover scan line */}
          <motion.div
            aria-hidden
            initial={{ y: "-100%" }}
            whileHover={{ y: "100%" }}
            transition={{ duration: 1.2, ease: "linear" }}
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 0,
              height: 50,
              background:
                "linear-gradient(180deg, transparent, rgba(232,196,104,0.18), transparent)",
              pointerEvents: "none",
            }}
          />
        </div>

        {/* Card meta */}
        <div
          style={{
            padding: "1rem 1.1rem 1.1rem",
            background: "rgba(10,10,20,0.85)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.55rem",
              letterSpacing: "0.3em",
              color: GOLD_DIM,
              marginBottom: "0.4rem",
            }}
          >
            ▸ COLORWAY
          </div>
          <div
            style={{
              fontSize: "0.95rem",
              fontWeight: 500,
              color: "#fff",
              letterSpacing: "0.02em",
              lineHeight: 1.25,
            }}
          >
            {entry.colorway}
          </div>
          <div
            style={{
              marginTop: "0.6rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.55rem",
              letterSpacing: "0.22em",
              color: GOLD_DIM,
            }}
          >
            <span>{entry.model}</span>
            <span style={{ color: GOLD }}>
              {is360 ? `${entry.frames} FR` : "STATIC"}
            </span>
          </div>
        </div>

        {/* Hover glow ring */}
        <style jsx>{`
          .colorway-card:hover {
            border-color: rgba(232, 196, 104, 0.6) !important;
            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5),
              0 0 30px rgba(232, 196, 104, 0.18);
          }
        `}</style>
      </motion.article>
    </Link>
  );
}

function CornerL({ pos }: { pos: "tl" | "tr" | "bl" | "br" }) {
  const stroke = `1px solid ${GOLD_DIM}`;
  const base: React.CSSProperties = {
    position: "absolute",
    width: 12,
    height: 12,
    pointerEvents: "none",
  };
  const map: Record<typeof pos, React.CSSProperties> = {
    tl: { top: 8, left: 8, borderTop: stroke, borderLeft: stroke },
    tr: { top: 8, right: 8, borderTop: stroke, borderRight: stroke },
    bl: { bottom: 8, left: 8, borderBottom: stroke, borderLeft: stroke },
    br: { bottom: 8, right: 8, borderBottom: stroke, borderRight: stroke },
  };
  return <div aria-hidden style={{ ...base, ...map[pos] }} />;
}

function OfflinePlaceholder() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: "0.6rem",
        background:
          "repeating-linear-gradient(45deg, #f5f5f0, #f5f5f0 8px, #efefe8 8px, #efefe8 16px)",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: "0.55rem",
        letterSpacing: "0.3em",
        color: "rgba(0,0,0,0.4)",
        textTransform: "uppercase",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "1.5px dashed rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1rem",
        }}
      >
        ⊘
      </div>
      <div>SPECIMEN OFFLINE</div>
    </div>
  );
}
