// src/services/emailService.js
// Servicio de plantillas y despacho de correos automáticos para La Ampolleta Producciones
import { supabase } from "../lib/supabase.js";

/**
 * Plantilla HTML: Postulación Recibida
 */
export const getPostulacionRecibidaTemplate = ({
  name,
  email,
  rut,
  phone,
  bankName,
  accountType,
  accountNumber
}) => {
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
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header with Amber Glow & Logo -->
          <tr>
            <td align="center" style="background: linear-gradient(180deg, rgba(245, 158, 11, 0.15) 0%, rgba(17, 24, 39, 0) 100%); padding: 36px 30px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="width: 72px; height: 72px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 18px; margin: 0 auto 16px; padding: 12px; box-sizing: border-box;">
                <img src="https://laampolleta.tv/logo.png" onerror="this.src='https://raw.githubusercontent.com/crisvidaldev/app-ampolleta/main/public/logo.png'" alt="La Ampolleta Logo" width="48" height="48" style="display: block; margin: 0 auto; object-fit: contain;" />
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">
                LA AMPOLLETA
              </h1>
              <p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #f59e0b; text-transform: uppercase;">
                PRODUCCIONES & EVENTOS
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 30px;">
              <!-- Status Badge -->
              <div style="display: inline-block; padding: 6px 14px; background-color: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 9999px; margin-bottom: 20px;">
                <span style="font-size: 12px; font-weight: 700; color: #fbbf24; letter-spacing: 0.5px;">
                  ⏳ Postulación en Revisión
                </span>
              </div>

              <h2 style="margin: 0 0 14px; font-size: 22px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ¡Hola, ${name || "Postulante"}!
              </h2>

              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                Hemos recibido tu registro con éxito para formar parte de nuestro equipo de <strong style="color: #ffffff;">Anfitrionas & Staff</strong> en <strong style="color: #f59e0b;">La Ampolleta Producciones</strong>.
              </p>

              <!-- Applicant Summary Box -->
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
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${name}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">RUT:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${rut || "-"}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Correo:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${email}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">WhatsApp / Tel:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${phone || "-"}</td>
                      </tr>
                      ${bankName ? `
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Banco:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${bankName}</td>
                      </tr>
                      ` : ""}
                      ${accountNumber ? `
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">N° Cuenta:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${accountNumber} (${accountType || "Vista/RUT"})</td>
                      </tr>
                      ` : ""}
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Fecha de envío:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${fecha}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Steps Explanation -->
              <h3 style="margin: 0 0 10px; font-size: 15px; font-weight: 700; color: #ffffff;">
                ¿Cuáles son los siguientes pasos?
              </h3>
              <ol style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Revisión de Producción:</strong> Nuestro equipo validará tus datos y antecedentes para incorporarte a nuestra base activa.
                </li>
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Aprobación y Activación:</strong> Te enviaremos un correo electrónico y/o WhatsApp en cuanto tu cuenta sea habilitada.
                </li>
                <li>
                  <strong style="color: #e5e7eb;">Acceso a Convocatorias:</strong> Una vez aprobada, podrás ingresar con tu correo y contraseña a la plataforma para ver eventos, marcar turnos con GPS y gestionar tus pagos.
                </li>
              </ol>

              <!-- Friendly note -->
              <div style="padding: 14px 18px; background-color: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; border-radius: 8px; font-size: 13px; line-height: 1.5; color: #d1d5db;">
                💡 <em>Por motivos de seguridad, el ingreso al sistema se habilitará una vez que producción apruebe tu perfil. ¡Te avisaremos muy pronto!</em>
              </div>
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
};

/**
 * Plantilla HTML: Cuenta Aprobada
 */
export const getCuentaAprobadaTemplate = ({
  name,
  email,
  loginUrl = "https://app.laampolleta.tv"
}) => {
  const currentYear = new Date().getFullYear();

  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cuenta Aprobada - La Ampolleta Producciones</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f3f4f6;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 40px 15px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #111827; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);" cellspacing="0" cellpadding="0">
          
          <!-- Header with Emerald/Amber Glow & Logo -->
          <tr>
            <td align="center" style="background: linear-gradient(180deg, rgba(16, 185, 129, 0.15) 0%, rgba(17, 24, 39, 0) 100%); padding: 36px 30px 24px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
              <div style="width: 72px; height: 72px; background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(16, 185, 129, 0.5); border-radius: 18px; margin: 0 auto 16px; padding: 12px; box-sizing: border-box;">
                <img src="https://laampolleta.tv/logo.png" onerror="this.src='https://raw.githubusercontent.com/crisvidaldev/app-ampolleta/main/public/logo.png'" alt="La Ampolleta Logo" width="48" height="48" style="display: block; margin: 0 auto; object-fit: contain;" />
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #ffffff; text-transform: uppercase;">
                LA AMPOLLETA
              </h1>
              <p style="margin: 4px 0 0; font-size: 11px; font-weight: 700; letter-spacing: 3px; color: #10b981; text-transform: uppercase;">
                PRODUCCIONES & EVENTOS
              </p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 30px;">
              <!-- Status Badge -->
              <div style="display: inline-block; padding: 6px 14px; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 9999px; margin-bottom: 20px;">
                <span style="font-size: 12px; font-weight: 700; color: #34d399; letter-spacing: 0.5px;">
                  ✨ ¡Postulación Aprobada con Éxito!
                </span>
              </div>

              <h2 style="margin: 0 0 14px; font-size: 24px; font-weight: 700; color: #ffffff; line-height: 1.3;">
                ¡Felicidades y bienvenida, ${name || "Anfitriona"}!
              </h2>

              <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.6; color: #9ca3af;">
                Tu perfil ha sido revisado y <strong style="color: #34d399;">aprobado</strong> por el equipo de producción. A partir de este momento, eres parte oficial de nuestro staff activo.
              </p>

              <!-- Access Information Card -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; margin-bottom: 26px; overflow: hidden;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.06);">
                    <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #34d399;">
                      Datos de Acceso
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 18px 20px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6">
                      <tr>
                        <td width="35%" style="font-size: 13px; color: #9ca3af;">Correo de acceso:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">${email}</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Contraseña:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #ffffff;">La que definiste en tu registro</td>
                      </tr>
                      <tr>
                        <td style="font-size: 13px; color: #9ca3af;">Rol asignado:</td>
                        <td style="font-size: 13px; font-weight: 600; color: #f59e0b;">Anfitriona / Staff</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Call to Action Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 28px;">
                <tr>
                  <td align="center">
                    <a href="${loginUrl}" target="_blank" style="display: inline-block; padding: 15px 36px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #000000; font-size: 15px; font-weight: 800; text-decoration: none; border-radius: 12px; letter-spacing: 0.5px; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.35);">
                      INGRESAR A LA PLATAFORMA &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Features included -->
              <h3 style="margin: 0 0 12px; font-size: 15px; font-weight: 700; color: #ffffff;">
                ¿Qué puedes hacer desde tu panel de staff?
              </h3>
              <ul style="margin: 0 0 24px; padding-left: 20px; font-size: 14px; line-height: 1.6; color: #9ca3af;">
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Eventos y Turnos:</strong> Revisa las fechas, horarios y ubicaciones donde estés asignada.
                </li>
                <li style="margin-bottom: 8px;">
                  <strong style="color: #e5e7eb;">Asistencia GPS:</strong> Marca tu ingreso y salida en vivo desde tu celular en el lugar del evento.
                </li>
                <li>
                  <strong style="color: #e5e7eb;">Finanzas y Pagos:</strong> Consulta el resumen de tus pagos acumulados y sube tus boletas de honorarios fácilmente.
                </li>
              </ul>

              <!-- Recommendation -->
              <div style="padding: 14px 18px; background-color: rgba(16, 185, 129, 0.08); border-left: 3px solid #10b981; border-radius: 8px; font-size: 13px; line-height: 1.5; color: #d1d5db;">
                📲 <em>Tip: Guarda la aplicación en la pantalla de inicio de tu celular (iPhone o Android) para acceder más rápido y recibir notificaciones instantáneas de eventos.</em>
              </div>
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
};

/**
 * Despacha notificación por correo de "Postulación Recibida"
 */
export const sendPostulacionRecibidaEmail = async (applicantData) => {
  const { email, name } = applicantData;
  if (!email) return;

  const subject = "Hemos recibido tu postulación - La Ampolleta Producciones";
  const html = getPostulacionRecibidaTemplate(applicantData);

  try {
    // 1. Invocar Edge Function si existe
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        subject,
        html,
        type: "postulacion_recibida"
      }
    });

    if (error) {
      console.info("ℹ️ [EMAIL SERVICE]: Edge Function send-email not configured or offline:", error.message || error);
    } else {
      console.log("✅ [EMAIL SERVICE]: Correo de postulación recibida despachado a", email, data);
    }
  } catch (err) {
    console.info("ℹ️ [EMAIL SERVICE]: Supabase send-email function not ready yet, logged gracefully.");
  }
};

/**
 * Despacha notificación por correo de "Cuenta Aprobada"
 */
export const sendCuentaAprobadaEmail = async ({ name, email, userId }) => {
  if (!email) return;

  const loginUrl = window?.location?.origin 
    ? `${window.location.origin}/login` 
    : "https://app.laampolleta.tv/login";

  const subject = "🎉 ¡Bienvenida al equipo! Tu cuenta ha sido aprobada - La Ampolleta Producciones";
  const html = getCuentaAprobadaTemplate({ name, email, loginUrl });

  // 1. Crear notificación en base de datos si tenemos userId
  if (userId) {
    try {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "🎉 ¡Cuenta Aprobada!",
        description: "Tu perfil ha sido aprobado por producción. Ya puedes postularte y participar en los eventos oficiales.",
        type: "success"
      });
    } catch (notifErr) {
      console.warn("⚠️ [EMAIL SERVICE]: No se pudo registrar notificación en tabla:", notifErr);
    }
  }

  // 2. Invocar Edge Function para despacho de correo
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: {
        to: email,
        subject,
        html,
        type: "cuenta_aprobada"
      }
    });

    if (error) {
      console.info("ℹ️ [EMAIL SERVICE]: Edge Function send-email offline or returned:", error.message || error);
    } else {
      console.log("✅ [EMAIL SERVICE]: Correo de aprobación despachado a", email, data);
    }
  } catch (err) {
    console.info("ℹ️ [EMAIL SERVICE]: Supabase send-email function not ready yet, logged gracefully.");
  }
};
