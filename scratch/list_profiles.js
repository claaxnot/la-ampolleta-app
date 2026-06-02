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
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function inspect() {
  console.log("Fetching first 10 profiles...");
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, role, system_role')
    .limit(10);

  if (error) {
    console.error("❌ Error fetching profiles:", error.message);
    return;
  }

  console.log(`Found ${data.length} profiles:`);
  data.forEach((p, index) => {
    console.log(`${index + 1}. [${p.id}] ${p.name} (${p.email || 'no-email'}) - Role: ${p.role}/${p.system_role}`);
  });
}

inspect();
