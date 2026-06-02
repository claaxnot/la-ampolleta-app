const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGNic2V0bXp2bW9kbmtsd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyNDMsImV4cCI6MjA5NDM1MzI0M30.nK7UkraNG_Xhqng7f-FEv9BzBdyMr-MWeuz4Li5AZSc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Testing signInWithPassword with dummy credentials...");
  const start = Date.now();
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "invalid-user-test-12345@example.com",
      password: "wrong-password"
    });
    console.log(`Finished in ${Date.now() - start}ms`);
    if (error) {
      console.log("Expected Error:", error.message);
    } else {
      console.log("Data:", data);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
  }
}

run();
