"use client";

/* ============================================================================
   ERROR BOUNDARY — captura excepciones en cualquier ruta de la app
   ----------------------------------------------------------------------------
   Next dispara este componente cuando un client/server component throwea
   durante render/effect en cualquier route segment. Sin esto, el usuario veria
   el mensaje crudo "Application error: a client-side exception has occurred"
   y quedaria sin forma de salir. Con esto, siempre tiene 3 escapes:
     - Volver atras  (router.back)
     - Ir al inicio  (router.push("/"))
     - Reintentar    (reset())
   ============================================================================ */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const LILAC = "#cdb5f0";
const DARK = "#0a0a14";
const YELLOW = "#f4dc3f";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Log al console para debug (Next ya lo loggea server-side cuando hay digest)
    console.error("[app/error]", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: LILAC,
        color: DARK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        fontFamily: "var(--font-body, system-ui), sans-serif",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* dotted grid sutil para no romper la estetica */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "radial-gradient(rgba(10,10,20,0.18) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          maxWidth: 480,
          width: "100%",
          textAlign: "center",
          background: "rgba(255,255,255,0.55)",
          border: "1px solid rgba(10,10,20,0.2)",
          borderRadius: 18,
          padding: "2.5rem 1.75rem",
          backdropFilter: "blur(10px)",
          WebkitBackdropFilter: "blur(10px)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono, monospace)",
            fontSize: 11,
            letterSpacing: "0.3em",
            color: "rgba(10,10,20,0.6)",
            fontWeight: 700,
            marginBottom: 16,
            textTransform: "uppercase",
          }}
        >
          ▸ Error 500 / No se pudo cargar
        </div>

        <h1
          style={{
            fontFamily: "var(--font-marquee, var(--font-body))",
            fontSize: "clamp(1.6rem, 6vw, 2.2rem)",
            color: DARK,
            margin: "0 0 0.75rem",
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            lineHeight: 1.05,
          }}
        >
          Algo salió mal
        </h1>
        <p
          style={{
            fontSize: 14,
            color: "rgba(10,10,20,0.7)",
            margin: "0 0 1.5rem",
            lineHeight: 1.5,
          }}
        >
          Tuvimos un problema al cargar esta sección. Podés volver atrás,
          reintentar o ir al inicio.
        </p>

        {/* Botones de recuperacion */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              padding: "13px 16px",
              background: YELLOW,
              color: DARK,
              border: "1px solid rgba(10,10,20,0.2)",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.04em",
              fontFamily: "inherit",
            }}
          >
            ↻ Reintentar
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1)
                router.back();
              else router.push("/");
            }}
            style={{
              padding: "12px 16px",
              background: "transparent",
              color: DARK,
              border: "1px solid rgba(10,10,20,0.3)",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.04em",
              fontFamily: "inherit",
            }}
          >
            ← Volver atrás
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              padding: "10px 16px",
              background: "transparent",
              color: "rgba(10,10,20,0.6)",
              border: "none",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              fontFamily: "var(--font-mono, monospace)",
              marginTop: 4,
            }}
          >
            Ir al inicio
          </button>
        </div>

        {/* digest del error (server-side) — util para soporte */}
        {error.digest && (
          <p
            style={{
              fontFamily: "var(--font-mono, monospace)",
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
    </div>
  );
}
