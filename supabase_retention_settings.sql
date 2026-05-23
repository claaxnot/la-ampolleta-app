-- =====================================================================
-- MIGRACIÓN DE SUPABASE: CONFIGURACIONES DE RETENCIÓN TRIBUTARIA (V2)
-- =====================================================================

-- 1. Crear tabla de configuraciones si no existe
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 2. Habilitar RLS en la tabla
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- 3. Crear Políticas de Seguridad RLS
-- Permitir lectura a todos los usuarios autenticados
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON public.app_settings;
CREATE POLICY "Permitir lectura a usuarios autenticados" 
ON public.app_settings FOR SELECT 
TO authenticated 
USING (true);

-- Permitir escritura únicamente a administradores
DROP POLICY IF EXISTS "Permitir escritura solo a administradores" ON public.app_settings;
CREATE POLICY "Permitir escritura solo a administradores" 
ON public.app_settings FOR ALL 
TO authenticated 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE public.profiles.id = auth.uid() 
    AND public.profiles.role IN ('Admin', 'SuperAdmin')
  )
);

-- 4. Insertar tasa de retención inicial para honorarios (15.25% para 2026/2027 Chile)
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('honorarios_retention_rate', '{"rate": 15.25}', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- 5. Insertar tolerancia monetaria inicial de coincidencia ($10 CLP)
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('honorarios_invoice_tolerance', '{"tolerance": 10}', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, updated_at = NOW();

-- 6. Documentar las configuraciones en la base de datos
COMMENT ON TABLE public.app_settings IS 'Configuraciones generales de la aplicación persistentes y editables';
COMMENT ON COLUMN public.app_settings.key IS 'Identificador único de la configuración';
COMMENT ON COLUMN public.app_settings.value IS 'Objeto JSON conteniendo las variables de la configuración';
