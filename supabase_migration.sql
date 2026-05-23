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
SET search_path = public, pg_catalog
AS $$
BEGIN
  INSERT INTO profiles (id, email, name, role, system_role, status, email_confirmed)
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


-- B. Función sync_user_confirmation (Sincronización de activación de correo)
CREATE OR REPLACE FUNCTION public.sync_user_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF new.email_confirmed_at IS NOT NULL AND old.email_confirmed_at IS NULL THEN
    UPDATE profiles
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
