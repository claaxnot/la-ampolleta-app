import React, { useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, Clock, MapPin, CheckCircle, XCircle } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import { supabase } from "../lib/supabase.js";

// Helper functions for mini calendar
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => {
  let day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; 
};
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DAY_NAMES = ["L", "M", "X", "J", "V", "S", "D"];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function WorkerDashboard({ user }) {
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState({});

  React.useEffect(() => {
    if (user?.id) {
      fetchMyEvents(user.id);
      fetchMyAvailability(user.id);
    }
  }, [user]);

  const fetchMyAvailability = async (workerId) => {
    const { data } = await supabase.from('staff_availability').select('date, status').eq('staff_id', workerId);
    if (data) {
      const availObj = {};
      data.forEach(item => {
        availObj[item.date] = item.status;
      });
      setAvailability(availObj);
    }
  };

  const fetchMyEvents = async (workerId) => {
    setIsLoading(true);
    
    // We fetch assignments and join with the events table
    const { data, error } = await supabase
      .from('event_assignments')
      .select(`
        id,
        status,
        event_id,
        events (
          id, name, date, time, location, client, status
        )
      `)
      .eq('staff_id', workerId);
      
    if (data) {
      // Flatten the structure for easier rendering
      const formattedEvents = data.map(assignment => ({
        assignment_id: assignment.id,
        assignment_status: assignment.status,
        ...assignment.events
      }));
      setAssignedEvents(formattedEvents);
    }
    
    setIsLoading(false);
  };



  // Mini calendar state
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const handlePrevMonth = () => setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(currentYear, currentMonth + 1, 1));

  const toggleAvailability = async (day) => {
    const y = currentYear;
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    const currentStatus = availability[dateStr];
    let nextStatus = "available";
    if (currentStatus === "available") nextStatus = "busy";
    
    const newAvailability = { ...availability };

    if (currentStatus === "busy") {
      delete newAvailability[dateStr];
      setAvailability(newAvailability);
      await supabase.from('staff_availability').delete().eq('staff_id', user.id).eq('date', dateStr);
    } else {
      newAvailability[dateStr] = nextStatus;
      setAvailability(newAvailability);
      
      // Upsert to Supabase
      await supabase.from('staff_availability').upsert({
        staff_id: user.id,
        date: dateStr,
        status: nextStatus
      }, { onConflict: 'staff_id, date' });
    }
  };

  const handleStatusChange = async (assignmentId, newStatus) => {
    const { error } = await supabase
      .from('event_assignments')
      .update({ status: newStatus })
      .eq('id', assignmentId);
    
    if (!error) {
      fetchMyEvents(user.id);
    }
  };

  return (
    <motion.div 
      className="p-6 lg:p-8 min-h-[calc(100vh-64px)]"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
          Mi Panel de Trabajo
        </h1>
        <p className="text-gray-400 mt-1">Hola, {user?.name || "Trabajador"}. Aquí están tus próximas asignaciones.</p>
      </motion.header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Mis Asignaciones */}
        <motion.section variants={itemVariants} className="lg:col-span-2 flex flex-col gap-4">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2 mb-2">
            <CalendarDays className="w-5 h-5 text-amber-400" />
            Mis Próximos Eventos
          </h2>
          
          {isLoading ? (
            <GlassCard className="p-8 text-center text-gray-400">
              <p>Cargando eventos...</p>
            </GlassCard>
          ) : assignedEvents.length === 0 ? (
            <GlassCard className="p-8 text-center text-gray-400">
              <p>No tienes eventos asignados por el momento.</p>
            </GlassCard>
          ) : (
            assignedEvents.map(event => (
              <GlassCard key={event.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-l-4 border-l-amber-500">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">{event.name}</h3>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-300">
                    <span className="flex items-center gap-1"><CalendarDays className="w-4 h-4 text-gray-400"/> {event.date.split('-').reverse().join('/')}</span>
                    <span className="flex items-center gap-1"><Clock className="w-4 h-4 text-gray-400"/> {event.time}</span>
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-gray-400"/> {event.location}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-4 md:mt-0">
                  {event.assignment_status === 'Confirmado' ? (
                    <span className="flex items-center gap-1 px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/50 font-medium">
                      <CheckCircle className="w-4 h-4" /> Confirmado
                    </span>
                  ) : event.assignment_status === 'Rechazado' ? (
                    <span className="flex items-center gap-1 px-4 py-2 bg-red-500/20 text-red-400 rounded-lg border border-red-500/50 font-medium">
                      <XCircle className="w-4 h-4" /> Rechazado
                    </span>
                  ) : (
                    <>
                      <button 
                        onClick={() => handleStatusChange(event.assignment_id, 'Confirmado')}
                        className="flex items-center gap-1 px-4 py-2 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-gray-900 rounded-lg transition-colors border border-emerald-500/50"
                      >
                        <CheckCircle className="w-4 h-4" /> Confirmar
                      </button>
                      <button 
                        onClick={() => handleStatusChange(event.assignment_id, 'Rechazado')}
                        className="flex items-center gap-1 px-4 py-2 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-gray-900 rounded-lg transition-colors border border-red-500/50"
                      >
                        <XCircle className="w-4 h-4" /> Rechazar
                      </button>
                    </>
                  )}
                </div>
              </GlassCard>
            ))
          )}
        </motion.section>

        {/* Panel lateral: Estado y Notificaciones */}
        <motion.section variants={itemVariants} className="lg:col-span-1 space-y-6">
          <GlassCard className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Mi Estado</h2>
            <div className="flex items-center gap-4 mb-4">
              <img src={user?.avatar_url || user?.avatar || "https://i.pravatar.cc/100?img=1"} alt="Avatar" className="w-16 h-16 rounded-full border-2 border-amber-500 object-cover" />
              <div>
                <p className="font-bold text-white">{user?.name || "Trabajador"}</p>
                <p className="text-sm text-gray-400 capitalize">{user?.role || "Staff"}</p>
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
              <div className="flex justify-between items-center mb-4">
                <p className="text-sm text-gray-300 font-semibold">Definir Disponibilidad</p>
                <div className="flex gap-3 items-center text-sm text-gray-400">
                   <button onClick={handlePrevMonth} className="hover:text-white transition-colors">&lt;</button>
                   <span className="w-16 text-center font-medium">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                   <button onClick={handleNextMonth} className="hover:text-white transition-colors">&gt;</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2 text-gray-500 font-semibold">
                 {DAY_NAMES.map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                 {blanks.map(b => <div key={`b-${b}`} className="aspect-square rounded bg-transparent" />)}
                 {days.map(day => {
                   const y = currentYear;
                   const m = String(currentMonth + 1).padStart(2, '0');
                   const d = String(day).padStart(2, '0');
                   const dateStr = `${y}-${m}-${d}`;
                   const status = availability[dateStr];
                   
                   let bgClass = "bg-white/5 hover:bg-white/10 text-gray-300";
                   if (status === "available") bgClass = "bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.2)]";
                   if (status === "busy") bgClass = "bg-red-500/30 text-red-300 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]";

                   return (
                     <button
                       key={day}
                       onClick={() => toggleAvailability(day)}
                       className={`aspect-square rounded text-xs transition-colors flex items-center justify-center font-medium ${bgClass}`}
                     >
                       {day}
                     </button>
                   );
                 })}
              </div>
              
              <div className="mt-5 flex flex-col gap-2 text-xs text-gray-400">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/50"></div> Disponible</div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500/30 border border-red-500/50"></div> No Disponible</div>
                 <p className="mt-2 text-gray-500 italic">Haz clic repetidamente en un día para cambiar su estado.</p>
              </div>
            </div>
          </GlassCard>
        </motion.section>

      </div>
    </motion.div>
  );
}
