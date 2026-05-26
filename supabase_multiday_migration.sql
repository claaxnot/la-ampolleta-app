-- ==========================================
-- SCRIPT DE MIGRACIÓN: EVENTOS MULTI-DÍA (la-ampolleta-app)
-- ==========================================

-- FASE 1: Creación de la nueva tabla de jornadas
CREATE TABLE IF NOT EXISTS public.event_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    call_time TIME,
    setup_time TIME,
    status VARCHAR(50) NOT NULL DEFAULT 'Planificado',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Habilitar RLS en event_days
ALTER TABLE public.event_days ENABLE ROW LEVEL SECURITY;

-- Crear políticas de RLS para event_days
CREATE POLICY "Permitir lectura de jornadas para usuarios autenticados"
ON public.event_days
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Permitir escritura de jornadas para administradores"
ON public.event_days
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'viewer')
  )
);

-- FASE 2: Agregar referencias a tablas de soporte
ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS event_day_id UUID REFERENCES public.event_days(id) ON DELETE CASCADE;
ALTER TABLE public.event_attendance_logs ADD COLUMN IF NOT EXISTS event_day_id UUID REFERENCES public.event_days(id) ON DELETE CASCADE;

-- FASE 3: Traspasar la información de eventos de un solo día existentes
DO $$
DECLARE
    evt RECORD;
    new_day_id UUID;
BEGIN
    FOR evt IN SELECT id, date, time, end_time, call_time, setup_time, status FROM public.events LOOP
        -- 1. Insertar una jornada por cada evento actual si no existe ya para ese evento
        IF NOT EXISTS (SELECT 1 FROM public.event_days WHERE event_id = evt.id) THEN
            INSERT INTO public.event_days (event_id, date, start_time, end_time, call_time, setup_time, status)
            VALUES (
                evt.id, 
                evt.date::DATE, 
                COALESCE(evt.time, '09:00:00')::TIME, 
                COALESCE(evt.end_time, '18:00:00')::TIME, 
                evt.call_time::TIME, 
                evt.setup_time::TIME, 
                COALESCE(evt.status, 'Planificado')
            )
            RETURNING id INTO new_day_id;

            -- 2. Enlazar las asignaciones existentes al ID de la nueva jornada
            UPDATE public.event_assignments
            SET event_day_id = new_day_id
            WHERE event_id = evt.id AND event_day_id IS NULL;

            -- 3. Enlazar los logs de asistencia al ID de la nueva jornada
            UPDATE public.event_attendance_logs
            SET event_day_id = new_day_id
            WHERE event_id = evt.id AND event_day_id IS NULL;
        END IF;
    END LOOP; -- Corrección: END LOOP en lugar de END FOR
END $$;

-- FASE 4: Establecer restricciones definitivas (NOT NULL) para nuevos registros
-- Nota: Solo aplicamos NOT NULL si no hay asignaciones huérfanas
ALTER TABLE public.event_assignments ALTER COLUMN event_day_id SET NOT NULL;
