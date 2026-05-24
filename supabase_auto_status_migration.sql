-- ====================================================================
-- MIGRACIÓN SUPABASE: AUTOMATIZACIÓN DE ESTADOS DE EVENTOS POR TIEMPO
-- Huso Horario de Referencia: America/Santiago (Chile)
-- Seguridad: Hardening RLS, search_path restrictivo y revocación de EXECUTE en PUBLIC
-- ====================================================================

-- 1. Crear la función del actualizador automático de estados
CREATE OR REPLACE FUNCTION public.auto_update_event_statuses()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_time_santiago timestamp;
  updated_to_in_progress integer := 0;
  updated_to_finished integer := 0;
  result json;
BEGIN
  -- Obtener la hora actual del servidor convertida a la hora de Santiago de Chile
  current_time_santiago := pg_catalog.now() AT TIME ZONE 'America/Santiago';

  -- Transición 1: 'Planificado' o 'Confirmado' a 'En progreso'
  -- Requisitos:
  -- - El estado es 'Planificado' o 'Confirmado'
  -- - La fecha y hora de inicio es menor o igual al tiempo actual en Santiago
  WITH to_in_progress AS (
    UPDATE public.events
    SET 
      status = 'En progreso'
    WHERE 
      status IN ('Planificado', 'Confirmado')
      AND date IS NOT NULL 
      AND (
        (date::text || ' ' || COALESCE(NULLIF(time::text, ''), '00:00'))::timestamp
      ) <= current_time_santiago
    RETURNING id
  )
  SELECT count(*) INTO updated_to_in_progress FROM to_in_progress;

  -- Transición 2: 'En progreso' a 'Finalizado'
  -- Requisitos:
  -- - El estado es 'En progreso'
  -- - end_time está especificado y no es nulo ni vacío (Regla: no finalizar si no hay hora de término)
  -- - La hora de término es menor o igual al tiempo actual en Santiago
  -- - Soporta eventos nocturnos: si end_time es menor a la hora de inicio, finaliza al día siguiente
  WITH to_finished AS (
    UPDATE public.events
    SET 
      status = 'Finalizado'
    WHERE 
      status = 'En progreso'
      AND date IS NOT NULL 
      AND end_time IS NOT NULL 
      AND end_time::text <> ''
      AND (
        CASE 
          WHEN COALESCE(NULLIF(time::text, ''), '00:00')::time > (end_time::text)::time THEN
            (((date::date + interval '1 day')::date)::text || ' ' || end_time::text)::timestamp
          ELSE
            (date::text || ' ' || end_time::text)::timestamp
        END
      ) <= current_time_santiago
    RETURNING id
  )
  SELECT count(*) INTO updated_to_finished FROM to_finished;

  -- Construir el JSON de auditoría de retorno
  result := pg_catalog.json_build_object(
    'success', true,
    'timestamp_santiago', current_time_santiago,
    'updated_to_in_progress', updated_to_in_progress,
    'updated_to_finished', updated_to_finished
  );

  RETURN result;
END;
$$;

-- 2. Restringir y bloquear los permisos de ejecución para proteger la base de datos
-- Evita llamadas no autorizadas desde el cliente (anon/authenticated de PostgREST)
REVOKE ALL ON FUNCTION public.auto_update_event_statuses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_update_event_statuses() FROM anon;
REVOKE ALL ON FUNCTION public.auto_update_event_statuses() FROM authenticated;

-- Conceder permisos únicamente a roles de sistema y superusuario
GRANT EXECUTE ON FUNCTION public.auto_update_event_statuses() TO postgres;
GRANT EXECUTE ON FUNCTION public.auto_update_event_statuses() TO service_role;

-- 3. Habilitar la programación automática mediante pg_cron (si está habilitado en Supabase)
-- Nota: Esto se ejecutará cada 5 minutos de forma nativa en el backend
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Programar cronjob seguro
SELECT cron.schedule(
  'auto-update-event-statuses-job',
  '*/5 * * * *', -- Cada 5 minutos
  $$ SELECT public.auto_update_event_statuses(); $$
);
