-- ====================================================================
-- PARCHE DE SEGURIDAD SUPABASE: public.handle_new_user()
-- Ejecuta este script completo en el Editor SQL de Supabase
-- ====================================================================

-- 1. Re-crear la función con hardening de seguridad
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Insertar en la tabla profiles especificando el esquema público explícitamente
  INSERT INTO public.profiles (id, email, name, role, system_role, status, email_confirmed)
  VALUES (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', new.email),
    'worker',
    'worker',
    'Activo',
    (new.email_confirmed_at IS NOT NULL)
  );
  RETURN new;
END;
$$;

-- 2. Asegurar que el trigger exista y esté correctamente enlazado
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Revocar privilegios de ejecución a roles públicos y anónimos (PostgREST RPC block)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
