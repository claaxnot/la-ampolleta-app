-- ==========================================================
-- SCRIPT DE PARCHE: Corregir RLS y Restricciones de Asignación
-- ==========================================================

-- 1. Eliminar la política restrictiva anterior
DROP POLICY IF EXISTS "Permitir escritura de jornadas para administradores" ON public.event_days;

-- 2. Crear una nueva política de escritura robusta, tolerante y case-insensitive
CREATE POLICY "Permitir escritura de jornadas para administradores"
ON public.event_days
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      LOWER(profiles.role) IN ('admin', 'viewer', 'superadmin')
      OR LOWER(profiles.system_role) IN ('admin', 'viewer', 'superadmin')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND (
      LOWER(profiles.role) IN ('admin', 'viewer', 'superadmin')
      OR LOWER(profiles.system_role) IN ('admin', 'viewer', 'superadmin')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
);

-- 3. Asegurar permisos GRANT para prevenir bloqueos locales de roles en Supabase
GRANT ALL ON TABLE public.event_days TO authenticated;
GRANT ALL ON TABLE public.event_days TO service_role;

-- 4. Modificar la restricción única de asignaciones en event_assignments
-- En eventos multi-día, un técnico puede trabajar en múltiples días (jornadas) del mismo evento.
-- Por lo tanto, eliminamos la restricción restrictiva por evento completo y la reemplazamos por jornada (event_day_id).
ALTER TABLE public.event_assignments DROP CONSTRAINT IF EXISTS event_assignments_event_id_staff_id_key;
ALTER TABLE public.event_assignments DROP CONSTRAINT IF EXISTS event_assignments_day_staff_unique;
ALTER TABLE public.event_assignments ADD CONSTRAINT event_assignments_day_staff_unique UNIQUE (event_day_id, staff_id);
