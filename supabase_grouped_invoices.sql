-- =====================================================================
-- MIGRACIÓN DE SUPABASE: SISTEMA DE BOLETAS DE HONORARIOS AGRUPADAS (V3)
-- =====================================================================

-- 1. Crear tabla de lotes de boletas por trabajador
CREATE TABLE IF NOT EXISTS public.worker_invoice_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    worker_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    period_label TEXT NULL,
    total_liquid_amount NUMERIC NOT NULL,
    retention_rate NUMERIC NOT NULL,
    expected_gross_amount NUMERIC NOT NULL,
    estimated_retention NUMERIC NOT NULL,
    invoice_number TEXT NULL,
    invoice_amount NUMERIC NULL,
    invoice_received_at TIMESTAMP WITH TIME ZONE NULL,
    invoice_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    invoice_notes TEXT NULL,
    status TEXT DEFAULT 'pending' NOT NULL, -- pending, verified, rejected, paid
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Crear tabla puente para enlazar eventos/asignaciones a un lote específico
CREATE TABLE IF NOT EXISTS public.worker_invoice_batch_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES public.worker_invoice_batches(id) ON DELETE CASCADE,
    assignment_id UUID REFERENCES public.event_assignments(id) ON DELETE CASCADE,
    liquid_amount NUMERIC NOT NULL,
    CONSTRAINT unique_assignment_in_batch UNIQUE (assignment_id)
);

-- 3. Habilitar RLS en ambas tablas
ALTER TABLE public.worker_invoice_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_invoice_batch_items ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de Seguridad RLS
-- Lotes de Boletas
DROP POLICY IF EXISTS "Trabajadores pueden ver sus propios lotes" ON public.worker_invoice_batches;
CREATE POLICY "Trabajadores pueden ver sus propios lotes"
ON public.worker_invoice_batches FOR SELECT
TO authenticated
USING (worker_id = auth.uid());

DROP POLICY IF EXISTS "Administradores pueden gestionar todos los lotes" ON public.worker_invoice_batches;
CREATE POLICY "Administradores pueden gestionar todos los lotes"
ON public.worker_invoice_batches FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (
      LOWER(public.profiles.role) IN ('admin', 'superadmin')
      OR LOWER(public.profiles.system_role) IN ('admin', 'superadmin')
    )
  )
);

-- Ítems de lotes
DROP POLICY IF EXISTS "Trabajadores pueden ver sus propios items de lote" ON public.worker_invoice_batch_items;
CREATE POLICY "Trabajadores pueden ver sus propios items de lote"
ON public.worker_invoice_batch_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.worker_invoice_batches
    WHERE public.worker_invoice_batches.id = batch_id
    AND public.worker_invoice_batches.worker_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Administradores pueden gestionar todos los items de lote" ON public.worker_invoice_batch_items;
CREATE POLICY "Administradores pueden gestionar todos los items de lote"
ON public.worker_invoice_batch_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (
      LOWER(public.profiles.role) IN ('admin', 'superadmin')
      OR LOWER(public.profiles.system_role) IN ('admin', 'superadmin')
    )
  )
);

-- 5. Otorgar permisos explícitos en las tablas para prevenir bloqueos de roles locales
GRANT ALL ON TABLE public.worker_invoice_batches TO authenticated;
GRANT ALL ON TABLE public.worker_invoice_batches TO service_role;
GRANT ALL ON TABLE public.worker_invoice_batches TO anon;

GRANT ALL ON TABLE public.worker_invoice_batch_items TO authenticated;
GRANT ALL ON TABLE public.worker_invoice_batch_items TO service_role;
GRANT ALL ON TABLE public.worker_invoice_batch_items TO anon;

-- 6. Documentación de tablas para auditorías tributarias
COMMENT ON TABLE public.worker_invoice_batches IS 'Lotes y estados de boletas de honorarios emitidas de forma agrupada por trabajador y periodo';
COMMENT ON TABLE public.worker_invoice_batch_items IS 'Tabla intermedia que asocia eventos/asignaciones individuales a un lote de boleta agrupada';
