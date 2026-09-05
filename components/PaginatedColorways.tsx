"use client";

/* ============================================================================
   PaginatedColorways — grid paginado con URL hash sync (lilac DICH)
   ----------------------------------------------------------------------------
   - 24 cards por página (3 col × 8 rows en desktop; responsive abajo).
   - Estado en URL hash (#page=N) bookmarkable + sobrevive back/forward.
   - Paginator futurista: PREV/NEXT botones glass blanco + counter + ticks.
   - Scroll suave al inicio del grid en cambio manual de página.
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ColorwayCard from "./ColorwayCard";
import { searchEntries } from "@/lib/searchEntries";
import type { CatalogEntry } from "@/data/catalog";

const PAGE_SIZE = 24;
const DARK = "#0a0a14";
const DARK_DIM = "rgba(10,10,20,0.65)";
const YELLOW = "#f4dc3f";

function readPageFromHash(): number {
  if (typeof window === "undefined") return 1;
  const m = window.location.hash.match(/page=(\d+)/);
  const n = m ? parseInt(m[1], 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function writePageToHash(p: number) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.hash = p <= 1 ? "" : `page=${p}`;
  window.history.replaceState(null, "", url.toString());
}

export default function PaginatedColorways({
  entries,
  brandSlug,
}: {
  entries: CatalogEntry[];
  brandSlug: string;
}) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const gridTopRef = useRef<HTMLDivElement>(null);
  const isFirstRenderRef = useRef(true);

  useEffect(() => {
    setPage(readPageFromHash());
    const handler = () => setPage(readPageFromHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  useEffect(() => {
    writePageToHash(page);
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    gridTopRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [page]);

  /* Cuando cambia el filtro, volvemos a página 1 (no tendría sentido seguir
     en la 3 si el filtro deja sólo 2 resultados). */
  useEffect(() => {
    if (search) setPage(1);
  }, [search]);

  /* Filtro inline: si hay query, usamos los resultados filtrados. */
  const filtered = useMemo(
    () => (search ? searchEntries(entries, search) : entries),
    [entries, search]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageEntries = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ position: "relative" }}>
      <div
        ref={gridTopRef}
        style={{ position: "absolute", top: -100, left: 0, height: 1 }}
      />

      {/* Search filter bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "1.2rem",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            padding: "0.55rem 0.95rem",
            background: "rgba(255,255,255,0.55)",
            border: `1.5px solid ${DARK}`,
            borderRadius: 999,
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            boxShadow:
              "0 6px 16px rgba(0,0,0,0.1), inset 0 1px 1px rgba(255,255,255,0.8)",
            flex: "1 1 320px",
            maxWidth: 440,
          }}
        >
          <span style={{ color: DARK, fontSize: "0.95rem", fontWeight: 700 }}>
            ⌖
          </span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="FILTER · type model or colorway..."
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              color: DARK,
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.75rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              aria-label="Clear filter"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: DARK_DIM,
                fontSize: "0.8rem",
                padding: 0,
                lineHeight: 1,
              }}
            >
              ✕
            </button>
          )}
        </div>

        {search && (
          <div
            style={{
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.62rem",
              letterSpacing: "0.25em",
              textTransform: "uppercase",
              color: filtered.length === 0 ? "#ff5436" : DARK,
              fontWeight: 700,
            }}
          >
            {filtered.length === 0
              ? "NO MATCHES"
              : `${filtered.length} MATCH${filtered.length === 1 ? "" : "ES"}`}
          </div>
        )}
      </div>

      {/* Top counter strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1.5rem",
          paddingBottom: "0.8rem",
          borderBottom: `1px solid rgba(10,10,20,0.22)`,
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.66rem",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: DARK_DIM,
        }}
      >
        <span>
          PAGE{" "}
          <span style={{ color: DARK, fontWeight: 700 }}>
            {String(safePage).padStart(2, "0")}
          </span>{" "}
          / {String(totalPages).padStart(2, "0")}
        </span>
        {/* Acá iba "DISPLAYING 01–24 / 126". El total delataba cuántos pares
            tiene la marca, que es la data que Fabri pidió sacar (4-sep): sale
            de contar fotos del catálogo, no stock, y hace ver chica a la
            tienda. "PAGE 01 / 06" de al lado ya ubica al visitante, y cuando
            hay una búsqueda activa el contador de resultados sigue arriba. */}
      </div>

      {/* Grid 3 cols × 8 rows  (con empty state si el filtro no matchea) */}
      <AnimatePresence mode="wait">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              padding: "4rem 1rem",
              textAlign: "center",
              fontFamily: "var(--font-mono, monospace)",
              fontSize: "0.7rem",
              letterSpacing: "0.3em",
              color: DARK_DIM,
              textTransform: "uppercase",
              border: `1px dashed rgba(10,10,20,0.25)`,
              borderRadius: 12,
            }}
          >
            <div style={{ fontSize: "1.4rem", marginBottom: "0.8rem" }}>⊘</div>
            <div style={{ fontWeight: 700, color: DARK, marginBottom: "0.4rem" }}>
              NO SPECIMENS MATCH
            </div>
            <div>TRY ANOTHER QUERY</div>
          </motion.div>
        ) : (
          <motion.div
            key={safePage}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="paginated-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "1.4rem",
            }}
          >
            {pageEntries.map((entry) => (
              <ColorwayCard
                key={entry.path}
                entry={entry}
                href={`/catalog/${brandSlug}/${entry.slug.model}/${entry.slug.colorway}`}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {totalPages > 1 && (
        <Paginator
          page={safePage}
          totalPages={totalPages}
          onChange={setPage}
        />
      )}

      <style jsx>{`
        @media (max-width: 1100px) {
          .paginated-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 640px) {
          .paginated-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function Paginator({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (p: number) => void;
}) {
  const goPrev = () => onChange(Math.max(1, page - 1));
  const goNext = () => onChange(Math.min(totalPages, page + 1));

  return (
    <div
      style={{
        marginTop: "3rem",
        paddingTop: "2rem",
        borderTop: `1px solid rgba(10,10,20,0.22)`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.4rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2.5rem",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        <PagBtn
          onClick={goPrev}
          disabled={page <= 1}
          ariaLabel="Previous page"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M15 5 L8 12 L15 19"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.35em",
              marginLeft: "0.4rem",
              fontWeight: 600,
            }}
          >
            PREV
          </span>
        </PagBtn>

        <div
          style={{
            fontSize: "1.1rem",
            letterSpacing: "0.3em",
            color: DARK,
            display: "flex",
            alignItems: "baseline",
            gap: "0.4rem",
          }}
        >
          <span style={{ fontWeight: 700, textShadow: `0 0 12px ${YELLOW}50` }}>
            {String(page).padStart(2, "0")}
          </span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: DARK_DIM, fontSize: "0.85rem", fontWeight: 600 }}>
            {String(totalPages).padStart(2, "0")}
          </span>
        </div>

        <PagBtn
          onClick={goNext}
          disabled={page >= totalPages}
          ariaLabel="Next page"
        >
          <span
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.35em",
              marginRight: "0.4rem",
              fontWeight: 600,
            }}
          >
            NEXT
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5 L16 12 L9 19"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </PagBtn>
      </div>

      {/* Ticks scrubber clickeable */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
        }}
      >
        {Array.from({ length: totalPages }).map((_, i) => {
          const n = i + 1;
          const active = n === page;
          return (
            <button
              key={n}
              onClick={() => onChange(n)}
              aria-label={`Go to page ${n}`}
              style={{
                width: 2,
                height: active ? 16 : 6,
                background: active ? DARK : "rgba(10,10,20,0.32)",
                boxShadow: active ? "0 0 10px rgba(244,220,63,0.6)" : "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                transition:
                  "height 0.3s cubic-bezier(0.16,1,0.3,1), background 0.3s, box-shadow 0.3s",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

function PagBtn({
  children,
  onClick,
  disabled,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  ariaLabel: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      whileHover={disabled ? undefined : { scale: 1.05 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "0.7rem 1.2rem",
        borderRadius: 999,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 100%)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        border: `1.5px solid ${disabled ? "rgba(10,10,20,0.18)" : DARK}`,
        boxShadow: disabled
          ? "none"
          : "0 0 24px rgba(255,255,255,0.45), 0 8px 20px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.85)",
        color: disabled ? "rgba(10,10,20,0.25)" : DARK,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-mono, monospace)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </motion.button>
  );
}
