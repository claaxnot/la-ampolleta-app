-- ====================================================================
-- MIGRACIÓN SUPABASE: AUTOMATIZACIÓN DE ESTADOS DE EVENTOS Y JORNADAS POR TIEMPO
-- Huso Horario de Referencia: America/Santiago (Chile)
-- Seguridad: Hardening RLS, search_path restrictivo y revocación de EXECUTE en PUBLIC
-- ====================================================================

-- 1. Crear la función del actualizador automático de estados adaptada a Jornadas
CREATE OR REPLACE FUNCTION public.auto_update_event_statuses()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_time_santiago timestamp;
  updated_days_to_in_progress integer := 0;
  updated_days_to_finished integer := 0;
  updated_events_to_in_progress integer := 0;
  updated_events_to_finished integer := 0;
  result json;
BEGIN
  -- Obtener la hora actual del servidor convertida a la hora de Santiago de Chile
  current_time_santiago := pg_catalog.now() AT TIME ZONE 'America/Santiago';

  -- A. ACTUALIZAR JORNADAS (event_days)
  
  -- Transición A1: Jornadas 'Planificado' o 'Confirmado' a 'En progreso'
  WITH to_in_progress_days AS (
    UPDATE public.event_days
    SET 
      status = 'En progreso',
      updated_at = pg_catalog.now()
    WHERE 
      status IN ('Planificado', 'Confirmado')
      AND date IS NOT NULL 
      AND (
        (date::text || ' ' || COALESCE(NULLIF(start_time::text, ''), '00:00'))::timestamp
      ) <= current_time_santiago
    RETURNING id
  )
  SELECT count(*) INTO updated_days_to_in_progress FROM to_in_progress_days;

  -- Transición A2: Jornadas 'En progreso' a 'Finalizado'
  WITH to_finished_days AS (
    UPDATE public.event_days
    SET 
      status = 'Finalizado',
      updated_at = pg_catalog.now()
    WHERE 
      status = 'En progreso'
      AND date IS NOT NULL 
      AND end_time IS NOT NULL 
      AND end_time::text <> ''
      AND (
        CASE 
          WHEN COALESCE(NULLIF(start_time::text, ''), '00:00')::time > (end_time::text)::time THEN
            (((date::date + interval '1 day')::date)::text || ' ' || end_time::text)::timestamp
          ELSE
            (date::text || ' ' || end_time::text)::timestamp
        END
      ) <= current_time_santiago
    RETURNING id
  )
  SELECT count(*) INTO updated_days_to_finished FROM to_finished_days;

  -- B. SINCRONIZAR ESTADOS DE EVENTOS PADRES (events)

  -- Transición B1: Eventos a 'En progreso'
  -- Si alguna de sus jornadas está 'En progreso' o 'Finalizado', y no todas están 'Finalizado' o 'Cancelado', el evento pasa a 'En progreso'
  WITH to_in_progress_events AS (
    UPDATE public.events e
    SET 
      status = 'En progreso'
    WHERE 
      e.status IN ('Planificado', 'Confirmado')
      -- Tiene al menos una jornada en 'En progreso' o 'Finalizado'
      AND EXISTS (
        SELECT 1 FROM public.event_days d 
        WHERE d.event_id = e.id 
          AND d.status IN ('En progreso', 'Finalizado')
      )
      -- Y no todas están Finalizadas o Canceladas
      AND EXISTS (
        SELECT 1 FROM public.event_days d 
        WHERE d.event_id = e.id 
          AND d.status NOT IN ('Finalizado', 'Cancelado')
      )
    RETURNING id
  )
  SELECT count(*) INTO updated_events_to_in_progress FROM to_in_progress_events;

  -- Transición B2: Eventos a 'Finalizado'
  -- Si todas sus jornadas están en 'Finalizado' o 'Cancelado', el evento pasa a 'Finalizado'
  WITH to_finished_events AS (
    UPDATE public.events e
    SET 
      status = 'Finalizado'
    WHERE 
      e.status IN ('Planificado', 'Confirmado', 'En progreso')
      AND EXISTS (SELECT 1 FROM public.event_days d WHERE d.event_id = e.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.event_days d 
        WHERE d.event_id = e.id 
          AND d.status NOT IN ('Finalizado', 'Cancelado')
      )
    RETURNING id
  )
  SELECT count(*) INTO updated_events_to_finished FROM to_finished_events;

  -- Construir el JSON de auditoría de retorno
  result := pg_catalog.json_build_object(
    'success', true,
    'timestamp_santiago', current_time_santiago,
    'updated_days_to_in_progress', updated_days_to_in_progress,
    'updated_days_to_finished', updated_days_to_finished,
    'updated_events_to_in_progress', updated_events_to_in_progress,
    'updated_events_to_finished', updated_events_to_finished
  );

  RETURN result;
END;
$$;

-- 2. Restringir y bloquear los permisos de ejecución para proteger la base de datos
REVOKE ALL ON FUNCTION public.auto_update_event_statuses() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_update_event_statuses() FROM anon;
REVOKE ALL ON FUNCTION public.auto_update_event_statuses() FROM authenticated;

-- Conceder permisos únicamente a roles de sistema y superusuario
GRANT EXECUTE ON FUNCTION public.auto_update_event_statuses() TO postgres;
GRANT EXECUTE ON FUNCTION public.auto_update_event_statuses() TO service_role;
