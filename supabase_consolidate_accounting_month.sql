-- =====================================================================
-- MIGRACIÓN: CONSOLIDACIÓN CONTABLE DE EVENTOS QUE CRUZAN DE MES
-- Permite que eventos de fin de mes (ej. 31 de Octubre a 1 de Noviembre)
-- imputen todas sus jornadas a las finanzas y boletas del mes de inicio.
-- =====================================================================

-- 1. Agregar columna consolidate_accounting_month a la tabla events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS consolidate_accounting_month BOOLEAN DEFAULT TRUE;

-- 2. Asegurar que los eventos existentes tengan habilitada la consolidación por defecto
UPDATE public.events 
SET consolidate_accounting_month = TRUE 
WHERE consolidate_accounting_month IS NULL;

-- 3. Comentario explicativo en la columna
COMMENT ON COLUMN public.events.consolidate_accounting_month IS 
'Si es TRUE (por defecto), todas las jornadas del evento se imputan financieramente y tributariamente al mes de inicio del evento, evitando dividir boletas SII entre dos meses distintos.';
