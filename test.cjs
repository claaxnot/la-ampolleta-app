const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGNic2V0bXp2bW9kbmtsd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyNDMsImV4cCI6MjA5NDM1MzI0M30.nK7UkraNG_Xhqng7f-FEv9BzBdyMr-MWeuz4Li5AZSc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const dummyId = "00000000-0000-0000-0000-000000000000";
  // Attempt to insert a dummy profile
  const { data: insertData, error: insertError } = await supabase
    .from('profiles')
    .insert({
      id: dummyId,
      name: "Temporary Test User",
      email: "temp_test_user@laampolleta.tv",
      rut: "1-9"
    })
    .select('*');

  if (insertError) {
    console.error("Error inserting dummy:", insertError);
  } else {
    console.log("Successfully inserted! Column keys are:", Object.keys(insertData[0]));
    
    // Clean up
    const { error: deleteError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', dummyId);
    if (deleteError) {
      console.error("Error deleting dummy:", deleteError);
    } else {
      console.log("Successfully cleaned up!");
    }
  }
}

run();
