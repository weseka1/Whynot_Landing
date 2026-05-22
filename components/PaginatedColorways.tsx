"use client";

/* ============================================================================
   PaginatedColorways — grid paginado con URL hash sync
   ----------------------------------------------------------------------------
   - 24 cards por página (3 col × 8 rows en desktop; responsive abajo).
   - Estado en URL hash (#page=N) para que sea bookmarkable y sobreviva el
     back-button del browser (al volver, el hash sigue ahí → restauramos pág).
   - Paginator futurista: PREV/NEXT botones + counter NN/NN + ticks scrubber.
   - Cuando el usuario cambia de página manualmente, scroll suave al inicio
     del grid (no al top del documento). Mount inicial NO hace scroll (para
     preservar la posición restaurada por el browser).
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ColorwayCard from "./ColorwayCard";
import type { CatalogEntry } from "@/data/catalog";

const PAGE_SIZE = 24; // 3 cols × 8 rows
const GOLD = "#e8c468";
const GOLD_DIM = "rgba(232,196,104,0.55)";

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
  const gridTopRef = useRef<HTMLDivElement>(null);
  const isFirstRenderRef = useRef(true);

  /* Mount: leer hash y suscribir a cambios externos (back/forward) */
  useEffect(() => {
    setPage(readPageFromHash());
    const handler = () => setPage(readPageFromHash());
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  /* Cambio de page → escribir hash. Si es interacción de usuario (no mount),
     scroll al top del grid (no del documento) para que el HUD/hero queden
     visibles. */
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

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageEntries = entries.slice(start, start + PAGE_SIZE);

  return (
    <div style={{ position: "relative" }}>
      {/* Anchor para scroll al cambio de página */}
      <div
        ref={gridTopRef}
        style={{ position: "absolute", top: -100, left: 0, height: 1 }}
      />

      {/* Top counter strip */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1.5rem",
          paddingBottom: "0.8rem",
          borderBottom: "1px solid rgba(232,196,104,0.18)",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: "0.66rem",
          letterSpacing: "0.25em",
          textTransform: "uppercase",
          color: GOLD_DIM,
        }}
      >
        <span>
          PAGE{" "}
          <span style={{ color: GOLD }}>
            {String(safePage).padStart(2, "0")}
          </span>{" "}
          / {String(totalPages).padStart(2, "0")}
        </span>
        <span>
          DISPLAYING{" "}
          <span style={{ color: "#e9e2d4" }}>
            {start + 1}–{Math.min(start + PAGE_SIZE, entries.length)}
          </span>{" "}
          / {entries.length}
        </span>
      </div>

      {/* Grid 3 cols × 8 rows (responsive) */}
      <AnimatePresence mode="wait">
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
      </AnimatePresence>

      {/* Paginator */}
      {totalPages > 1 && (
        <Paginator
          page={safePage}
          totalPages={totalPages}
          onChange={setPage}
        />
      )}

      {/* Responsive override: en pantallas chicas pasar a 2 o 1 col */}
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

/* ============================================================================
   Paginator — controles futurista: PREV / counter / NEXT + ticks
   ============================================================================ */
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
        borderTop: "1px solid rgba(232,196,104,0.18)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1.4rem",
      }}
    >
      {/* Prev | counter | Next */}
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
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span
            style={{
              fontSize: "0.6rem",
              letterSpacing: "0.35em",
              marginLeft: "0.4rem",
            }}
          >
            PREV
          </span>
        </PagBtn>

        <div
          style={{
            fontSize: "1.1rem",
            letterSpacing: "0.3em",
            color: "#e9e2d4",
            display: "flex",
            alignItems: "baseline",
            gap: "0.4rem",
          }}
        >
          <span style={{ color: GOLD }}>
            {String(page).padStart(2, "0")}
          </span>
          <span style={{ opacity: 0.4 }}>/</span>
          <span style={{ color: GOLD_DIM, fontSize: "0.85rem" }}>
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
            }}
          >
            NEXT
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 5 L16 12 L9 19"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </PagBtn>
      </div>

      {/* Ticks scrubber (clickeable) */}
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
                background: active ? GOLD : "rgba(232,196,104,0.28)",
                boxShadow: active
                  ? "0 0 10px rgba(232,196,104,0.55)"
                  : "none",
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
          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: `1px solid ${disabled ? "rgba(232,196,104,0.15)" : "rgba(232,196,104,0.4)"}`,
        boxShadow: disabled
          ? "none"
          : "0 0 24px rgba(232,196,104,0.15), 0 8px 20px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.15)",
        color: disabled ? "rgba(232,196,104,0.25)" : GOLD,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--font-mono, monospace)",
        textTransform: "uppercase",
      }}
    >
      {children}
    </motion.button>
  );
}
