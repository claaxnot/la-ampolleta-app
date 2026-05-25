-- ====================================================================
-- MIGRACIÓN DE SUPABASE: VALIDACIÓN GPS EN CONTROL DE ASISTENCIA
-- Ejecuta este script completo en el Editor SQL de Supabase
-- ====================================================================

-- 1. Agregar columnas a public.events
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS latitude NUMERIC NULL,
ADD COLUMN IF NOT EXISTS longitude NUMERIC NULL,
ADD COLUMN IF NOT EXISTS allowed_radius_meters INTEGER DEFAULT 300 NOT NULL;

-- 2. Agregar columnas a public.event_attendance_logs
ALTER TABLE public.event_attendance_logs
ADD COLUMN IF NOT EXISTS check_in_lat NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_in_lng NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_in_accuracy NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_in_distance_meters NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_in_location_status TEXT NULL,
ADD COLUMN IF NOT EXISTS check_out_lat NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_out_lng NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_out_accuracy NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_out_distance_meters NUMERIC NULL,
ADD COLUMN IF NOT EXISTS check_out_location_status TEXT NULL;

-- 3. Re-crear Función 1: Registrar Entrada (Check-In) con GPS
CREATE OR REPLACE FUNCTION public.mark_event_check_in(
  p_event_id UUID, 
  p_assignment_id UUID,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL
)
RETURNS public.event_attendance_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_control_enabled BOOLEAN;
  v_require_confirmed BOOLEAN;
  v_assigned_status VARCHAR(50);
  v_log public.event_attendance_logs;
  
  v_event_lat NUMERIC;
  v_event_lng NUMERIC;
  v_radius INTEGER;
  v_distance NUMERIC;
  v_status TEXT;
BEGIN
  -- 1. Validar autenticación
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado. Debe iniciar sesión en el portal.';
  END IF;

  -- 2. Validar que el evento existe y tiene habilitado el control de asistencia
  SELECT attendance_control_enabled, attendance_require_confirmed, latitude, longitude, allowed_radius_meters
  INTO v_control_enabled, v_require_confirmed, v_event_lat, v_event_lng, v_radius
  FROM public.events
  WHERE id = p_event_id;

  IF v_control_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'El control de asistencia no está habilitado para este evento.';
  END IF;

  -- 3. Obtener el estado de la asignación de la trabajadora
  SELECT status INTO v_assigned_status
  FROM public.event_assignments
  WHERE id = p_assignment_id AND event_id = p_event_id AND staff_id = v_user_id;

  IF v_assigned_status IS NULL THEN
    RAISE EXCEPTION 'No tienes una asignación activa para este evento.';
  END IF;

  -- 4. Validar estado de la asignación según configuración
  IF v_require_confirmed IS TRUE THEN
    IF v_assigned_status NOT IN ('Confirmado', 'Aceptado') THEN
      RAISE EXCEPTION 'No tienes una asignación confirmada para este evento.';
    END IF;
  ELSE
    IF v_assigned_status NOT IN ('Confirmado', 'Aceptado', 'Pendiente') THEN
      RAISE EXCEPTION 'No tienes una asignación activa o pendiente válida para este evento.';
    END IF;
  END IF;

  -- 5. Validar si ya marcó entrada antes
  IF EXISTS (
    SELECT 1 FROM public.event_attendance_logs
    WHERE event_id = p_event_id AND worker_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Ya has registrado tu entrada para este evento.';
  END IF;

  -- 6. Calcular geolocalización y distancia (Haversine estable)
  IF v_event_lat IS NULL OR v_event_lng IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN
    v_distance := NULL;
    v_status := 'unavailable';
  ELSE
    v_distance := 2 * 6371000 * pg_catalog.asin(pg_catalog.sqrt(
      pg_catalog.sin(pg_catalog.radians(p_lat - v_event_lat) / 2) ^ 2 +
      pg_catalog.cos(pg_catalog.radians(v_event_lat)) * pg_catalog.cos(pg_catalog.radians(p_lat)) * pg_catalog.sin(pg_catalog.radians(p_lng - v_event_lng) / 2) ^ 2
    ));

    IF p_accuracy > 100 THEN
      v_status := 'approximate';
    ELSIF v_distance <= v_radius THEN
      v_status := 'verified';
    ELSE
      v_status := 'out_of_range';
    END IF;
  END IF;

  -- 7. Insertar log de entrada con la hora exacta del servidor en UTC
  INSERT INTO public.event_attendance_logs (
    event_id,
    worker_id,
    assignment_id,
    check_in_at,
    check_in_source,
    is_complete,
    total_duration_minutes,
    check_in_lat,
    check_in_lng,
    check_in_accuracy,
    check_in_distance_meters,
    check_in_location_status
  ) VALUES (
    p_event_id,
    v_user_id,
    p_assignment_id,
    pg_catalog.now() AT TIME ZONE 'UTC',
    'worker_portal',
    FALSE,
    0,
    p_lat,
    p_lng,
    p_accuracy,
    v_distance,
    v_status
  )
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$;

-- 4. Re-crear Función 2: Registrar Salida (Check-Out) con GPS
CREATE OR REPLACE FUNCTION public.mark_event_check_out(
  p_event_id UUID, 
  p_assignment_id UUID,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  p_accuracy NUMERIC DEFAULT NULL
)
RETURNS public.event_attendance_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_control_enabled BOOLEAN;
  v_assigned_status VARCHAR(50);
  v_log public.event_attendance_logs;
  v_duration_mins INTEGER;
  
  v_event_lat NUMERIC;
  v_event_lng NUMERIC;
  v_radius INTEGER;
  v_distance NUMERIC;
  v_status TEXT;
BEGIN
  -- 1. Validar autenticación
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado. Debe iniciar sesión en el portal.';
  END IF;

  -- 2. Validar que el evento tiene habilitado el control de asistencia
  SELECT attendance_control_enabled, latitude, longitude, allowed_radius_meters
  INTO v_control_enabled, v_event_lat, v_event_lng, v_radius
  FROM public.events
  WHERE id = p_event_id;

  IF v_control_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'El control de asistencia no está habilitado para este evento.';
  END IF;

  -- 3. Validar asignación
  SELECT status INTO v_assigned_status
  FROM public.event_assignments
  WHERE id = p_assignment_id AND event_id = p_event_id AND staff_id = v_user_id;

  IF v_assigned_status IS NULL THEN
    RAISE EXCEPTION 'No tienes una asignación activa para este evento.';
  END IF;

  -- 4. Validar que exista un registro de entrada previo
  SELECT * INTO v_log
  FROM public.event_attendance_logs
  WHERE event_id = p_event_id AND worker_id = v_user_id;

  IF v_log.id IS NULL THEN
    RAISE EXCEPTION 'Debes registrar tu entrada antes de marcar la salida.';
  END IF;

  -- 5. Validar que no haya registrado la salida ya
  IF v_log.check_out_at IS NOT NULL THEN
    RAISE EXCEPTION 'Ya has registrado tu salida para este evento.';
  END IF;

  -- 6. Calcular duración en minutos utilizando now() del servidor
  v_duration_mins := EXTRACT(EPOCH FROM (pg_catalog.now() AT TIME ZONE 'UTC' - v_log.check_in_at)) / 60;
  IF v_duration_mins < 0 THEN
    v_duration_mins := 0;
  END IF;

  -- 7. Calcular geolocalización y distancia (Haversine estable)
  IF v_event_lat IS NULL OR v_event_lng IS NULL OR p_lat IS NULL OR p_lng IS NULL THEN
    v_distance := NULL;
    v_status := 'unavailable';
  ELSE
    v_distance := 2 * 6371000 * pg_catalog.asin(pg_catalog.sqrt(
      pg_catalog.sin(pg_catalog.radians(p_lat - v_event_lat) / 2) ^ 2 +
      pg_catalog.cos(pg_catalog.radians(v_event_lat)) * pg_catalog.cos(pg_catalog.radians(p_lat)) * pg_catalog.sin(pg_catalog.radians(p_lng - v_event_lng) / 2) ^ 2
    ));

    IF p_accuracy > 100 THEN
      v_status := 'approximate';
    ELSIF v_distance <= v_radius THEN
      v_status := 'verified';
    ELSE
      v_status := 'out_of_range';
    END IF;
  END IF;

  -- 8. Actualizar registro con la hora exacta de salida en UTC y datos GPS
  UPDATE public.event_attendance_logs
  SET
    check_out_at = pg_catalog.now() AT TIME ZONE 'UTC',
    check_out_source = 'worker_portal',
    is_complete = TRUE,
    total_duration_minutes = v_duration_mins,
    updated_at = pg_catalog.now() AT TIME ZONE 'UTC',
    check_out_lat = p_lat,
    check_out_lng = p_lng,
    check_out_accuracy = p_accuracy,
    check_out_distance_meters = v_distance,
    check_out_location_status = v_status
  WHERE id = v_log.id
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$;

-- 5. Privilegios de PostgREST
REVOKE ALL ON FUNCTION public.mark_event_check_in(UUID, UUID, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_event_check_in(UUID, UUID, NUMERIC, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_event_check_in(UUID, UUID, NUMERIC, NUMERIC, NUMERIC) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_event_check_out(UUID, UUID, NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_event_check_out(UUID, UUID, NUMERIC, NUMERIC, NUMERIC) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_event_check_out(UUID, UUID, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
