-- =========================================================================
-- MIGRACIÓN DE ROBUSTECEZ: TRANSACCIONES ATÓMICAS PARA AUTO-VALIDACIÓN V3
-- engine: PostgreSQL (Supabase)
-- =========================================================================

-- 1. RPC para Auto-Creador Dinámico de Lotes (On-The-Fly) de forma atómica y aislada.
CREATE OR REPLACE FUNCTION public.auto_create_invoice_batch_v3(
  p_worker_id UUID,
  p_period_label VARCHAR,
  p_total_liquid_amount NUMERIC,
  p_retention_rate NUMERIC,
  p_expected_gross_amount NUMERIC,
  p_estimated_retention NUMERIC,
  p_invoice_number INT,
  p_invoice_amount NUMERIC,
  p_assignment_ids UUID[],
  p_invoice_notes TEXT
) RETURNS UUID AS $$
DECLARE
  v_batch_id UUID;
  v_assignment_id UUID;
  v_assignment_rate NUMERIC;
  v_default_rate NUMERIC;
BEGIN
  -- A. Insertar el lote en worker_invoice_batches
  INSERT INTO public.worker_invoice_batches (
    worker_id,
    period_label,
    total_liquid_amount,
    retention_rate,
    expected_gross_amount,
    estimated_retention,
    invoice_number,
    invoice_amount,
    invoice_received_at,
    invoice_notes,
    status,
    created_at,
    updated_at
  ) VALUES (
    p_worker_id,
    p_period_label,
    p_total_liquid_amount,
    p_retention_rate,
    p_expected_gross_amount,
    p_estimated_retention,
    p_invoice_number,
    p_invoice_amount,
    NOW(),
    p_invoice_notes,
    'verified',
    NOW(),
    NOW()
  ) RETURNING id INTO v_batch_id;

  -- B. Insertar los items en worker_invoice_batch_items
  FOREACH v_assignment_id IN ARRAY p_assignment_ids LOOP
    -- Obtener tarifa de la asignación o el default por perfil
    SELECT COALESCE(
      ea.custom_rate::NUMERIC, 
      p.monto_transferencia::NUMERIC, 
      25000
    ) INTO v_assignment_rate
    FROM public.event_assignments ea
    LEFT JOIN public.profiles p ON p.id = ea.staff_id
    WHERE ea.id = v_assignment_id;

    INSERT INTO public.worker_invoice_batch_items (
      batch_id,
      assignment_id,
      liquid_amount
    ) VALUES (
      v_batch_id,
      v_assignment_id,
      v_assignment_rate
    );
  END LOOP;

  -- C. Actualizar event_assignments
  UPDATE public.event_assignments
  SET
    invoice_received = true,
    invoice_number = p_invoice_number,
    invoice_amount = p_invoice_amount,
    invoice_received_at = NOW(),
    invoice_notes = CONCAT('Validación automática agrupada (Lote Auto-Creado ', p_period_label, ')')
  WHERE id = ANY(p_assignment_ids);

  RETURN v_batch_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC para Auto-Verificar un lote tributario pendiente/rechazado pre-existente.
CREATE OR REPLACE FUNCTION public.auto_verify_existing_invoice_batch_v3(
  p_batch_id UUID,
  p_invoice_number INT,
  p_invoice_amount NUMERIC,
  p_period_label VARCHAR
) RETURNS VOID AS $$
BEGIN
  -- A. Actualizar worker_invoice_batches a verified
  UPDATE public.worker_invoice_batches
  SET
    invoice_number = p_invoice_number,
    invoice_amount = p_invoice_amount,
    invoice_received_at = NOW(),
    invoice_notes = 'Validado automáticamente desde correo SII (Finanzas 3.5)',
    status = 'verified',
    updated_at = NOW()
  WHERE id = p_batch_id;

  -- B. Actualizar event_assignments vinculados a ese lote
  UPDATE public.event_assignments
  SET
    invoice_received = true,
    invoice_number = p_invoice_number,
    invoice_amount = p_invoice_amount,
    invoice_received_at = NOW(),
    invoice_notes = CONCAT('Validación automática agrupada (Lote ', p_period_label, ')')
  WHERE id IN (
    SELECT assignment_id 
    FROM public.worker_invoice_batch_items 
    WHERE batch_id = p_batch_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder accesos de ejecución al rol service_role y anon/authenticated para ser usado por Edge Functions
GRANT EXECUTE ON FUNCTION public.auto_create_invoice_batch_v3 TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_verify_existing_invoice_batch_v3 TO service_role;
