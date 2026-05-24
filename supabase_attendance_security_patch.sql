-- ====================================================================
-- PARCHE DE SEGURIDAD SUPABASE: Asistencia (Check-In & Check-Out)
-- Ejecuta este script completo en el Editor SQL de Supabase
-- ====================================================================

-- 1. Re-crear Función 1: Registrar Entrada (Check-In)
CREATE OR REPLACE FUNCTION public.mark_event_check_in(p_event_id UUID, p_assignment_id UUID)
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
BEGIN
  -- 1. Validar autenticación
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado. Debe iniciar sesión en el portal.';
  END IF;

  -- 2. Validar que el evento existe y tiene habilitado el control de asistencia
  SELECT attendance_control_enabled, attendance_require_confirmed 
  INTO v_control_enabled, v_require_confirmed
  FROM public.events
  WHERE id = p_event_id;

  IF v_control_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'El control de asistencia no está habilitado para este evento.';
  END IF;

  -- 3. Obtener el estado de la asignación de la trabajadora (Filtro estricto por v_user_id)
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

  -- 6. Insertar log de entrada con la hora exacta del servidor en UTC
  INSERT INTO public.event_attendance_logs (
    event_id,
    worker_id,
    assignment_id,
    check_in_at,
    check_in_source,
    is_complete,
    total_duration_minutes
  ) VALUES (
    p_event_id,
    v_user_id,
    p_assignment_id,
    pg_catalog.now() AT TIME ZONE 'UTC',
    'worker_portal',
    FALSE,
    0
  )
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$;

-- 2. Re-crear Función 2: Registrar Salida (Check-Out)
CREATE OR REPLACE FUNCTION public.mark_event_check_out(p_event_id UUID, p_assignment_id UUID)
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
BEGIN
  -- 1. Validar autenticación
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado. Debe iniciar sesión en el portal.';
  END IF;

  -- 2. Validar que el evento tiene habilitado el control de asistencia
  SELECT attendance_control_enabled INTO v_control_enabled
  FROM public.events
  WHERE id = p_event_id;

  IF v_control_enabled IS NOT TRUE THEN
    RAISE EXCEPTION 'El control de asistencia no está habilitado para este evento.';
  END IF;

  -- 3. Validar asignación (Filtro estricto por v_user_id)
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

  -- 7. Actualizar registro con la hora exacta de salida en UTC
  UPDATE public.event_attendance_logs
  SET
    check_out_at = pg_catalog.now() AT TIME ZONE 'UTC',
    check_out_source = 'worker_portal',
    is_complete = TRUE,
    total_duration_minutes = v_duration_mins,
    updated_at = pg_catalog.now() AT TIME ZONE 'UTC'
  WHERE id = v_log.id
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$;

-- 3. Asegurar los privilegios de ejecución estrictos para PostgREST
REVOKE ALL ON FUNCTION public.mark_event_check_in(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_event_check_in(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_event_check_in(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_event_check_out(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_event_check_out(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_event_check_out(UUID, UUID) TO authenticated;
