"use client";

/* ============================================================================
   WHYNOT END — sección final estilo DICH "INTO THE FUTURE"
   - Fondo negro, texto WHYNOT en líneas onduladas (canvas)
   - Las líneas se distorsionan al pasar el mouse (spring back)
   ============================================================================ */

import { useEffect, useRef, useState } from "react";
import { useIsTouch } from "./useIsMobile";
import { useInViewport } from "./useInViewport";

const TEXT          = "WHY NOT";
const LINE_COLOR    = "#ffdfc4";
const LINES_COUNT   = 28;   // menos líneas = más espaciadas
const CELL_WIDTH    = 5;
const TYPE_CANVAS_W = 580;  // ancho suficiente para "WHY NOT" con espacio
const TYPE_CANVAS_H = 90;
const FONT_FACTOR   = 0.14; // letras un poco más chicas
const HEIGHT_OFFSET = 34;   // amplitud del relieve
const H_PAD_FACTOR  = 0.03; // padding horizontal del canvas (3% = casi full-width)
const V_PAD_FACTOR  = 0.10;
const MOUSE_RADIUS  = 130;
const MOUSE_FORCE   = 14;
const SPRING        = 0.10;

type Point = { x: number; y: number; baseX: number; baseY: number };

export default function WhyNotEnd() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const isTouch = useIsTouch();
  /* Lazy: hasta que la seccion no entra al viewport (con 200px de margen),
     no construimos las 28 lineas ni arrancamos el rAF. Cuando se va el
     viewport el rAF se cancela (chequeamos isInView dentro del loop).      */
  const { ref: sectionRef, isInView, hasBeenInView } = useInViewport<HTMLElement>({
    rootMargin: "200px",
  });
  /* Ref espejo para que el loop lea siempre el valor mas reciente
     sin re-crear el useEffect.                                            */
  const isInViewRef = useRef(false);
  useEffect(() => { isInViewRef.current = isInView; }, [isInView]);

  useEffect(() => {
    if (!hasBeenInView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const mouse = { x: -99999, y: -99999 };
    let lines: Point[][] = [];
    let dpr = 1;
    let rafId = 0;

    function buildLines(width: number, height: number) {
      const typeCanvas = document.createElement("canvas");
      typeCanvas.width  = TYPE_CANVAS_W;
      typeCanvas.height = TYPE_CANVAS_H;
      const tctx = typeCanvas.getContext("2d");
      if (!tctx) return;

      tctx.fillStyle = "black";
      tctx.fillRect(0, 0, TYPE_CANVAS_W, TYPE_CANVAS_H);
      tctx.fillStyle = "white";
      const fontSize = TYPE_CANVAS_W * FONT_FACTOR;
      tctx.font = `900 ${fontSize}px "Orbitron", system-ui, sans-serif`;
      tctx.textBaseline = "middle";
      tctx.textAlign    = "center";
      tctx.fillText(TEXT, TYPE_CANVAS_W / 2, TYPE_CANVAS_H / 2);

      const data = tctx.getImageData(0, 0, TYPE_CANVAS_W, TYPE_CANVAS_H).data;

      const hPad = width < 768 ? 0 : width * H_PAD_FACTOR;
      const vPad = height * V_PAD_FACTOR;
      const usableW = width  - hPad * 2;
      const usableH = height - vPad * 2;
      const lineH   = usableH / LINES_COUNT;
      const cols    = Math.floor(usableW / CELL_WIDTH);

      lines = [];
      for (let i = 0; i < LINES_COUNT; i++) {
        const y = vPad + i * lineH;
        const line: Point[] = [];
        for (let j = 0; j < cols; j++) {
          const x = hPad + j * CELL_WIDTH;
          const tx = Math.floor((j / cols) * TYPE_CANVAS_W);
          const ty = Math.floor((i / LINES_COUNT) * TYPE_CANVAS_H);
          const idx = (ty * TYPE_CANVAS_W + tx) * 4;
          const brightness = data[idx] || 0;
          const offset = (brightness / 255) * HEIGHT_OFFSET;
          const finalY = y - offset;
          line.push({ x, y: finalY, baseX: x, baseY: finalY });
        }
        lines.push(line);
      }
    }

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w === 0 || h === 0) return;
      dpr = window.devicePixelRatio || 1;
      canvas!.width  = Math.floor(w * dpr);
      canvas!.height = Math.floor(h * dpr);
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.scale(dpr, dpr);
      buildLines(w, h);
      setSize({ w, h });
    }

    function tick() {
      /* Pausa si la tab esta oculta o la seccion fuera del viewport — sin
         cursor no hay cambios visibles y rAF consume CPU.                 */
      if (document.hidden || !isInViewRef.current) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const w = canvas!.width  / dpr;
      const h = canvas!.height / dpr;

      for (const line of lines) {
        for (const p of line) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MOUSE_RADIUS) {
            const angle = Math.atan2(dy, dx);
            const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS;
            p.x += Math.cos(angle) * force * MOUSE_FORCE;
            p.y += Math.sin(angle) * force * MOUSE_FORCE;
          }
          p.x += (p.baseX - p.x) * SPRING;
          p.y += (p.baseY - p.y) * SPRING;
        }
      }

      ctx!.clearRect(0, 0, w, h);
      ctx!.strokeStyle = LINE_COLOR;
      ctx!.lineWidth   = 0.7;
      for (const line of lines) {
        if (line.length < 2) continue;
        ctx!.beginPath();
        ctx!.moveTo(line[0].x, line[0].y);
        for (let i = 1; i < line.length; i++) {
          const prev = line[i - 1];
          const cur  = line[i];
          const midX = (prev.x + cur.x) / 2;
          const midY = (prev.y + cur.y) / 2;
          ctx!.quadraticCurveTo(prev.x, prev.y, midX, midY);
        }
        ctx!.stroke();
      }

      rafId = requestAnimationFrame(tick);
    }

    function onMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }
    function onLeave() {
      mouse.x = -99999;
      mouse.y = -99999;
    }

    // Pequeño delay para que el layout esté listo
    const startId = window.setTimeout(() => {
      resize();
      rafId = requestAnimationFrame(tick);
    }, 50);

    window.addEventListener("resize", resize, { passive: true });
    // En touch devices no agregamos listeners de mouse (no aplican y consume CPU)
    if (!isTouch) {
      canvas.addEventListener("mousemove", onMove, { passive: true });
      canvas.addEventListener("mouseleave", onLeave, { passive: true });
    }

    return () => {
      clearTimeout(startId);
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      if (!isTouch) {
        canvas.removeEventListener("mousemove", onMove);
        canvas.removeEventListener("mouseleave", onLeave);
      }
    };
  }, [isTouch, hasBeenInView]);

  return (
    <section
      id="section-whynot-end"
      ref={sectionRef}
      data-bg-color="#070707"
      data-text-color="#f4a982"
      style={{
        position: "relative",
        background: "var(--page-bg)",
        color: "var(--color-accent)",
        padding: "var(--space-xl) var(--container-pad) var(--space-lg)",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        overflow: "hidden",
        borderTop: "1px solid var(--color-line)",
      }}
    >
      {/* TOP STRIP */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span className="system-text" style={{ color: "var(--color-accent)" }}>
          STUDY: 404 PAGE
        </span>
        <span className="system-text" style={{ color: "var(--color-accent)" }}>
          WHYNOT // BOTTOM
        </span>
        <a
          href="#hero"
          className="system-text"
          style={{ color: "var(--color-accent)", textDecoration: "none" }}
        >
          BACK TO TOP ↑
        </a>
      </div>

      {/* TITLE */}
      <h2
        style={{
          textAlign: "center",
          fontSize: "clamp(2rem, 6vw, 5rem)",
          letterSpacing: "0.08em",
          color: "var(--color-accent)",
          textTransform: "uppercase",
          fontFamily: "var(--font-marquee)",
          lineHeight: 1,
          marginTop: "var(--space-md)",
        }}
      >
        Into the Future
      </h2>

      {/* CANVAS — WHYNOT en líneas distorsionables */}
      <div
        style={{
          flex: 1,
          minHeight: 320,
          position: "relative",
          marginTop: "var(--space-md)",
        }}
      >
        <canvas
          ref={canvasRef}
          aria-label="WHYNOT — pasá el mouse para distorsionar"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            display: "block",
            cursor: "crosshair",
          }}
        />
      </div>

      {/* BOTTOM INFO */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--space-md)",
          paddingTop: "var(--space-md)",
          borderTop: "1px solid var(--color-line)",
        }}
      >
        <Info label="SITE BY:"    main="WHYNOT_DEV"        sub="BL/S0" />
        <Info label="PROJECT:"    main="NEW ERA OF WHYNOT" />
        <Info label="LEGAL:"      main="@2025–2045" />
        <Info label="MASTERCLASS" main="WHYNOT TEAM"       align="right" />
      </div>
    </section>
  );
}

function Info({
  label,
  main,
  sub,
  align = "left",
}: {
  label: string;
  main: string;
  sub?: string;
  align?: "left" | "right";
}) {
  return (
    <div style={{ display: "grid", gap: 2, textAlign: align }}>
      <span className="system-text" style={{ color: "var(--color-accent)" }}>
        {label}
      </span>
      <span style={{ color: "var(--color-fg)", fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
        {main}
      </span>
      {sub && (
        <span className="system-text" style={{ color: "var(--color-muted)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
