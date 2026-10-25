-- ==========================================================
-- SCRIPT DE MIGRACIÓN: Habilitar Permisos RLS para Rol 'Productor'
-- ==========================================================

-- 1. Actualizar RLS en 'event_days' para permitir que productores guarden jornadas
ALTER TABLE public.event_days ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir escritura de jornadas para administradores" ON public.event_days;
DROP POLICY IF EXISTS "Permitir escritura de jornadas para administradores y productores" ON public.event_days;

CREATE POLICY "Permitir escritura de jornadas para administradores y productores"
ON public.event_days
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      LOWER(profiles.role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR LOWER(profiles.system_role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      LOWER(profiles.role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR LOWER(profiles.system_role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
);

-- 2. Asegurar que 'event_assignments' permita asignar personal a productores
ALTER TABLE public.event_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir escritura de asignaciones para administradores y productores" ON public.event_assignments;
DROP POLICY IF EXISTS "Permitir lectura de asignaciones para autenticados" ON public.event_assignments;

CREATE POLICY "Permitir lectura de asignaciones para autenticados"
ON public.event_assignments
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir escritura de asignaciones para administradores y productores"
ON public.event_assignments
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      LOWER(profiles.role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR LOWER(profiles.system_role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      LOWER(profiles.role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR LOWER(profiles.system_role) IN ('admin', 'viewer', 'superadmin', 'productor')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
);

-- 3. Actualizar RLS en 'event_attendance_logs' para que productores puedan gestionar asistencia
ALTER TABLE public.event_attendance_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can view all attendance logs" ON public.event_attendance_logs;
DROP POLICY IF EXISTS "Admins and producers can view all attendance logs" ON public.event_attendance_logs;

CREATE POLICY "Admins and producers can view all attendance logs"
ON public.event_attendance_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (
      LOWER(system_role) IN ('admin', 'productor') 
      OR LOWER(role) IN ('admin', 'supervisor', 'coordinador', 'productor')
    )
  )
);

DROP POLICY IF EXISTS "Admins can update attendance logs for corrections" ON public.event_attendance_logs;
DROP POLICY IF EXISTS "Admins and producers can update attendance logs for corrections" ON public.event_attendance_logs;

CREATE POLICY "Admins and producers can update attendance logs for corrections"
ON public.event_attendance_logs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (
      LOWER(system_role) IN ('admin', 'productor') 
      OR LOWER(role) IN ('admin', 'supervisor', 'coordinador', 'productor')
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (
      LOWER(system_role) IN ('admin', 'productor') 
      OR LOWER(role) IN ('admin', 'supervisor', 'coordinador', 'productor')
    )
  )
);

DROP POLICY IF EXISTS "Admins can insert attendance logs for manual registrations" ON public.event_attendance_logs;
DROP POLICY IF EXISTS "Admins and producers can insert attendance logs for manual registrations" ON public.event_attendance_logs;

CREATE POLICY "Admins and producers can insert attendance logs for manual registrations"
ON public.event_attendance_logs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (
      LOWER(system_role) IN ('admin', 'productor') 
      OR LOWER(role) IN ('admin', 'supervisor', 'coordinador', 'productor')
    )
  )
);

-- 4. Actualizar RLS en 'notifications' para que productores puedan emitir avisos de asignación
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins and producers can insert notifications" ON public.notifications;

CREATE POLICY "Admins and producers can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND (
        LOWER(system_role) IN ('admin', 'productor')
        OR LOWER(role) IN ('admin', 'supervisor', 'coordinador', 'productor')
      )
  )
);

-- 5. Asegurar permisos explícitos GRANT a usuarios autenticados
GRANT ALL ON TABLE public.event_days TO authenticated;
GRANT ALL ON TABLE public.event_assignments TO authenticated;
GRANT ALL ON TABLE public.event_attendance_logs TO authenticated;
GRANT ALL ON TABLE public.notifications TO authenticated;
