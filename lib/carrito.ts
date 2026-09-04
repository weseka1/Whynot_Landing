/* ============================================================================
   CARRITO — estado local + armado del pedido de WhatsApp.
   ----------------------------------------------------------------------------
   No hay checkout ni pasarela, y es a propósito: el modelo de la casa es
   catálogo → WhatsApp → pago contra entrega. Lo que cambia es que el cliente
   ya no escribe "hola, tenés la Jordan?" — llega con el pedido armado:
   productos, talles, cantidades y total. El vendedor solo confirma.

   Estado en `localStorage` (sobrevive a que cierren la pestaña) con un store
   mínimo + `useSyncExternalStore`, para no arrastrar una librería por esto.
   Toda lectura/escritura va en try/catch: en modo incógnito o con las cookies
   bloqueadas el accessor tira, y el carrito tiene que seguir funcionando en
   memoria igual.
   ============================================================================ */

import { useSyncExternalStore } from "react";

const CLAVE = "whynot.carrito.v1";

/** WhatsApp de ventas. Mismo número que `site.ts` → mission/.001 COMPRA. */
export const WHATSAPP = "5491176295915";

export type ItemCarrito = {
  /** id de la fila del panel + talle: dos talles del mismo par son 2 items. */
  key: string;
  id: string;
  brand: string;
  model: string;
  colorway: string;
  imageUrl: string;
  /** Talle elegido. Obligatorio salvo que el producto no tenga talles. */
  size: string;
  qty: number;
  price: number | null;
  transferencia: number | null;
};

/* --------------------------------- store --------------------------------- */

let items: ItemCarrito[] = [];
let cargado = false;
const oyentes = new Set<() => void>();
/* Snapshot cacheado: useSyncExternalStore compara por identidad y entra en
   loop infinito si getSnapshot devuelve un array nuevo en cada llamada. */
let snapshot: ItemCarrito[] = items;

function leerStorage(): ItemCarrito[] {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return [];
    const val = JSON.parse(raw);
    return Array.isArray(val) ? (val as ItemCarrito[]) : [];
  } catch {
    return [];
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(items));
  } catch {
    /* incógnito o storage lleno: el carrito sigue vivo en memoria */
  }
}

function emitir() {
  snapshot = items;
  guardar();
  oyentes.forEach((fn) => fn());
}

function asegurarCarga() {
  if (cargado || typeof window === "undefined") return;
  cargado = true;
  items = leerStorage();
  snapshot = items;
}

function suscribir(fn: () => void): () => void {
  asegurarCarga();
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

function getSnapshot(): ItemCarrito[] {
  asegurarCarga();
  return snapshot;
}

/* En el server no hay carrito: array estable para no romper la hidratación. */
const VACIO: ItemCarrito[] = [];
const getServerSnapshot = (): ItemCarrito[] => VACIO;

/* -------------------------------- acciones -------------------------------- */

export function agregar(p: Omit<ItemCarrito, "key" | "qty">, qty = 1) {
  asegurarCarga();
  const key = `${p.id}::${p.size}`;
  const existente = items.find((i) => i.key === key);
  items = existente
    ? items.map((i) => (i.key === key ? { ...i, qty: i.qty + qty } : i))
    : [...items, { ...p, key, qty }];
  emitir();
}

export function quitar(key: string) {
  asegurarCarga();
  items = items.filter((i) => i.key !== key);
  emitir();
}

export function cambiarCantidad(key: string, qty: number) {
  asegurarCarga();
  if (qty <= 0) return quitar(key);
  items = items.map((i) => (i.key === key ? { ...i, qty } : i));
  emitir();
}

export function vaciar() {
  asegurarCarga();
  items = [];
  emitir();
}

/* --------------------------------- hooks --------------------------------- */

export function useCarrito(): ItemCarrito[] {
  return useSyncExternalStore(suscribir, getSnapshot, getServerSnapshot);
}

export function useTotales() {
  const items = useCarrito();
  const unidades = items.reduce((s, i) => s + i.qty, 0);
  /* Solo suma lo que tiene precio cargado. Si algún producto no lo tiene, el
     total es parcial y hay que decirlo (ver `precioIncompleto`), nunca
     inventar un número. */
  const total = items.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);
  const totalTransferencia = items.reduce(
    (s, i) => s + (i.transferencia ?? i.price ?? 0) * i.qty,
    0
  );
  const precioIncompleto = items.some((i) => i.price == null);
  return { unidades, total, totalTransferencia, precioIncompleto };
}

/* ------------------------------- el pedido -------------------------------- */

function pesos(n: number): string {
  return "$ " + new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 }).format(n);
}

/**
 * Arma el texto del pedido. Sale en el idioma del cliente, no en el nuestro:
 * nada de "SKU" ni ids — marca, modelo, color, talle y cantidad.
 */
export function textoPedido(items: ItemCarrito[]): string {
  if (items.length === 0) return "";

  const lineas = items.map((i) => {
    const nombre = [i.brand, i.model, i.colorway].filter(Boolean).join(" · ");
    const precio = i.price != null ? ` — ${pesos(i.price * i.qty)}` : "";
    const talle = i.size ? ` · talle ${i.size}` : "";
    const cant = i.qty > 1 ? ` · x${i.qty}` : "";
    return `• ${nombre}${talle}${cant}${precio}`;
  });

  const total = items.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);
  const transf = items.reduce((s, i) => s + (i.transferencia ?? i.price ?? 0) * i.qty, 0);
  const faltaPrecio = items.some((i) => i.price == null);

  const pie: string[] = [];
  if (total > 0) pie.push(`Total: ${pesos(total)}`);
  if (transf > 0 && transf < total) pie.push(`Por transferencia: ${pesos(transf)}`);
  if (faltaPrecio) pie.push("(hay productos sin precio en la web — los consulto)");

  return [
    "Hola! Vi la web y quiero hacer este pedido:",
    "",
    ...lineas,
    "",
    ...pie,
  ]
    .join("\n")
    .trim();
}

/** El link de WhatsApp con el pedido ya escrito. */
export function linkPedido(items: ItemCarrito[]): string {
  const texto = textoPedido(items);
  return `https://wa.me/${WHATSAPP}${texto ? `?text=${encodeURIComponent(texto)}` : ""}`;
}
