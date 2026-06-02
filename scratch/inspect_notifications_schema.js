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
  const columns = ['id', 'user_id', 'title', 'message', 'description', 'body', 'type', 'read', 'created_at', 'related_event_id'];
  
  console.log("Testing columns of 'notifications' table individually...");
  for (const col of columns) {
    const { data, error } = await supabase
      .from('notifications')
      .select(col)
      .limit(1);
    if (error) {
      console.log(`❌ Column '${col}' fails:`, error.message);
    } else {
      console.log(`✅ Column '${col}' is present.`);
    }
  }
}

inspect();
