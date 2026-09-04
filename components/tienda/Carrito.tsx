"use client";

/* ============================================================================
   CARRITO — botón flotante + panel, con salida a WhatsApp.
   ----------------------------------------------------------------------------
   El final del embudo. Todo lo demás de la web existe para que alguien llegue
   acá y apriete un botón.

   Decisiones:
   · El botón flotante SOLO aparece con algo adentro. Un carrito vacío flotando
     es ruido, y en mobile tapa contenido.
   · Bottom-sheet en celu, panel derecho en desktop — mismo componente.
   · El total dice si está incompleto en vez de mentir: si un producto no tiene
     precio cargado, se avisa y el mensaje de WhatsApp lo aclara.
   · No hay checkout. El cierre es humano por WhatsApp y con el pedido ya
     escrito: el vendedor solo confirma.
   ============================================================================ */

import { useEffect, useState } from "react";
import {
  cambiarCantidad,
  linkPedido,
  quitar,
  useCarrito,
  useTotales,
  vaciar,
} from "@/lib/carrito";

function pesos(n: number): string {
  return "$ " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
}

export default function Carrito() {
  const items = useCarrito();
  const { unidades, total, totalTransferencia, precioIncompleto } = useTotales();
  const [abierto, setAbierto] = useState(false);

  /* Body scroll lock mientras el panel está abierto. */
  useEffect(() => {
    if (!abierto) return;
    const previo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEsc = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", onEsc);
    return () => {
      document.body.style.overflow = previo;
      window.removeEventListener("keydown", onEsc);
    };
  }, [abierto]);

  /* Si se vacía con el panel abierto, lo cerramos. */
  useEffect(() => {
    if (items.length === 0) setAbierto(false);
  }, [items.length]);

  if (items.length === 0) return null;

  return (
    <>
      <button type="button" className="fab" onClick={() => setAbierto(true)} aria-label={`Ver el pedido (${unidades})`}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M6 7h12l-1 12H7L6 7Z" strokeLinejoin="round" />
          <path d="M9 7a3 3 0 0 1 6 0" strokeLinecap="round" />
        </svg>
        <span className="cuenta">{unidades}</span>
        {total > 0 && <span className="fabtotal">{pesos(total)}</span>}
      </button>

      {abierto && (
        <div className="capa" onClick={() => setAbierto(false)} role="presentation">
          <aside
            className="panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Tu pedido"
          >
            <header className="ph">
              <div>
                <p className="pe">Tu pedido</p>
                <h2 className="pt">
                  {unidades} {unidades === 1 ? "par" : "pares"}
                </h2>
              </div>
              <button type="button" className="cerrar" onClick={() => setAbierto(false)} aria-label="Cerrar">
                ✕
              </button>
            </header>

            <div className="lista">
              {items.map((i) => (
                <article key={i.key} className="item">
                  <img src={i.imageUrl} alt="" aria-hidden="true" loading="lazy" />
                  <div className="datos">
                    <p className="im">{i.brand}</p>
                    <p className="in">{i.model}</p>
                    {i.size && <p className="it">Talle {i.size}</p>}
                    {i.price != null ? (
                      <p className="ip">{pesos(i.price * i.qty)}</p>
                    ) : (
                      <p className="isp">A consultar</p>
                    )}
                  </div>
                  <div className="acciones">
                    <div className="qty">
                      <button type="button" onClick={() => cambiarCantidad(i.key, i.qty - 1)} aria-label="Restar uno">
                        −
                      </button>
                      <span>{i.qty}</span>
                      <button type="button" onClick={() => cambiarCantidad(i.key, i.qty + 1)} aria-label="Sumar uno">
                        +
                      </button>
                    </div>
                    <button type="button" className="sacar" onClick={() => quitar(i.key)}>
                      Sacar
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <footer className="pf">
              {total > 0 && (
                <div className="totales">
                  <div className="fila">
                    <span>Total</span>
                    <strong>{pesos(total)}</strong>
                  </div>
                  {totalTransferencia > 0 && totalTransferencia < total && (
                    <div className="fila sec">
                      <span>Por transferencia</span>
                      <strong>{pesos(totalTransferencia)}</strong>
                    </div>
                  )}
                  {precioIncompleto && <p className="aviso">Hay productos sin precio en la web — los consultás por chat.</p>}
                </div>
              )}

              <a className="wa" href={linkPedido(items)} target="_blank" rel="noopener noreferrer">
                Pedir por WhatsApp
              </a>
              <p className="nota">Coordinás entrega y pago por chat. En CABA y GBA podés abonar al recibir.</p>
              <button type="button" className="vaciar" onClick={vaciar}>
                Vaciar
              </button>
            </footer>
          </aside>
        </div>
      )}

      <style jsx>{`
        .fab {
          position: fixed;
          right: max(16px, env(safe-area-inset-right));
          bottom: max(16px, env(safe-area-inset-bottom));
          z-index: 60;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          min-height: 50px;
          padding: 0 18px;
          border-radius: 999px;
          border: 1px solid rgba(243, 236, 225, 0.2);
          background: rgba(10, 9, 8, 0.72);
          backdrop-filter: blur(20px) saturate(180%);
          -webkit-backdrop-filter: blur(20px) saturate(180%);
          box-shadow: 0 16px 40px -16px rgba(0, 0, 0, 0.85),
            inset 0 1px 0 rgba(243, 236, 225, 0.18);
          color: var(--color-fg, #f3ece1);
          font-size: 0.9rem;
          cursor: pointer;
          transition: transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .fab:hover {
          transform: translateY(-2px);
        }
        .cuenta {
          min-width: 21px;
          height: 21px;
          padding: 0 5px;
          border-radius: 999px;
          background: var(--color-gold-soft, #c9ad6b);
          color: #0a0908;
          font-size: 0.72rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          display: grid;
          place-items: center;
        }
        .fabtotal {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }

        .capa {
          position: fixed;
          inset: 0;
          z-index: 70;
          background: rgba(6, 5, 4, 0.62);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }
        @media (min-width: 720px) {
          .capa {
            align-items: stretch;
            justify-content: flex-end;
          }
        }

        .panel {
          display: flex;
          flex-direction: column;
          width: 100%;
          max-height: 92svh;
          border-radius: 26px 26px 0 0;
          background: rgba(19, 16, 13, 0.86);
          backdrop-filter: blur(26px) saturate(180%);
          -webkit-backdrop-filter: blur(26px) saturate(180%);
          border: 1px solid rgba(243, 236, 225, 0.12);
          border-bottom: none;
          box-shadow: 0 -20px 60px -20px rgba(0, 0, 0, 0.9),
            inset 0 1px 0 rgba(243, 236, 225, 0.16);
          animation: subir 380ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @media (min-width: 720px) {
          .panel {
            width: min(420px, 100%);
            max-height: 100svh;
            border-radius: 0;
            border-right: none;
            animation: entrar 380ms cubic-bezier(0.16, 1, 0.3, 1);
          }
        }
        @keyframes subir {
          from {
            transform: translateY(24px);
            opacity: 0;
          }
        }
        @keyframes entrar {
          from {
            transform: translateX(24px);
            opacity: 0;
          }
        }

        .ph {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding: 20px 20px 14px;
          border-bottom: 1px solid rgba(243, 236, 225, 0.09);
        }
        .pe {
          margin: 0 0 3px;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.58rem;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--color-gold-soft, #c9ad6b);
        }
        .pt {
          margin: 0;
          font-size: 1.24rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--color-fg, #f3ece1);
        }
        .cerrar {
          width: 40px;
          height: 40px;
          flex-shrink: 0;
          border-radius: 10px;
          border: 1px solid rgba(243, 236, 225, 0.14);
          background: transparent;
          color: var(--color-fg, #f3ece1);
          font-size: 0.9rem;
          cursor: pointer;
        }

        .lista {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding: 6px 20px;
        }
        .item {
          display: grid;
          grid-template-columns: 62px minmax(0, 1fr) auto;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(243, 236, 225, 0.07);
        }
        .item img {
          width: 62px;
          height: 62px;
          border-radius: 12px;
          object-fit: cover;
          background: #f2f0ec;
        }
        .datos {
          min-width: 0;
        }
        .im {
          margin: 0;
          font-family: var(--font-mono, ui-monospace, monospace);
          font-size: 0.56rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--color-muted, #6e6155);
        }
        .in {
          margin: 2px 0 0;
          font-size: 0.92rem;
          font-weight: 600;
          color: var(--color-fg, #f3ece1);
          overflow-wrap: anywhere;
        }
        .it {
          margin: 2px 0 0;
          font-size: 0.78rem;
          color: var(--color-muted, #6e6155);
        }
        .ip {
          margin: 4px 0 0;
          font-size: 0.94rem;
          font-weight: 700;
          font-variant-numeric: tabular-nums;
          color: var(--color-fg, #f3ece1);
        }
        .isp {
          margin: 4px 0 0;
          font-size: 0.82rem;
          color: var(--color-muted, #6e6155);
        }

        .acciones {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: space-between;
          gap: 8px;
        }
        .qty {
          display: inline-flex;
          align-items: center;
          gap: 2px;
          border-radius: 10px;
          border: 1px solid rgba(243, 236, 225, 0.14);
          overflow: hidden;
        }
        .qty button {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          color: var(--color-fg, #f3ece1);
          font-size: 1rem;
          cursor: pointer;
        }
        .qty span {
          min-width: 22px;
          text-align: center;
          font-size: 0.86rem;
          font-variant-numeric: tabular-nums;
          color: var(--color-fg, #f3ece1);
        }
        .sacar {
          border: none;
          background: transparent;
          color: var(--color-muted, #6e6155);
          font-size: 0.74rem;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
          padding: 4px;
        }

        .pf {
          padding: 16px 20px max(20px, env(safe-area-inset-bottom));
          border-top: 1px solid rgba(243, 236, 225, 0.09);
        }
        .totales {
          margin-bottom: 14px;
        }
        .fila {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          font-size: 1rem;
          color: var(--color-fg, #f3ece1);
        }
        .fila strong {
          font-variant-numeric: tabular-nums;
          font-size: 1.16rem;
        }
        .fila.sec {
          margin-top: 4px;
          font-size: 0.84rem;
          color: var(--color-gold-soft, #c9ad6b);
        }
        .fila.sec strong {
          font-size: 0.92rem;
        }
        .aviso {
          margin: 8px 0 0;
          font-size: 0.74rem;
          line-height: 1.4;
          color: var(--color-muted, #6e6155);
        }

        .wa {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 52px;
          border-radius: 14px;
          background: var(--color-fg, #f3ece1);
          color: #0a0908;
          font-size: 1rem;
          font-weight: 700;
          text-decoration: none;
          transition: transform 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .wa:hover {
          transform: translateY(-1px);
        }
        .wa:focus-visible {
          outline: 2px solid var(--color-gold-soft, #c9ad6b);
          outline-offset: 3px;
        }
        .nota {
          margin: 10px 0 0;
          font-size: 0.74rem;
          line-height: 1.45;
          text-align: center;
          color: var(--color-muted, #6e6155);
        }
        .vaciar {
          display: block;
          margin: 10px auto 0;
          border: none;
          background: transparent;
          color: var(--color-muted, #6e6155);
          font-size: 0.76rem;
          text-decoration: underline;
          text-underline-offset: 3px;
          cursor: pointer;
          padding: 6px 10px;
        }

        @media (prefers-reduced-motion: reduce) {
          .panel {
            animation: none;
          }
          .fab,
          .wa {
            transition: none;
          }
          .fab:hover,
          .wa:hover {
            transform: none;
          }
        }
      `}</style>
    </>
  );
}
