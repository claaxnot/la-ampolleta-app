-- =====================================================================
-- MIGRACIÓN DE SUPABASE: SISTEMA DE CONTROL Y VERIFICACIÓN DE BOLETAS
-- =====================================================================

-- 1. Agregar columnas de control de boleta en la tabla event_assignments
ALTER TABLE public.event_assignments 
ADD COLUMN IF NOT EXISTS invoice_required BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS invoice_received BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN IF NOT EXISTS invoice_number TEXT NULL,
ADD COLUMN IF NOT EXISTS invoice_received_at TIMESTAMP WITH TIME ZONE NULL,
ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC NULL,
ADD COLUMN IF NOT EXISTS invoice_verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL NULL,
ADD COLUMN IF NOT EXISTS invoice_notes TEXT NULL;

-- 2. Documentar las columnas para mayor claridad
COMMENT ON COLUMN public.event_assignments.invoice_required IS 'Indica si este pago requiere la entrega de una boleta de honorarios';
COMMENT ON COLUMN public.event_assignments.invoice_received IS 'Indica si la boleta ha sido recibida y confirmada por administración';
COMMENT ON COLUMN public.event_assignments.invoice_number IS 'Número de boleta asignado por el emisor';
COMMENT ON COLUMN public.event_assignments.invoice_received_at IS 'Fecha y hora en que se validó la boleta';
COMMENT ON COLUMN public.event_assignments.invoice_amount IS 'Monto exacto de la boleta de honorarios';
COMMENT ON COLUMN public.event_assignments.invoice_verified_by IS 'ID del administrador que realizó la validación manual';
COMMENT ON COLUMN public.event_assignments.invoice_notes IS 'Observaciones u observaciones operativas sobre la boleta';
