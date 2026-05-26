"use client";

/* ============================================================================
   BRAND × MODEL FILTER — buscador inline futurista para PastDrop
   ----------------------------------------------------------------------------
   Dos dropdowns glass side-by-side:
     1. BRAND     — lista de las marcas del catalog. Click → expande, selecciona.
     2. MODEL_VAR — modelos+colorways de la marca seleccionada. Disabled hasta
                    que haya brand. Click en un item → router.push al colorway.
   Estetica: matchea PastDrop (lila bg, dark stroke #0a0a14, T-12 en labels,
   mono en helpers, glass blur, brackets [ ]).
   ============================================================================ */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  getAllEntries,
  getEntriesByBrand,
  type CatalogEntry,
} from "@/data/catalog";

const DARK = "#0a0a14";
const DARK_2 = "rgba(10,10,20,0.55)";
const GLASS = "rgba(255,255,255,0.62)";
const GLASS_HOVER = "rgba(255,255,255,0.82)";
const BRACKET_FONT = "var(--font-mono, monospace)";

/* Sentinel key para el item "TODOS" en el dropdown MODEL/VAR: navega al
   catalogo de la marca completa en vez de un colorway puntual.            */
const ALL_KEY = "__all__";

type ModelVariant = {
  model: string;
  colorway: string;
  entry: CatalogEntry;
  label: string;
};

export default function BrandModelFilter({ isMobile = false }: { isMobile?: boolean }) {
  const router = useRouter();

  /* ----- Datos del catalogo ----- */
  const allBrands = useMemo(() => {
    const all = getAllEntries();
    return [...new Set(all.map((e) => e.brand))].sort();
  }, []);

  const [brand, setBrand] = useState<string | null>(null);
  const [variantsForBrand, setVariantsForBrand] = useState<ModelVariant[]>([]);

  useEffect(() => {
    if (!brand) {
      setVariantsForBrand([]);
      return;
    }
    const list = getEntriesByBrand(brand).map<ModelVariant>((e) => ({
      model: e.model,
      colorway: e.colorway,
      entry: e,
      label: `${e.model} / ${e.colorway}`,
    }));
    /* Ordenamos por model luego colorway para que al expandir veas todos
       los Air Force juntos, todos los AirMax juntos, etc.                  */
    list.sort((a, b) =>
      a.model.localeCompare(b.model) || a.colorway.localeCompare(b.colorway)
    );
    setVariantsForBrand(list);
  }, [brand]);

  /* ----- UI state ----- */
  const [openBrand, setOpenBrand] = useState(false);
  const [openVariant, setOpenVariant] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const [variantQuery, setVariantQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  /* Cierra los dropdowns al click fuera. */
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpenBrand(false);
        setOpenVariant(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpenBrand(false);
        setOpenVariant(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /* Filtros de busqueda dentro de cada dropdown. */
  const filteredBrands = useMemo(() => {
    const q = brandQuery.trim().toLowerCase();
    if (!q) return allBrands;
    return allBrands.filter((b) => b.toLowerCase().includes(q));
  }, [allBrands, brandQuery]);

  const filteredVariants = useMemo(() => {
    const q = variantQuery.trim().toLowerCase();
    if (!q) return variantsForBrand;
    return variantsForBrand.filter((v) =>
      v.label.toLowerCase().includes(q)
    );
  }, [variantsForBrand, variantQuery]);

  const handleSelectBrand = (b: string) => {
    setBrand(b);
    setOpenBrand(false);
    setVariantQuery("");
    /* UX: al elegir brand, abrimos automaticamente el segundo dropdown
       para que el flujo brand→variant sea de un solo movimiento.          */
    setTimeout(() => setOpenVariant(true), 180);
  };

  const handleSelectVariant = (v: ModelVariant) => {
    setOpenVariant(false);
    router.push(
      `/catalog/${v.entry.slug.brand}/${v.entry.slug.model}/${v.entry.slug.colorway}`
    );
  };

  const handleSelectAllForBrand = () => {
    setOpenVariant(false);
    if (variantsForBrand.length === 0) return;
    /* Todas las variants de un brand comparten slug.brand — agarramos el
       de la primera para construir la URL del catalogo de marca.           */
    router.push(`/catalog/${variantsForBrand[0].entry.slug.brand}`);
  };

  return (
    <div
      ref={containerRef}
      style={{
        /* Posicionado por el wrapper padre (PastDrop title block) — antes
           era position:absolute con top:16-18% pero se solapaba con la
           imagen del titulo "DROP" en mobile. Ahora es flow-relative. */
        position: "relative",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: isMobile ? "0.5rem" : "0.85rem",
          alignItems: "stretch",
          pointerEvents: "auto",
          width: isMobile ? "100%" : "auto",
          maxWidth: isMobile ? "92vw" : "min(820px, 90vw)",
        }}
      >
        {/* ============ BRAND DROPDOWN ============ */}
        <Dropdown
          isMobile={isMobile}
          label="BRAND"
          placeholder="MARCA"
          value={brand}
          open={openBrand}
          onToggle={() => {
            setOpenBrand((v) => !v);
            setOpenVariant(false);
          }}
          query={brandQuery}
          onQueryChange={setBrandQuery}
          items={filteredBrands.map((b) => ({ key: b, primary: b }))}
          onSelect={(it) => handleSelectBrand(it.key)}
          emptyHint="NO MATCH"
          flexBasis={isMobile ? "50%" : "260px"}
        />

        {/* ============ MODEL / VARIANT DROPDOWN ============
             Cuando hay brand, prependeamos un item "TODOS" — al apretarlo
             navegamos al catalogo de la marca completa (en lugar de un
             colorway individual). Atajo para los que ya saben la marca y
             quieren ver toda la grilla.                                    */}
        <Dropdown
          isMobile={isMobile}
          label="MODEL / VAR"
          placeholder={brand ? "MODELO / COLOR" : "ELEGI MARCA"}
          value={null}
          disabled={!brand}
          open={openVariant}
          onToggle={() => {
            if (!brand) return;
            setOpenVariant((v) => !v);
            setOpenBrand(false);
          }}
          query={variantQuery}
          onQueryChange={setVariantQuery}
          items={[
            ...(brand && variantsForBrand.length > 0
              ? [{ key: ALL_KEY, primary: "TODOS", secondary: "VER MARCA" }]
              : []),
            ...filteredVariants.map((v) => ({
              key: `${v.model}/${v.colorway}`,
              primary: v.model,
              secondary: v.colorway,
              data: v,
            })),
          ]}
          onSelect={(it) => {
            if (it.key === ALL_KEY) {
              handleSelectAllForBrand();
            } else {
              handleSelectVariant(it.data as ModelVariant);
            }
          }}
          emptyHint={brand ? "SIN MODELOS" : "—"}
          flexBasis={isMobile ? "50%" : "320px"}
        />
      </div>
    </div>
  );
}

/* ============================================================================
   Dropdown — pill glass + panel desplegable. Reutilizado por brand y variant.
   ============================================================================ */
type DropdownItem = {
  key: string;
  primary: string;
  secondary?: string;
  data?: unknown;
};

function Dropdown({
  isMobile,
  label,
  placeholder,
  value,
  open,
  onToggle,
  query,
  onQueryChange,
  items,
  onSelect,
  disabled = false,
  emptyHint,
  flexBasis,
}: {
  isMobile: boolean;
  label: string;
  placeholder: string;
  value: string | null;
  open: boolean;
  onToggle: () => void;
  query: string;
  onQueryChange: (q: string) => void;
  items: DropdownItem[];
  onSelect: (it: DropdownItem) => void;
  disabled?: boolean;
  emptyHint: string;
  flexBasis: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  /* Cuando se abre, focus al input para filtrar de una. */
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  return (
    <div
      style={{
        position: "relative",
        flex: `1 1 ${flexBasis}`,
        minWidth: 0,
      }}
    >
      {/* ----- TRIGGER (pill) ----- */}
      <motion.button
        onClick={onToggle}
        disabled={disabled}
        whileHover={disabled ? undefined : { scale: 1.015 }}
        whileTap={disabled ? undefined : { scale: 0.985 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          width: "100%",
          minHeight: 44,
          padding: isMobile ? "0.55rem 0.7rem" : "0.55rem 0.95rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          background: disabled ? "rgba(255,255,255,0.32)" : GLASS,
          border: `1.5px solid ${DARK}`,
          borderRadius: 999,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: open
            ? "0 8px 24px rgba(0,0,0,0.18), inset 0 1px 1px rgba(255,255,255,0.9), 0 0 0 1px rgba(10,10,20,0.18)"
            : "0 4px 14px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.55 : 1,
          color: DARK,
          textAlign: "left",
        }}
      >
        {/* Bracket izquierdo */}
        <span
          style={{
            fontFamily: BRACKET_FONT,
            fontSize: "0.95rem",
            lineHeight: 1,
            color: DARK_2,
            fontWeight: 300,
          }}
        >
          [
        </span>

        {/* Label fija + valor / placeholder */}
        <span
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: "0.05rem",
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          <span
            style={{
              fontFamily: BRACKET_FONT,
              fontSize: "0.52rem",
              letterSpacing: "0.28em",
              color: DARK_2,
              textTransform: "uppercase",
              fontWeight: 600,
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontFamily: "var(--font-marquee)",
              fontSize: isMobile ? "0.78rem" : "0.92rem",
              letterSpacing: "0.06em",
              color: DARK,
              fontWeight: 400,
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {value ?? placeholder}
          </span>
        </span>

        {/* Bracket derecho + chevron */}
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            color: DARK,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
            <path
              d="M2.5 4.5 L6 8 L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.7"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </motion.span>
        <span
          style={{
            fontFamily: BRACKET_FONT,
            fontSize: "0.95rem",
            lineHeight: 1,
            color: DARK_2,
            fontWeight: 300,
          }}
        >
          ]
        </span>
      </motion.button>

      {/* ----- PANEL ----- */}
      <AnimatePresence>
        {open && (
          <motion.div
            key="panel"
            initial={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              zIndex: 30,
              background: "rgba(255,255,255,0.92)",
              border: `1.5px solid ${DARK}`,
              borderRadius: 18,
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.28), 0 0 0 1px rgba(10,10,20,0.12), inset 0 1px 1px rgba(255,255,255,0.95)",
              padding: "0.7rem",
              maxHeight: isMobile ? "58vh" : "420px",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* Input filtrador */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.55rem",
                padding: "0.5rem 0.7rem",
                background: "rgba(244,220,63,0.18)",
                border: `1px solid rgba(10,10,20,0.55)`,
                borderRadius: 999,
                marginBottom: "0.55rem",
              }}
            >
              <span style={{ color: DARK, fontSize: "0.85rem", lineHeight: 1 }}>⌖</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => onQueryChange(e.target.value)}
                placeholder="SEARCH..."
                style={{
                  flex: 1,
                  fontFamily: BRACKET_FONT,
                  fontSize: "0.72rem",
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: DARK,
                  background: "transparent",
                  border: 0,
                  outline: "none",
                  minWidth: 0,
                }}
              />
              {/* Counter */}
              <span
                style={{
                  fontFamily: BRACKET_FONT,
                  fontSize: "0.55rem",
                  letterSpacing: "0.22em",
                  color: DARK_2,
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {String(items.length).padStart(3, "0")}
              </span>
            </div>

            {/* Lista */}
            <div
              style={{
                overflowY: "auto",
                flex: 1,
                paddingRight: "0.2rem",
              }}
            >
              {items.length === 0 ? (
                <div
                  style={{
                    padding: "1.2rem 0.6rem",
                    textAlign: "center",
                    fontFamily: BRACKET_FONT,
                    fontSize: "0.65rem",
                    letterSpacing: "0.28em",
                    color: DARK_2,
                  }}
                >
                  {emptyHint}
                </div>
              ) : (
                items.map((it, i) => (
                  <button
                    key={it.key}
                    onClick={() => onSelect(it)}
                    role="option"
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "0.6rem",
                      padding: "0.55rem 0.7rem",
                      background: "transparent",
                      border: 0,
                      borderTop:
                        i === 0 ? "none" : "1px dashed rgba(10,10,20,0.16)",
                      cursor: "pointer",
                      textAlign: "left",
                      color: DARK,
                      transition: "background 140ms",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(244,220,63,0.32)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-marquee)",
                        fontSize: isMobile ? "0.85rem" : "0.95rem",
                        letterSpacing: "0.04em",
                        textTransform: "uppercase",
                        fontWeight: 400,
                        color: DARK,
                        flex: 1,
                        minWidth: 0,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {it.primary}
                    </span>
                    {it.secondary && (
                      <span
                        style={{
                          fontFamily: BRACKET_FONT,
                          fontSize: "0.6rem",
                          letterSpacing: "0.22em",
                          color: DARK_2,
                          textTransform: "uppercase",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {it.secondary}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div
              style={{
                marginTop: "0.4rem",
                paddingTop: "0.45rem",
                borderTop: "1px solid rgba(10,10,20,0.14)",
                display: "flex",
                justifyContent: "space-between",
                fontFamily: BRACKET_FONT,
                fontSize: "0.52rem",
                letterSpacing: "0.24em",
                color: DARK_2,
                textTransform: "uppercase",
              }}
            >
              <span>▸ ENTER ARCHIVE</span>
              <span>ESC // CLOSE</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
