const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGNic2V0bXp2bW9kbmtsd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyNDMsImV4cCI6MjA5NDM1MzI0M30.nK7UkraNG_Xhqng7f-FEv9BzBdyMr-MWeuz4Li5AZSc";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log("Checking event_days table...");
  const { data: days, error: daysError } = await supabase.from('event_days').select('*').limit(5);
  if (daysError) {
    console.log("Error querying event_days:", daysError);
  } else {
    console.log("Success querying event_days! Found records:", days.length);
    if (days.length > 0) {
      console.log("Sample day keys:", Object.keys(days[0]));
    }
  }

  console.log("\nChecking event_assignments table...");
  const { data: assigns, error: assignsError } = await supabase.from('event_assignments').select('*').limit(5);
  if (assignsError) {
    console.log("Error querying event_assignments:", assignsError);
  } else {
    console.log("Success querying event_assignments! Found records:", assigns.length);
    if (assigns.length > 0) {
      console.log("Sample assignment keys:", Object.keys(assigns[0]));
    }
  }
}

run();
