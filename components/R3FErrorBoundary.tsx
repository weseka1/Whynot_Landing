"use client";

/* ============================================================================
   R3F ERROR BOUNDARY — atrapa errores de carga/render de R3F Canvases
   ----------------------------------------------------------------------------
   Sin esto, si useGLTF tira (404 del .glb, fetch abort, decoder Draco no
   disponible) el Suspense queda colgado para siempre o el Canvas crashea
   silenciosamente y el usuario ve un hueco en blanco.

   Wrappear cualquier <Canvas>{...}</Canvas> con esto. El fallback default
   muestra un placeholder sutil que no rompe el layout. Pasale `fallback`
   custom si necesitas algo especifico.
   ============================================================================ */

import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (err: Error) => void;
}

interface State {
  hasError: boolean;
}

export default class R3FErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn("[R3F] canvas error caught:", error);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? <DefaultR3FFallback />;
    }
    return this.props.children;
  }
}

/* Placeholder default: caja vacia con el mismo tamaño que pediria el canvas
   (heredado del padre). Sin texto — la idea es no llamar la atencion
   sobre el fallo, solo no romper el layout.                              */
function DefaultR3FFallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "transparent",
        pointerEvents: "none",
      }}
      aria-hidden
    />
  );
}
