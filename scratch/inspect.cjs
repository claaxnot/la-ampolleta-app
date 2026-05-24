const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGNic2V0bXp2bW9kbmtsd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyNDMsImV4cCI6MjA5NDM1MzI0M30.nK7UkraNG_Xhqng7f-FEv9BzBdyMr-MWeuz4Li5AZSc";

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function run() {
  console.log("🔍 Fetching recent events...");
  const { data: events, error: err1 } = await supabase
    .from('events')
    .select('id, name, status, date')
    .order('date', { ascending: false })
    .limit(20);
  
  if (err1) {
    console.error("Error fetching events:", err1);
    return;
  }
  
  console.log("Recent Events:", events);
  
  if (events && events.length > 0) {
    for (const event of events) {
      const { data: assignments } = await supabase
        .from('event_assignments')
        .select('id, staff_id, status, custom_rate')
        .eq('event_id', event.id);
        
      const { data: attendance } = await supabase
        .from('event_attendance_logs')
        .select('id, worker_id, check_in_at, check_out_at')
        .eq('event_id', event.id);
        
      if ((assignments && assignments.length > 0) || (attendance && attendance.length > 0)) {
        console.log(`\n------------------- EVENT: ${event.name} (${event.id}) -------------------`);
        console.log("Assignments Count:", assignments ? assignments.length : 0);
        console.log("Assignments:", assignments);
        console.log("Attendance Logs Count:", attendance ? attendance.length : 0);
        console.log("Attendance Logs:", attendance);
      }
    }
  }
}

run();
