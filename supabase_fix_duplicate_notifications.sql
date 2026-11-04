-- =========================================================================
-- Corrección: Evitar notificaciones duplicadas en registro de staff / postulaciones
-- =========================================================================

-- 1. Eliminar trigger secundario duplicado
DROP TRIGGER IF EXISTS trg_notify_on_new_hostess ON public.profiles;
DROP FUNCTION IF EXISTS public.notify_admin_on_new_hostess_registration();

-- 2. Actualizar función unificada notify_on_new_staff
CREATE OR REPLACE FUNCTION public.notify_on_new_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_record record;
BEGIN
  IF NEW.status = 'Pendiente' THEN
    -- Postulación pública pendiente de aprobación
    FOR admin_record IN 
      SELECT id FROM public.profiles 
      WHERE (LOWER(role) IN ('admin', 'superadmin', 'supervisor', 'coordinador', 'productor')
         OR LOWER(system_role) IN ('admin', 'superadmin', 'productor'))
         OR email = 'admin@laampolleta.tv'
    LOOP
      INSERT INTO public.notifications (user_id, title, description, type, created_at)
      VALUES (
        admin_record.id,
        '🔔 Nueva Postulación de Staff',
        'Se ha registrado ' || COALESCE(NEW.name, 'una nueva postulante') || ' (' || COALESCE(NEW.role, 'Anfitriona') || '). Revisa la pestaña de Pendientes en Staff para aprobar o rechazar.',
        'info',
        NOW()
      );
    END LOOP;
  ELSE
    -- Creación manual directa por el administrador (personal activo)
    FOR admin_record IN 
      SELECT id FROM public.profiles 
      WHERE (LOWER(role) IN ('admin', 'superadmin', 'supervisor', 'coordinador', 'productor')
         OR LOWER(system_role) IN ('admin', 'superadmin', 'productor'))
         OR email = 'admin@laampolleta.tv'
    LOOP
      INSERT INTO public.notifications (user_id, title, description, type, created_at)
      VALUES (
        admin_record.id,
        '👤 Nuevo Personal Registrado',
        'Se ha registrado un nuevo miembro del staff: ' || NEW.name || ' (' || COALESCE(NEW.role, 'Sin rol') || ').',
        'success',
        NOW()
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_new_staff ON public.profiles;
CREATE TRIGGER trg_on_new_staff
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_staff();
