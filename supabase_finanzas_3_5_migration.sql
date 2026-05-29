-- =========================================================================
-- MIGRACIÓN DE BASE DE DATOS: FINANZAS 3.5 - VALIDACIÓN AUTOMÁTICA DE BOLETAS
-- =========================================================================

-- 1. Crear tabla de boletas detectadas
CREATE TABLE IF NOT EXISTS public.detected_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT UNIQUE NOT NULL,                       -- Para evitar procesar duplicados
    sender_email TEXT NOT NULL,                            -- siichile@sii.cl
    subject TEXT,                                          -- Asunto del correo
    received_at TIMESTAMPTZ NOT NULL,                      -- Fecha del correo
    notification_date DATE,                                -- Fecha extraída del cuerpo
    issuer_rut TEXT NOT NULL,                              -- RUT del Técnico (con guion, sin puntos, ej: 12345678-9)
    issuer_name TEXT,                                      -- Nombre del Técnico
    invoice_number TEXT NOT NULL,                          -- Folio de la Boleta
    invoice_date DATE NOT NULL,                            -- Fecha real de emisión (tributaria)
    invoice_amount NUMERIC NOT NULL,                       -- Bruto (totalHonorarios)
    liquid_amount NUMERIC NOT NULL,                        -- Líquido (liquidoHonorarios)
    withheld_tax NUMERIC NOT NULL,                         -- Retención (impuestoHonorarios)
    tax_rate NUMERIC NOT NULL,                             -- Tasa de retención (ej: 15.25)
    receiver_rut TEXT,                                     -- RUT de La Ampolleta
    receiver_name TEXT,                                    -- Nombre de La Ampolleta
    raw_text_preview TEXT,                                 -- Resumen del texto del correo (máx 500 caracteres)
    matched_batch_id UUID REFERENCES public.worker_invoice_batches(id) ON DELETE SET NULL,
    match_status TEXT DEFAULT 'pending' NOT NULL,          -- pending, matched, auto_verified, needs_review, rejected
    confidence_score NUMERIC DEFAULT 0 NOT NULL,           -- Puntuación de confianza (0 - 100)
    match_reason TEXT,                                     -- Motivo del match o del rechazo
    xml_parse_status TEXT NOT NULL,                        -- success, missing_xml, invalid_xml, missing_fields
    xml_parse_error TEXT NULL,                             -- Mensaje corto del error de parseo
    processed_at TIMESTAMPTZ DEFAULT NOW(),                -- Fecha de procesamiento
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear Índices SQL para optimización de consultas en bandejas de alta carga
CREATE INDEX IF NOT EXISTS idx_detected_invoices_match_status
ON public.detected_invoices(match_status);

CREATE INDEX IF NOT EXISTS idx_detected_invoices_issuer_rut
ON public.detected_invoices(issuer_rut);

CREATE INDEX IF NOT EXISTS idx_detected_invoices_invoice_date
ON public.detected_invoices(invoice_date);

CREATE INDEX IF NOT EXISTS idx_detected_invoices_received_at
ON public.detected_invoices(received_at);

-- 3. Habilitar Row Level Security (RLS)
ALTER TABLE public.detected_invoices ENABLE ROW LEVEL SECURITY;

-- 4. Crear Políticas de RLS Seguras (Solo acceso para perfiles de administración o visualización)
DROP POLICY IF EXISTS "Permitir lectura de boletas detectadas para administradores" ON public.detected_invoices;
CREATE POLICY "Permitir lectura de boletas detectadas para administradores"
ON public.detected_invoices FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (
      LOWER(profiles.role) IN ('admin', 'superadmin', 'viewer')
      OR LOWER(profiles.system_role) IN ('admin', 'superadmin', 'viewer')
    )
  )
);

DROP POLICY IF EXISTS "Permitir gestión de boletas detectadas para administradores" ON public.detected_invoices;
CREATE POLICY "Permitir gestión de boletas detectadas para administradores"
ON public.detected_invoices FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND (
      LOWER(profiles.role) IN ('admin', 'superadmin')
      OR LOWER(profiles.system_role) IN ('admin', 'superadmin')
    )
  )
);

-- 5. Función PL/pgSQL para limpieza automática y segura de registros obsoletos
CREATE OR REPLACE FUNCTION public.clean_old_detected_invoices()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.detected_invoices
    WHERE received_at < (NOW() - INTERVAL '60 days')
      AND match_status IN ('auto_verified', 'matched', 'rejected');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN deleted_count;
END;
$$;

-- 6. Otorgar permisos de ejecución de la función de limpieza a roles autenticados
GRANT EXECUTE ON FUNCTION public.clean_old_detected_invoices() TO authenticated;
