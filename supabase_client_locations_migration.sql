-- =====================================================================
-- MIGRACIÓN DE SUPABASE: GESTOR DE CLIENTES Y UBICACIONES (CLIENT_LOCATIONS)
-- =====================================================================

-- 1. Crear tabla de clientes y locaciones si no existe
CREATE TABLE IF NOT EXISTS public.client_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    name TEXT,
    address TEXT NOT NULL,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    allowed_radius_meters INTEGER NOT NULL DEFAULT 300,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Habilitar RLS en la tabla
ALTER TABLE public.client_locations ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de Seguridad (RLS)
-- Lectura pública para cualquier usuario (Admins, Productores y Trabajadores para autocompletar)
DROP POLICY IF EXISTS "Permitir lectura de clientes a usuarios autenticados" ON public.client_locations;
DROP POLICY IF EXISTS "Permitir lectura pública de clientes" ON public.client_locations;
CREATE POLICY "Permitir lectura pública de clientes"
ON public.client_locations FOR SELECT
TO public
USING (true);

-- Escritura, edición y eliminación EXCLUSIVAS para Administradores (los Productores NO tienen acceso)
DROP POLICY IF EXISTS "Permitir gestión de clientes solo a administradores" ON public.client_locations;
CREATE POLICY "Permitir gestión de clientes solo a administradores"
ON public.client_locations FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
        AND (
            LOWER(public.profiles.system_role) IN ('admin', 'superadmin')
            OR public.profiles.role = 'Admin'
        )
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
        AND (
            LOWER(public.profiles.system_role) IN ('admin', 'superadmin')
            OR public.profiles.role = 'Admin'
        )
    )
);

-- 4. Seed de clientes base predeterminados (Migración sin duplicados)
INSERT INTO public.client_locations (code, name, address, latitude, longitude, allowed_radius_meters)
VALUES
  ('PAK', 'Mall Parque Arauco Kennedy', 'Av. Pdte. Kennedy 5413, Las Condes, Santiago', -33.4033686, -70.5787967, 300),
  ('MAM', 'Mall Arauco Maipú', 'Av. Américo Vespucio 399, Maipú, Región Metropolitana', -33.4814037, -70.7519018, 300),
  ('MAE', 'Mall Arauco Estación', 'Av. Alameda Libertador Bernardo O''Higgins 3250, Estación Central', -33.4522129, -70.6797104, 300),
  ('MAQ', 'Mall Arauco Quilicura', 'Av. Bernardo O''Higgins 581, Quilicura', -33.3679549, -70.7303442, 300),
  ('AEB', 'Arauco El Bosque', 'Gran Av. José Miguel Carrera 10375, El Bosque', -33.5536663, -70.6769562, 300),
  ('ASA', 'Arauco San Antonio', 'Barros Luco 105, San Antonio, Valparaíso', -33.5816088, -71.613832, 300),
  ('ACH', 'Arauco Chillán', 'El Roble 770, Chillán, Ñuble', -36.6097439, -72.1007552, 300),
  ('ACO', 'Arauco Coronel', 'Carlos Pratt González 913, Coronel, Bío Bío', -37.0131897, -73.1586072, 300),
  ('PAN', 'Parque Angamos Antofagasta', 'Av. Angamos 02170, Antofagasta', -23.6950327, -70.4162149, 300),
  ('BOM', 'Bodega Buenaventura Quilicura', 'San Ignacio 500, Quilicura, Región Metropolitana', -33.3320303, -70.7035477, 300),
  ('CUR', 'Arauco Curauma', 'Av. Lomas de la Luz 4650, Curauma, Valparaíso', -33.1316449, -71.564289, 300),
  ('COQ', 'Arauco Coquimbo', 'Camino La Cantera 2325, Coquimbo', -29.9763306, -71.2961941, 300),
  ('CON', 'Portal San Pedro', 'Av. Portal San Pedro 4850, San Pedro de la Paz, Bío Bío', -36.8664577, -73.1368322, 300),
  ('BUIN', 'Centro Comercial Buin', 'Kilómetro 37 de la Ruta 5 Sur, Buin', -33.7612571, -70.7429046, 300),
  ('CHICUREO', 'Arauco Chicureo', 'Avenida Chicureo 125, Chicureo, Colina', -33.2858607, -70.6785264, 300),
  ('QUILIN', 'Mall Paseo Quilín', 'Av. Américo Vespucio 3300 / Av. Quilín, Peñalolén', -33.4875358, -70.5776595, 300),
  ('LAAMP', 'Base Central La Ampolleta', 'Mahuida 956, San Bernardo', -33.5991537, -70.7119985, 300)
ON CONFLICT (code) DO UPDATE
SET 
  address = EXCLUDED.address,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  allowed_radius_meters = EXCLUDED.allowed_radius_meters,
  updated_at = NOW();
