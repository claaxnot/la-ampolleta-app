-- ====================================================================
-- SCRIPT DE PRUEBA SQL: AUTOMATIZACIÓN DE ESTADOS CON JORNADAS MULTI-DÍA
-- Ejecuta este script completo en el Editor SQL de Supabase para verificar.
-- ====================================================================

-- 1. Limpiar cualquier residuo de pruebas previas
DELETE FROM public.events WHERE name LIKE 'TEST_JORNADAS_%';

-- 2. Crear Evento de prueba principal
INSERT INTO public.events (id, name, client, date, time, end_time, location, status, required_staff)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'TEST_JORNADAS_Multi_Dia', 'Cliente Test', CURRENT_DATE - 1, '09:00:00', '18:00:00', 'Sede Central', 'Planificado', 1);

-- 3. Crear jornadas de prueba asociadas
INSERT INTO public.event_days (event_id, date, start_time, end_time, status)
VALUES 
  -- Jornada 1: Ayer (pasada) -> Debe cambiar a 'Finalizado'
  ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE - 1, '09:00:00', '18:00:00', 'Planificado'),
  -- Jornada 2: Hoy en curso (hora de inicio en el pasado, hora de término en el futuro) -> Debe cambiar a 'En progreso'
  ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE, '00:01:00', '23:59:00', 'Confirmado'),
  -- Jornada 3: Mañana (futura) -> Debe permanecer en 'Planificado'
  ('a0000000-0000-0000-0000-000000000001', CURRENT_DATE + 1, '09:00:00', '18:00:00', 'Planificado');

-- 4. Ejecutar la función de transición automática de estados
SELECT public.auto_update_event_statuses();

-- 5. Consultar resultados de las jornadas
SELECT 
  d.date AS "Fecha Jornada",
  d.status AS "Estado Final Jornada",
  CASE 
    WHEN d.date = CURRENT_DATE - 1 AND d.status = 'Finalizado' THEN '✅ PASÓ (Pasada -> Finalizado)'
    WHEN d.date = CURRENT_DATE AND d.status = 'En progreso' THEN '✅ PASÓ (Hoy en curso -> En progreso)'
    WHEN d.date = CURRENT_DATE + 1 AND d.status = 'Planificado' THEN '✅ PASÓ (Futura -> Permanece Planificado)'
    ELSE '❌ FALLÓ'
  END AS "Resultado Jornada"
FROM public.event_days d
JOIN public.events e ON d.event_id = e.id
WHERE e.name = 'TEST_JORNADAS_Multi_Dia'
ORDER BY d.date ASC;

-- 6. Consultar estado final del evento padre
SELECT 
  name AS "Evento Padre",
  status AS "Estado Evento Padre",
  CASE 
    WHEN status = 'En progreso' THEN '✅ PASÓ (Parent es En progreso ya que hay jornadas activas/futuras)'
    ELSE '❌ FALLÓ'
  END AS "Resultado Evento"
FROM public.events
WHERE name = 'TEST_JORNADAS_Multi_Dia';

-- 7. Limpiar registros después de la prueba
DELETE FROM public.events WHERE name LIKE 'TEST_JORNADAS_%';
