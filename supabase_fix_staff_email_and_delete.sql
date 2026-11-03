-- ====================================================================
-- SCRIPT DE MIGRACIÓN: Corrección para Cambio de Correo y Eliminación de Staff (V2 - Sin Recursión)
-- Resuelve: "infinite recursion detected in policy for relation profiles"
-- ====================================================================

-- 1. ELIMINAR CUALQUIER POLÍTICA RECURSIVA PREVIA EN 'public.profiles'
DROP POLICY IF EXISTS "Admins and producers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins and producers can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.profiles;

-- 2. FUNCIÓN DE COMPROBACIÓN CON 'SECURITY DEFINER'
-- Al ser SECURITY DEFINER, ejecuta con permisos de superusuario y NO activa el RLS de 'profiles', evitando cualquier recursión infinita
CREATE OR REPLACE FUNCTION public.is_admin_or_producer()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid;
  v_is_auth boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  IF auth.jwt()->>'email' = 'admin@laampolleta.tv' THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_uid
    AND (
      LOWER(COALESCE(role, '')) IN ('admin', 'superadmin', 'productor')
      OR LOWER(COALESCE(system_role, '')) IN ('admin', 'superadmin', 'productor')
    )
  ) INTO v_is_auth;

  RETURN COALESCE(v_is_auth, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_producer() TO authenticated;


-- 3. POLÍTICAS RLS LIMPIAS EN 'public.profiles'
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lectura para todos los usuarios autenticados
CREATE POLICY "Enable read access for all authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
);

-- Actualización: cada usuario puede editar su propio perfil, y Administradores/Productores pueden editar cualquier perfil
CREATE POLICY "Admins and producers can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id OR public.is_admin_or_producer()
)
WITH CHECK (
  auth.uid() = id OR public.is_admin_or_producer()
);

-- Eliminación: permitida únicamente a Administradores y Productores
CREATE POLICY "Admins and producers can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  public.is_admin_or_producer()
);

GRANT ALL ON TABLE public.profiles TO authenticated;


-- 4. TRIGGER 'notify_on_assignment_delete' PROTEGIDO
CREATE OR REPLACE FUNCTION public.notify_on_assignment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_exists boolean;
  user_exists boolean;
  event_name text;
  event_date date;
  event_status text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.events WHERE id = OLD.event_id
  ) INTO event_exists;

  IF NOT event_exists THEN
    RETURN OLD;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = OLD.staff_id
  ) INTO user_exists;

  IF NOT user_exists THEN
    RETURN OLD;
  END IF;

  SELECT name, date, status INTO event_name, event_date, event_status 
  FROM public.events 
  WHERE id = OLD.event_id;
  
  IF COALESCE(event_status, '') <> 'Cancelado' THEN
    BEGIN
      INSERT INTO public.notifications (user_id, title, description, type, priority, related_event_id)
      VALUES (
        OLD.staff_id,
        '🚫 Citación Removida',
        'Se ha cancelado tu asignación para el evento "' || COALESCE(event_name, 'Sin nombre') || '" del ' || to_char(COALESCE(event_date, now()::date), 'DD/MM/YYYY') || '.',
        'assignment_removed',
        'normal',
        OLD.event_id
      );
    EXCEPTION 
      WHEN foreign_key_violation THEN
        NULL;
      WHEN OTHERS THEN
        NULL;
    END;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_assignment_delete ON public.event_assignments;
CREATE TRIGGER trg_on_assignment_delete
  AFTER DELETE ON public.event_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_assignment_delete();


-- 5. CASCADE EN NOTIFICATIONS (user_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_user_id_fkey' 
      AND table_name = 'notifications'
  ) THEN
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_user_id_fkey;
  END IF;
  
  ALTER TABLE public.notifications 
    ADD CONSTRAINT notifications_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;


-- 6. SINCRONIZACIÓN DE CAMBIO DE CORREO 'profiles' -> 'auth.users'
CREATE OR REPLACE FUNCTION public.handle_profile_email_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email AND NEW.email IS NOT NULL THEN
    UPDATE auth.users
    SET email = NEW.email,
        email_confirmed_at = COALESCE(email_confirmed_at, pg_catalog.now())
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_profile_email_update ON public.profiles;
CREATE TRIGGER trg_on_profile_email_update
  AFTER UPDATE OF email ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_email_update();


-- 7. LIBERAR CORREO EN 'auth.users' SI SE BORRA EN 'profiles'
CREATE OR REPLACE FUNCTION public.handle_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = OLD.id;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_profile_delete ON public.profiles;
CREATE TRIGGER trg_on_profile_delete
  AFTER DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_profile_delete();
