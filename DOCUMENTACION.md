# DOCUMENTACIÓN — Esqueleto editorial DICH

Reconstrucción profesional del esqueleto de la página
`dich-fashion.webflow.io`, hecha como **base editable** sobre
Next.js 14 + TypeScript + Tailwind + Framer Motion.

> ⚠️ Esta versión es un **esqueleto inspirado**: la composición,
> jerarquía, tipo de animaciones y orden de secciones imita la
> referencia, pero ningún texto, asset o nombre fue copiado tal cual.
> Los créditos originales (SITE BY · MASTERCLASS BY · AWWWARDS ·
> LEGAL · COPYRIGHT) se preservan como **slots editables** en
> `data/credits.ts`. Hasta que los pegues, se renderizan en rojo en
> el footer para que no te olvides de completarlos.

---

## 1. Estructura general

```
app/
  layout.tsx           → Layout raíz + import de globals.css
  page.tsx             → Composición de la home (orden de secciones)
  globals.css          → Variables CSS, reset y animaciones globales

components/
  Preloader.tsx        → Pantalla de boot (C://SYSTEM_FILES → ACCESS GRANTED)
  Header.tsx           → Nav fija + system text + botón hamburguesa
  MenuOverlay.tsx      → Menú fullscreen (cortina desde arriba)
  Hero.tsx             → Bloque hero con display grande y meta
  DiscoverButton.tsx   → Botón circular reutilizable
  Collections.tsx      → Ancla #section-collections + listado
  CollectionBlock.tsx  → Un bloque por colección (Oraniths, Anturax…)
  Ticker.tsx           → Marquee horizontal infinito
  Mission.tsx          → Manifiesto / Our Mission
  PastDrop.tsx         → Galería de drops anteriores
  IdeaForm.tsx         → Sección CTA + modal "Your Idea"
  Footer.tsx           → Créditos y legal (NO TOCAR sin permiso)

data/
  site.ts              → Toda la copy editable de la web
  credits.ts           → Slots de SITE BY / MASTERCLASS / AWWWARDS / LEGAL

public/assets/
  collections/         → Imágenes de Oraniths y Anturax
  archive/             → Imágenes de Past Drop
```

---

## 2. Qué hace cada sección

| Sección | Componente | Anchor | Función |
|---------|-----------|--------|---------|
| Preloader | `Preloader.tsx` | — | Boot inicial (2.2s), se autodestruye |
| Header | `Header.tsx` | — | Nav fija con hamburguesa |
| Hero | `Hero.tsx` | `#hero` | Display gigante + Discover |
| Collections | `Collections.tsx` | `#section-collections` | Lista de colecciones |
| Oraniths | `CollectionBlock` | `#collection-oraniths` | Capsule 01 |
| Anturax | `CollectionBlock` | `#collection-anturax` | Capsule 02 |
| Ticker | `Ticker.tsx` | — | Marquee de palabras |
| Mission | `Mission.tsx` | `#section-mission` | Manifiesto |
| Past Drop | `PastDrop.tsx` | `#section-past-drop` | Archivo |
| Your Idea | `IdeaForm.tsx` | `#section-form` | CTA + modal |
| Footer | `Footer.tsx` | — | Créditos · Legal · Copyright |

---

## 3. Dónde editar cada cosa

### 3.1 Cambiar textos
Casi todo está en **`data/site.ts`**, agrupado por sección
(`hero`, `collections`, `mission`, `pastDrop`, `form`, etc.).

Si no encontrás un texto en `site.ts`, probablemente sea:

- **Boot del preloader** → `site.preloader.*`
- **Items del menú** → `site.nav`
- **Palabras del marquee** → `site.ticker`

### 3.2 Cambiar imágenes
Reemplazá los archivos en `public/assets/`. Los paths se referencian
desde `data/site.ts`:

- Colecciones → `collections.items[i].image`
- Past Drop → `pastDrop.items[i].image`

Si el archivo no existe, el layout **no rompe**: hay un fallback de
degradé en `CollectionBlock.tsx` y un fondo gris en `PastDrop.tsx`.

### 3.3 Cambiar animaciones
- **Velocidad global** → variables CSS en `globals.css`
  (`--speed-fast`, `--speed-base`, `--speed-slow`, `--speed-ticker`,
  `--speed-preload`).
- **Animación específica** → cada componente usa `framer-motion`.
  Los `initial / animate / transition` están inline en el JSX para
  que sean fáciles de tunear.
- **Marquee** → keyframe `@keyframes marquee` en `globals.css`.
- **Preloader** → duración total en el `setTimeout` de
  `Preloader.tsx` + variable `--speed-preload`.

### 3.4 Variables CSS de diseño
Todas en `app/globals.css` bajo `:root`:

| Grupo | Variables |
|-------|-----------|
| Color | `--color-bg`, `--color-fg`, `--color-muted`, `--color-line`, `--color-accent`, `--color-warn`, `--color-ok` |
| Fuente | `--font-display`, `--font-body`, `--font-mono` |
| Spacing | `--space-xs / sm / md / lg / xl / 2xl` |
| Layout | `--container-pad`, `--section-pad-y` |
| Radio | `--radius-pill`, `--radius-sm` |
| Velocidad | `--speed-fast`, `--speed-base`, `--speed-slow`, `--speed-ticker`, `--speed-preload` |
| Easing | `--ease-out`, `--ease-in-out` |

Cambiá una sola variable y se propaga a toda la web.

### 3.5 Créditos / Footer / Legal (ZONA PROTEGIDA)
**No tocar sin permiso del autor del sitio original.**

Todos los textos viven en `data/credits.ts`. El componente
`Footer.tsx` lee ese archivo y renderiza:

- `SITE BY` → quien hizo el sitio
- `MASTERCLASS BY` → curso / academia que lo produjo
- `AWWWARDS` → reconocimiento
- `LEGAL` → aviso legal
- `COPYRIGHT` → línea de derechos (año incluido)
- `externalLinks[]` → links extra opcionales (IG, X, etc.)

**Para llenarlo:**
1. Abrí `data/credits.ts`.
2. Reemplazá cada `"TODO: pegar ..."` por el string exacto del original.
3. Pegá las URLs en los `href` si las había.
4. Guardá. El footer se actualiza solo.

Mientras un slot tenga `TODO:` se va a renderizar en color
`--color-warn` (rojo) en el footer, para no olvidártelo.

**Reglas:**
- ❌ No reemplazar nombres de los créditos.
- ❌ No cambiar el año del copyright.
- ❌ No esconder ni comentar la sección.
- ❌ No borrar links externos.
- ✅ Si querés agregar más links → `credits.externalLinks`.

---

## 4. Cómo agregar una nueva colección

1. Abrí `data/site.ts`.
2. En `collections.items`, agregá un objeto nuevo:

   ```ts
   {
     id: "nova",
     index: "03",
     name: "NOVA",
     tag: "AW / 03",
     copy: "Capsule three. Descripción breve.",
     image: "/assets/collections/nova.jpg",
     accent: "#39d9ff",
   }
   ```

3. Colocá la imagen en `public/assets/collections/nova.jpg`.
4. Listo. El bloque se renderiza solo y el menú/anchors siguen funcionando.

Si querés que tenga su propio item en la navegación, editá
`site.nav` y agregá `{ label: "Nova", href: "#collection-nova" }`.

---

## 5. Cómo cambiar la marca DICH por otra (más adelante, NO ahora)

> ⚠️ Esto es informativo. **NO ejecutarlo hasta que lo pidas
> explícitamente.** Cuando llegue el momento:

1. `data/site.ts` → `brand.name` y `brand.tagline`.
2. `app/layout.tsx` → `metadata.title` y `metadata.description`.
3. `data/credits.ts` → **NO TOCAR.** Los créditos del sitio
   original quedan intactos aunque cambies de marca, salvo que el
   autor original te autorice expresamente.
4. Reemplazar assets de `public/assets/` por los de la nueva marca.
5. Variables `--color-accent` en `globals.css` para ajustar el tono.

---

## 6. Responsive

- **Mobile** (≤640px): los grids de 12 columnas colapsan a 1
  columna; el display escala con `clamp()`.
- **Tablet** (641–1024px): grids de 6 columnas; el menú sigue
  fullscreen.
- **Desktop** (≥1025px): grid de 12 columnas como en la referencia.

No hace falta tocar nada para que funcione: las medidas usan
`clamp()` y `auto-fit, minmax(...)` donde corresponde.

---

## 7. Animaciones — mapa completo

| Animación | Dónde | Cómo editar |
|-----------|-------|-------------|
| Boot del preloader | `Preloader.tsx` (setInterval / setTimeout) | Duración: `--speed-preload` + el timeout de 2200ms |
| Cortina del menú | `MenuOverlay.tsx` (motion.div con `y: -100%`) | `transition.duration` inline |
| Hero fade-up del display | `Hero.tsx` (motion.h1) | `transition.delay` (espera al preloader) |
| Hover del DiscoverButton | `DiscoverButton.tsx` | `whileHover.scale` + CSS hover invertido |
| Marquee del Ticker | `Ticker.tsx` + keyframe `marquee` | Velocidad: `--speed-ticker` |
| Reveal del Mission | `Mission.tsx` (whileInView) | `viewport.amount`, `transition.duration` |
| Cards de Past Drop | `PastDrop.tsx` (whileInView + delay i*0.1) | mismo patrón |
| Hover B/N → color en Past Drop | `PastDrop.tsx` (CSS `filter: grayscale`) | clase `.past-drop-img:hover` |
| Modal del IdeaForm | `IdeaForm.tsx` (AnimatePresence + y: 30) | `transition` inline |
| Scanline del preloader | `globals.css` keyframe `scan` | `animation: scan 2s linear infinite` |

---

## 8. Comandos

```bash
npm install        # primera vez
npm run dev        # http://localhost:3000
npm run build      # build de producción
npm run start      # servir el build
```

---

## 9. Checklist de "está todo bien"

- [ ] El preloader aparece al cargar y desaparece a los ~2.2s.
- [ ] El menú abre con la hamburguesa y cierra con ✕ o `ESC`.
- [ ] El botón `Discover` baja a `#section-collections`.
- [ ] Las 2 colecciones (Oraniths, Anturax) renderizan con su accent.
- [ ] El ticker se mueve sin saltos.
- [ ] El modal de "Your Idea" abre, valida y muestra OK.
- [ ] El footer muestra los 4 créditos. **Los que digan `TODO:`
      están en rojo: completalos en `data/credits.ts`.**
- [ ] El copyright se ve y NO está modificado.
