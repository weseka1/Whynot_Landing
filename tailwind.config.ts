import type { Config } from "tailwindcss";

/**
 * Tailwind config.
 * Las paletas reales viven en CSS variables (ver app/globals.css).
 * Acá sólo declaramos los aliases para que Tailwind las exponga
 * como utilidades (bg-bg, text-fg, border-line, etc).
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--color-bg)",
        fg: "var(--color-fg)",
        muted: "var(--color-muted)",
        line: "var(--color-line)",
        accent: "var(--color-accent)",
        warn: "var(--color-warn)",
        ok: "var(--color-ok)",
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
        mono: "var(--font-mono)",
      },
      letterSpacing: {
        tightest: "-0.04em",
        widestx: "0.25em",
      },
    },
  },
  plugins: [],
};

export default config;
