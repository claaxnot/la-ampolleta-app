-- =========================================================================
-- MIGRACIÓN: Sistema de Registro y Aprobación de Anfitrionas / Staff
-- La Ampolleta Producciones
-- =========================================================================

-- 1. Asegurar columna 'phone' en public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Función pública y segura para verificar si un RUT ya está registrado
-- (SECURITY DEFINER para consultar sin exponer datos personales al exterior)
CREATE OR REPLACE FUNCTION public.check_rut_exists(p_rut text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clean_rut text;
  v_exists boolean;
BEGIN
  IF p_rut IS NULL OR LENGTH(TRIM(p_rut)) = 0 THEN
    RETURN false;
  END IF;

  v_clean_rut := LOWER(REGEXP_REPLACE(p_rut, '[^0-9kK]', '', 'g'));

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE LOWER(REGEXP_REPLACE(COALESCE(rut, ''), '[^0-9kK]', '', 'g')) = v_clean_rut
  ) INTO v_exists;

  RETURN COALESCE(v_exists, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rut_exists(text) TO anon, authenticated;


-- 3. Actualizar función handle_new_user() para capturar metadatos del registro
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name text;
  v_role text;
  v_system_role text;
  v_status text;
  v_rut text;
  v_phone text;
  v_avatar_url text;
  v_cuenta_destino text;
  v_codigo_banco text;
  v_glosa text;
BEGIN
  v_name := coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
  v_role := coalesce(new.raw_user_meta_data->>'role', 'Anfitriona');
  v_system_role := coalesce(new.raw_user_meta_data->>'system_role', 'worker');
  v_status := coalesce(new.raw_user_meta_data->>'status', 'Pendiente');
  v_rut := new.raw_user_meta_data->>'rut';
  v_phone := new.raw_user_meta_data->>'phone';
  v_avatar_url := new.raw_user_meta_data->>'avatar_url';
  v_cuenta_destino := new.raw_user_meta_data->>'cuenta_destino';
  v_codigo_banco := new.raw_user_meta_data->>'codigo_banco_destino';
  v_glosa := new.raw_user_meta_data->>'glosa_transferencia';

  INSERT INTO public.profiles (
    id, email, name, role, system_role, status, email_confirmed,
    rut, phone, avatar_url, cuenta_destino, codigo_banco_destino, glosa_transferencia
  )
  VALUES (
    new.id,
    new.email,
    v_name,
    v_role,
    v_system_role,
    v_status,
    (new.email_confirmed_at IS NOT NULL),
    v_rut,
    v_phone,
    v_avatar_url,
    v_cuenta_destino,
    v_codigo_banco,
    v_glosa
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    system_role = EXCLUDED.system_role,
    status = EXCLUDED.status,
    rut = COALESCE(EXCLUDED.rut, public.profiles.rut),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    cuenta_destino = COALESCE(EXCLUDED.cuenta_destino, public.profiles.cuenta_destino),
    codigo_banco_destino = COALESCE(EXCLUDED.codigo_banco_destino, public.profiles.codigo_banco_destino),
    glosa_transferencia = COALESCE(EXCLUDED.glosa_transferencia, public.profiles.glosa_transferencia);

  RETURN new;
END;
$$;


-- 4. Modificar sync_user_confirmation para NO pasar de 'Pendiente' a 'Activo' sin aprobación administrativa
CREATE OR REPLACE FUNCTION public.sync_user_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL AND old.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET email_confirmed = true,
        status = CASE WHEN status = 'Pendiente' THEN 'Pendiente' ELSE 'Activo' END
    WHERE id = new.id;
  END IF;
  RETURN new;
END;
$$;


-- 5. Crear notificación automática para los administradores cuando se registra una nueva anfitriona
CREATE OR REPLACE FUNCTION public.notify_admin_on_new_hostess_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  IF NEW.status = 'Pendiente' THEN
    -- Insertar notificación para todos los administradores y productores
    FOR v_admin_id IN 
      SELECT id FROM public.profiles 
      WHERE (LOWER(role) IN ('admin', 'superadmin', 'productor') OR LOWER(system_role) IN ('admin', 'superadmin', 'productor'))
         OR email = 'admin@laampolleta.tv'
    LOOP
      INSERT INTO public.notifications (user_id, title, description, type, created_at)
      VALUES (
        v_admin_id,
        '🔔 Nueva Postulación de Staff',
        'Se ha registrado ' || COALESCE(NEW.name, 'una nueva postulante') || ' (' || COALESCE(NEW.role, 'Anfitriona') || '). Revisa la pestaña de Pendientes en Staff para aprobar o rechazar.',
        'info',
        NOW()
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_new_hostess ON public.profiles;
CREATE TRIGGER trg_notify_on_new_hostess
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_new_hostess_registration();
