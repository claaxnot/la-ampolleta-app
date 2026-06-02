const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("Fetching registered push subscriptions...");
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('id, user_id, platform, browser, device_label, active, created_at, last_seen_at');
    
  if (error) {
    console.error("Error fetching subscriptions:", error);
  } else {
    console.log("Current subscriptions in database:");
    console.log(data);
  }
}

inspect();
