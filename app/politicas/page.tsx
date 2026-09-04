/* ============================================================================
   POLITICAS — pagina legal con shipping/payment/exchange/channels.

   Texto provisto por el cliente. NO se modifica ninguna palabra del
   contenido (incluida la grafia "WHYNOT" del titulo y "Política Comercial"
   que se firma desde la cuenta oficial).
   ============================================================================ */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Políticas",
  description:
    "Políticas de envío, pago, cambios y canales oficiales de WHY NOT.",
};

const SECTIONS: { header: string; paragraphs: string[] }[] = [
  {
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
    header: "[FORMAS DE PAGO]",
    paragraphs: [
      "La compra se coordina de forma personalizada por WhatsApp oficial.",
      "Nuestro equipo informa los detalles necesarios para avanzar con el pedido según producto, disponibilidad y modalidad de entrega.",
      "Los datos para concretar la operación se brindan únicamente a través de nuestros canales oficiales.",
    ],
  },
  {
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
    header: "[CANALES OFICIALES]",
    paragraphs: [
      "Nuestro único canal oficial de atención es WhatsApp.",
      "Desde allí confirmamos stock, talles, valores, entregas, cambios y cualquier detalle relacionado con tu pedido.",
      "WhyNot no se responsabiliza por operaciones realizadas fuera de sus canales oficiales o mediante cuentas no autorizadas.",
      "Antes de avanzar con cualquier pedido, verificá que estés hablando con nuestro equipo oficial.",
    ],
  },
];

export default function PoliticasPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        color: "var(--color-fg)",
        padding: "var(--space-xl) var(--container-pad)",
      }}
    >
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        {/* Breadcrumb minimo, estilo system-text */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "var(--space-lg)",
          }}
        >
          <Link
            href="/"
            className="system-text"
            style={{
              color: "var(--color-accent)",
              textDecoration: "none",
              letterSpacing: "0.22em",
            }}
          >
            ← VOLVER AL INICIO
          </Link>
          <span
            className="system-text"
            style={{
              color: "var(--color-muted)",
              letterSpacing: "0.22em",
            }}
          >
            LEGAL
          </span>
        </div>

        {/* Titulo principal — bold, mediano (no T-12 gigante) */}
        <h1
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "clamp(1.4rem, 2.4vw, 1.9rem)",
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            margin: 0,
            marginBottom: "var(--space-lg)",
            color: "var(--color-fg)",
          }}
        >
          POLÍTICAS WHYNOT
        </h1>

        {/* Linea fina cromada que subraya el titulo */}
        <span
          aria-hidden
          style={{
            display: "block",
            width: 60,
            height: 1,
            background:
              "linear-gradient(90deg, var(--color-accent), transparent)",
            marginBottom: "var(--space-xl)",
          }}
        />

        {/* Secciones de la politica */}
        <div style={{ display: "grid", gap: "var(--space-xl)" }}>
          {SECTIONS.map((sec) => (
            <section key={sec.header}>
              <h2
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  margin: 0,
                  marginBottom: "var(--space-md)",
                  color: "var(--color-accent)",
                  textTransform: "uppercase",
                }}
              >
                {sec.header}
              </h2>
              <div style={{ display: "grid", gap: "0.85rem" }}>
                {sec.paragraphs.map((p, i) => (
                  <p
                    key={i}
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.92rem",
                      lineHeight: 1.65,
                      margin: 0,
                      color: "var(--color-fg)",
                    }}
                  >
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Footer minimo de la pagina */}
        <div
          style={{
            marginTop: "var(--space-2xl)",
            paddingTop: "var(--space-md)",
            borderTop: "1px solid var(--color-line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Link
            href="/"
            className="system-text"
            style={{
              color: "var(--color-accent)",
              textDecoration: "none",
              letterSpacing: "0.22em",
            }}
          >
            ← VOLVER AL INICIO
          </Link>
          <span
            className="system-text"
            style={{
              color: "var(--color-muted)",
              letterSpacing: "0.22em",
            }}
          >
            © 2026 WHYNOT EXCLUSIVE
          </span>
        </div>
      </div>
    </main>
  );
}
