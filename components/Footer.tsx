/* ============================================================================
   FOOTER  —  ZONA DE CRÉDITOS / LEGAL  (NO TOCAR sin permiso)
   ----------------------------------------------------------------------------
   Esta sección renderiza los créditos del sitio original:
     SITE BY · MASTERCLASS BY · AWWWARDS · LEGAL · COPYRIGHT

   El contenido de cada crédito vive en /data/credits.ts.  Para editarlos
   reemplazá los TODO de ese archivo con los strings exactos del original.
   NO BORRES NI REEMPLACES estos slots: el autor pidió expresamente
   mantenerlos visibles en todo momento.
   ============================================================================ */

import { credits } from "@/data/credits";
import { site } from "@/data/site";

export default function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--color-line)",
        padding: "var(--space-lg) var(--container-pad) var(--space-md)",
        display: "grid",
        gap: "var(--space-lg)",
      }}
    >
      {/* Display final del nombre de marca */}
      <h2
        className="display"
        style={{
          fontSize: "clamp(5rem, 22vw, 22rem)",
          lineHeight: 0.9,
          textAlign: "center",
        }}
      >
        {site.brand.name}
      </h2>

      {/* Grid de créditos: SITE BY · MASTERCLASS BY · AWWWARDS · LEGAL */}
      <div
        className="hairline-top"
        style={{
          paddingTop: "var(--space-md)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "var(--space-md)",
        }}
      >
        <CreditSlot
          label={credits.siteBy.label}
          value={credits.siteBy.name}
          href={credits.siteBy.href}
        />
        <CreditSlot
          label={credits.masterclassBy.label}
          value={credits.masterclassBy.name}
          href={credits.masterclassBy.href}
        />
        <CreditSlot
          label={credits.awwwards.label}
          value={credits.awwwards.name}
          href={credits.awwwards.href}
        />
        <CreditSlot
          label={credits.legal.label}
          value={credits.legal.text}
          href={credits.legal.href}
        />
      </div>

      {/* Links externos opcionales (Instagram, X, etc.) — si el original los tenía */}
      {credits.externalLinks.length > 0 && (
        <ul
          className="system-text hairline-top"
          style={{
            listStyle: "none",
            display: "flex",
            gap: "var(--space-md)",
            paddingTop: "var(--space-md)",
            flexWrap: "wrap",
          }}
        >
          {credits.externalLinks.map((l) => (
            <li key={l.label}>
              <a href={l.href} target="_blank" rel="noopener noreferrer">
                {l.label} ↗
              </a>
            </li>
          ))}
        </ul>
      )}

      {/* Copyright */}
      <div
        className="system-text hairline-top"
        style={{
          paddingTop: "var(--space-md)",
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-sm)",
        }}
      >
        <span>{credits.copyright}</span>
        <span>{site.hero.metaLeft} · {site.hero.metaRight}</span>
      </div>
    </footer>
  );
}

/* ---------------- Crédito individual ---------------- */
function CreditSlot({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  // Si el valor todavía es un TODO lo marcamos en rojo para no olvidarlo
  const isTodo = value.startsWith("TODO");

  const content = (
    <>
      <span className="system-text" style={{ display: "block", marginBottom: 4 }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "0.85rem",
          color: isTodo ? "var(--color-warn)" : "var(--color-fg)",
        }}
      >
        {value}
      </span>
    </>
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  ) : (
    <div>{content}</div>
  );
}
