"use client";

/* ============================================================================
   COMMAND PALETTE — buscador global del archivo (overlay)
   ----------------------------------------------------------------------------
   - Trigger: botón en HUD o atajo Ctrl/Cmd+K
   - Input fuzzy sobre las 279 entries del catálogo
   - Resultados: thumb (frame_01 o main.jpg) + brand + model + colorway + 360 badge
   - Keyboard: ↑↓ selecciona, ↵ abre, Esc cierra
   - Click en resultado → router.push al colorway page
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  getAllEntries,
  frameUrl,
  mainUrl,
  type CatalogEntry,
} from "@/data/catalog";
import { searchAll } from "@/lib/searchEntries";

const DARK = "#0a0a14";
const DARK_DIM = "rgba(10,10,20,0.65)";
const YELLOW = "#f4dc3f";
const MAX_RESULTS = 12;

export default function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const all = useMemo(() => getAllEntries(), []);
  /* searchAll usa el índice Fuse global precomputado del módulo (preguardado
     al cargar) → respuestas instantáneas a cada keystroke. */
  const results = useMemo(
    () => searchAll(query, MAX_RESULTS),
    [query]
  );

  /* Reset cuando se abre */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIdx(0);
    /* focus tras mount (rAF para asegurar que el input está pintado) */
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  /* Reset selected cuando cambia la query */
  useEffect(() => setSelectedIdx(0), [query]);

  /* Keyboard handling global cuando está abierto */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(results.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const r = results[selectedIdx];
        if (r) {
          router.push(
            `/catalog/${r.slug.brand}/${r.slug.model}/${r.slug.colorway}`
          );
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selectedIdx, router, onClose]);

  /* Scroll into view la row seleccionada (para keyboard nav) */
  useEffect(() => {
    if (!listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-row-idx="${selectedIdx}"]`
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop blur */}
          <motion.div
            key="bd"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(10,10,20,0.45)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              zIndex: 200,
              cursor: "pointer",
            }}
          />

          {/* Panel */}
          <motion.div
            key="pl"
            initial={{ opacity: 0, y: -20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: "fixed",
              top: "12%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "min(720px, 92vw)",
              maxHeight: "76vh",
              background: "#fff",
              border: `1.5px solid ${DARK}`,
              borderRadius: 16,
              boxShadow:
                "0 30px 60px rgba(0,0,0,0.4), 0 0 0 6px rgba(244,220,63,0.18)",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              zIndex: 201,
            }}
          >
            {/* Header */}
            <div style={{ padding: "1.1rem 1.4rem 0.8rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.8rem",
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: "0.62rem",
                  letterSpacing: "0.3em",
                  color: DARK_DIM,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {/* El conteo sale SOLO cuando hay busqueda. Con el input
                    vacio decia "280 resultados", que no es una respuesta a
                    nada: es el tamaño del catalogo cargado — justo la data
                    que Fabri pidio sacar porque hace ver chica a la tienda.
                    Cuando escribis algo, en cambio, el numero SI contesta lo
                    que preguntaste y se queda. */}
                <span>
                  ⌖ BUSCAR EN EL CATÁLOGO
                  {query.trim() && (
                    <>
                      {" · "}
                      <span style={{ color: DARK, fontWeight: 700 }}>
                        {results.length}
                      </span>{" "}
                      {results.length === 1 ? "resultado" : "resultados"}
                    </>
                  )}
                </span>
                <button
                  onClick={onClose}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: DARK_DIM,
                    font: "inherit",
                    padding: 0,
                  }}
                  aria-label="Cerrar buscador"
                >
                  ESC ✕
                </button>
              </div>

              {/* Input glass pill */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  padding: "0.7rem 1rem",
                  background: "rgba(244,220,63,0.12)",
                  border: `1.5px solid ${DARK}`,
                  borderRadius: 999,
                }}
              >
                <span
                  style={{
                    color: DARK,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                  }}
                >
                  ⌖
                </span>
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Marca, modelo o color..."
                  style={{
                    flex: 1,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: DARK,
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.95rem",
                    letterSpacing: "0.05em",
                  }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Results list */}
            <div
              ref={listRef}
              style={{
                flex: 1,
                overflow: "auto",
                padding: "0.4rem 0.6rem 0.8rem",
              }}
            >
              {results.length === 0 ? (
                <div
                  style={{
                    padding: "2.5rem 1rem",
                    textAlign: "center",
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.7rem",
                    letterSpacing: "0.3em",
                    color: DARK_DIM,
                    textTransform: "uppercase",
                  }}
                >
                  Sin resultados · probá con marca, modelo o color
                </div>
              ) : (
                results.map((r, i) => (
                  <SearchResultRow
                    key={r.path}
                    idx={i}
                    entry={r}
                    selected={i === selectedIdx}
                    onClick={() => {
                      router.push(
                        `/catalog/${r.slug.brand}/${r.slug.model}/${r.slug.colorway}`
                      );
                      onClose();
                    }}
                    onMouseEnter={() => setSelectedIdx(i)}
                  />
                ))
              )}
            </div>

            {/* Footer hints */}
            <div
              style={{
                padding: "0.7rem 1.4rem",
                borderTop: `1px solid rgba(10,10,20,0.12)`,
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.58rem",
                letterSpacing: "0.28em",
                color: DARK_DIM,
                textTransform: "uppercase",
                background: "rgba(244,220,63,0.08)",
              }}
            >
              <span>↑↓ MOVERSE · ↵ ABRIR · ESC CERRAR</span>
              {/* Decía "{all.length} MODELOS EN EL CATÁLOGO": contaba las
                  fotos cargadas, no el stock, y le hacía parecer chica a la
                  tienda (Fabri, 4-sep). Acá va qué se puede buscar, que es
                  lo que el visitante necesita saber en este momento. */}
              <span style={{ color: DARK, fontWeight: 600 }}>
                BUSCÁ POR MARCA O MODELO
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function SearchResultRow({
  idx,
  entry,
  selected,
  onClick,
  onMouseEnter,
}: {
  idx: number;
  entry: CatalogEntry;
  selected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}) {
  const is360 = entry.type === "360";
  const preview = is360 ? frameUrl(entry, 1) : mainUrl(entry);

  return (
    <div
      data-row-idx={idx}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.9rem",
        padding: "0.6rem 0.7rem",
        cursor: "pointer",
        borderRadius: 10,
        background: selected ? "rgba(244,220,63,0.22)" : "transparent",
        border: `1px solid ${selected ? DARK : "transparent"}`,
        marginBottom: 3,
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {/* Thumb */}
      <div
        style={{
          width: 56,
          height: 42,
          flexShrink: 0,
          background: "#fff",
          border: `1px solid ${DARK}`,
          borderRadius: 6,
          overflow: "hidden",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={preview}
          alt=""
          loading="lazy"
          draggable={false}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            transform: "scale(0.84)",
            pointerEvents: "none",
            display: "block",
          }}
          onError={(e) => {
            const t = e.currentTarget as HTMLImageElement;
            t.style.display = "none";
          }}
        />
      </div>

      {/* Meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.55rem",
            letterSpacing: "0.3em",
            color: DARK_DIM,
            textTransform: "uppercase",
            marginBottom: 2,
            fontWeight: 600,
          }}
        >
          {entry.brand}
        </div>
        <div
          style={{
            fontSize: "0.92rem",
            fontWeight: 600,
            color: DARK,
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.model}{" "}
          <span style={{ color: DARK_DIM, fontWeight: 400 }}>
            · {entry.colorway}
          </span>
        </div>
      </div>

      {/* 360 badge */}
      {is360 && (
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: "0.55rem",
            letterSpacing: "0.25em",
            color: DARK,
            fontWeight: 700,
            padding: "3px 6px",
            background: "rgba(244,220,63,0.55)",
            borderRadius: 4,
            flexShrink: 0,
          }}
        >
          360°
        </div>
      )}

      <span
        style={{
          color: selected ? DARK : DARK_DIM,
          fontSize: "0.85rem",
          flexShrink: 0,
          fontWeight: selected ? 700 : 400,
        }}
      >
        →
      </span>
    </div>
  );
}
