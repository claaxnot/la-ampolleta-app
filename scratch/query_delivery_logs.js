const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
const envContent = fs.readFileSync('.env.local', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    let val = parts.slice(1).join('=').trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
  console.log("Fetching last 10 records from push_delivery_logs...");
  const { data, error } = await supabase
    .from('push_delivery_logs')
    .select(`
      id,
      notification_id,
      user_id,
      status,
      sent_count,
      failed_count,
      error_message,
      created_at,
      notifications (
        id,
        title,
        description,
        type
      )
    `)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Error fetching logs:", error.message);
    return;
  }

  console.log(`Found ${data.length} records:`);
  data.forEach((log, index) => {
    console.log(`\n--- Log #${index + 1} ---`);
    console.log(`ID: ${log.id}`);
    console.log(`Status: ${log.status}`);
    console.log(`Created: ${log.created_at}`);
    console.log(`Sent/Failed: ${log.sent_count}/${log.failed_count}`);
    console.log(`Error: ${log.error_message}`);
    if (log.notifications) {
      console.log(`Notification: [${log.notifications.type}] "${log.notifications.title}"`);
      console.log(`Desc: "${log.notifications.description}"`);
    } else {
      console.log(`Notification: [No associated notification record found] (ID: ${log.notification_id})`);
    }
  });
}

inspect();
