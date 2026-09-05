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
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { frameUrl, mainUrl, type CatalogEntry } from "@/data/catalog";
import { searchAll } from "@/lib/searchEntries";
import { useIsTouch } from "@/components/useIsMobile";

const DARK = "#0a0a14";
const DARK_DIM = "rgba(10,10,20,0.65)";
const YELLOW = "#f4dc3f";
/* Cuántas filas se dibujan. 12 dejaba corta la lista ("jordan" son 134) y
   24 sigue siendo barato: las fotos van con loading="lazy", así que lo que
   está fuera del scroll ni se pide. */
const MAX_RESULTS = 24;

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

  /* El overlay se dibuja con un portal en <body> (ver el return). En el
     server no hay document, así que esperamos al primer efecto. */
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  /* ¿Hay teclado? En un celular no, así que los atajos (↑↓ ↵ ESC) son
     ruido que además parte los renglones en dos. */
  const esTactil = useIsTouch();

  /* searchAll usa el índice Fuse global precomputado del módulo (preguardado
     al cargar) → respuestas instantáneas a cada keystroke.
     Pedimos la lista COMPLETA y cortamos acá: así el contador dice cuántos
     hay de verdad (antes mostraba el largo ya recortado, o sea siempre
     "12 resultados" aunque hubiera 40) y en pantalla igual entran 12. */
  const encontrados = useMemo(() => searchAll(query), [query]);
  const results = useMemo(
    () => encontrados.slice(0, MAX_RESULTS),
    [encontrados]
  );

  /* Reset cuando se abre */
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIdx(0);
    /* focus tras mount (rAF para asegurar que el input está pintado).
       preventScroll no es un detalle: al enfocar, el browser scrollea al
       ancestro scrolleable para traer el input a la vista. Si el modal
       llegara a quedar dentro de un contenedor scrolleable, ese scroll se
       lleva puesto TODO el overlay de costado (medido 5-sep: la sección
       terminaba con scrollLeft 146 y el panel salía de pantalla). El portal
       ya lo evita; esto lo deja imposible. */
    requestAnimationFrame(() =>
      inputRef.current?.focus({ preventScroll: true })
    );
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

  if (!montado) return null;

  /* ── Por qué un portal y no un div más adentro ────────────────────────
     Este overlay se monta dentro de <PastDrop>, o sea dentro de
     #section-past-drop. Esa sección declara `contain: layout style paint`
     en globals.css, y `contain: layout` convierte al elemento en BLOQUE
     CONTENEDOR de sus descendientes `position: fixed`. Resultado medido el
     5-sep en producción a 390px: el backdrop, con `inset: 0`, se dibujaba
     de -146px a 244px — ni siquiera tapaba la pantalla — y el panel salía
     18px afuera por la derecha.

     Un modal no puede depender de dónde lo montaron. Sacándolo a <body>
     vuelve a estar anclado al viewport, y de paso su z-index (200/201)
     pasa a competir en el stacking del documento: antes quedaba encerrado
     en el de la sección, y por eso el header y la barra de WhatsApp se
     veían NÍTIDOS por encima del fondo desenfocado.                      */
  return createPortal(
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
              /* En un celu, 12% de alto son ~100px de aire arriba que le
                 comen pantalla a los resultados. Con clamp queda pegado
                 arriba en mobile y centrado con aire en desktop. */
              top: "clamp(14px, 12%, 110px)",
              /* ── Centrado por MARGEN, no por transform ────────────────
                 Esto es un motion.div: Framer Motion se APROPIA del
                 `transform` para animar la escala y el desplazamiento, y
                 al terminar lo deja en "none" — se lleva puesto cualquier
                 translateX(-50%) que escribamos acá. Medido: el panel
                 quedaba en left:195px colgando 164px afuera.
                 left+right+margin auto centra sin transform, así que no
                 hay nada que Framer pueda pisar.                        */
              left: 0,
              right: 0,
              marginInline: "auto",
              width: "min(720px, 92vw)",
              maxHeight: "min(76vh, calc(100vh - 28px))",
              /* Vidrio líquido: el mismo material del menú y del aviso de
                 carrito, para que la web tenga UNA sola materia. */
              background:
                "linear-gradient(168deg, rgba(255,253,250,0.88), rgba(240,232,252,0.72)) padding-box," +
                " linear-gradient(140deg, rgba(255,255,255,0.95), rgba(255,255,255,0.2) 38%," +
                " rgba(255,255,255,0.08) 64%, rgba(126,88,190,0.42)) border-box",
              border: "1px solid transparent",
              borderRadius: 24,
              backdropFilter: "blur(30px) saturate(190%)",
              WebkitBackdropFilter: "blur(30px) saturate(190%)",
              boxShadow:
                "0 40px 90px -30px rgba(38,20,66,0.5), 0 4px 16px rgba(38,20,66,0.16), inset 0 1px 0 rgba(255,255,255,0.75)",
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
                {/* En celular el título entero + "ESC ✕" no entran en un
                    renglón: se partían en dos y quedaba amontonado. Ahí va
                    corto. */}
                <span>
                  {esTactil ? "⌖ BUSCAR" : "⌖ BUSCAR EN EL CATÁLOGO"}
                  {/* "12 resultados" cuando había 134 era mentira; decir
                      "134" y mostrar 12 también. Se dice lo que se ve y de
                      cuántos, que además invita a afinar la búsqueda. */}
                  {query.trim() && (
                    <>
                      {" · "}
                      <span style={{ color: DARK, fontWeight: 700 }}>
                        {encontrados.length > results.length
                          ? `${results.length} de ${encontrados.length}`
                          : encontrados.length}
                      </span>{" "}
                      {encontrados.length === 1 ? "resultado" : "resultados"}
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
                    /* En un celu no hay tecla ESC: sobra nombrarla, y la
                       cruz sola necesita ser un blanco de 44px. */
                    minWidth: esTactil ? 44 : undefined,
                    minHeight: esTactil ? 44 : undefined,
                    fontSize: esTactil ? "1.05rem" : undefined,
                    marginRight: esTactil ? -10 : undefined,
                  }}
                  aria-label="Cerrar buscador"
                >
                  {esTactil ? "✕" : "ESC ✕"}
                </button>
              </div>

              {/* Input glass pill */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.7rem",
                  padding: "0.7rem 1rem",
                  /* Sobre vidrio, el borde negro de 1.5px era del skin
                     viejo (panel blanco opaco). Acá va tinta suave. */
                  background: "rgba(255,255,255,0.55)",
                  border: "1px solid rgba(38,20,66,0.16)",
                  borderRadius: 999,
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7)",
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
                    /* Ancho mínimo 0: sin esto un input flex no se deja
                       encoger y estira la fila más allá del panel. */
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: DARK,
                    fontFamily: "var(--font-mono, monospace)",
                    /* 16px CLAVADOS. Con menos, iOS le hace zoom a la
                       página al enfocar el input y el overlay entero
                       queda corrido — el mismo tell que ya arreglamos en
                       el buscador de marcas del menú. */
                    fontSize: 16,
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
                borderTop: "1px solid rgba(38,20,66,0.12)",
                display: "flex",
                justifyContent: esTactil ? "center" : "space-between",
                fontFamily: "var(--font-mono, monospace)",
                fontSize: "0.58rem",
                letterSpacing: "0.28em",
                color: DARK_DIM,
                textTransform: "uppercase",
                background: "rgba(255,255,255,0.32)",
              }}
            >
              {/* Los atajos de teclado solo existen si hay teclado. En un
                  celu ocupaban dos renglones para explicar teclas que no
                  están. */}
              {!esTactil && <span>↑↓ MOVERSE · ↵ ABRIR · ESC CERRAR</span>}
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
    </AnimatePresence>,
    document.body
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
        borderRadius: 14,
        /* El amarillo de la marca se queda: acá SÍ significa algo (es la
           fila elegida). Lo que se va es el borde negro duro. */
        background: selected ? "rgba(244,220,63,0.34)" : "transparent",
        border: `1px solid ${selected ? "rgba(38,20,66,0.18)" : "transparent"}`,
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
          background: "rgba(255,255,255,0.72)",
          border: "1px solid rgba(38,20,66,0.14)",
          borderRadius: 9,
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
