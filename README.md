# WHYNOT — Luxury Sneaker Store

Esqueleto editorial / cyber para landing de drops de sneakers de lujo.

- **Stack:** Next.js 14 (App Router) + TypeScript + Tailwind + Framer Motion.
- **Estado:** Skeleton + documentación lista para reemplazar contenido real.

## Inicio rápido

```bash
npm install
npm run dev
# → http://localhost:3000
```

## Documentación

Toda la documentación (en español) vive en [`/docs`](./docs):

- [README — estructura general](./docs/README.md)
- [Design System — colores, fuentes, espaciados](./docs/DESIGN_SYSTEM.md)
- [Component Map — qué hace cada componente](./docs/COMPONENT_MAP.md)
- [Animation Map — todas las animaciones](./docs/ANIMATION_MAP.md)
- [Editing Guide — recetas por cambio común](./docs/EDITING_GUIDE.md)
- [Reference Breakdown — análisis sin copia](./docs/REFERENCE_BREAKDOWN.md)

## Estructura mínima

```
app/        → layout + page principal
components/ → componentes reutilizables
data/       → contenido editable (textos, productos, colecciones)
docs/       → documentación
```

Para editar contenido, casi siempre vas a tocar `/data/*`. Para diseño,
`tailwind.config.ts` o el componente específico.

## Lo que NO copia del referente

Ver [REFERENCE_BREAKDOWN.md](./docs/REFERENCE_BREAKDOWN.md).
Sólo se usaron **patrones UX comunes** del segmento cyber-fashion.
Ningún texto, clase, asset o nombre del referente fue replicado.
