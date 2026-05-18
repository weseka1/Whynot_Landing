# /public/assets

Carpeta pública de assets estáticos. Todo lo que esté acá se sirve desde la
raíz: `public/assets/x.jpg` → `/assets/x.jpg` en el HTML.

## Estructura

```
collections/
  oraniths.jpg    → Hero de la colección Oraniths
  anturax.jpg     → Hero de la colección Anturax
archive/
  drop-00.jpg     → Card 1 de Past Drop
  drop-01.jpg     → Card 2 de Past Drop
  drop-02.jpg     → Card 3 de Past Drop
```

Los archivos `.txt` adjuntos son guías placeholder con el aspect ratio
sugerido. Cuando reemplaces por la imagen real, podés borrar el `.txt`.

## Reglas

- Si una imagen falta, el bloque **no rompe** el layout: el CSS de
  `CollectionBlock` aplica un degradé de fallback usando el color de la
  colección.
- Si querés cambiar el path de una imagen, edita `data/site.ts`
  (`collections.items[].image` o `pastDrop.items[].image`). No hace falta
  tocar componentes.
