// =========================================================================
// SUPABASE EDGE FUNCTION: send-email
// =========================================================================
// Despachador de correos transaccionales para La Ampolleta Producciones
// Admite Resend API y modo fallback de desarrollo
// =========================================================================

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "La Ampolleta Producciones <contacto@laampolleta.tv>";

    if (resendApiKey) {
      // Envío vía Resend API oficial
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: senderEmail,
          to: [to],
          subject: subject,
          html: html,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Error al enviar correo con Resend");
      }

      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo simulación si aún no han configurado RESEND_API_KEY
    console.log(`[SIMULACIÓN EMAIL] Para: ${to} | Asunto: ${subject}`);
    return new Response(
      JSON.stringify({
        success: true,
        simulation: true,
        message: "Correo simulado con éxito (configura RESEND_API_KEY en Supabase Secrets para envío real)",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in send-email:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno enviando correo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
