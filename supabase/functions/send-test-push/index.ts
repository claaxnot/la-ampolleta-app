// =========================================================================
// SUPABASE EDGE FUNCTION: send-test-push
// =========================================================================
// Firma y envía notificaciones Web Push nativas de prueba usando VAPID
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
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Manejo de preflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Inicializar cliente Supabase Admin para evadir RLS y gestionar suscripciones
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Extraer y verificar la identidad del usuario a través del JWT de autorización
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, message: "Falta encabezado de autorización en la petición." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, message: "Sesión inválida o expirada. Inicie sesión de nuevo." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Cargar credenciales VAPID del entorno de Supabase
    // Claves fallback para pruebas iniciales seguras en localhost
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "BK6xAJN2En_UF2GqhoXB_UPpt_lKy__dlpOSOb7nYnhRiOv_tvGZ_NqlcqfXkGQjADrRJzxVYKLhVDcPv7ceFT0";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "jZUe-GW_v6GUpWbuavSIu9aWs9acpEnnqav8Thp7yTM";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:contacto@laampolleta.tv";

    if (!vapidPrivateKey) {
      return new Response(
        JSON.stringify({ success: false, message: "Clave privada VAPID no configurada en las variables de entorno." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Configurar firma VAPID
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    // 4. Obtener todos los dispositivos registrados y activos del usuario solicitante
    const { data: subscriptions, error: subsError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .eq("active", true);

    if (subsError) {
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No se encontraron suscripciones push activas registradas para este dispositivo/usuario." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Preparar mensaje de notificación Push
    const pushPayload = JSON.stringify({
      title: "La Ampolleta",
      body: "🔔 ¡Excelente! Las notificaciones push han sido activadas correctamente en tu dispositivo.",
      url: "/profile",
      tag: "test-push-notification"
    });

    let successCount = 0;
    let failureCount = 0;

    // 6. Realizar envíos directos a los servidores push (Apple, Google, Mozilla)
    for (const sub of subscriptions) {
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
        console.warn(`⚠️ Fallo de envío al endpoint del dispositivo ID ${sub.id}:`, pushErr);
        failureCount++;

        // Si el endpoint devuelve 404 (Not Found) o 410 (Gone), el token expiró o la suscripción fue revocada
        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
          console.log(`🧹 Desactivando automáticamente suscripción obsoleta ID: ${sub.id}`);
          await supabase
            .from("push_subscriptions")
            .update({ active: false, revoked_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Envío completado. Dispositivos exitosos: ${successCount}. Dispositivos fallidos/obsoletos: ${failureCount}.`,
        sentCount: successCount,
        failedCount: failureCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ Error general en Edge Function send-test-push:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message || err }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
