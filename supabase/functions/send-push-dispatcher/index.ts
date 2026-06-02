// =========================================================================
// SUPABASE EDGE FUNCTION: send-push-dispatcher
// =========================================================================
// Despachador automático de notificaciones Web Push nativas para eventos
// =========================================================================

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
// @ts-ignore
import webpush from "npm:web-push@3.6.7";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-token",
};

serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Inicializar cliente Supabase Admin con service key para bypass RLS
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Extraer cabeceras de autorización
    const authHeader = req.headers.get("Authorization") || "";
    const internalHeader = req.headers.get("X-Internal-Token") || "";

    // 3. Validar token interno (Vault) o en su defecto JWT estándar
    const expectedInternalToken = Deno.env.get("INTERNAL_PUSH_TOKEN") || "la_ampolleta_push_internal_token_secret_2026";
    let isAuthorized = false;

    if (internalHeader && internalHeader === expectedInternalToken) {
      isAuthorized = true;
    } else if (authHeader) {
      // Fallback: Validar con JWT estándar (útil para pruebas manuales autenticadas desde el cliente)
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ success: false, message: "Petición no autorizada. Acceso denegado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Parsear el payload enviado desde el trigger de base de datos
    let requestData: any = {};
    try {
      requestData = await req.json();
    } catch (_) {
      return new Response(
        JSON.stringify({ success: false, message: "Cuerpo de petición JSON inválido." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { notification_id, log_id, user_id, title, description, type, related_event_id } = requestData;

    if (!user_id || !notification_id) {
      return new Response(
        JSON.stringify({ success: false, message: "Parámetros user_id y notification_id obligatorios." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Cargar credenciales VAPID
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "BK6xAJN2En_UF2GqhoXB_UPpt_lKy__dlpOSOb7nYnhRiOv_tvGZ_NqlcqfXkGQjADrRJzxVYKLhVDcPv7ceFT0";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "jZUe-GW_v6GUpWbuavSIu9aWs9acpEnnqav8Thp7yTM";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:contacto@laampolleta.tv";

    if (!vapidPrivateKey) {
      throw new Error("Clave privada VAPID no configurada en las variables de entorno de Supabase.");
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 6. Obtener dispositivos push activos para el usuario
    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id)
      .eq("active", true);

    if (subsError) {
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      // Registrar que no hay destinatarios activos
      if (log_id) {
        await supabase
          .from("push_delivery_logs")
          .update({ status: "no_subscribers", updated_at: new Date().toISOString() })
          .eq("id", log_id);
      }
      return new Response(
        JSON.stringify({ success: true, message: "No hay dispositivos con push activo para este usuario." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Diseñar mensaje breve y seguro (Privacy by Design - Sin información sensible)
    let pushBody = "Tienes una nueva notificación en tu portal de La Ampolleta.";
    let pushUrl = "/";

    if (type === "event_assigned") {
      pushBody = "📅 Nuevo evento asignado. Revisa los detalles en tu portal.";
      pushUrl = "/"; 
    } else if (type === "event_updated") {
      pushBody = "🔔 Evento actualizado. Hay cambios importantes en tu jornada.";
      pushUrl = "/";
    } else if (type === "event_cancelled") {
      pushBody = "🚫 Evento cancelado. Tu citación ha sido removida.";
      pushUrl = "/";
    } else if (type === "assignment_removed") {
      pushBody = "🚫 Citación removida. Revisa tu panel para más detalles.";
      pushUrl = "/";
    }

    const pushPayload = JSON.stringify({
      title: "La Ampolleta",
      body: pushBody,
      url: pushUrl,
      tag: `notification-${notification_id}`
    });

    let successCount = 0;
    let failureCount = 0;
    const errorsList: string[] = [];

    // 8. Enviar notificaciones en paralelo
    const deliveryPromises = subscriptions.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushSubscription, pushPayload);
        successCount++;

        // Actualizar último avistamiento
        await supabase
          .from("push_subscriptions")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("id", sub.id);

      } catch (pushErr: any) {
        failureCount++;
        errorsList.push(`Endpoint ${sub.id}: ${pushErr.message || pushErr}`);

        // Manejo automático de tokens obsoletos (404/410)
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          console.log(`🧹 Marcando suscripción obsoleta ID ${sub.id} como inactiva.`);
          await supabase
            .from("push_subscriptions")
            .update({ active: false, revoked_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
      }
    });

    await Promise.all(deliveryPromises);

    // 9. Actualizar log de entrega con estadísticas finales
    if (log_id) {
      const finalStatus = successCount > 0 ? "success" : "failed";
      await supabase
        .from("push_delivery_logs")
        .update({
          status: finalStatus,
          sent_count: successCount,
          failed_count: failureCount,
          error_message: errorsList.length > 0 ? errorsList.join(" | ") : null,
          updated_at: new Date().toISOString()
        })
        .eq("id", log_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Entrega push finalizada. Éxitos: ${successCount}. Fallidos: ${failureCount}.`,
        sentCount: successCount,
        failedCount: failureCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ Error crítico en send-push-dispatcher:", err);
    
    // Intentar registrar el fallo en el log si se proporcionó log_id
    try {
      const requestData = await req.clone().json().catch(() => ({}));
      if (requestData.log_id) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        await supabase
          .from("push_delivery_logs")
          .update({
            status: "failed",
            error_message: `Error general en Edge Function: ${err.message || err}`,
            updated_at: new Date().toISOString()
          })
          .eq("id", requestData.log_id);
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({ success: false, error: err.message || err }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
