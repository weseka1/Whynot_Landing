-- ============================================================================
-- STOCK POR TALLE — la columna que falta
-- ----------------------------------------------------------------------------
-- Juani, 5-sep-2026: "armemos la estructura para trabajar por talles/producto,
-- bien completo, y que eso se traspole al panel. Que el stock sea administrado
-- por ellos: ellos deciden cuántos pares por talle hay".
--
-- CÓMO CORRERLO
--   Supabase → el proyecto jkkytzgmhzzngnntkfbr → SQL Editor → pegar y Run.
--   Es seguro de correr dos veces (todo lleva IF NOT EXISTS).
--   No borra ni modifica ningún dato existente.
--
-- QUÉ HACE
--   Agrega `stock_por_talle` a landing_products: un objeto JSON con los pares
--   que hay de cada talle.
--
--       {"40": 3, "41": 1, "42": 0}
--
--   El talle que no figura en el objeto es un talle que no se maneja para ese
--   producto (distinto de figurar en 0, que es "lo tenemos pero está agotado").
--
-- POR QUÉ UNA COLUMNA NUEVA Y NO REUSAR `sizes`
--   `sizes` es un array de texto — ["40","41"] — y sólo puede decir QUÉ talles
--   hay, nunca CUÁNTOS. Se mantiene como está para no romper nada mientras se
--   migra, y el código toma stock_por_talle cuando existe. Ver
--   disponibilidadDeTalles() en data/landingProducts.ts: la decisión vive en un
--   solo lugar, así que cuando esta columna esté cargada no hay que tocar
--   ningún componente.
-- ============================================================================

-- 1 · La columna. jsonb y no json: permite índices y operadores.
ALTER TABLE public.landing_products
  ADD COLUMN IF NOT EXISTS stock_por_talle jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.landing_products.stock_por_talle IS
  'Pares por talle: {"40": 3, "41": 1}. Talle ausente = no se maneja. '
  'Talle en 0 = se maneja pero está agotado. Lo administra el panel.';

-- 2 · Que no entre basura. Sin esto, un bug del panel puede dejar
--     {"cuarenta": "tres"} y la web tendría que defenderse en runtime.
ALTER TABLE public.landing_products
  DROP CONSTRAINT IF EXISTS landing_products_stock_por_talle_valido;

ALTER TABLE public.landing_products
  ADD CONSTRAINT landing_products_stock_por_talle_valido CHECK (
    jsonb_typeof(stock_por_talle) = 'object'
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_each(stock_por_talle) AS kv(talle, pares)
      WHERE
        -- la clave tiene que ser un talle de 2 o 3 dígitos (35, 40, 45, 105)
        talle !~ '^[0-9]{2,3}$'
        -- el valor tiene que ser un entero >= 0
        OR jsonb_typeof(pares) <> 'number'
        OR (pares::numeric) < 0
        OR (pares::numeric) <> floor(pares::numeric)
    )
  );

-- 3 · Índice para poder preguntar "¿qué hay en talle 42?" sin leer la tabla
--     entera. Es lo que va a necesitar el buscador por talle que pidió Fabri.
CREATE INDEX IF NOT EXISTS landing_products_stock_por_talle_idx
  ON public.landing_products USING gin (stock_por_talle);

-- ============================================================================
-- 4 · SEMILLA (opcional, correr sólo si se quiere arrancar desde lo que hay)
-- ----------------------------------------------------------------------------
-- Pasa los talles de `sizes` a la estructura nueva, repartiendo el `stock`
-- total en partes iguales — es una ESTIMACIÓN para no arrancar de cero, no un
-- dato real. Los 158 productos que hoy tienen talles quedan con algo cargado y
-- los chicos corrigen desde el panel.
--
-- Si preferís que carguen todo a mano desde cero, NO corras este bloque.
-- ============================================================================

-- UPDATE public.landing_products p
-- SET stock_por_talle = sub.mapa
-- FROM (
--   SELECT
--     id,
--     jsonb_object_agg(
--       talle,
--       GREATEST(1, COALESCE(stock, 0) / GREATEST(1, array_length(sizes, 1)))
--     ) AS mapa
--   FROM public.landing_products, unnest(sizes) AS talle
--   WHERE sizes IS NOT NULL
--     AND array_length(sizes, 1) > 0
--     AND talle ~ '^[0-9]{2,3}$'
--   GROUP BY id
-- ) AS sub
-- WHERE p.id = sub.id
--   AND p.stock_por_talle = '{}'::jsonb;   -- nunca pisa lo ya cargado

-- ============================================================================
-- VERIFICAR QUE QUEDÓ BIEN
-- ============================================================================
-- SELECT
--   count(*) FILTER (WHERE stock_por_talle <> '{}'::jsonb) AS con_stock_por_talle,
--   count(*) FILTER (WHERE stock_por_talle =  '{}'::jsonb) AS sin_cargar,
--   count(*) AS total
-- FROM public.landing_products;
