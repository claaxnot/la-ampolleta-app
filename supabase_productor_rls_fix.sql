-- ==========================================================
-- SCRIPT DE MIGRACIÓN: Habilitar Permisos RLS para Rol 'Productor'
-- ==========================================================
-- Este script otorga permisos de escritura en Supabase al nuevo rol 'productor'
-- en las tablas: event_days, event_assignments, event_attendance_logs, notifications y events.

-- 1. Actualizar RLS en 'event_days' para permitir que productores guarden jornadas
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

-- 2. Asegurar que 'event_assignments' permita crear/editar asignaciones de staff a productores
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.id = c.relnamespace
    WHERE c.relname = 'event_assignments' AND n.nspname = 'public' AND c.relrowsecurity = true
  ) THEN
    DROP POLICY IF EXISTS "Permitir escritura de asignaciones para administradores y productores" ON public.event_assignments;
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
        )
      )
    );
  END IF;
END $$;

-- 3. Actualizar RLS en 'event_attendance_logs' para que productores puedan gestionar y confirmar asistencia
DROP POLICY IF EXISTS "Admins can view all attendance logs" ON public.event_attendance_logs;
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
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
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
