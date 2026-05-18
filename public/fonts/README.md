# /public/fonts

Carpeta para tipografías locales (auto-hospedadas).

## T-12 (T-012)  —  display sci-fi del marquee

La fuente principal del marquee superior (la que usa el referente DICH).
Es **free-to-use** pero hay que descargarla desde Studio Innate.

### Cómo instalarla

1. Ir a la página oficial de la fuente:
   - Studio Innate → https://studioinnate.com (buscar "T-12" en la sección de
     typefaces) — registro/descarga gratuito.
   - Alternativa: el archivo también suele estar referenciado como **T-012**
     y publicado por **Blackbox Grafx**.

2. Descargar el zip. Adentro vienen archivos `.otf` y/o `.ttf`.

3. Copiar el archivo de la **weight Regular** (la base) a esta carpeta como:

   ```
   public/fonts/T-12.otf
   ```

   Importante: el nombre tiene que ser **exactamente `T-12.otf`** (mayúsculas
   y guion incluidos) — así matchea con el `@font-face` declarado en
   `app/globals.css`.

   Si sólo te dan `.ttf`, también vale: copialo como `public/fonts/T-12.ttf`
   y editá una línea en `globals.css` (la `url(...)`) para apuntar al `.ttf`.

   Si querés más weights (Bold, Black) podés sumar otros archivos y declarar
   nuevos `@font-face` con `font-weight: 700` / `900`.

4. Recargá el dev server (hot reload alcanza). El marquee del Hero cambia
   automáticamente a T-12.

### Mientras no esté la fuente

El CSS tiene un fallback en `--font-marquee`:

```css
--font-marquee: "T-12", "Audiowide", "Bruno Ace SC", "Quantico", system-ui;
```

Hasta que dropees el `.otf`, se va a ver Audiowide. Cuando agregues el
archivo, T-12 toma el lugar sin tocar nada más.

### Licencia

T-12 / T-012 es free-to-use según los términos de Studio Innate. Para uso
comercial revisar los términos en su sitio.
