const fs = require('fs');

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

async function test() {
  const url = `${supabaseUrl}/functions/v1/send-push-dispatcher`;
  console.log("Calling Edge Function with standard Authorization + X-Internal-Token:", url);

  const payload = {
    notification_id: '00000000-0000-0000-0000-000000000000', // Dummy UUID
    user_id: 'a98f4df0-7d72-46bf-8fe7-fb8ea5e89d1b', // Replace with a real user_id if you want, or keep empty
    title: 'Test Direct Call',
    description: 'This is a direct API verification call',
    type: 'event_assigned'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'X-Internal-Token': 'la_ampolleta_push_internal_token_secret_2026'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log("Response status:", response.status);
    console.log("Response body:", result);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
