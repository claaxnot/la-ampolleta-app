-- ====================================================================
-- PARCHE DE RENDIMIENTO SUPABASE: Optimización RLS en public.profiles
-- Ejecuta este script completo en el Editor SQL de Supabase
-- ====================================================================

-- 1. Eliminar la política anterior ineficiente
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.profiles;

-- 2. Crear la nueva versión de alto rendimiento con InitPlan de Postgres
CREATE POLICY "Enable read access for all authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
);
