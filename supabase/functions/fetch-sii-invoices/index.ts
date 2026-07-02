// =========================================================================
// SUPABASE EDGE FUNCTION: fetch-sii-invoices
// =========================================================================
// Servidor IMAP: Detección, comparación y auto-validación de Boletas SII
// =========================================================================


// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
// @ts-ignore
import { ImapFlow } from "npm:imapflow@1.0.155";
// @ts-ignore
import { simpleParser } from "npm:mailparser@3.6.5";

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

  // Cargar secretos de entorno obligatorios
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const imapHost = Deno.env.get("IMAP_HOST") || "";
  const imapPort = parseInt(Deno.env.get("IMAP_PORT") || "993", 10);
  const imapUser = Deno.env.get("IMAP_USER") || "";
  const imapPassword = Deno.env.get("IMAP_PASSWORD") || "";
  const officialReceptorRut = normalizeRut(Deno.env.get("OFFICIAL_RECEPTOR_RUT") || "76666197-1");
  const toleranceSetting = parseInt(Deno.env.get("TOLERANCE_SETTING") || "10", 10);

  // Inicializar Supabase Admin Client
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  let requestData: any = {};
  try {
    requestData = await req.json();
  } catch (_) { }

  // Estructura de Resumen de Ejecución
  const summary = {
    emailsReviewed: 0,
    newInvoices: 0,
    autoVerified: 0,
    needsReview: 0,
    rejected: 0,
    xmlErrors: 0,
    logs: [] as string[]
  };

  // Validación básica de entorno
  if (!imapHost || !imapUser || !imapPassword) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Credenciales de servidor IMAP no configuradas en Edge Functions Secrets.",
        summary
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // IMAP Client setup con timeout defensivo global (Requirement 3)
  const client = new ImapFlow({
    host: imapHost,
    port: imapPort,
    secure: true,
    auth: {
      user: imapUser,
      pass: imapPassword
    },
    tls: {
      rejectUnauthorized: false
    },
    logger: false,
    clientInfo: { name: "LaAmpolleta-Boletas" }
  });

  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Timeout de conexión al servidor de correo IMAP (30s).")), 30000)
  );

  const isPushMode = requestData.action === "push" && Array.isArray(requestData.emails);
  let emailsToProcess: any[] = [];

  try {
    if (isPushMode) {
      summary.logs.push(`Modo inyección directa (PUSH): procesando ${requestData.emails.length} correos.`);
      emailsToProcess = requestData.emails;
    } else {
      summary.logs.push("Estableciendo conexión segura con servidor de correo...");

      // Conectarse con Timeout Defensivo
      await Promise.race([client.connect(), timeoutPromise]);
      summary.logs.push("Conexión IMAP establecida con éxito.");

      // Abrir buzón principal (INBOX) en modo lectura únicamente
      let mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
      summary.logs.push(`Buzón INBOX abierto. Mensajes totales: ${mailbox.exists}`);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // En lugar de hacer una búsqueda "since" IMAP (la cual es inestable en cPanel/Dovecot y omite mensajes),
      // leemos las cabeceras de los últimos 600 mensajes de la bandeja de entrada y filtramos en memoria.
      const totalMessages = mailbox.exists;
      const startSeq = Math.max(1, totalMessages - 600);
      summary.logs.push(`Analizando los últimos ${totalMessages - startSeq + 1} mensajes por rango de secuencia (${startSeq}:${totalMessages})...`);

      const range = `${startSeq}:${totalMessages}`;
      const messageStream = client.fetch(range, { envelope: true });

      const matchingMessages = [];

      for await (const msg of messageStream) {
        if (!msg || !msg.envelope) continue;

        // Validar fecha en memoria
        const msgDate = msg.envelope.date || new Date();
        if (msgDate < thirtyDaysAgo) continue;

        const senderEmail = (msg.envelope.from?.[0]?.address || "").toLowerCase();

        const isOfficialSender = senderEmail === "siichile@sii.cl" ||
          senderEmail === "boleta.honorarios@sii.cl" ||
          senderEmail === "noreply@sii.cl";

        if (!isOfficialSender) {
          continue;
        }

        const subject = msg.envelope.subject || "Copia de Boleta de Honorarios Electrónica";
        const isAnulada = subject.toLowerCase().includes("anulada") ||
          subject.toLowerCase().includes("anulación") ||
          subject.toLowerCase().includes("anulacion");

        if (isAnulada) {
          summary.logs.push(`🛑 Omitiendo correo de boleta anulada: "${subject}"`);
          continue;
        }

        matchingMessages.push({
          uid: msg.uid,
          subject,
          senderEmail
        });
      }

      summary.logs.push(`🔍 Encontrados ${matchingMessages.length} correos oficiales en memoria. Descargando fuentes...`);

      // Iterar y descargar
      for (const m of matchingMessages) {
        summary.logs.push(`📥 Descargando boleta SII oficial detectada: UID ${m.uid} | Asunto: "${m.subject}"...`);

        // 2. Descargar el correo completo
        let message = await client.fetchOne(m.uid.toString(), { source: true }, { uid: true });
        if (!message || !message.source) {
          summary.logs.push(`⚠️ No se pudo descargar el correo UID: ${m.uid} (IMAP Fallback).`);
          continue;
        }
        const parsedMail = await simpleParser(message.source);
        const messageId = parsedMail.messageId || `imap_uid_${m.uid}`;
        const sender = m.senderEmail || "siichile@sii.cl";
        const receivedAt = parsedMail.date || new Date();
        const rawText = parsedMail.text || parsedMail.textAsHtml || "";

        const xmlAttachment = parsedMail.attachments.find((att: any) =>
          att.contentType?.includes("xml") ||
          att.filename?.toLowerCase().endsWith(".xml")
        );
        let xmlContent = "";
        if (xmlAttachment) {
          xmlContent = new TextDecoder().decode(xmlAttachment.content);
        }

        emailsToProcess.push({
          messageId,
          sender,
          subject: m.subject,
          receivedAt,
          rawText,
          xmlContent
        });
      }
    }

    // Iterar de manera segura e incremental sobre los correos preparados
    for (const email of emailsToProcess) {
      summary.emailsReviewed++;

      const messageId = email.messageId;
      const sender = email.sender;
      const subject = email.subject;
      const receivedAt = email.receivedAt;
      const rawText = email.rawText;
      const raw_text_preview = rawText.substring(0, 500); // Storage Optimization (Máx 500 chars)

      // De-duplicación estricta por message_id antes de parsear XML (Optimización de red y DB)
      const { data: existingInvoice } = await supabase
        .from("detected_invoices")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existingInvoice) {
        summary.logs.push(`Mensaje ID [${messageId}] ya fue procesado anteriormente. Omitiendo.`);
        continue;
      }

      // Extraer datos iniciales del cuerpo del correo (como respaldo)
      const notificationDate = extractNotificationDate(rawText);
      const issuerName = extractIssuerName(rawText);

      // --- DE-DUPLICACIÓN PROFUNDA DE NEGOCIO (RUT Emisor + Folio de Boleta) ---
      const bodyIssuerRut = normalizeRut(extractIssuerRutFromBody(rawText) || "sin-rut");
      const bodyInvoiceNumber = extractInvoiceNumberFromBody(rawText) || "0";

      let xmlIssuerRut = "";
      let xmlInvoiceNumber = "";
      if (email.xmlContent) {
        try {
          const tempParsed = parseSiiXml(email.xmlContent);
          if (tempParsed.success && tempParsed.data) {
            xmlIssuerRut = normalizeRut(tempParsed.data.issuerRut || "");
            xmlInvoiceNumber = tempParsed.data.invoiceNumber || "";
          }
        } catch (e) {
          // Ignorar error temporal de parseo para de-duplicación
        }
      }

      const finalIssuerRut = xmlIssuerRut || bodyIssuerRut;
      const finalInvoiceNumber = xmlInvoiceNumber || bodyInvoiceNumber;

      if (finalIssuerRut !== "sin-rut" && finalInvoiceNumber !== "0") {
        const { data: duplicateInvoice } = await supabase
          .from("detected_invoices")
          .select("id, message_id")
          .eq("issuer_rut", finalIssuerRut)
          .eq("invoice_number", finalInvoiceNumber)
          .maybeSingle();

        if (duplicateInvoice) {
          summary.logs.push(`La Boleta Folio [${finalInvoiceNumber}] del Emisor [${finalIssuerRut}] ya existe en la base de datos (Original ID: ${duplicateInvoice.message_id}). Omitiendo duplicado.`);
          continue;
        }
      }
      // -------------------------------------------------------------------------

      if (!email.xmlContent) {
        // Guardar registro como rejected / missing_xml
        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: extractIssuerRutFromBody(rawText) || "sin-rut",
          issuer_name: issuerName,
          invoice_number: extractInvoiceNumberFromBody(rawText) || "0",
          invoice_date: notificationDate || new Date(),
          invoice_amount: 0,
          liquid_amount: 0,
          withheld_tax: 0,
          tax_rate: 0,
          raw_text_preview,
          match_status: "rejected",
          confidence_score: 0,
          match_reason: "El correo no contiene el archivo XML oficial adjunto del SII.",
          xml_parse_status: "missing_xml",
          xml_parse_error: "No XML attachment found in email."
        });
        summary.rejected++;
        summary.newInvoices++;
        continue;
      }

      // Decodificar y Parsear el archivo XML
      const parsedXml = parseSiiXml(email.xmlContent);

      if (!parsedXml.success) {
        summary.xmlErrors++;
        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: extractIssuerRutFromBody(rawText) || "sin-rut",
          issuer_name: issuerName,
          invoice_number: extractInvoiceNumberFromBody(rawText) || "0",
          invoice_date: notificationDate || new Date(),
          invoice_amount: 0,
          liquid_amount: 0,
          withheld_tax: 0,
          tax_rate: 0,
          raw_text_preview,
          match_status: "rejected",
          confidence_score: 0,
          match_reason: `El XML adjunto no pudo ser leído: ${parsedXml.error}`,
          xml_parse_status: "invalid_xml",
          xml_parse_error: parsedXml.error?.substring(0, 100)
        });
        summary.rejected++;
        summary.newInvoices++;
        continue;
      }

      // Validar datos mínimos obligatorios del XML
      const {
        issuerRut,
        issuerNameXml,
        invoiceNumber,
        invoiceDate,
        invoiceAmount,
        liquidAmount,
        withheldTax,
        taxRate,
        receiverRut,
        receiverName
      } = parsedXml.data!;

      if (!issuerRut || !invoiceNumber || !invoiceDate || !invoiceAmount) {
        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: issuerRut || "sin-rut",
          issuer_name: issuerNameXml || issuerName,
          invoice_number: invoiceNumber || "0",
          invoice_date: invoiceDate || notificationDate || new Date(),
          invoice_amount: invoiceAmount || 0,
          liquid_amount: liquidAmount || 0,
          withheld_tax: withheldTax || 0,
          tax_rate: taxRate || 0,
          raw_text_preview,
          match_status: "rejected",
          confidence_score: 10,
          match_reason: "Faltan campos mandatorios esenciales en el XML tributario del SII.",
          xml_parse_status: "missing_fields",
          xml_parse_error: "Missing required fields in parsed XML schema."
        });
        summary.rejected++;
        summary.newInvoices++;
        continue;
      }

      // 1. VALIDACIÓN DE RECEPTOR OFICIAL (Requirement 3 de robustez)
      const normReceiverRut = normalizeRut(receiverRut);
      if (normReceiverRut !== officialReceptorRut) {
        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: normalizeRut(issuerRut),
          issuer_name: issuerNameXml || issuerName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          invoice_amount: invoiceAmount,
          liquid_amount: liquidAmount,
          withheld_tax: withheldTax,
          tax_rate: taxRate,
          receiver_rut: normReceiverRut,
          receiver_name: receiverName,
          raw_text_preview,
          match_status: "rejected",
          confidence_score: 0,
          match_reason: `Boleta emitida a RUT receptor inválido: ${receiverRut}. Debe ser emitida a La Ampolleta (${officialReceptorRut}).`,
          xml_parse_status: "success"
        });
        summary.rejected++;
        summary.newInvoices++;
        continue;
      }

      // 2. BUSCAR LOTE TRIBUTARIO COINCIDENTE (Matching engine)
      const normIssuerRut = normalizeRut(issuerRut);
      const invoicePeriod = invoiceDate.toISOString().substring(0, 7); // "YYYY-MM"

      // Obtener perfiles de staff registrados con este RUT
      const { data: staffProfiles } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("rut", normIssuerRut);

      if (!staffProfiles || staffProfiles.length === 0) {
        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: normIssuerRut,
          issuer_name: issuerNameXml || issuerName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          invoice_amount: invoiceAmount,
          liquid_amount: liquidAmount,
          withheld_tax: withheldTax,
          tax_rate: taxRate,
          receiver_rut: normReceiverRut,
          receiver_name: receiverName,
          raw_text_preview,
          match_status: "rejected",
          confidence_score: 0,
          match_reason: `El RUT del emisor (${issuerRut}) no corresponde a ningún perfil de staff registrado en el sistema.`,
          xml_parse_status: "success"
        });
        summary.rejected++;
        summary.newInvoices++;
        continue;
      }

      const staffIds = staffProfiles.map((p: any) => p.id);

      // Buscar todos los lotes de este trabajador para el periodo, sin importar el estado
      const { data: existingBatches, error: batError } = await supabase
        .from("worker_invoice_batches")
        .select("id, worker_id, period_label, expected_gross_amount, status, invoice_number")
        .in("worker_id", staffIds)
        .eq("period_label", invoicePeriod);

      if (batError) {
        summary.logs.push(`⚠️ Error al buscar lotes existentes para el trabajador: ${batError.message}`);
      }

      // Si existe algún lote verificado o pagado en el período, esto requiere revisión o es un posible duplicado (Regla 6)
      const verifiedOrPaidBatch = existingBatches?.find((b: any) => b.status === "verified" || b.status === "paid");
      if (verifiedOrPaidBatch) {
        const isExactFolio = verifiedOrPaidBatch.invoice_number === invoiceNumber;
        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: normIssuerRut,
          issuer_name: issuerNameXml || issuerName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          invoice_amount: invoiceAmount,
          liquid_amount: liquidAmount,
          withheld_tax: withheldTax,
          tax_rate: taxRate,
          receiver_rut: normReceiverRut,
          receiver_name: receiverName,
          raw_text_preview,
          matched_batch_id: verifiedOrPaidBatch.id,
          match_status: "needs_review",
          confidence_score: 50,
          match_reason: isExactFolio
            ? `Ya existe un lote tributario '${verifiedOrPaidBatch.status}' con el mismo Folio N° ${invoiceNumber} para el periodo ${invoicePeriod}. Posible reenvío o duplicado.`
            : `El periodo ${invoicePeriod} ya registra un Lote Tributario en estado '${verifiedOrPaidBatch.status}' (ID: ${verifiedOrPaidBatch.id}). Requiere revisión manual.`,
          xml_parse_status: "success"
        });
        summary.needsReview++;
        summary.newInvoices++;
        continue;
      }

      const candidateBatches = existingBatches ? existingBatches.filter((b: any) => b.status === "pending" || b.status === "rejected") : [];

      if (candidateBatches.length > 0) {
        // --- CASO A: SI YA EXISTE UN LOTE FÍSICO EN ESTADO PENDING/REJECTED ---
        const matchingBatches = candidateBatches.filter((b: any) => {
          const diff = Math.abs((b.expected_gross_amount || 0) - invoiceAmount);
          return diff <= toleranceSetting;
        });

        if (matchingBatches.length === 0) {
          // Encontrar lote con mayor similitud o dejar en revisión
          const bestCandidate = candidateBatches[0];
          await insertDetectedInvoice(supabase, {
            message_id: messageId,
            sender_email: sender,
            subject,
            received_at: receivedAt,
            notification_date: notificationDate,
            issuer_rut: normIssuerRut,
            issuer_name: issuerNameXml || issuerName,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            invoice_amount: invoiceAmount,
            liquid_amount: liquidAmount,
            withheld_tax: withheldTax,
            tax_rate: taxRate,
            receiver_rut: normReceiverRut,
            receiver_name: receiverName,
            raw_text_preview,
            matched_batch_id: bestCandidate.id,
            match_status: "needs_review",
            confidence_score: 60,
            match_reason: `El RUT y periodo coinciden, pero el monto bruto de la boleta ($${invoiceAmount}) difiere del esperado ($${bestCandidate.expected_gross_amount}) en el lote existente, superando la tolerancia de $${toleranceSetting} CLP.`,
            xml_parse_status: "success"
          });
          summary.needsReview++;
          summary.newInvoices++;
          continue;
        }

        if (matchingBatches.length > 1) {
          await insertDetectedInvoice(supabase, {
            message_id: messageId,
            sender_email: sender,
            subject,
            received_at: receivedAt,
            notification_date: notificationDate,
            issuer_rut: normIssuerRut,
            issuer_name: issuerNameXml || issuerName,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            invoice_amount: invoiceAmount,
            liquid_amount: liquidAmount,
            withheld_tax: withheldTax,
            tax_rate: taxRate,
            receiver_rut: normReceiverRut,
            receiver_name: receiverName,
            raw_text_preview,
            match_status: "needs_review",
            confidence_score: 70,
            match_reason: "Existen múltiples lotes candidatos pendientes para este trabajador en el mismo mes. Requiere vinculación manual.",
            xml_parse_status: "success"
          });
          summary.needsReview++;
          summary.newInvoices++;
          continue;
        }

        // MATCH PERFECTO ENCONTRADO (Score 100% -> Auto Verified con lote existente)
        const finalBatch = matchingBatches[0];

        // Ejecutar la auto-verificación atómica del lote pre-existente mediante RPC
        const { error: verifyRpcError } = await supabase
          .rpc("auto_verify_existing_invoice_batch_v3", {
            p_batch_id: finalBatch.id,
            p_invoice_number: invoiceNumber,
            p_invoice_amount: invoiceAmount,
            p_period_label: finalBatch.period_label
          });

        if (verifyRpcError) {
          throw new Error(`Error en RPC de auto-verificación de lote pre-existente: ${verifyRpcError.message}`);
        }

        // Insertar notificación de boleta recibida
        try {
          await supabase.from('notifications').insert({
            user_id: finalBatch.worker_id,
            title: "🧾 Boleta Verificada",
            description: `Tu boleta N° ${invoiceNumber} por $${invoiceAmount.toLocaleString("es-CL")} CLP para el periodo ${finalBatch.period_label} ha sido recibida y verificada con éxito automáticamente.`,
            type: "success"
          });
        } catch (errNotif) {
          console.warn("⚠️ [NOTIFICATIONS]: Error inserting batch auto-verification notification:", errNotif);
        }

        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: normIssuerRut,
          issuer_name: issuerNameXml || issuerName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          invoice_amount: invoiceAmount,
          liquid_amount: liquidAmount,
          withheld_tax: withheldTax,
          tax_rate: taxRate,
          receiver_rut: normReceiverRut,
          receiver_name: receiverName,
          raw_text_preview,
          matched_batch_id: finalBatch.id,
          match_status: "auto_verified",
          confidence_score: 100,
          match_reason: "Coincidencia perfecta en RUT, Período e Importe Bruto con lote tributario existente (Procesado de forma atómica).",
          xml_parse_status: "success"
        });

        summary.autoVerified++;
        summary.newInvoices++;
      } else {
        // --- CASO B: AUTO-CREADOR DINÁMICO DE LOTES ON-THE-FLY (Si no existe ningún lote previo) ---
        // Cargar tasa de retención desde la base de datos (app_settings) si existe, o usar el fallback 2026 (15.25%)
        let retentionRate = 15.25;
        try {
          const { data: settingsData } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", "honorarios_retention_rate")
            .maybeSingle();
          if (settingsData && settingsData.value && settingsData.value.rate !== undefined) {
            retentionRate = parseFloat(settingsData.value.rate);
          }
        } catch (err) {
          const error = err as any;
          summary.logs.push(`⚠️ No se pudo cargar la tasa de retención de app_settings: ${error.message}. Usando fallback 15.25%.`);
        }

        // Consultar asignaciones de eventos pendientes en tiempo real para este trabajador
        const { data: assignments, error: assErr } = await supabase
          .from("event_assignments")
          .select(`
            id,
            status,
            payment_status,
            custom_rate,
            invoice_required,
            invoice_received,
            event_day_id,
            event_id,
            event_days ( date, status ),
            events ( date, status ),
            profiles:staff_id ( id, name, monto_transferencia )
          `)
          .in("staff_id", staffIds)
          .in("status", ["Confirmado", "Aceptado"])
          .neq("payment_status", "Pagado");

        if (assErr) {
          summary.logs.push(`⚠️ Error al buscar asignaciones de eventos pendientes: ${assErr.message}`);
        }

        const pendingGroup = [];
        let totalLiquid = 0;
        let targetWorkerId = null;

        if (assignments && assignments.length > 0) {
          for (const a of assignments) {
            // Excluir si ya tiene boleta recibida
            if (a.invoice_received) continue;
            // Excluir si explícitamente se configuró que NO requiere boleta
            if (a.invoice_required === false) continue;

            // Excluir si el evento o el día del evento están cancelados
            const eventDayStatus = a.event_days?.status?.toLowerCase() || "";
            const eventStatus = a.events?.status?.toLowerCase() || "";
            if (eventDayStatus === "cancelado" || eventDayStatus === "cancelled" || eventStatus === "cancelado" || eventStatus === "cancelled") {
              continue;
            }

            // Obtener fecha del evento (priorizando event_days.date)
            const dateStr = a.event_days?.date || a.events?.date || "";
            if (!dateStr) continue;

            const periodKey = dateStr.substring(0, 7); // "YYYY-MM"
            if (periodKey === invoicePeriod) {
              const rawMonto = a.profiles?.monto_transferencia;
              const parsedMonto = rawMonto ? parseFloat(rawMonto) : NaN;
              const defaultRate = !isNaN(parsedMonto) ? parsedMonto : 25000;

              const rawCustom = a.custom_rate;
              const parsedCustom = rawCustom ? parseFloat(rawCustom) : NaN;
              const rate = !isNaN(parsedCustom) ? parsedCustom : defaultRate;

              totalLiquid += rate;
              pendingGroup.push({
                id: a.id,
                liquid_amount: rate
              });
              if (!targetWorkerId) {
                targetWorkerId = a.profiles?.id;
              }
            }
          }
        }

        if (pendingGroup.length === 0) {
          // No hay asignaciones pendientes que requieran boleta para este periodo
          await insertDetectedInvoice(supabase, {
            message_id: messageId,
            sender_email: sender,
            subject,
            received_at: receivedAt,
            notification_date: notificationDate,
            issuer_rut: normIssuerRut,
            issuer_name: issuerNameXml || issuerName,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            invoice_amount: invoiceAmount,
            liquid_amount: liquidAmount,
            withheld_tax: withheldTax,
            tax_rate: taxRate,
            receiver_rut: normReceiverRut,
            receiver_name: receiverName,
            raw_text_preview,
            match_status: "needs_review",
            confidence_score: 30,
            match_reason: `No se encontraron asignaciones de eventos pendientes que requieran boleta de honorarios para el periodo ${invoicePeriod}.`,
            xml_parse_status: "success"
          });
          summary.needsReview++;
          summary.newInvoices++;
          continue;
        }

        // Si hay asignaciones, calculamos el bruto esperado
        const calculatedGross = Math.round(totalLiquid / (1 - (retentionRate / 100)));
        const diff = Math.abs(calculatedGross - invoiceAmount);

        if (diff > toleranceSetting) {
          // Si no calza el monto bruto esperado (Diferencia fuera de la tolerancia)
          await insertDetectedInvoice(supabase, {
            message_id: messageId,
            sender_email: sender,
            subject,
            received_at: receivedAt,
            notification_date: notificationDate,
            issuer_rut: normIssuerRut,
            issuer_name: issuerNameXml || issuerName,
            invoice_number: invoiceNumber,
            invoice_date: invoiceDate,
            invoice_amount: invoiceAmount,
            liquid_amount: liquidAmount,
            withheld_tax: withheldTax,
            tax_rate: taxRate,
            receiver_rut: normReceiverRut,
            receiver_name: receiverName,
            raw_text_preview,
            match_status: "needs_review",
            confidence_score: 60,
            match_reason: `Se encontraron ${pendingGroup.length} asignaciones pendientes para el periodo ${invoicePeriod}, pero el monto bruto de la boleta ($${invoiceAmount}) difiere del bruto esperado ($${calculatedGross}) calculado a partir del líquido pactado ($${totalLiquid}). Diferencia: $${diff} CLP (Tolerancia: $${toleranceSetting} CLP).`,
            xml_parse_status: "success"
          });
          summary.needsReview++;
          summary.newInvoices++;
          continue;
        }

        // ¡MATCH PERFECTO DINÁMICO ENCONTRADO! (Tolerancia aceptada)
        const assignmentIds = pendingGroup.map(item => item.id);

        // Ejecutar la auto-creación atómica mediante RPC transaccional
        const { data: createdBatchId, error: createRpcError } = await supabase
          .rpc("auto_create_invoice_batch_v3", {
            p_worker_id: targetWorkerId || staffIds[0],
            p_period_label: invoicePeriod,
            p_total_liquid_amount: totalLiquid,
            p_retention_rate: retentionRate,
            p_expected_gross_amount: calculatedGross,
            p_estimated_retention: calculatedGross - totalLiquid,
            p_invoice_number: invoiceNumber,
            p_invoice_amount: invoiceAmount,
            p_assignment_ids: assignmentIds,
            p_invoice_notes: "Lote creado y validado automáticamente desde correo SII (Finanzas 3.5 - Auto-Match)"
          });

        if (createRpcError) {
          throw new Error(`Error en RPC de auto-creación de lote transaccional: ${createRpcError.message}`);
        }

        // Insertar notificación de boleta recibida
        try {
          await supabase.from('notifications').insert({
            user_id: targetWorkerId || staffIds[0],
            title: "🧾 Boleta Verificada",
            description: `Tu boleta N° ${invoiceNumber} por $${invoiceAmount.toLocaleString("es-CL")} CLP para el periodo ${invoicePeriod} ha sido recibida y verificada con éxito automáticamente.`,
            type: "success"
          });
        } catch (errNotif) {
          console.warn("⚠️ [NOTIFICATIONS]: Error inserting auto-create batch notification:", errNotif);
        }

        // Registrar la boleta detectada como auto_verified
        await insertDetectedInvoice(supabase, {
          message_id: messageId,
          sender_email: sender,
          subject,
          received_at: receivedAt,
          notification_date: notificationDate,
          issuer_rut: normIssuerRut,
          issuer_name: issuerNameXml || issuerName,
          invoice_number: invoiceNumber,
          invoice_date: invoiceDate,
          invoice_amount: invoiceAmount,
          liquid_amount: liquidAmount,
          withheld_tax: withheldTax,
          tax_rate: taxRate,
          receiver_rut: normReceiverRut,
          receiver_name: receiverName,
          raw_text_preview,
          matched_batch_id: createdBatchId,
          match_status: "auto_verified",
          confidence_score: 100,
          match_reason: "Lote creado y validado automáticamente desde XML SII (Procesado de forma atómica)",
          xml_parse_status: "success"
        });

        summary.autoVerified++;
        summary.newInvoices++;
      }
    }
    summary.logs.push("Sincronización IMAP y validación de boletas finalizada.");
  } catch (err) {
    const error = err as any;
    summary.logs.push(`Error crítico de ejecución: ${error.message}`);
    const isTcpRestriction = error.message?.includes("connect") ||
      error.message?.includes("TLS") ||
      error.message?.includes("network") ||
      error.message?.includes("socket") ||
      error.message?.includes("IMAP");

    return new Response(
      JSON.stringify({
        success: false,
        error: isTcpRestriction ? "IMAP_TCP_RESTRICTION" : `Error durante el procesamiento IMAP: ${error.message}`,
        message: error.message,
        summary
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    try {
      await client.logout();
    } catch (_) { }
  }

  return new Response(
    JSON.stringify({
      success: true,
      summary
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

// =========================================================================
// FUNCIONES AUXILIARES DE PARSEO Y NORMALIZACIÓN
// =========================================================================

function normalizeRut(rut: string): string {
  if (!rut) return "";
  return rut.replace(/[^0-9kK]/g, "").toLowerCase().replace(/^(\d+)([0-9kK])$/, "$1-$2");
}

function extractIssuerRutFromBody(body: string): string | null {
  const match = body.match(/RUT\s*(?:N°)?\s*([\d\.\-]+)/i);
  return match ? normalizeRut(match[1]) : null;
}

function extractInvoiceNumberFromBody(body: string): string | null {
  const match = body.match(/Boleta(?:.*?)Electronica\s*(?:N°)?\s*(\d+)/i);
  return match ? match[1] : null;
}

function extractNotificationDate(body: string): Date | null {
  const match = body.match(/fecha\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (match) {
    const [day, month, year] = match[1].split("/");
    return new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
  }
  return null;
}

function extractIssuerName(body: string): string | null {
  const match = body.match(/contribuyente\s+([A-Z\s]+)\s+RUT/i);
  return match ? match[1].trim() : null;
}

// Parsea un XML de Boleta del SII usando expresiones regulares (A prueba de fallos de Deno)
interface ParseResult {
  success: boolean;
  error?: string;
  data?: {
    issuerRut: string;
    issuerNameXml: string;
    invoiceNumber: string;
    invoiceDate: Date;
    invoiceAmount: number;
    liquidAmount: number;
    withheldTax: number;
    taxRate: number;
    receiverRut: string;
    receiverName: string;
  };
}

function parseSiiXml(xmlStr: string): ParseResult {
  try {
    const getTag = (tag: string): string => {
      const match = xmlStr.match(new RegExp(`<${tag}>([^<]+)<\/${tag}>`, "i"));
      return match ? match[1].trim() : "";
    };

    const rutEmisor = getTag("rutEmisor");
    const dvEmisor = getTag("dvEmisor");
    const numeroBoleta = getTag("numeroBoleta");
    const fechaBoletaStr = getTag("fechaBoleta"); // YYYYMMDD
    const totalHonorarios = parseFloat(getTag("totalHonorarios") || "0");
    const liquidoHonorarios = parseFloat(getTag("liquidoHonorarios") || "0");
    const impuestoHonorarios = parseFloat(getTag("impuestoHonorarios") || "0");
    const porcentajeImpuesto = parseFloat(getTag("porcentajeImpuesto") || "0");
    const rutReceptor = getTag("rutReceptor");
    const dvReceptor = getTag("dvReceptor");
    const nombreReceptor = getTag("nombreReceptor");
    const nombreEmisor = getTag("nombreEmisor") || getTag("razonSocialEmisor");

    if (!rutEmisor || !numeroBoleta || !fechaBoletaStr) {
      return { success: false, error: "XML no corresponde al formato de Boletas SII o está incompleto." };
    }

    // Convertir fecha de YYYYMMDD a Date
    const year = parseInt(fechaBoletaStr.substring(0, 4), 10);
    const month = parseInt(fechaBoletaStr.substring(4, 6), 10) - 1;
    const day = parseInt(fechaBoletaStr.substring(6, 8), 10);
    const invoiceDate = new Date(year, month, day);

    return {
      success: true,
      data: {
        issuerRut: `${rutEmisor}-${dvEmisor}`,
        issuerNameXml: nombreEmisor,
        invoiceNumber: numeroBoleta,
        invoiceDate,
        invoiceAmount: totalHonorarios,
        liquidAmount: liquidoHonorarios,
        withheldTax: impuestoHonorarios,
        taxRate: porcentajeImpuesto,
        receiverRut: `${rutReceptor}-${dvReceptor}`,
        receiverName: nombreReceptor
      }
    };
  } catch (err) {
    const error = err as any;
    return { success: false, error: error.message };
  }
}

function toTitleCase(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

async function insertDetectedInvoice(supabase: any, data: any) {
  const formattedIssuerName = data.issuer_name ? toTitleCase(data.issuer_name) : data.issuer_name;
  const { error } = await supabase
    .from("detected_invoices")
    .insert({
      ...data,
      issuer_name: formattedIssuerName,
      processed_at: new Date().toISOString()
    });
  if (error) {
    console.error("Error inserting detected invoice:", error);
  }
}
