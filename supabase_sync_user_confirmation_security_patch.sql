-- ====================================================================
-- PARCHE DE SEGURIDAD SUPABASE: public.sync_user_confirmation()
-- Ejecuta este script completo en el Editor SQL de Supabase
-- ====================================================================

-- 1. Re-crear la función con hardening de seguridad y SET search_path restrictivo
CREATE OR REPLACE FUNCTION public.sync_user_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Actualizar la confirmación en public.profiles al activarse el correo
  IF new.email_confirmed_at IS NOT NULL AND old.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET status = 'Activo',
        email_confirmed = true
    WHERE id = new.id;
  END IF;
  RETURN new;
END;
$$;

-- 2. Asegurar que el trigger de Supabase Auth esté correctamente enlazado
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_confirmation();

-- 3. Revocar privilegios de ejecución a roles públicos y de PostgREST
REVOKE EXECUTE ON FUNCTION public.sync_user_confirmation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_user_confirmation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_user_confirmation() FROM authenticated;
