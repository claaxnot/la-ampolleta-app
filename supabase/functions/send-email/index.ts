// =========================================================================
// SUPABASE EDGE FUNCTION: send-email
// =========================================================================
// Despachador de correos transaccionales para La Ampolleta Producciones
// Envío directo mediante servidor SMTP mail.laampolleta.tv y soporte Resend
// =========================================================================

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import nodemailer from "npm:nodemailer@6.9.13";

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
    const senderEmail = Deno.env.get("SENDER_EMAIL") || "La Ampolleta Producciones <no-reply@laampolleta.tv>";

    // Opción 1: Resend si está configurado en las variables de entorno
    if (resendApiKey) {
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

      return new Response(JSON.stringify({ success: true, provider: "resend", data }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Opción 2: Servidor SMTP propio de La Ampolleta (mail.laampolleta.tv:465)
    const smtpHost = Deno.env.get("SMTP_HOST") || "mail.laampolleta.tv";
    const smtpPort = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
    const smtpUser = Deno.env.get("SMTP_USER") || "no-reply@laampolleta.tv";
    const smtpPass = Deno.env.get("SMTP_PASS") || "Kmdqtvc9dkXlMOf2";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const info = await transporter.sendMail({
      from: senderEmail,
      to,
      subject,
      html,
    });

    console.log(`[SMTP EMAIL ENVIADO] MessageId: ${info.messageId} | Para: ${to} | Asunto: ${subject}`);

    return new Response(
      JSON.stringify({
        success: true,
        provider: "smtp",
        messageId: info.messageId,
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
