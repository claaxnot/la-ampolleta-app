// =========================================================================
// SUPABASE EDGE FUNCTION: send-email
// =========================================================================
// Despachador de correos transaccionales para La Ampolleta Producciones
// Envío directo mediante servidor SMTP mail.laampolleta.tv (no-reply)
// Maneja:
// 1. Envío genérico (to, subject, html)
// 2. Recuperación de contraseña (action: 'reset-password')
// 3. Registro blindado de Staff (action: 'register-staff')
// =========================================================================

// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
// @ts-ignore
import nodemailer from "npm:nodemailer@6.9.13";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configuración SMTP de La Ampolleta
const SMTP_HOST = Deno.env.get("SMTP_HOST") || "mail.laampolleta.tv";
const SMTP_PORT = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
const SMTP_USER = Deno.env.get("SMTP_USER") || "no-reply@laampolleta.tv";
const SMTP_PASS = Deno.env.get("SMTP_PASS");
const SENDER_EMAIL = Deno.env.get("SENDER_EMAIL") || "La Ampolleta Producciones <no-reply@laampolleta.tv>";

// Helper para crear el transporte de correo
function createMailTransporter() {
  const host = Deno.env.get("SMTP_HOST") || "mail.laampolleta.tv";
  const port = parseInt(Deno.env.get("SMTP_PORT") || "465", 10);
  const user = Deno.env.get("SMTP_USER") || "no-reply@laampolleta.tv";
  const pass = Deno.env.get("SMTP_PASS") || atob("S21kcXR2Yzlka1hsTU9mMg==");

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
}

// Plantilla HTML: Recuperación de Contraseña
function getPasswordResetHtml(resetUrl: string, name?: string) {
  const currentYear = new Date().getFullYear();
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecer Contraseña - La Ampolleta Producciones</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header con Logo & Glow Ámbar -->
          <tr>
            <td align="center" style="background: linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(17, 24, 39, 0) 100%); padding: 36px 30px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="width: 72px; height: 72px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 18px; margin: 0 auto 16px; padding: 12px; box-sizing: border-box;">
                <img src="https://app.laampolleta.tv/logo.png" alt="La Ampolleta Logo" width="48" height="48" style="display: block; margin: 0 auto; object-fit: contain; border: 0;" />
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">
                LA AMPOLLETA
              </h1>
              <p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #f59e0b; text-transform: uppercase;">
                PRODUCCIONES & EVENTOS
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 30px;">
              <div style="display: inline-block; padding: 6px 14px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; margin-bottom: 20px;">
                <span style="font-size: 12px; font-weight: 700; color: #fbbf24; letter-spacing: 0.5px;">
                  🔐 Recuperación de Contraseña
                </span>
              </div>

              <h2 style="margin: 0 0 14px; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ${name ? `Hola, ${name}` : "¿Olvidaste tu contraseña?"}
              </h2>

              <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                Hemos recibido una solicitud para restablecer la contraseña de tu cuenta en el sistema de <strong style="color: #ffffff;">La Ampolleta Producciones</strong>. Para crear tu nueva clave, haz clic en el siguiente botón:
              </p>

              <!-- Botón CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000000; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 12px; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                      Restablecer mi Contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Nota de seguridad -->
              <div style="padding: 14px 18px; background-color: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; border-radius: 8px; font-size: 13px; line-height: 1.5; color: #d1d5db; margin-bottom: 20px;">
                ⚠️ <em>Este enlace es válido por 1 hora y de un solo uso. Si tú no realizaste esta solicitud, puedes ignorar este correo; tu contraseña actual continuará protegida y nadie podrá ingresar a tu cuenta.</em>
              </div>

              <p style="margin: 0; font-size: 12px; color: #6b7280; word-break: break-all;">
                Si tienes problemas con el botón, copia y pega el siguiente enlace en tu navegador:<br />
                <a href="${resetUrl}" style="color: #f59e0b; text-decoration: underline;">${resetUrl}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0f19; padding: 24px 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06);">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #9ca3af; letter-spacing: 0.5px;">
                La Ampolleta Producciones SpA
              </p>
              <p style="margin: 0; font-size: 11px; color: #6b7280;">
                Santiago de Chile · contacto@laampolleta.tv · © ${currentYear} Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}



// Plantilla HTML: Postulación Recibida
function getPostulacionHtml(data: {
  name: string;
  email: string;
  rut?: string;
  phone?: string;
  role?: string;
  bankName?: string;
  accountType?: string;
  accountNumber?: string;
}) {
  const currentYear = new Date().getFullYear();
  const fecha = new Date().toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Postulación Recibida - La Ampolleta Producciones</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <tr>
            <td align="center" style="background: linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(17, 24, 39, 0) 100%); padding: 36px 30px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="width: 72px; height: 72px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 18px; margin: 0 auto 16px; padding: 12px; box-sizing: border-box;">
                <img src="https://app.laampolleta.tv/logo.png" alt="La Ampolleta Logo" width="48" height="48" style="display: block; margin: 0 auto; object-fit: contain; border: 0;" />
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">
                LA AMPOLLETA
              </h1>
              <p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #f59e0b; text-transform: uppercase;">
                PRODUCCIONES & EVENTOS
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 32px 30px;">
              <div style="display: inline-block; padding: 6px 14px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; margin-bottom: 20px;">
                <span style="font-size: 12px; font-weight: 700; color: #fbbf24; letter-spacing: 0.5px;">
                  ⏳ Postulación en Revisión
                </span>
              </div>

              <h2 style="margin: 0 0 14px; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ¡Hola, ${data.name || "Postulante"}!
              </h2>

              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                Hemos recibido tu registro con éxito para formar parte de nuestro equipo en <strong style="color: #f59e0b;">La Ampolleta Producciones</strong>${data.role ? ` como <strong style="color: #ffffff;">${data.role}</strong>` : ""}.
              </p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b;">
                      Resumen de tu Ficha
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6">
                      <tr>
                        <td width="38%" style="font-size: 13px; color: #9ca3af;">Nombre:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.name}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Cargo / Área:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #f59e0b;">${data.role || "Staff"}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">RUT:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.rut || "-"}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Correo:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.email}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">WhatsApp / Tel:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.phone || "-"}</td>
                      </tr>
                      ${data.bankName ? `
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Banco:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.bankName}</td>
                      </tr>` : ""}
                      ${data.accountNumber ? `
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">N° Cuenta:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.accountNumber} (${data.accountType || "Vista/RUT"})</td>
                      </tr>` : ""}
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Fecha de registro:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${fecha}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <h3 style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #ffffff;">
                ¿Cuáles son los siguientes pasos?
              </h3>
              <ol style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Revisión de Producción:</strong> Nuestro equipo validará tus datos y antecedentes para incorporarte a nuestra base activa.
                </li>
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Aprobación y Notificación:</strong> Te enviaremos un correo electrónico y/o WhatsApp en cuanto tu cuenta sea habilitada.
                </li>
                <li>
                  <strong style="color: #e5e7eb;">Acceso a Convocatorias:</strong> Una vez aprobada tu cuenta, podrás ingresar con tu correo y contraseña para ver eventos, marcar asistencia con GPS y gestionar tus pagos.
                </li>
              </ol>

              <div style="padding: 14px 18px; background-color: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; border-radius: 8px; font-size: 13px; line-height: 1.5; color: #d1d5db;">
                💡 <em>Por motivos de seguridad, el ingreso a la app se habilitará una vez que producción apruebe tu perfil. ¡Te notificaremos muy pronto!</em>
              </div>
            </td>
          </tr>

          <tr>
            <td style="background-color: #0b0f19; padding: 24px 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06);">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #9ca3af; letter-spacing: 0.5px;">
                La Ampolleta Producciones SpA
              </p>
              <p style="margin: 0; font-size: 11px; color: #6b7280;">
                Santiago de Chile · contacto@laampolleta.tv · © ${currentYear} Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

// Plantilla HTML: Cuenta Creada Manualmente por Producción (con credenciales)
function getManualStaffWelcomeHtml(data: {
  name: string;
  email: string;
  password?: string;
  role?: string;
  loginUrl?: string;
}) {
  const currentYear = new Date().getFullYear();
  const loginUrl = data.loginUrl || "https://app.laampolleta.tv/login";

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bienvenida al Equipo - La Ampolleta Producciones</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header con Logo & Glow Ámbar -->
          <tr>
            <td align="center" style="background: linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(17, 24, 39, 0) 100%); padding: 36px 30px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="width: 72px; height: 72px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 18px; margin: 0 auto 16px; padding: 12px; box-sizing: border-box;">
                <img src="https://app.laampolleta.tv/logo.png" alt="La Ampolleta Logo" width="48" height="48" style="display: block; margin: 0 auto; object-fit: contain; border: 0;" />
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">
                LA AMPOLLETA
              </h1>
              <p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #f59e0b; text-transform: uppercase;">
                PRODUCCIONES & EVENTOS
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px 30px;">
              <div style="display: inline-block; padding: 6px 14px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; margin-bottom: 20px;">
                <span style="font-size: 12px; font-weight: 700; color: #fbbf24; letter-spacing: 0.5px;">
                  ✨ Cuenta de Staff Creada
                </span>
              </div>

              <h2 style="margin: 0 0 14px; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ¡Hola, ${data.name}!
              </h2>

              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                Te damos la bienvenida al equipo oficial de <strong style="color: #f59e0b;">La Ampolleta Producciones</strong>. La coordinación de producción ha creado tu cuenta activa en nuestra plataforma.
              </p>

              <!-- Tarjeta de Credenciales -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; margin-bottom: 24px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #f59e0b;">
                      Tus Datos de Acceso
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6">
                      <tr>
                        <td width="38%" style="font-size: 13px; color: #9ca3af;">Correo de acceso:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.email}</td>
                      </tr>
                      ${data.password ? `
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Contraseña inicial:</td>
                        <td style="font-size: 14px; font-weight: 700; color: #fbbf24; font-family: monospace;">${data.password}</td>
                      </tr>` : ""}
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Cargo / Área:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${data.role || "Staff"}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Botón CTA -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000000; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 34px; border-radius: 12px; box-shadow: 0 6px 20px rgba(245, 158, 11, 0.4); text-transform: uppercase; letter-spacing: 0.5px;">
                      Ingresar a la Plataforma &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <div style="padding: 14px 18px; background-color: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; border-radius: 8px; font-size: 13px; line-height: 1.5; color: #d1d5db; margin-bottom: 20px;">
                💡 <em>Por seguridad, tu contraseña inicial corresponde a los números de tu RUT (sin puntos ni guion). Te recomendamos iniciar sesión y cambiarla desde tu perfil si lo deseas.</em>
              </div>

              <!-- Funcionalidades -->
              <h3 style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #ffffff;">
                ¿Qué puedes hacer desde tu panel de staff?
              </h3>
              <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Eventos y Turnos:</strong> Revisa las fechas, horarios y ubicaciones donde se te convoque.
                </li>
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Asistencia GPS:</strong> Marca tu ingreso y salida en vivo desde tu celular en el lugar de cada evento.
                </li>
                <li>
                  <strong style="color: #e5e7eb;">Finanzas y Pagos:</strong> Consulta el resumen de tus pagos acumulados y sube tus boletas de honorarios fácilmente.
                </li>
              </ul>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #0b0f19; padding: 24px 30px; text-align: center; border-top: 1px solid rgba(255, 255, 255, 0.06);">
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #9ca3af; letter-spacing: 0.5px;">
                La Ampolleta Producciones SpA
              </p>
              <p style="margin: 0; font-size: 11px; color: #6b7280;">
                Santiago de Chile · contacto@laampolleta.tv · © ${currentYear} Todos los derechos reservados.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, type } = body;

    // Inicializar cliente Supabase Admin para operaciones con privilegios de sistema
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // =========================================================================
    // FLUJO 1: RECUPERACIÓN DE CONTRASEÑA
    // =========================================================================
    if (action === "reset-password" || type === "reset-password") {
      const email = body.email?.trim().toLowerCase();
      const redirectTo = body.redirectTo || "https://app.laampolleta.tv/reset-password";

      if (!email) {
        return new Response(
          JSON.stringify({ error: "El correo electrónico es requerido." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[PASSWORD RESET] Solicitando enlace de recuperación para: ${email}`);

      // Generar link criptográfico de recuperación en Supabase
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: email,
        options: {
          redirectTo: redirectTo,
        },
      });

      if (linkError) {
        console.warn(`[PASSWORD RESET ERROR]:`, linkError.message);
        // Si el usuario no existe, devolvemos mensaje seguro
        if (linkError.message?.toLowerCase().includes("not found") || linkError.message?.toLowerCase().includes("user")) {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Si este correo está registrado en La Ampolleta, recibirás un enlace de recuperación.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        throw linkError;
      }

      const resetUrl = linkData?.properties?.action_link;
      const userName = linkData?.user?.user_metadata?.name || "";

      if (!resetUrl) {
        throw new Error("No se pudo generar el enlace de recuperación en Supabase.");
      }

      const html = getPasswordResetHtml(resetUrl, userName);
      const subject = "🔐 Restablecer tu contraseña - La Ampolleta Producciones";

      const transporter = createMailTransporter();
      const info = await transporter.sendMail({
        from: SENDER_EMAIL,
        to: email,
        subject: subject,
        html: html,
      });

      console.log(`[PASSWORD RESET ENVIADO] MessageId: ${info.messageId} | Para: ${email}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Correo de recuperación enviado exitosamente.",
          messageId: info.messageId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // FLUJO 2: REGISTRO BLINDADO DE STAFF
    // =========================================================================
    if (action === "register-staff" || type === "register-staff") {
      const email = body.email?.trim().toLowerCase();
      const password = body.password;
      const {
        name,
        rut,
        phone,
        role = "Staff",
        codigo_banco_destino,
        cuenta_destino,
        tipo_cuenta,
        bankName,
        avatar_url,
      } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Correo y contraseña son obligatorios." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[STAFF REGISTER] Creando cuenta de staff para: ${email} (${name}) con rol: ${role}`);

      // 1. Crear usuario en Auth pre-confirmado (email_confirm: true)
      // Esto evita que Supabase intente mandar un correo y se caiga por el rate limit
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: name,
          rut: rut,
          phone: phone,
          role: role,
          system_role: "worker",
          status: "Pendiente",
          codigo_banco_destino: codigo_banco_destino,
          cuenta_destino: cuenta_destino,
          glosa_transferencia: tipo_cuenta,
          avatar_url: avatar_url || null,
        },
      });

      if (createError) {
        console.error("[STAFF REGISTER ERROR]:", createError.message);
        if (createError.message?.toLowerCase().includes("already registered") ||
            createError.message?.toLowerCase().includes("already exists")) {
          return new Response(
            JSON.stringify({ error: "Este correo electrónico ya se encuentra registrado. Inicia sesión o recupera tu contraseña." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = userData.user.id;

      // 2. Asegurar que la tabla public.profiles tenga la ficha completa y estado 'Pendiente'
      try {
        const profilePayload = {
          id: userId,
          name: name,
          rut: rut,
          phone: phone,
          role: role,
          system_role: "worker",
          status: "Pendiente",
          codigo_banco_destino: codigo_banco_destino,
          cuenta_destino: cuenta_destino,
          glosa_transferencia: tipo_cuenta,
          mensaje_beneficiario: phone,
          avatar_url: avatar_url || null,
        };

        const { error: upsertErr } = await supabaseAdmin
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" });

        if (upsertErr) {
          console.warn("[PROFILES UPSERT WARNING]:", upsertErr.message);
        }
      } catch (dbErr) {
        console.warn("[PROFILES DB ERROR]:", dbErr);
      }

      // 3. Despachar correo de postulación recibida mediante no-reply
      try {
        const postHtml = getPostulacionHtml({
          name: name,
          email: email,
          rut: rut,
          phone: phone,
          role: role,
          bankName: bankName,
          accountType: tipo_cuenta,
          accountNumber: cuenta_destino,
        });

        const transporter = createMailTransporter();
        const info = await transporter.sendMail({
          from: SENDER_EMAIL,
          to: email,
          subject: "Hemos recibido tu postulación - La Ampolleta Producciones",
          html: postHtml,
        });

        console.log(`[STAFF POSTULACION ENVIADO] MessageId: ${info.messageId} | Para: ${email}`);
      } catch (mailErr: any) {
        console.warn("[POSTULACION MAIL ERROR]:", mailErr?.message || mailErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: userData.user,
          message: "Postulación registrada con éxito.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // FLUJO 3: CREACIÓN MANUAL DE STAFF POR ADMINISTRADOR
    // =========================================================================
    if (action === "admin-create-staff" || type === "admin-create-staff") {
      const email = body.email?.trim().toLowerCase();
      const password = body.password;
      const {
        name,
        rut,
        phone,
        role = "Staff",
        system_role = "worker",
        codigo_banco_destino,
        cuenta_destino,
        cuenta_origen,
        monto_transferencia,
        glosa_transferencia,
      } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Correo y contraseña son obligatorios." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[ADMIN CREATE STAFF] Creando staff manual para: ${email} (${name}) con rol: ${role}`);

      // 1. Crear usuario en Auth pre-confirmado y con status 'Activo'
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true,
        user_metadata: {
          name: name,
          rut: rut,
          phone: phone,
          role: role,
          system_role: system_role,
          status: "Activo",
          codigo_banco_destino: codigo_banco_destino,
          cuenta_destino: cuenta_destino,
          cuenta_origen: cuenta_origen,
          monto_transferencia: monto_transferencia,
          glosa_transferencia: glosa_transferencia,
        },
      });

      if (createError) {
        console.error("[ADMIN CREATE STAFF ERROR]:", createError.message);
        if (createError.message?.toLowerCase().includes("already registered") ||
            createError.message?.toLowerCase().includes("already exists")) {
          return new Response(
            JSON.stringify({ error: "Este correo electrónico ya se encuentra registrado." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        return new Response(
          JSON.stringify({ error: createError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = userData.user.id;

      // 2. Asegurar registro en public.profiles con status: 'Activo'
      try {
        const profilePayload = {
          id: userId,
          email: email,
          name: name,
          rut: rut,
          phone: phone,
          role: role,
          system_role: system_role,
          status: "Activo",
          codigo_banco_destino: codigo_banco_destino,
          cuenta_destino: cuenta_destino,
          cuenta_origen: cuenta_origen,
          monto_transferencia: monto_transferencia,
          glosa_transferencia: glosa_transferencia,
          mensaje_beneficiario: phone,
          email_confirmed: true,
        };

        const { error: upsertErr } = await supabaseAdmin
          .from("profiles")
          .upsert(profilePayload, { onConflict: "id" });

        if (upsertErr) {
          console.warn("[ADMIN STAFF UPSERT WARNING]:", upsertErr.message);
        }
      } catch (dbErr) {
        console.warn("[ADMIN STAFF DB ERROR]:", dbErr);
      }

      // 3. Despachar correo oficial de bienvenida con credenciales desde no-reply
      try {
        const welcomeHtml = getManualStaffWelcomeHtml({
          name: name,
          email: email,
          password: password,
          role: role,
          loginUrl: "https://app.laampolleta.tv/login",
        });

        const transporter = createMailTransporter();
        const info = await transporter.sendMail({
          from: SENDER_EMAIL,
          to: email,
          subject: "🎉 ¡Te damos la bienvenida al equipo! Tus datos de acceso - La Ampolleta Producciones",
          html: welcomeHtml,
        });

        console.log(`[MANUAL STAFF WELCOME ENVIADO] MessageId: ${info.messageId} | Para: ${email}`);
      } catch (mailErr: any) {
        console.warn("[MANUAL STAFF MAIL ERROR]:", mailErr?.message || mailErr);
      }

      return new Response(
        JSON.stringify({
          success: true,
          user: userData.user,
          message: "Staff creado exitosamente y correo de bienvenida enviado.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // FLUJO 4: REENVIAR ACCESO / ACTIVACIÓN POR PARTE DE UN ADMINISTRADOR
    // =========================================================================
    if (action === "resend-welcome" || type === "resend-welcome") {
      const email = body.email?.trim().toLowerCase();
      const name = body.name || "Miembro del Staff";
      const role = body.role || "Staff";

      if (!email) {
        return new Response(
          JSON.stringify({ error: "El correo es requerido." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[RESEND WELCOME] Reenviando acceso para: ${email}`);

      // Generar link criptográfico de recuperación oficial para acceso directo
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: email,
        options: {
          redirectTo: "https://app.laampolleta.tv/reset-password",
        },
      });

      if (linkError) {
        throw linkError;
      }

      const resetUrl = linkData?.properties?.action_link;
      const html = getPasswordResetHtml(resetUrl, name);
      const subject = "🔐 Tus datos de acceso - La Ampolleta Producciones";

      const transporter = createMailTransporter();
      const info = await transporter.sendMail({
        from: SENDER_EMAIL,
        to: email,
        subject: subject,
        html: html,
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Correo de acceso reenviado exitosamente.",
          messageId: info.messageId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // =========================================================================
    // FLUJO 5: DESPACHO GENÉRICO (to, subject, html)
    // Usado por Aprobación de Cuenta, Rechazo de Cuenta, etc.
    // =========================================================================
    const { to, subject, html } = body;

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Faltan parámetros requeridos: to, subject, html" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transporter = createMailTransporter();
    const info = await transporter.sendMail({
      from: SENDER_EMAIL,
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
    console.error("Error en Edge Function send-email:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Error interno enviando correo" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
