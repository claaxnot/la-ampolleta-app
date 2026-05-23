-- =====================================================================
-- MIGRACIÓN DE SUPABASE: SISTEMA DE CONTROL DE INGRESO Y SALIDA (ASISTENCIA)
-- =====================================================================

-- 1. Agregar columnas de habilitación en tabla events si no existen
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS attendance_control_enabled BOOLEAN DEFAULT FALSE NOT NULL;

-- Ajuste 1: Flag configurable para exigir asignación confirmada (por defecto TRUE)
ALTER TABLE public.events
ADD COLUMN IF NOT EXISTS attendance_require_confirmed BOOLEAN DEFAULT TRUE NOT NULL;

-- 2. Crear tabla de logs de asistencia
CREATE TABLE IF NOT EXISTS public.event_attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.event_assignments(id) ON DELETE CASCADE,
    check_in_at TIMESTAMP WITH TIME ZONE,
    check_out_at TIMESTAMP WITH TIME ZONE,
    check_in_source TEXT DEFAULT 'worker_portal' NOT NULL,
    check_out_source TEXT DEFAULT 'worker_portal' NOT NULL,
    check_in_note TEXT,
    check_out_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ajuste 2: Campos de auditoría y corrección administrativa manual
    verified_by_admin BOOLEAN DEFAULT FALSE NOT NULL,
    admin_adjusted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    admin_adjustment_notes TEXT,
    original_check_in_at TIMESTAMP WITH TIME ZONE,
    original_check_out_at TIMESTAMP WITH TIME ZONE,
    
    -- Ajuste 3: Campos financieros y métricas de jornada
    is_complete BOOLEAN DEFAULT FALSE NOT NULL,
    total_duration_minutes INTEGER DEFAULT 0 NOT NULL,
    
    -- Restricción única: un registro por trabajador por evento
    CONSTRAINT event_attendance_logs_worker_event_unique UNIQUE (event_id, worker_id)
);

-- 3. Habilitar RLS (Row Level Security)
ALTER TABLE public.event_attendance_logs ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas existentes (evita duplicados al re-ejecutar)
DROP POLICY IF EXISTS "Workers can view own attendance logs" ON public.event_attendance_logs;
DROP POLICY IF EXISTS "Admins can view all attendance logs" ON public.event_attendance_logs;
DROP POLICY IF EXISTS "Admins can update attendance logs for corrections" ON public.event_attendance_logs;

-- 5. Crear políticas de visualización (SELECT)
-- A. Trabajadores ven solo su propia asistencia
CREATE POLICY "Workers can view own attendance logs"
ON public.event_attendance_logs
FOR SELECT
TO authenticated
USING (auth.uid() = worker_id);

-- B. Admins, Supervisores y Coordinadores ven toda la asistencia
CREATE POLICY "Admins can view all attendance logs"
ON public.event_attendance_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
);

-- C. Ajuste 2: Admins/Supervisores/Coordinadores pueden actualizar para correcciones manuales
CREATE POLICY "Admins can update attendance logs for corrections"
ON public.event_attendance_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
);

-- Nota: No se definen políticas de INSERT directo desde frontend. 
-- Todo registro se realiza estrictamente a través de las RPC de base de datos seguras.


-- =====================================================================
-- FUNCIONES SEGURAS (RPC) - SECURITY DEFINER
-- =====================================================================

-- Función 1: Registrar Entrada (Check-In)
CREATE OR REPLACE FUNCTION public.mark_event_check_in(p_event_id UUID, p_assignment_id UUID)
RETURNS public.event_attendance_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
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

  -- 3. Obtener el estado de la asignación de la trabajadora
  SELECT status INTO v_assigned_status
  FROM public.event_assignments
  WHERE id = p_assignment_id AND event_id = p_event_id AND staff_id = v_user_id;

  IF v_assigned_status IS NULL THEN
    RAISE EXCEPTION 'No tienes una asignación activa para este evento.';
  END IF;

  -- 4. Ajuste 1: Validar estado de la asignación según configuración
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
    timezone('utc'::text, now()),
    'worker_portal',
    FALSE,
    0
  )
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$;

-- Función 2: Registrar Salida (Check-Out)
CREATE OR REPLACE FUNCTION public.mark_event_check_out(p_event_id UUID, p_assignment_id UUID)
RETURNS public.event_attendance_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
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

  -- 6. Ajuste 3: Calcular duración en minutos utilizando now() del servidor
  v_duration_mins := EXTRACT(EPOCH FROM (timezone('utc'::text, now()) - v_log.check_in_at)) / 60;
  IF v_duration_mins < 0 THEN
    v_duration_mins := 0;
  END IF;

  -- 7. Actualizar registro con la hora exacta de salida en UTC
  UPDATE public.event_attendance_logs
  SET
    check_out_at = timezone('utc'::text, now()),
    check_out_source = 'worker_portal',
    is_complete = TRUE,
    total_duration_minutes = v_duration_mins,
    updated_at = timezone('utc'::text, now())
  WHERE id = v_log.id
  RETURNING * INTO v_log;

  RETURN v_log;
END;
$$;


-- =====================================================================
-- ENDURECIMIENTO DE ACCESOS Y ROLES
-- =====================================================================

-- Revocar permisos de ejecución a accesos públicos y anónimos (Warning 0029)
REVOKE ALL ON FUNCTION public.mark_event_check_in(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_event_check_in(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_event_check_in(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_event_check_out(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_event_check_out(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_event_check_out(UUID, UUID) TO authenticated;
