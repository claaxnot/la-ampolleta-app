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
