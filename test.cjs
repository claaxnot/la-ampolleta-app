const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGNic2V0bXp2bW9kbmtsd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyNDMsImV4cCI6MjA5NDM1MzI0M30.nK7UkraNG_Xhqng7f-FEv9BzBdyMr-MWeuz4Li5AZSc";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  const email = `test_user_${Date.now()}@laampolleta.tv`;
  const password = "password123";

  console.log(`Attempting signup for ${email}...`);
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) {
    console.log("Signup error:", JSON.stringify(error, null, 2));
  } else {
    console.log("Signup success! Created User ID:", data.user?.id);
  }
}

run();
