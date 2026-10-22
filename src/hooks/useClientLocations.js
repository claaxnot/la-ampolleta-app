import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";

export const DEFAULT_MALL_LOCATIONS = [
  { code: "PAK", name: "Mall Parque Arauco Kennedy", address: "Av. Pdte. Kennedy 5413, Las Condes, Santiago", latitude: -33.4033686, longitude: -70.5787967, allowed_radius_meters: 300 },
  { code: "MAM", name: "Mall Arauco Maipú", address: "Av. Américo Vespucio 399, Maipú, Región Metropolitana", latitude: -33.4814037, longitude: -70.7519018, allowed_radius_meters: 300 },
  { code: "MAE", name: "Mall Arauco Estación", address: "Av. Alameda Libertador Bernardo O'Higgins 3250, Estación Central", latitude: -33.4522129, longitude: -70.6797104, allowed_radius_meters: 300 },
  { code: "MAQ", name: "Mall Arauco Quilicura", address: "Av. Bernardo O'Higgins 581, Quilicura", latitude: -33.3679549, longitude: -70.7303442, allowed_radius_meters: 300 },
  { code: "AEB", name: "Arauco El Bosque", address: "Gran Av. José Miguel Carrera 10375, El Bosque", latitude: -33.5536663, longitude: -70.6769562, allowed_radius_meters: 300 },
  { code: "ASA", name: "Arauco San Antonio", address: "Barros Luco 105, San Antonio, Valparaíso", latitude: -33.5816088, longitude: -71.613832, allowed_radius_meters: 300 },
  { code: "ACH", name: "Arauco Chillán", address: "El Roble 770, Chillán, Ñuble", latitude: -36.6097439, longitude: -72.1007552, allowed_radius_meters: 300 },
  { code: "ACO", name: "Arauco Coronel", address: "Carlos Pratt González 913, Coronel, Bío Bío", latitude: -37.0131897, longitude: -73.1586072, allowed_radius_meters: 300 },
  { code: "PAN", name: "Parque Angamos Antofagasta", address: "Av. Angamos 02170, Antofagasta", latitude: -23.6950327, longitude: -70.4162149, allowed_radius_meters: 300 },
  { code: "BOM", name: "Bodega Buenaventura Quilicura", address: "San Ignacio 500, Quilicura, Región Metropolitana", latitude: -33.3320303, longitude: -70.7035477, allowed_radius_meters: 300 },
  { code: "CUR", name: "Arauco Curauma", address: "Av. Lomas de la Luz 4650, Curauma, Valparaíso", latitude: -33.1316449, longitude: -71.564289, allowed_radius_meters: 300 },
  { code: "COQ", name: "Arauco Coquimbo", address: "Camino La Cantera 2325, Coquimbo", latitude: -29.9763306, longitude: -71.2961941, allowed_radius_meters: 300 },
  { code: "CON", name: "Portal San Pedro", address: "Av. Portal San Pedro 4850, San Pedro de la Paz, Bío Bío", latitude: -36.8664577, longitude: -73.1368322, allowed_radius_meters: 300 },
  { code: "BUIN", name: "Centro Comercial Buin", address: "Kilómetro 37 de la Ruta 5 Sur, Buin", latitude: -33.7612571, longitude: -70.7429046, allowed_radius_meters: 300 },
  { code: "CHICUREO", name: "Arauco Chicureo", address: "Avenida Chicureo 125, Chicureo, Colina", latitude: -33.2858607, longitude: -70.6785264, allowed_radius_meters: 300 },
  { code: "QUILIN", name: "Mall Paseo Quilín", address: "Av. Américo Vespucio 3300 / Av. Quilín, Peñalolén", latitude: -33.4875358, longitude: -70.5776595, allowed_radius_meters: 300 },
  { code: "LAAMP", name: "Base Central La Ampolleta", address: "Mahuida 956, San Bernardo", latitude: -33.5991537, longitude: -70.7119985, allowed_radius_meters: 300 }
];

export function parseGoogleMapsUrl(input) {
  if (!input || typeof input !== "string") return null;
  const str = input.trim();

  // 1. Direct "lat, lng" format
  const directMatch = str.match(/^(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)$/);
  if (directMatch) {
    return {
      latitude: parseFloat(directMatch[1]),
      longitude: parseFloat(directMatch[2]),
    };
  }

  // 2. Data params: !3d-33.5991537!4d-70.7119985
  const dataMatch = str.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
  if (dataMatch) {
    return {
      latitude: parseFloat(dataMatch[1]),
      longitude: parseFloat(dataMatch[2]),
    };
  }

  // 3. Place @lat,lng format
  const atMatch = str.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (atMatch) {
    return {
      latitude: parseFloat(atMatch[1]),
      longitude: parseFloat(atMatch[2]),
    };
  }

  // 4. Query param ?q=lat,lng or ?ll=lat,lng
  const qMatch = str.match(/[?&](?:q|ll)=(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
  if (qMatch) {
    return {
      latitude: parseFloat(qMatch[1]),
      longitude: parseFloat(qMatch[2]),
    };
  }

  return null;
}

export function useClientLocations() {
  const [locations, setLocations] = useState(DEFAULT_MALL_LOCATIONS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLocations = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("client_locations")
        .select("*")
        .order("code", { ascending: true });

      if (error) {
        console.warn("Tabla client_locations no disponible aún, usando catálogo local por defecto.", error.message);
        setLocations(DEFAULT_MALL_LOCATIONS);
        return;
      }

      if (data && data.length > 0) {
        // La base de datos es la única fuente de verdad
        const normalized = data.map(item => ({
          ...item,
          latitude: parseFloat(item.latitude),
          longitude: parseFloat(item.longitude),
          allowed_radius_meters: parseInt(item.allowed_radius_meters, 10) || 300
        }));
        setLocations(normalized);
      } else {
        // Si la tabla existe pero no tiene filas, auto-sembrar los 17 predeterminados
        try {
          const { error: seedError } = await supabase
            .from("client_locations")
            .upsert(DEFAULT_MALL_LOCATIONS, { onConflict: "code" });

          if (!seedError) {
            const { data: seeded } = await supabase
              .from("client_locations")
              .select("*")
              .order("code", { ascending: true });

            if (seeded && seeded.length > 0) {
              setLocations(seeded.map(item => ({
                ...item,
                latitude: parseFloat(item.latitude),
                longitude: parseFloat(item.longitude),
                allowed_radius_meters: parseInt(item.allowed_radius_meters, 10) || 300
              })));
              return;
            }
          }
        } catch (seedErr) {
          console.warn("No se pudo sembrar automáticamente client_locations:", seedErr);
        }
        setLocations(DEFAULT_MALL_LOCATIONS);
      }
    } catch (err) {
      console.warn("Error cargando client_locations:", err);
      setLocations(DEFAULT_MALL_LOCATIONS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const saveLocation = async (locationData) => {
    const code = (locationData.code || "").trim().toUpperCase();
    const originalCode = (locationData.originalCode || "").trim().toUpperCase();

    if (!code) throw new Error("El código de cliente es obligatorio.");
    if (!locationData.address) throw new Error("La dirección es obligatoria.");
    if (isNaN(locationData.latitude) || isNaN(locationData.longitude)) {
      throw new Error("Las coordenadas de latitud y longitud deben ser números válidos.");
    }

    const payload = {
      code,
      name: locationData.name?.trim() || code,
      address: locationData.address.trim(),
      latitude: parseFloat(locationData.latitude),
      longitude: parseFloat(locationData.longitude),
      allowed_radius_meters: parseInt(locationData.allowed_radius_meters, 10) || 300,
      updated_at: new Date().toISOString()
    };

    if (locationData.id) {
      // Edición por ID existente en Supabase
      const { error } = await supabase
        .from("client_locations")
        .update(payload)
        .eq("id", locationData.id);
      if (error) throw error;
    } else if (originalCode) {
      // Edición por Código Previo si no tenía ID
      const { data: existing } = await supabase
        .from("client_locations")
        .select("id")
        .eq("code", originalCode)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("client_locations")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("client_locations")
          .upsert(payload, { onConflict: "code" });
        if (error) throw error;
      }
    } else {
      // Creación nueva
      const { error } = await supabase
        .from("client_locations")
        .upsert(payload, { onConflict: "code" });
      if (error) throw error;
    }

    // Si el código cambió, sincronizar automáticamente los eventos que usaban el código anterior
    if (originalCode && originalCode !== code) {
      try {
        await supabase
          .from("events")
          .update({ client: code })
          .eq("client", originalCode);
      } catch (evErr) {
        console.warn("Aviso: No se pudieron sincronizar eventos antiguos:", evErr);
      }
    }

    await fetchLocations();
  };

  const deleteLocation = async (id, code) => {
    if (id) {
      const { error } = await supabase
        .from("client_locations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    } else if (code) {
      const { error } = await supabase
        .from("client_locations")
        .delete()
        .eq("code", code);
      if (error) throw error;
    }

    await fetchLocations();
  };

  return {
    locations,
    isLoading,
    refreshLocations: fetchLocations,
    saveLocation,
    deleteLocation,
  };
}

export default useClientLocations;
