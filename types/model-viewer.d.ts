/**
 * Declaración del custom element <model-viewer> para TypeScript / JSX.
 * Necesario porque es un web component externo, no un componente React.
 */
import type React from "react";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          src?: string;
          alt?: string;
          poster?: string;
          ar?: boolean;
          "auto-rotate"?: boolean;
          "auto-rotate-delay"?: string | number;
          "rotation-per-second"?: string;
          "camera-controls"?: boolean;
          "disable-zoom"?: boolean;
          "shadow-intensity"?: string | number;
          "shadow-softness"?: string | number;
          "camera-orbit"?: string;
          "min-camera-orbit"?: string;
          "max-camera-orbit"?: string;
          "field-of-view"?: string;
          exposure?: string | number;
          "environment-image"?: string;
          "skybox-image"?: string;
          loading?: "auto" | "lazy" | "eager";
          reveal?: "auto" | "manual";
          "interaction-prompt"?: "auto" | "none" | "when-focused";
        },
        HTMLElement
      >;
    }
  }
}

export {};
