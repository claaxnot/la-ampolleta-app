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
  console.log("Fetching all records from push_subscriptions...");
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*');

  if (error) {
    console.error("❌ Error fetching subscriptions:", error.message);
    return;
  }

  console.log(`Found ${data.length} subscriptions:`);
  data.forEach((sub, index) => {
    console.log(`\n--- Subscription #${index + 1} ---`);
    console.log(`ID: ${sub.id}`);
    console.log(`User ID: ${sub.user_id}`);
    console.log(`Active: ${sub.active}`);
    console.log(`Created: ${sub.created_at}`);
    console.log(`Endpoint (truncated): ${sub.endpoint ? sub.endpoint.substring(0, 60) + '...' : 'none'}`);
  });
}

inspect();
