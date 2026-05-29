const { ImapFlow } = require("imapflow");

const imapHost = "mail.laampolleta.tv";
const imapPort = 993;
const imapUser = "contacto@laampolleta.tv";
const imapPassword = "YFdwW1ZHrtzx";

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

async function run() {
  console.log("🕵️‍♂️ Buscando por número de secuencia en el buzón...");
  await client.connect();
  let mailbox = await client.mailboxOpen("INBOX", { readOnly: true });
  console.log(`Buzón INBOX abierto. Mensajes totales: ${mailbox.exists}`);
  
  // Vamos a buscar los últimos 500 mensajes de la bandeja de entrada directamente por su número de secuencia
  // El último mensaje es mailbox.exists, el anterior es mailbox.exists - 1, etc.
  const total = mailbox.exists;
  const start = Math.max(1, total - 400);
  
  console.log(`Inspeccionando secuencia de mensajes desde ${start} hasta ${total}...`);
  
  // fetch por rango de secuencias
  const range = `${start}:${total}`;
  const messages = client.fetch(range, { envelope: true });
  
  const results = [];
  for await (let msg of messages) {
    const sender = (msg.envelope.from?.[0]?.address || "").toLowerCase();
    const subject = msg.envelope.subject || "";
    const date = msg.envelope.date || new Date();
    
    if (sender.includes("sii") || subject.toLowerCase().includes("boleta")) {
      results.push({
        seq: msg.seq,
        uid: msg.uid,
        date,
        sender,
        subject
      });
    }
  }
  
  // Ordenar por fecha descendente
  results.sort((a, b) => b.date - a.date);
  
  console.log(`\nEncontradas ${results.length} boletas/correos SII en los últimos 400 mensajes de la bandeja de entrada:`);
  results.slice(0, 50).forEach((r, idx) => {
    console.log(`[${idx+1}] Seq: ${r.seq} | UID: ${r.uid} | Fecha: ${r.date.toISOString()} | De: ${r.sender} | Asunto: "${r.subject}"`);
  });
  
  await client.logout();
  console.log("\n🚪 Conexión cerrada.");
}

run().catch(err => {
  console.error("❌ Error:", err);
});
