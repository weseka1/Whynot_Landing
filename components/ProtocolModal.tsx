"use client";

/* ============================================================================
   PROTOCOL MODAL — ventana de Politicas accesible desde el menu item 05
   ("D://DATA_CORE / PROTOCOL"). 4 botones que expanden el texto exacto de
   cada politica en acordeon. El texto NO se modifica — son las politicas
   provistas por el cliente, palabra por palabra.

   - Solo se abre desde MenuOverlay (no figura en el inicio).
   - Se cierra con ESC, click en X o click en backdrop.
   ============================================================================ */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Section = { id: string; header: string; paragraphs: string[] };

const SECTIONS: Section[] = [
  {
    id: "shipping",
    header: "[ENVÍOS]",
    paragraphs: [
      "Realizamos envíos a CABA, GBA y todo el país.",
      "Las condiciones, tiempos y modalidad de entrega se coordinan por canal oficial según zona, disponibilidad y tipo de pedido.",
      "En CABA y GBA contamos con entregas coordinadas y, cuando corresponda, posibilidad de abonar al recibir.",
      "Para envíos al interior, el pedido se despacha a través de empresas de correo o transporte disponibles según destino. Una vez despachado, los tiempos de entrega pueden variar según la empresa y la zona correspondiente.",
      "El cliente deberá brindar correctamente los datos necesarios para coordinar la entrega.",
    ],
  },
  {
    id: "payment",
    header: "[FORMAS DE PAGO]",
    paragraphs: [
      "La compra se coordina de forma personalizada por WhatsApp oficial.",
      "Nuestro equipo informa los detalles necesarios para avanzar con el pedido según producto, disponibilidad y modalidad de entrega.",
      "Los datos para concretar la operación se brindan únicamente a través de nuestros canales oficiales.",
    ],
  },
  {
    id: "exchange",
    header: "[CAMBIOS Y DEVOLUCIONES]",
    paragraphs: [
      "Los cambios se gestionan de forma personalizada a través de nuestros canales oficiales, siempre que el producto se encuentre sin uso, en buen estado y con su packaging correspondiente.",
      "Cada solicitud será evaluada por nuestro equipo según el caso, el estado del producto, el talle/modelo solicitado y la disponibilidad vigente al momento de iniciar el cambio.",
      "Al tratarse de drops de alta rotación, la disponibilidad puede variar. En caso de que el mismo modelo o talle no se encuentre disponible, se podrá ofrecer una alternativa, dejar el cambio pendiente hasta un próximo ingreso o evaluar otra solución acorde al caso.",
      "Las diferencias de valor, en caso de corresponder, serán informadas antes de avanzar con cualquier cambio.",
      "No se aceptarán cambios de productos con uso, daños, alteraciones, mal uso del cliente, packaging incompleto o señales que no correspondan a su estado original de entrega.",
      "Los reintegros no se realizan de forma automática. Podrán ser evaluados únicamente cuando no exista una alternativa disponible, cuando la reposición no pueda concretarse dentro de un plazo razonable o cuando el caso lo requiera según evaluación del equipo.",
      "Cuando un reintegro sea aprobado, el plazo de gestión podrá variar según el medio utilizado y el tipo de operación, con un plazo estimado de 5 a 45 días hábiles.",
      "Para iniciar una solicitud, contactanos por WhatsApp oficial indicando los datos de la compra, el producto y el motivo del cambio.",
      "Nuestro equipo podrá solicitar fotos, videos o información adicional para evaluar correctamente cada caso.",
    ],
  },
  {
    id: "channels",
    header: "[CANAL OFICIAL]",
    paragraphs: [
      "Nuestro único canal oficial de atención es WhatsApp.",
      "Desde allí confirmamos stock, talles, valores, entregas, cambios y cualquier detalle relacionado con tu pedido.",
      "WhyNot no se responsabiliza por operaciones realizadas fuera de sus canales oficiales o mediante cuentas no autorizadas.",
      "Antes de avanzar con cualquier pedido, verificá que estés hablando con nuestro equipo oficial.",
    ],
  },
];

type Props = { open: boolean; onClose: () => void };

export default function ProtocolModal({ open, onClose }: Props) {
  /* Que seccion esta expandida (id o null). Solo una a la vez para mantener
     la ventana corta y la jerarquia clara.                                  */
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      /* Reset al cerrar: la proxima apertura arranca con todas colapsadas */
      setOpenId(null);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    /* Bloquear scroll del body mientras esta abierto */
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 80,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "grid",
            placeItems: "center",
            padding: "var(--container-pad)",
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="protocol-title"
            style={{
              width: "min(760px, 100%)",
              maxHeight: "86vh",
              display: "flex",
              flexDirection: "column",
              background: "var(--color-bg)",
              border: "1px solid var(--color-line)",
              borderRadius: 8,
              boxShadow: "0 30px 80px rgba(0,0,0,0.6)",
              overflow: "hidden",
            }}
          >
            {/* Header del modal */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--space-md) var(--space-lg)",
                borderBottom: "1px solid var(--color-line)",
              }}
            >
              <span
                id="protocol-title"
                className="system-text"
                style={{
                  color: "var(--color-accent)",
                  letterSpacing: "0.22em",
                }}
              >
                POLÍTICAS / WHYNOT EXCLUSIVE
              </span>
              <button
                onClick={onClose}
                aria-label="Cerrar políticas"
                className="system-text"
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--color-fg)",
                  cursor: "pointer",
                  letterSpacing: "0.22em",
                  padding: 4,
                }}
              >
                CERRAR ✕
              </button>
            </div>

            {/* Lista de botones + acordeon */}
            <div
              style={{
                overflowY: "auto",
                padding: "var(--space-md) var(--space-lg) var(--space-lg)",
                display: "grid",
                gap: "0.65rem",
              }}
            >
              {SECTIONS.map((sec) => {
                const isOpen = openId === sec.id;
                return (
                  <div key={sec.id}>
                    <button
                      onClick={() => setOpenId(isOpen ? null : sec.id)}
                      aria-expanded={isOpen}
                      style={{
                        width: "100%",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.85rem 1rem",
                        background: isOpen
                          ? "rgba(255,255,255,0.04)"
                          : "transparent",
                        border: "1px solid var(--color-line)",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.9rem",
                        fontWeight: 700,
                        letterSpacing: "0.18em",
                        textTransform: "uppercase",
                        color: isOpen
                          ? "var(--color-accent)"
                          : "var(--color-fg)",
                        transition: "background 160ms, color 160ms",
                        textAlign: "left",
                      }}
                    >
                      <span>{sec.header}</span>
                      <span
                        style={{
                          fontSize: "0.85rem",
                          opacity: 0.7,
                          transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                          transition: "transform 220ms",
                          display: "inline-block",
                        }}
                      >
                        +
                      </span>
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                          style={{ overflow: "hidden" }}
                        >
                          <div
                            style={{
                              padding: "0.85rem 1rem 0.2rem",
                              display: "grid",
                              gap: "0.7rem",
                            }}
                          >
                            {sec.paragraphs.map((p, i) => (
                              <p
                                key={i}
                                style={{
                                  fontFamily: "var(--font-mono)",
                                  fontSize: "0.86rem",
                                  lineHeight: 1.65,
                                  margin: 0,
                                  color: "var(--color-fg)",
                                }}
                              >
                                {p}
                              </p>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
