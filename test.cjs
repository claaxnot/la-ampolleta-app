const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGNic2V0bXp2bW9kbmtsd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyNDMsImV4cCI6MjA5NDM1MzI0M30.nK7UkraNG_Xhqng7f-FEv9BzBdyMr-MWeuz4Li5AZSc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, email, status, system_role');

  if (error) {
    console.log("Error selecting profiles:", error.message);
  } else {
    console.log("Profiles list:", data);
  }
}

run();
