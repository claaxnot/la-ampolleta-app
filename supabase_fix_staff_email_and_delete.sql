-- ====================================================================
-- SCRIPT DE MIGRACIÓN: Corrección para Cambio de Correo y Eliminación de Staff
-- Resuelve: Error violates foreign key constraint "notifications_user_id_fkey"
-- Permite: Edición directa del correo y eliminación limpia de funcionarios
-- ====================================================================

-- 1. CORREGIR EL TRIGGER 'notify_on_assignment_delete'
-- Evita que al eliminar un funcionario o sus asignaciones se intente insertar una notificación para un usuario que ya no existe
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
  -- Verificar si el evento aún existe (evita errores en borrados en cascada)
  SELECT EXISTS(
    SELECT 1 FROM public.events WHERE id = OLD.event_id
  ) INTO event_exists;

  IF NOT event_exists THEN
    RETURN OLD;
  END IF;

  -- Verificar si el usuario aún existe en profiles (evita fallos si el funcionario fue eliminado)
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE id = OLD.staff_id
  ) INTO user_exists;

  IF NOT user_exists THEN
    RETURN OLD;
  END IF;

  SELECT name, date, status INTO event_name, event_date, event_status 
  FROM public.events 
  WHERE id = OLD.event_id;
  
  -- Solo notificar si el evento no está cancelado
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


-- 2. ASEGURAR QUE 'notifications' TENGA 'ON DELETE CASCADE' EN user_id
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


-- 3. SINCRONIZAR AUTOMÁTICAMENTE EL CAMBIO DE CORREO DE 'profiles' HACIA 'auth.users'
-- Cuando un admin o productor edita el correo de un funcionario en la app, se actualiza también su login de acceso
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


-- 4. LIMPIAR LA CUENTA EN 'auth.users' SI SE ELIMINA EL PERFIL DE 'profiles'
-- Libera el correo y el RUT para que puedan volver a registrarse si fue eliminado
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


-- 5. POLÍTICAS RLS EN 'public.profiles' PARA ADMINISTRADORES Y PRODUCTORES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Lectura para todos los autenticados
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.profiles;
CREATE POLICY "Enable read access for all authenticated users"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  (SELECT auth.uid()) IS NOT NULL
);

-- Actualización para uno mismo, Administradores y Productores
DROP POLICY IF EXISTS "Admins and producers can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can update profiles" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.profiles;

CREATE POLICY "Admins and producers can update profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      LOWER(p.role) IN ('admin', 'superadmin', 'productor')
      OR LOWER(p.system_role) IN ('admin', 'superadmin', 'productor')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
)
WITH CHECK (
  auth.uid() = id
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      LOWER(p.role) IN ('admin', 'superadmin', 'productor')
      OR LOWER(p.system_role) IN ('admin', 'superadmin', 'productor')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
);

-- Eliminación permitida para Administradores y Productores
DROP POLICY IF EXISTS "Admins and producers can delete profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;

CREATE POLICY "Admins and producers can delete profiles"
ON public.profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND (
      LOWER(p.role) IN ('admin', 'superadmin', 'productor')
      OR LOWER(p.system_role) IN ('admin', 'superadmin', 'productor')
      OR auth.jwt()->>'email' = 'admin@laampolleta.tv'
    )
  )
);

-- Otorgar permisos GRANT a authenticated
GRANT ALL ON TABLE public.profiles TO authenticated;
