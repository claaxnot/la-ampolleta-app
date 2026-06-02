const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://bvdcbsetmzvmodnklwfp.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ2ZGNic2V0bXp2bW9kbmtsd2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NzcyNDMsImV4cCI6MjA5NDM1MzI0M30.nK7UkraNG_Xhqng7f-FEv9BzBdyMr-MWeuz4Li5AZSc";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Testing Supabase connection and query...");
  try {
    const start = Date.now();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .limit(1);
    
    if (error) throw error;
    console.log(`Success! Profiles query took ${Date.now() - start}ms. Data:`, data);
  } catch (err) {
    console.error("Error in profiles query:", err);
  }

  try {
    const start = Date.now();
    console.log("Testing event_assignments query...");
    const { data, error } = await supabase
      .from('event_assignments')
      .select(`
        id,
        status,
        payment_status,
        custom_rate,
        event_id,
        event_day_id,
        invoice_required,
        invoice_received,
        invoice_number,
        invoice_received_at,
        invoice_amount,
        event_days (
          id,
          date,
          start_time,
          end_time,
          call_time,
          setup_time,
          status,
          notes
        ),
        events (
          id, name, date, time, location, client, status, description,
          call_time, setup_time, end_time, priority, operational_notes,
          supervisor_id, type, operational_info_pending,
          attendance_control_enabled, attendance_require_confirmed, latitude, longitude, allowed_radius_meters,
          profiles:supervisor_id (
            name
          )
        )
      `)
      .limit(5);

    if (error) throw error;
    console.log(`Success! Event assignments query took ${Date.now() - start}ms. Found rows:`, data?.length);
  } catch (err) {
    console.error("Error in event_assignments query:", err);
  }
}

run();
