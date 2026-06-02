-- ==========================================================
-- MIGRACIÓN DE SUPABASE: SISTEMA DE VIÁTICOS Y REEMBOLSOS
-- ==========================================================

-- 1. Crear tabla de solicitudes de gastos (Viáticos y Reembolsos)
CREATE TABLE IF NOT EXISTS public.expense_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
    expense_type VARCHAR(50) NOT NULL CHECK (expense_type IN ('Viático', 'Reembolso', 'Compra Operacional', 'Otro')),
    requested_amount NUMERIC NOT NULL CHECK (requested_amount > 0),
    approved_amount NUMERIC CHECK (approved_amount >= 0),
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    receipt_url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'En revisión', 'Aprobado', 'Rechazado', 'Pagado')),
    admin_comment TEXT,
    included_in_payroll BOOLEAN DEFAULT FALSE NOT NULL,
    payroll_batch_id UUID NULL,
    approved_by UUID REFERENCES public.profiles(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.expense_requests ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas existentes si las hay (evitar colisiones de re-ejecución)
DROP POLICY IF EXISTS "Workers can view own expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Workers can create own expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Admins can view all expense requests" ON public.expense_requests;
DROP POLICY IF EXISTS "Admins can update all expense requests" ON public.expense_requests;

-- 3. Crear Políticas de Acceso Seguro a Solicitudes:

-- A. Los trabajadores pueden ver solo sus propias solicitudes
CREATE POLICY "Workers can view own expense requests" 
ON public.expense_requests 
FOR SELECT 
USING (auth.uid() = worker_id);

-- B. Los trabajadores pueden crear sus propias solicitudes
CREATE POLICY "Workers can create own expense requests" 
ON public.expense_requests 
FOR INSERT 
WITH CHECK (auth.uid() = worker_id);

-- C. Los administradores pueden ver todas las solicitudes
CREATE POLICY "Admins can view all expense requests" 
ON public.expense_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
);

-- D. Los administradores pueden actualizar todas las solicitudes
CREATE POLICY "Admins can update all expense requests" 
ON public.expense_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
);


-- ==========================================================
-- 4. CONFIGURACIÓN DE SUPABASE STORAGE (BUCKET PRIVADO 'receipts')
-- ==========================================================

-- Registrar el bucket privado 'receipts' en la tabla de almacenamiento de Supabase
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES (
  'receipts', 
  'receipts', 
  false, -- false = privado, requiere Signed URLs temporales para ver
  5242880, -- Límite de 5MB por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] -- Tipos permitidos
)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas del bucket si ya existen
DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
DROP POLICY IF EXISTS "Owners can view own receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update all receipts" ON storage.objects;

-- A. Permitir a usuarios autenticados subir comprobantes bajo su propia subcarpeta ({worker_id})
CREATE POLICY "Authenticated users can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'receipts' AND 
  (auth.uid()::text = (storage.foldername(name))[1])
);

-- B. Permitir a los dueños ver sus propios comprobantes subidos
CREATE POLICY "Owners can view own receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  (auth.uid()::text = (storage.foldername(name))[1])
);

-- C. Permitir a los administradores ver todos los comprobantes del bucket 'receipts'
CREATE POLICY "Admins can view all receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
);

-- D. Permitir a los administradores actualizar/eliminar objetos del bucket 'receipts'
CREATE POLICY "Admins can update all receipts"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'receipts' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
)
WITH CHECK (
  bucket_id = 'receipts' AND 
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND (system_role = 'admin' OR role = 'Admin' OR role = 'Supervisor' OR role = 'Coordinador')
  )
);


-- ==========================================================
-- 5. ENDURECIMIENTO DE SEGURIDAD (HARDENING DE FUNCIONES PL/PGSQL)
-- Corrige la advertencia de seguridad: 0011_function_search_path_mutable
-- ==========================================================

-- A. Función handle_new_user (Trigger de Registro en auth.users)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
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

-- Trigger asociado en auth.users (si no existe)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Revocar privilegios de ejecución para evitar llamadas RPC maliciosas/anónimas
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;



-- B. Función sync_user_confirmation (Sincronización de activación de correo)
CREATE OR REPLACE FUNCTION public.sync_user_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL AND old.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET status = 'Activo',
        email_confirmed = true
    WHERE id = new.id;
  END IF;
  RETURN new;
END;
$$;

-- Trigger asociado en auth.users
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_confirmation();

-- Revocar privilegios de ejecución para evitar llamadas RPC públicas no autorizadas
REVOKE EXECUTE ON FUNCTION public.sync_user_confirmation() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_user_confirmation() FROM anon;
REVOKE EXECUTE ON FUNCTION public.sync_user_confirmation() FROM authenticated;



-- C. Función handle_updated_at (Auditoría automática de timestamps en UTC)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  new.updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now());
  RETURN new;
END;
$$;


-- D. Función update_updated_at_column (Auditoría automática heredada o por defecto en UTC)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  new.updated_at = pg_catalog.timezone('utc'::pg_catalog.text, pg_catalog.now());
  RETURN new;
END;
$$;


-- ==========================================================
-- E. REVOCACIÓN DE PRIVILEGIOS DE EJECUCIÓN (Mitigación Warning 0029)
-- Previene que usuarios autenticados o anónimos llamen a estas funciones vía API/RPC.
-- ==========================================================
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;


-- ==========================================================
-- 6. POLÍTICAS DE SEGURIDAD Y RLS PARA NOTIFICACIONES
-- Corrige la vulnerabilidad RLS: Anyone can insert notifications
-- ==========================================================

-- Habilitar RLS en public.notifications si no estuviese habilitado
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- A. Eliminar políticas permisivas existentes
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can select own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;

-- B. Crear políticas restrictivas y seguras
-- 1. Los usuarios comunes sólo pueden insertar notificaciones destinadas a sí mismos (ej: al marcar asistencia)
CREATE POLICY "Users can insert own notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  (select auth.uid()) = user_id
);

-- 2. Los administradores, supervisores y coordinadores pueden insertar notificaciones para cualquier destinatario (ej: al asignar eventos)
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (select auth.uid())
      AND (
        system_role = 'admin'
        OR role IN ('Admin', 'Supervisor', 'Coordinador')
      )
  )
);

-- 3. Los usuarios sólo pueden ver sus propias notificaciones
CREATE POLICY "Users can select own notifications"
ON public.notifications
FOR SELECT
TO authenticated
USING (
  (select auth.uid()) = user_id
);

-- 4. Los usuarios sólo pueden actualizar (ej: marcar como leída) sus propias notificaciones
CREATE POLICY "Users can update own notifications"
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  (select auth.uid()) = user_id
)
WITH CHECK (
  (select auth.uid()) = user_id
);


-- ==========================================================
-- V3.7.1 - FASE 2: EXTENSIÓN DEL MODELO DE DATOS DE NOTIFICACIONES
-- ==========================================================

-- Agregar campos avanzados para soporte operativo y futuro push
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS related_event_id UUID NULL REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS related_event_day_id UUID NULL,
  ADD COLUMN IF NOT EXISTS related_assignment_id UUID NULL REFERENCES public.event_assignments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS related_payment_id UUID NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NULL;

-- Índices optimizados para lecturas rápidas de notificaciones no leídas y purga
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread 
  ON public.notifications(user_id, read) 
  WHERE read = false;

CREATE INDEX IF NOT EXISTS idx_notifications_expires 
  ON public.notifications(expires_at) 
  WHERE expires_at IS NOT NULL;

-- ==========================================================
-- V3.7.1 - FASE 3: LIMPIEZA AUTOMÁTICA Y EXPIRACIÓN (48 HORAS)
-- ==========================================================

-- Trigger para fijar expiración automática a las 48 horas de ser leída
CREATE OR REPLACE FUNCTION public.trg_set_notification_expiration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.read = true AND OLD.read = false THEN
    NEW.read_at := pg_catalog.timezone('utc'::text, pg_catalog.now());
    -- Expira en 48 horas solo si es prioridad regular (low o normal)
    IF NEW.priority IN ('low', 'normal') THEN
      NEW.expires_at := NEW.read_at + INTERVAL '48 hours';
    ELSE
      NEW.expires_at := NULL; -- Alertas críticas o altas no expiran automáticamente
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_notification_read ON public.notifications;
CREATE TRIGGER on_notification_read
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_notification_expiration();

-- Función SQL para purgar las notificaciones expiradas (baja/normal prioridad)
CREATE OR REPLACE FUNCTION public.clean_read_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.notifications
  WHERE read = true
    AND expires_at IS NOT NULL
    AND expires_at < pg_catalog.timezone('utc'::text, pg_catalog.now())
    AND priority IN ('low', 'normal');
    
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Revocar permisos públicos para evitar invocaciones RPC maliciosas
REVOKE EXECUTE ON FUNCTION public.clean_read_notifications() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.clean_read_notifications() FROM anon;
REVOKE EXECUTE ON FUNCTION public.clean_read_notifications() FROM authenticated;


-- ==========================================================
-- V3.7.1 - FASE 7: TABLA PREPARATORIA DE SUSCRIPCIONES PUSH
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    provider VARCHAR(50) DEFAULT 'web-push' NOT NULL,
    platform VARCHAR(50) NULL,
    browser VARCHAR(50) NULL,
    device_label TEXT NULL,
    active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE NULL,
    CONSTRAINT unique_user_token UNIQUE (user_id, token)
);

-- Habilitar RLS en suscripciones push
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
ON public.push_subscriptions
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


-- ==========================================================
-- V3.7.1 - FASE 6: DISPARADORES AUTOMÁTICOS EN BASE DE DATOS (TRIGGERS)
-- ==========================================================

-- 1. Notificar a todos los administradores/supervisores cuando se crea un nuevo evento
CREATE OR REPLACE FUNCTION public.notify_on_new_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_record record;
BEGIN
  FOR admin_record IN 
    SELECT id FROM public.profiles 
    WHERE system_role = 'admin' 
       OR role IN ('Admin', 'Supervisor', 'Coordinador')
  LOOP
    INSERT INTO public.notifications (user_id, title, description, type, priority, related_event_id)
    VALUES (
      admin_record.id,
      '📅 Nuevo Evento Creado',
      'Se ha registrado el evento "' || NEW.name || '" programado para el ' || to_char(NEW.date, 'DD/MM/YYYY') || '.',
      'info',
      'normal',
      NEW.id
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_new_event ON public.events;
CREATE TRIGGER trg_on_new_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_event();


-- 2. Notificar a todos los administradores/supervisores cuando se registra nuevo staff
CREATE OR REPLACE FUNCTION public.notify_on_new_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_record record;
BEGIN
  FOR admin_record IN 
    SELECT id FROM public.profiles 
    WHERE system_role = 'admin' 
       OR role IN ('Admin', 'Supervisor', 'Coordinador')
  LOOP
    INSERT INTO public.notifications (user_id, title, description, type, priority)
    VALUES (
      admin_record.id,
      '👤 Nuevo Personal Registrado',
      'Se ha registrado un nuevo miembro del staff: ' || NEW.name || ' (' || COALESCE(NEW.role, 'Sin rol') || ').',
      'success',
      'normal'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_new_staff ON public.profiles;
CREATE TRIGGER trg_on_new_staff
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_staff();


-- 3. Notificar al trabajador cuando es asignado a un evento (Fórmula optimizada tipo 'event_assigned')
CREATE OR REPLACE FUNCTION public.notify_on_new_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_name text;
  event_date date;
BEGIN
  SELECT name, date INTO event_name, event_date 
  FROM public.events 
  WHERE id = NEW.event_id;
  
  INSERT INTO public.notifications (user_id, title, description, type, priority, related_event_id, related_assignment_id)
  VALUES (
    NEW.staff_id,
    '📅 Nuevo evento asignado',
    'Has sido convocado para participar en el evento "' || COALESCE(event_name, 'Sin nombre') || '" el ' || to_char(COALESCE(event_date, now()::date), 'DD/MM/YYYY') || '. Revisa los detalles en tu portal.',
    'event_assigned',
    'normal',
    NEW.event_id,
    NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_new_assignment ON public.event_assignments;
CREATE TRIGGER trg_on_new_assignment
  AFTER INSERT ON public.event_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_assignment();


-- 4. Notificar a los administradores cuando un trabajador acepta o rechaza una citación
CREATE OR REPLACE FUNCTION public.notify_on_assignment_status_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_record record;
  staff_name text;
  event_name text;
BEGIN
  IF NEW.status <> OLD.status AND NEW.status IN ('Confirmado', 'Rechazado') THEN
    SELECT name INTO staff_name FROM public.profiles WHERE id = NEW.staff_id;
    SELECT name INTO event_name FROM public.events WHERE id = NEW.event_id;
    
    FOR admin_record IN 
      SELECT id FROM public.profiles 
      WHERE system_role = 'admin' 
         OR role IN ('Admin', 'Supervisor', 'Coordinador')
    LOOP
      INSERT INTO public.notifications (user_id, title, description, type, priority, related_event_id, related_assignment_id)
      VALUES (
        admin_record.id,
        CASE WHEN NEW.status = 'Confirmado' THEN '✅ Asistencia Confirmada' ELSE '❌ Asignación Rechazada' END,
        COALESCE(staff_name, 'Un trabajador') || ' ha ' || CASE WHEN NEW.status = 'Confirmado' THEN 'CONFIRMADO' ELSE 'RECHAZADO' END || ' su asistencia para "' || COALESCE(event_name, 'el evento') || '".',
        CASE WHEN NEW.status = 'Confirmado' THEN 'success' ELSE 'danger' END,
        'normal',
        NEW.event_id,
        NEW.id
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_assignment_status_update ON public.event_assignments;
CREATE TRIGGER trg_on_assignment_status_update
  AFTER UPDATE ON public.event_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_assignment_status_update();


-- 5. Trigger para cuando se remueve una asignación (DELETE de event_assignments)
CREATE OR REPLACE FUNCTION public.notify_on_assignment_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  event_name text;
  event_date date;
  event_status text;
BEGIN
  SELECT name, date, status INTO event_name, event_date, event_status 
  FROM public.events 
  WHERE id = OLD.event_id;
  
  -- Solo notificar si el evento no está cancelado (ya que si está cancelado se notifica la cancelación general del evento)
  IF COALESCE(event_status, '') <> 'Cancelado' THEN
    INSERT INTO public.notifications (user_id, title, description, type, priority, related_event_id)
    VALUES (
      OLD.staff_id,
      '🚫 Citación Removida',
      'Se ha cancelado tu asignación para el evento "' || COALESCE(event_name, 'Sin nombre') || '" del ' || to_char(COALESCE(event_date, now()::date), 'DD/MM/YYYY') || '.',
      'assignment_removed',
      'normal',
      OLD.event_id
    );
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_assignment_delete ON public.event_assignments;
CREATE TRIGGER trg_on_assignment_delete
  AFTER DELETE ON public.event_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_assignment_delete();


-- 6. Trigger para cuando se edita/actualiza un evento (UPDATE de events)
CREATE OR REPLACE FUNCTION public.notify_on_event_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  assign_record record;
  is_status_cancelled boolean;
  is_relevant_update boolean;
BEGIN
  is_status_cancelled := (NEW.status = 'Cancelado' AND OLD.status <> 'Cancelado');
  
  is_relevant_update := (
    NEW.name IS DISTINCT FROM OLD.name OR
    NEW.date IS DISTINCT FROM OLD.date OR
    NEW.time IS DISTINCT FROM OLD.time OR
    NEW.end_time IS DISTINCT FROM OLD.end_time OR
    NEW.location IS DISTINCT FROM OLD.location OR
    NEW.client IS DISTINCT FROM OLD.client OR
    NEW.operational_notes IS DISTINCT FROM OLD.operational_notes OR
    (NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'Cancelado')
  );

  -- Notificar a todos los trabajadores actualmente asignados al evento
  FOR assign_record IN 
    SELECT DISTINCT staff_id FROM public.event_assignments 
    WHERE event_id = NEW.id
  LOOP
    IF is_status_cancelled THEN
      INSERT INTO public.notifications (user_id, title, description, type, priority, related_event_id)
      VALUES (
        assign_record.staff_id,
        '🚨 Evento Cancelado',
        'El evento "' || NEW.name || '" programado para el ' || to_char(NEW.date, 'DD/MM/YYYY') || ' ha sido CANCELADO.',
        'event_cancelled',
        'high',
        NEW.id
      );
    ELSIF is_relevant_update THEN
      INSERT INTO public.notifications (user_id, title, description, type, priority, related_event_id)
      VALUES (
        assign_record.staff_id,
        '🔔 Evento Actualizado',
        'Se actualizaron los detalles de "' || NEW.name || '". Revisa la información actualizada en tu portal.',
        'event_updated',
        'normal',
        NEW.id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_event_update ON public.events;
CREATE TRIGGER trg_on_event_update
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_event_update();


-- ==========================================================
-- V3.7.1 - FASE 5: REPLICACIÓN REALTIME EN TABLA NOTIFICATIONS
-- ==========================================================

-- Habilitar la transmisión en tiempo real de Supabase (Realtime Channel) para notificaciones
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ==========================================================
-- V3.7.2 - FASE 2: TABLA PUSH_SUBSCRIPTIONS Y POLÍTICAS DE RLS
-- ==========================================================

-- Limpiar tabla previa si existía en un estado incompleto
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;

CREATE TABLE public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  platform TEXT NULL,
  browser TEXT NULL,
  device_label TEXT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  revoked_at TIMESTAMPTZ NULL,
  
  CONSTRAINT unique_user_endpoint UNIQUE(user_id, endpoint)
);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Indexación óptima
CREATE INDEX IF NOT EXISTS idx_push_subs_user_active 
  ON public.push_subscriptions(user_id) 
  WHERE active = true;

-- Eliminar políticas previas si existen
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions;

-- Crear políticas robustas
CREATE POLICY "Users can manage their own subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING ( (select auth.uid()) = user_id )
  WITH CHECK ( (select auth.uid()) = user_id );


-- ==========================================================
-- V3.7.2-B - FASE B1: TABLA PUSH_DELIVERY_LOGS Y TRIGGER AUTOMÁTICO
-- ==========================================================

-- Habilitar extensión pg_net si no está activa
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Crear tabla push_delivery_logs
CREATE TABLE IF NOT EXISTS public.push_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'success', 'failed', 'no_subscribers'
  sent_count INT DEFAULT 0,
  failed_count INT DEFAULT 0,
  error_message TEXT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS en push_delivery_logs
ALTER TABLE public.push_delivery_logs ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden leer sus propios logs de envíos push
DROP POLICY IF EXISTS "Users can view their own push logs" ON public.push_delivery_logs;
CREATE POLICY "Users can view their own push logs" 
  ON public.push_delivery_logs 
  FOR SELECT 
  TO authenticated 
  USING ( (select auth.uid()) = user_id );

-- Función Trigger para encolar el push de forma asíncrona
CREATE OR REPLACE FUNCTION public.enqueue_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  has_active_subs BOOLEAN;
  log_id UUID;
  internal_token TEXT;
  req_id BIGINT;
BEGIN
  -- 1. Filtrar solo por tipos aprobados (event_assigned, event_updated, event_cancelled, assignment_removed)
  IF NEW.type NOT IN ('event_assigned', 'event_updated', 'event_cancelled', 'assignment_removed') THEN
    RETURN NEW;
  END IF;

  -- 2. Verificar si el usuario tiene dispositivos con push activos
  SELECT EXISTS(
    SELECT 1 FROM public.push_subscriptions 
    WHERE user_id = NEW.user_id AND active = true
  ) INTO has_active_subs;

  -- 3. Si no tiene suscripciones, salir pacíficamente sin hacer nada
  IF NOT has_active_subs THEN
    RETURN NEW;
  END IF;

  -- 4. Registrar en push_delivery_logs de forma segura
  INSERT INTO public.push_delivery_logs (notification_id, user_id, status)
  VALUES (NEW.id, NEW.user_id, 'pending')
  RETURNING id INTO log_id;

  -- 5. Recuperar token interno seguro desde Supabase Vault
  BEGIN
    SELECT decrypted_secret INTO internal_token 
    FROM vault.decrypted_secrets 
    WHERE name = 'push_dispatcher_token'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    internal_token := NULL;
  END;

  -- Fallback seguro para entorno local si el Vault no está inicializado
  IF internal_token IS NULL THEN
    internal_token := 'la_ampolleta_push_internal_token_secret_2026';
  END IF;

  -- 6. Disparar petición HTTP asíncrona a la Edge Function
  -- Usamos un bloque EXCEPTION defensivo para que si pg_net no está configurado, no rompa la transacción principal
  BEGIN
    SELECT net.http_post(
      'https://bvdcbsetmzvmodnklwfp.supabase.co/functions/v1/send-push-dispatcher'::text,
      jsonb_build_object(
        'notification_id', NEW.id,
        'log_id', log_id,
        'user_id', NEW.user_id,
        'title', NEW.title,
        'description', NEW.description,
        'type', NEW.type,
        'related_event_id', NEW.related_event_id
      ),
      '{}'::jsonb, -- params
      jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Internal-Token', internal_token
      ),
      10000::integer -- timeout_ms
    ) INTO req_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.push_delivery_logs 
    SET status = 'failed', error_message = 'Error en base de datos al encolar petición pg_net: ' || SQLERRM
    WHERE id = log_id;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear el disparador en la tabla public.notifications
DROP TRIGGER IF EXISTS trg_enqueue_push_notification ON public.notifications;
CREATE TRIGGER trg_enqueue_push_notification
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_push_notification();



