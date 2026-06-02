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

async function testInsert() {
  const fakeUserId = '00000000-0000-0000-0000-000000000000';
  
  console.log("Testing insert with Format A ('endpoint', 'p256dh', 'auth')...");
  const payloadFormatA = {
    user_id: fakeUserId,
    endpoint: 'https://fcm.googleapis.com/fcm/send/test-endpoint-A',
    p256dh: 'test-p256dh',
    auth: 'test-auth',
    platform: 'Desktop',
    browser: 'Chrome',
    device_label: 'Test A',
    active: true
  };

  const { error: errorA } = await supabase
    .from('push_subscriptions')
    .insert([payloadFormatA]);

  if (errorA) {
    console.log("Format A Result:", errorA.message);
  } else {
    console.log("Format A Success! (Wait, how did it bypass foreign key? Or maybe it created it?)");
  }

  console.log("\nTesting insert with Format B ('token')...");
  const payloadFormatB = {
    user_id: fakeUserId,
    token: 'test-token-B',
    provider: 'web-push',
    platform: 'Desktop',
    browser: 'Chrome',
    device_label: 'Test B',
    active: true
  };

  const { error: errorB } = await supabase
    .from('push_subscriptions')
    .insert([payloadFormatB]);

  if (errorB) {
    console.log("Format B Result:", errorB.message);
  } else {
    console.log("Format B Success!");
  }
}

testInsert();
