-- ====================================================================
-- SCRIPT DE PRUEBA SQL: AUTOMATIZACIÓN DE ESTADOS DE EVENTOS
-- Ejecuta este script completo en el Editor SQL de Supabase para verificar.
-- ====================================================================

-- 1. Limpiar cualquier residuo de pruebas previas
DELETE FROM public.events WHERE name LIKE 'TEST_AUTO_%';

-- 2. Insertar eventos de prueba representativos
INSERT INTO public.events (name, client, date, time, end_time, location, status, required_staff)
VALUES 
  -- Evento A: Planificado con hora de inicio en el pasado -> Debe pasar a 'En progreso'
  ('TEST_AUTO_Planificado_Pasado', 'Cliente Test', CURRENT_DATE, '00:01', '23:59', 'Sede Central', 'Planificado', 1),
  
  -- Evento B: Confirmado con hora de inicio en el pasado -> Debe pasar a 'En progreso'
  ('TEST_AUTO_Confirmado_Pasado', 'Cliente Test', CURRENT_DATE, '00:01', '23:59', 'Sede Central', 'Confirmado', 1),
  
  -- Evento C: En progreso con hora de término en el pasado -> Debe pasar a 'Finalizado'
  ('TEST_AUTO_En_Progreso_Pasado', 'Cliente Test', CURRENT_DATE, '00:01', '00:05', 'Sede Central', 'En progreso', 1),
  
  -- Evento D: En progreso SIN hora de término -> Debe quedarse en 'En progreso' (Nueva Regla Failsafe)
  ('TEST_AUTO_En_Progreso_Sin_Fin', 'Cliente Test', CURRENT_DATE, '00:01', NULL, 'Sede Central', 'En progreso', 1),
  
  -- Evento E: Cancelado con hora de inicio en el pasado -> Debe quedarse en 'Cancelado'
  ('TEST_AUTO_Cancelado_Pasado', 'Cliente Test', CURRENT_DATE, '00:01', '00:05', 'Sede Central', 'Cancelado', 1);

-- 3. Ejecutar la función de transición automática de estados
SELECT public.auto_update_event_statuses();

-- 4. Consultar resultados y auditar que todas las reglas se cumplan con éxito
SELECT 
  name AS "Nombre del Evento",
  status AS "Estado Final",
  CASE 
    WHEN name = 'TEST_AUTO_Planificado_Pasado' AND status = 'En progreso' THEN '✅ PASÓ (Planificado -> En progreso)'
    WHEN name = 'TEST_AUTO_Confirmado_Pasado' AND status = 'En progreso' THEN '✅ PASÓ (Confirmado -> En progreso)'
    WHEN name = 'TEST_AUTO_En_Progreso_Pasado' AND status = 'Finalizado' THEN '✅ PASÓ (En progreso -> Finalizado)'
    WHEN name = 'TEST_AUTO_En_Progreso_Sin_Fin' AND status = 'En progreso' THEN '✅ PASÓ (Protección Sin Fin: Sigue En progreso)'
    WHEN name = 'TEST_AUTO_Cancelado_Pasado' AND status = 'Cancelado' THEN '✅ PASÓ (Cancelado no se modifica)'
    ELSE '❌ FALLÓ'
  END AS "Resultado de la Prueba"
FROM public.events
WHERE name LIKE 'TEST_AUTO_%';

-- 5. Opcional: Limpiar registros después de ver el resultado
-- (Si quieres ver los eventos físicamente en tu panel, comenta la línea de abajo antes de ejecutar)
DELETE FROM public.events WHERE name LIKE 'TEST_AUTO_%';
