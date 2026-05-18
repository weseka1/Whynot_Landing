"use client";

/* ============================================================================
   IDEA FORM
   Sección "Your Idea" con CTA "SEND SIGNAL".
   El botón abre un modal con campos Name / Email / World.
   ============================================================================ */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/data/site";
import CornerFrame from "./CornerFrame";

export default function IdeaForm() {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setOpen(false);
    }, 1800);
  }

  return (
    <section
      id="section-form"
      className="section bg-dich-peach-flat"
      style={{ position: "relative" }}
    >
      <div
        className="container-full"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(12, 1fr)",
          gap: "var(--space-md)",
          alignItems: "center",
        }}
      >
        <div style={{ gridColumn: "1 / span 6" }}>
          <span className="system-text">{site.form.eyebrow}</span>
          <h2
            className="display"
            style={{
              fontSize: "clamp(3rem, 10vw, 9rem)",
              marginTop: "var(--space-sm)",
              color: "var(--color-accent)",
            }}
          >
            {site.form.title}
          </h2>
          <p style={{ color: "var(--color-muted)", maxWidth: 380, marginTop: "var(--space-md)" }}>
            {site.form.copy}
          </p>
        </div>

        <div
          style={{
            gridColumn: "8 / span 5",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => setOpen(true)}
            style={{
              padding: "var(--space-md) var(--space-lg)",
              border: "1px solid var(--color-accent)",
              color: "var(--color-accent)",
              borderRadius: "var(--radius-pill)",
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              transition: "background var(--speed-fast), color var(--speed-fast)",
            }}
            className="form-cta"
          >
            {site.form.cta} →
          </button>
        </div>
      </div>

      {/* MODAL */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 80,
              background: "rgba(0,0,0,0.7)",
              backdropFilter: "blur(8px)",
              display: "grid",
              placeItems: "center",
              padding: "var(--container-pad)",
            }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 30, opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "relative",
                background: "var(--color-bg)",
                border: "1px solid var(--color-line)",
                width: "min(560px, 100%)",
                padding: "var(--space-lg)",
                display: "grid",
                gap: "var(--space-md)",
              }}
            >
              <CornerFrame position="top-left"     size={24} />
              <CornerFrame position="top-right"    size={24} />
              <CornerFrame position="bottom-left"  size={24} />
              <CornerFrame position="bottom-right" size={24} />

              <div
                className="system-text"
                style={{ display: "flex", justifyContent: "space-between" }}
              >
                <span>{site.form.eyebrow}</span>
                <button onClick={() => setOpen(false)} aria-label="Close">✕</button>
              </div>

              {sent ? (
                <p className="system-text" style={{ color: "var(--color-ok)", fontSize: "1rem" }}>
                  {site.form.success}
                </p>
              ) : (
                <form onSubmit={handleSubmit} style={{ display: "grid", gap: "var(--space-md)" }}>
                  <Field label={site.form.fields.name}  name="name"  />
                  <Field label={site.form.fields.email} name="email" type="email" />
                  <Field label={site.form.fields.world} name="world" textarea />

                  <button
                    type="submit"
                    style={{
                      marginTop: "var(--space-sm)",
                      padding: "14px",
                      border: "1px solid var(--color-accent)",
                      color: "var(--color-accent)",
                      borderRadius: "var(--radius-pill)",
                      fontFamily: "var(--font-mono)",
                      letterSpacing: "0.18em",
                      textTransform: "uppercase",
                    }}
                    className="form-cta"
                  >
                    {site.form.cta}
                  </button>
                </form>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .form-cta:hover {
          background: var(--color-accent) !important;
          color: var(--color-bg) !important;
        }
      `}</style>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  textarea,
}: {
  label: string;
  name: string;
  type?: string;
  textarea?: boolean;
}) {
  const style: React.CSSProperties = {
    background: "transparent",
    borderBottom: "1px solid var(--color-line)",
    padding: "10px 0",
    width: "100%",
    fontFamily: "var(--font-mono)",
    color: "var(--color-fg)",
  };
  return (
    <label style={{ display: "grid", gap: 4 }}>
      <span className="system-text">{label}</span>
      {textarea ? (
        <textarea name={name} rows={3} required style={style} />
      ) : (
        <input name={name} type={type} required style={style} />
      )}
    </label>
  );
}
