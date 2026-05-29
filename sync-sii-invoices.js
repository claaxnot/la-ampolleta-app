const { ImapFlow } = require("imapflow");
const { simpleParser } = require("mailparser");
const fs = require("fs");
const path = require("path");

// Cargar variables de entorno locales desde .env.local
let supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
let supabaseAnonKey = "";

const envPath = path.join(__dirname, ".env.local");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  const anonKeyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY=["']?([^"'\s]+)["']?/);
  if (anonKeyMatch) {
    supabaseAnonKey = anonKeyMatch[1];
  }
}

// Configuración de correo
const imapHost = "mail.laampolleta.tv";
const imapPort = 993;
const imapUser = "contacto@laampolleta.tv";
const imapPassword = "YFdwW1ZHrtzx"; // Contraseña segura real configurada por el usuario

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
  logger: false
});

async function main() {
  console.log("🚀 Iniciando Sincronizador de Boletas SII (Local Link)...");
  console.log("Conectando con el servidor de correo contacto@laampolleta.tv...");
  
  await client.connect();
  console.log("✅ Conexión IMAP establecida con éxito.");

  let mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
  console.log(`Buzón INBOX abierto. Mensajes totales: ${mailbox.exists}`);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // En lugar de hacer una búsqueda "since" IMAP (la cual es inestable en cPanel/Dovecot y omite mensajes),
  // leemos las cabeceras de los últimos 600 mensajes de la bandeja de entrada y filtramos en memoria.
  const totalMessages = mailbox.exists;
  const startSeq = Math.max(1, totalMessages - 600);
  console.log(`Analizando los últimos ${totalMessages - startSeq + 1} mensajes por rango de secuencia (${startSeq}:${totalMessages})...`);

  const range = `${startSeq}:${totalMessages}`;
  const messageStream = client.fetch(range, { envelope: true });
  
  const matchingMessages = [];

  for await (let msg of messageStream) {
    if (!msg || !msg.envelope) continue;
    
    // Validar fecha en memoria
    const msgDate = msg.envelope.date || new Date();
    if (msgDate < thirtyDaysAgo) continue;

    const senderEmail = (msg.envelope.from?.[0]?.address || "").toLowerCase();
    
    // Validar remitente oficial del SII estrictamente (incluyendo noreply)
    const isOfficialSender = senderEmail === "siichile@sii.cl" || 
                             senderEmail === "boleta.honorarios@sii.cl" ||
                             senderEmail === "noreply@sii.cl";
                             
    if (!isOfficialSender) {
      continue;
    }
    
    const subject = msg.envelope.subject || "Copia de Boleta de Honorarios Electrónica";
    
    // Validar si es una boleta anulada
    const isAnulada = subject.toLowerCase().includes("anulada") || 
                      subject.toLowerCase().includes("anulación") || 
                      subject.toLowerCase().includes("anulacion");
                      
    if (isAnulada) {
      console.log(` 🛑 Omitiendo correo de boleta anulada: "${subject}"`);
      continue;
    }

    matchingMessages.push({
      uid: msg.uid,
      subject,
      senderEmail
    });
  }

  console.log(`🔍 Encontrados ${matchingMessages.length} correos oficiales del SII. Iniciando descarga de contenidos...`);

  const emailsToPush = [];

  for (const m of matchingMessages) {
    console.log(`📥 Descargando boleta SII oficial detectada: UID ${m.uid} | Asunto: "${m.subject}"...`);
    
    // 2. Solo descargamos el contenido completo para correos válidos del SII
    let message = await client.fetchOne(m.uid.toString(), { source: true }, { uid: true });
    if (!message || !message.source) {
      console.log(` ⚠️ No se pudo descargar el contenido del correo UID: ${m.uid}. Omitiendo.`);
      continue;
    }
    
    const parsedMail = await simpleParser(message.source);
    const messageId = parsedMail.messageId || `imap_uid_${m.uid}`;
    const sender = m.senderEmail || "siichile@sii.cl";
    const receivedAt = parsedMail.date || new Date();
    const rawText = parsedMail.text || parsedMail.textAsHtml || "";
    
    const xmlAttachment = parsedMail.attachments.find(att => 
      att.contentType?.includes("xml") || 
      att.filename?.toLowerCase().endsWith(".xml")
    );
    let xmlContent = "";
    if (xmlAttachment) {
      xmlContent = xmlAttachment.content.toString("utf8");
    }

    emailsToPush.push({
      messageId,
      sender,
      subject: m.subject,
      receivedAt: receivedAt.toISOString(),
      rawText,
      xmlContent
    });
  }

  await client.logout();
  console.log("🚪 Conexión de correo cerrada.");

  if (emailsToPush.length === 0) {
    console.log("✨ No se encontraron correos nuevos para sincronizar.");
    return;
  }

  console.log(`\nEnviando ${emailsToPush.length} correos a Supabase Edge Function...`);
  
  // Realizar HTTP POST a la Edge Function
  const response = await fetch(`${supabaseUrl}/functions/v1/fetch-sii-invoices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      action: "push",
      emails: emailsToPush
    })
  });

  const result = await response.json();
  if (response.ok && result.success) {
    console.log("\n✅ ¡Sincronización Completada con Éxito!");
    console.log("-----------------------------------------");
    console.log(`Correos Procesados: ${result.summary.emailsReviewed}`);
    console.log(`Nuevas Boletas Detectadas: ${result.summary.newInvoices}`);
    console.log(`Boletas Auto-Verificadas y Liberadas: ${result.summary.autoVerified}`);
    console.log(`Casos Dudosos (Para Revisión Manual): ${result.summary.needsReview}`);
    console.log(`Boletas Rechazadas: ${result.summary.rejected}`);
    console.log(`Errores XML: ${result.summary.xmlErrors}`);
    console.log("-----------------------------------------");
  } else {
    console.error("\n❌ Error al sincronizar con Supabase:", result.error || result);
  }
}

main().catch(err => {
  console.error("❌ Error de ejecución:", err.message);
  try { client.logout(); } catch (_) {}
});
