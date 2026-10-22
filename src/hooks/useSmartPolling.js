import { useEffect, useRef } from "react";

/**
 * Hook de Smart Short-Polling que consulta periódicamente los datos vía HTTP (PostgREST),
 * consumiendo CERO (0) conexiones de WebSockets en Supabase Realtime.
 * 
 * - Se ejecuta en intervalos configurables (por defecto 4s) mientras la pestaña esté activa.
 * - Pausa el 100% de las consultas cuando la pestaña pasa a segundo plano o se bloquea la pantalla (Document Visibility API).
 * - Se reactiva de inmediato con una consulta instantánea al regresar a la app (eventos 'focus' y 'visibilitychange').
 * 
 * @param {Function} callback Función asíncrona o síncrona que refresca los datos.
 * @param {number} intervalMs Milisegundos entre cada consulta activa (ej. 4000ms = 4s).
 * @param {boolean} enabled Bandera para activar o suspender el polling condicionalmente.
 */
export function useSmartPolling(callback, intervalMs = 4000, enabled = true) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    let intervalId = null;

    const executeCallback = () => {
      if (document.visibilityState === "visible") {
        try {
          savedCallback.current?.();
        } catch (err) {
          console.error("Error executing smart polling callback:", err);
        }
      }
    };

    const startPolling = () => {
      if (intervalId) clearInterval(intervalId);
      intervalId = setInterval(executeCallback, intervalMs);
    };

    const stopPolling = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") {
        // Al volver a la pestaña, refrescar al instante y reiniciar el temporizador
        executeCallback();
        startPolling();
      } else {
        // En segundo plano, detener el polling para ahorrar batería, ancho de banda y peticiones
        stopPolling();
      }
    };

    // Iniciar si la pestaña está visible
    if (document.visibilityState === "visible") {
      startPolling();
    }

    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      stopPolling();
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, [intervalMs, enabled]);
}

export default useSmartPolling;
