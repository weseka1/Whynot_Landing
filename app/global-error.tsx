"use client";

/* ============================================================================
   GLOBAL ERROR — ultimo fallback si el ROOT layout tambien falla
   ----------------------------------------------------------------------------
   A diferencia de app/error.tsx (que asume que el RootLayout esta vivo),
   este reemplaza TODO incluyendo <html> + <body>. Es la red de seguridad
   cuando ni el layout se monta. UI minima sin dependencias para no
   re-crashear.
   ============================================================================ */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#cdb5f0",
          color: "#0a0a14",
          fontFamily: "system-ui, -apple-system, sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center",
            background: "rgba(255,255,255,0.6)",
            border: "1px solid rgba(10,10,20,0.2)",
            borderRadius: 16,
            padding: "2rem 1.5rem",
          }}
        >
          <div
            style={{
              fontSize: 11,
              letterSpacing: "0.3em",
              color: "rgba(10,10,20,0.6)",
              fontWeight: 700,
              marginBottom: 12,
              textTransform: "uppercase",
            }}
          >
            ▸ Error fatal
          </div>
          <h1
            style={{
              fontSize: "1.6rem",
              margin: "0 0 0.75rem",
              fontWeight: 800,
            }}
          >
            Algo salió muy mal
          </h1>
          <p
            style={{
              fontSize: 14,
              color: "rgba(10,10,20,0.7)",
              margin: "0 0 1.5rem",
              lineHeight: 1.5,
            }}
          >
            La página no pudo cargarse. Reintentá o volvé al inicio.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: "13px 16px",
                background: "#f4dc3f",
                color: "#0a0a14",
                border: "1px solid rgba(10,10,20,0.2)",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              ↻ Reintentar
            </button>
            <a
              href="/"
              style={{
                padding: "12px 16px",
                background: "transparent",
                color: "#0a0a14",
                border: "1px solid rgba(10,10,20,0.3)",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                textDecoration: "none",
                display: "block",
              }}
            >
              ← Ir al inicio
            </a>
          </div>

          {error.digest && (
            <p
              style={{
                fontSize: 10,
                color: "rgba(10,10,20,0.4)",
                marginTop: 20,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
              }}
            >
              ref: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
