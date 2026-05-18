import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CalendarDays, 
  Clock, 
  MapPin, 
  CheckCircle, 
  XCircle, 
  Bell, 
  Activity, 
  Sparkles, 
  Sun, 
  Info, 
  AlertTriangle 
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import { supabase } from "../lib/supabase.js";
import { toast } from "react-hot-toast";

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
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

export default function WorkerDashboard({ user }) {
  const [assignedEvents, setAssignedEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availability, setAvailability] = useState({});
  const [syncingDays, setSyncingDays] = useState({});
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDetailedEvent, setSelectedDetailedEvent] = useState(null);
  
  // Real-time Activity Feed state
  const [activities, setActivities] = useState([
    { id: 1, text: "Sistema operativo inicializado correctamente.", type: "system", time: "Hace unos minutos" },
    { id: 2, text: "Sesión iniciada con éxito.", type: "auth", time: "Hace 5 minutos" }
  ]);

  const addActivity = (text, type) => {
    setActivities(prev => [
      { id: Date.now(), text, type, time: "Ahora mismo" },
      ...prev
    ]);
  };

  // Clock updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user?.id) {
      fetchMyEvents(user.id);
      fetchMyAvailability(user.id);
    }
  }, [user]);

  const fetchMyAvailability = async (workerId) => {
    const { data } = await supabase
      .from('staff_availability')
      .select('date, status')
      .eq('staff_id', workerId);
      
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
    const { data, error } = await supabase
      .from('event_assignments')
      .select(`
        id,
        status,
        event_id,
        events (
          id, name, date, time, location, client, status, description
        )
      `)
      .eq('staff_id', workerId);
      
    if (data) {
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

  // Toggle availability with Click Cycling
  const toggleAvailability = async (day) => {
    const y = currentYear;
    const m = String(currentMonth + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;

    // Block changes if day has an assigned event
    const hasAssignedEvent = assignedEvents.some(event => event.date === dateStr);
    if (hasAssignedEvent) {
      toast.error("No puedes cambiar la disponibilidad de un día con evento asignado.");
      return;
    }

    setSyncingDays(prev => ({ ...prev, [dateStr]: true }));
    const currentStatus = availability[dateStr];
    let nextStatus = null;

    if (!currentStatus) {
      nextStatus = "available";
    } else if (currentStatus === "available") {
      nextStatus = "busy";
    }

    const newAvailability = { ...availability };

    try {
      if (!nextStatus) {
        delete newAvailability[dateStr];
        setAvailability(newAvailability);
        await supabase.from('staff_availability').delete().eq('staff_id', user.id).eq('date', dateStr);
        addActivity("Eliminaste preferencia de disponibilidad para el " + d + "/" + m, "info");
        toast.success("Preferencia de disponibilidad eliminada");
      } else {
        newAvailability[dateStr] = nextStatus;
        setAvailability(newAvailability);
        await supabase.from('staff_availability').upsert({
          staff_id: user.id,
          date: dateStr,
          status: nextStatus
        }, { onConflict: 'staff_id, date' });
        
        addActivity(
          `Marcaste el ${d}/${m} como ${nextStatus === "available" ? "Disponible" : "No disponible"}`,
          nextStatus === "available" ? "success" : "warning"
        );
        toast.success(nextStatus === "available" ? "Marcado como disponible" : "Marcado como no disponible");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar la disponibilidad");
    } finally {
      setSyncingDays(prev => ({ ...prev, [dateStr]: false }));
    }
  };

  const handleStatusChange = async (assignmentId, newStatus) => {
    const { error } = await supabase
      .from('event_assignments')
      .update({ status: newStatus })
      .eq('id', assignmentId);
    
    if (!error) {
      const eventInfo = assignedEvents.find(e => e.assignment_id === assignmentId);
      addActivity(`Cambiaste tu estado en "${eventInfo?.name || 'Evento'}" a ${newStatus}`, newStatus === "Confirmado" ? "success" : "danger");
      toast.success(`Asistencia marcada como: ${newStatus}`);
      fetchMyEvents(user.id);
    } else {
      toast.error("Error al actualizar la asistencia.");
    }
  };

  // Find nearest future event for countdown
  const getNextEvent = () => {
    if (!assignedEvents || assignedEvents.length === 0) return null;
    const now = new Date();
    const sortedFuture = assignedEvents
      .filter(e => {
        const evDate = new Date(`${e.date}T${e.time || '00:00'}`);
        return evDate > now;
      })
      .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));
    return sortedFuture[0] || null;
  };
  
  const nextEvent = getNextEvent();

  const getCountdownString = () => {
    if (!nextEvent) return "Sin eventos futuros";
    const now = new Date();
    const evDate = new Date(`${nextEvent.date}T${nextEvent.time || '00:00'}`);
    const diffMs = evDate - now;
    if (diffMs <= 0) return "¡Evento iniciado!";
    
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHrs = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const diffSecs = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    if (diffDays > 0) {
      return `${diffDays}d ${diffHrs}h ${diffMins}m`;
    }
    return `${diffHrs}h ${diffMins}m ${diffSecs}s`;
  };

  // Modern Enterprise Notifications
  const notifications = [
    { id: 1, title: "Actualización de Montaje", desc: "El montaje del concierto principal iniciará 30 min antes por pruebas técnicas.", type: "warning", time: "Hace 1 hora" },
    { id: 2, title: "Protocolo de Bodega", desc: "Recordar el uso obligatorio de calzado de seguridad en la carga de equipos.", type: "info", time: "Hace 2 horas" },
    { id: 3, title: "Documentación Pendiente", desc: "Sube tu boleta de honorarios de la producción anterior.", type: "danger", time: "Hace 1 día" }
  ];

  return (
    <motion.div 
      className="p-6 lg:p-8 min-h-[calc(100vh-64px)] relative overflow-hidden"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Background radial ambient lighting */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

      {/* 3️⃣ Hero Section más Viva */}
      <motion.div 
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl p-6 lg:p-8 bg-gradient-to-br from-gray-900/90 via-gray-900 to-amber-950/20 border border-white/5 mb-8 shadow-2xl backdrop-blur-md"
      >
        <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-80 h-80 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Sistema operativo online
              </span>
              <span className="text-xs px-3 py-1 rounded-full bg-white/5 text-gray-300 border border-white/5 flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                18° · Santiago
              </span>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white via-gray-200 to-amber-400 tracking-tight">
              Hola, {user?.name || "Trabajador"}
            </h1>
            <p className="text-gray-400 mt-1.5 text-sm lg:text-base">
              Bienvenido de vuelta. Tu rol operativo es <span className="text-amber-300 font-semibold capitalize">{user?.role || "Staff"}</span>.
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-1.5 bg-black/40 border border-white/5 p-4 rounded-2xl backdrop-blur-sm shadow-inner min-w-[240px]">
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
              {currentTime.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-2xl font-mono font-bold text-white tracking-widest">
              {currentTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-gray-300 font-medium border-t border-white/10 pt-1.5 mt-1.5 w-full md:text-right">
              🕒 {getCountdownString()}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Mis Asignaciones (Left Side) */}
        <motion.section variants={itemVariants} className="lg:col-span-2 flex flex-col gap-5">
          <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-1">
            <CalendarDays className="w-5.5 h-5.5 text-amber-400" />
            Mis Próximos Eventos
          </h2>
          
          {isLoading ? (
            <GlassCard className="p-12 text-center text-gray-400 border border-white/5">
              <svg className="animate-spin h-8 w-8 text-amber-400 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p className="font-semibold text-sm">Cargando próximos eventos...</p>
            </GlassCard>
          ) : assignedEvents.length === 0 ? (
            <GlassCard className="p-12 text-center text-gray-400 border border-white/5">
              <CalendarDays className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="font-semibold">No tienes eventos asignados por el momento.</p>
              <p className="text-xs text-gray-500 mt-1">Cuando seas asignado a una producción, aparecerá aquí.</p>
            </GlassCard>
          ) : (
            assignedEvents.map(event => {
              const isPending = event.assignment_status === 'Pendiente';
              const isConfirmed = event.assignment_status === 'Confirmado';
              const isRejected = event.assignment_status === 'Rechazado';

              // Dynamic styling based on assignment status
              let glowColor = "border-white/5 hover:border-amber-500/20";
              let statusBadge = "bg-amber-500/20 text-amber-300 border-amber-500/30";
              
              if (isConfirmed) {
                glowColor = "border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)] hover:border-emerald-500/40";
                statusBadge = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]";
              } else if (isRejected) {
                glowColor = "border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)] hover:border-red-500/40";
                statusBadge = "bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
              }

              // Presentation time is 2 hours before the event time
              const presentationTime = event.time ? (() => {
                const [h, m] = event.time.split(':');
                const hr = (parseInt(h) - 2 + 24) % 24;
                return `${String(hr).padStart(2, '0')}:${m || '00'} hrs`;
              })() : 'Por definir';

              return (
                <motion.div
                  key={event.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* 4️⃣ Event Card más Rica (Cinematic glass panel, dynamic glow) */}
                  <GlassCard className={`p-6 border-l-4 ${isConfirmed ? 'border-l-emerald-500' : isRejected ? 'border-l-red-500' : 'border-l-amber-500'} ${glowColor} transition-all duration-300`}>
                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <h3 className="text-xl font-bold text-white tracking-wide">{event.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${statusBadge}`}>
                            Asistencia: {event.assignment_status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-300 bg-black/40 p-4 rounded-2xl border border-white/5 shadow-inner">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Fecha</span>
                            <span className="flex items-center gap-1.5 font-semibold text-gray-100">
                              <CalendarDays className="w-4 h-4 text-amber-400" /> 
                              {event.date.split('-').reverse().join('/')}
                            </span>
                          </div>
                          
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Recinto</span>
                            <span className="flex items-center gap-1.5 font-semibold text-gray-100 truncate">
                              <MapPin className="w-4 h-4 text-amber-400" /> 
                              {event.location}
                            </span>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Presentación</span>
                            <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                              <Clock className="w-4 h-4 text-amber-400" /> 
                              {presentationTime}
                            </span>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Supervisor</span>
                            <span className="flex items-center gap-1.5 font-semibold text-gray-100">
                              👤 Carlos Ampolleta
                            </span>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Tu Rol</span>
                            <span className="flex items-center gap-1.5 font-semibold text-gray-100 capitalize">
                              🛠️ {user?.role || "Staff"}
                            </span>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Showtime</span>
                            <span className="flex items-center gap-1.5 font-semibold text-gray-100">
                              🎬 {event.time}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-row lg:flex-col justify-end items-center gap-3 mt-4 lg:mt-0 lg:self-center w-full lg:w-auto">
                        {isPending && (
                          <>
                            <motion.button 
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleStatusChange(event.assignment_id, 'Confirmado')}
                              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-gray-900 rounded-xl transition-all duration-300 border border-emerald-500/50 shadow-md font-bold text-sm w-full lg:w-44"
                            >
                              <CheckCircle className="w-4 h-4" /> Confirmar
                            </motion.button>
                            <motion.button 
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => handleStatusChange(event.assignment_id, 'Rechazado')}
                              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-300 border border-red-500/50 shadow-md font-bold text-sm w-full lg:w-44"
                            >
                              <XCircle className="w-4 h-4" /> Rechazar
                            </motion.button>
                          </>
                        )}
                        
                        {isConfirmed && (
                          <div className="flex flex-col gap-2 w-full lg:w-44">
                            <span className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/30 font-bold text-sm shadow-inner text-center">
                              ✓ Asistencia Confirmada
                            </span>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleStatusChange(event.assignment_id, 'Rechazado')}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors py-1 hover:underline text-center"
                            >
                              Cancelar Asistencia
                            </motion.button>
                          </div>
                        )}

                        {isRejected && (
                          <div className="flex flex-col gap-2 w-full lg:w-44">
                            <span className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-red-500/10 text-red-400 rounded-xl border border-red-500/30 font-bold text-sm shadow-inner text-center">
                              ✗ Rechazado
                            </span>
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleStatusChange(event.assignment_id, 'Confirmado')}
                              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors py-1 hover:underline text-center"
                            >
                              Cambiar a Confirmado
                            </motion.button>
                          </div>
                        )}

                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setSelectedDetailedEvent(event)}
                          className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white/5 text-gray-300 hover:bg-white/10 rounded-xl border border-white/10 text-sm font-semibold transition-all duration-300 w-full lg:w-44"
                        >
                          Ver detalles
                        </motion.button>
                      </div>
                    </div>

                    {/* 5️⃣ Timeline Operativo (Enterprise style, vertical illuminated line) */}
                    {isConfirmed && (
                      <div className="mt-6 border-t border-white/5 pt-6">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-4 flex items-center gap-1.5">
                          📋 Cronograma Operativo del Evento
                        </h4>
                        <div className="relative pl-6 border-l border-white/10 space-y-4">
                          <div className="relative group">
                            <div className="absolute -left-[30px] top-1.5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-gray-950 shadow-[0_0_10px_rgba(16,185,129,0.5)] group-hover:scale-125 transition-transform duration-300" />
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="font-bold text-emerald-300 font-mono">17:00</span>
                              <span className="text-gray-200">Llegada al recinto y check-in inicial</span>
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">Llegada</span>
                            </div>
                          </div>

                          <div className="relative group">
                            <div className="absolute -left-[30px] top-1.5 w-4 h-4 rounded-full bg-amber-500 border-4 border-gray-950 shadow-[0_0_10px_rgba(245,158,11,0.5)] group-hover:scale-125 transition-transform duration-300" />
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="font-bold text-amber-300 font-mono">18:00</span>
                              <span className="text-gray-200">Montaje y pruebas técnicas</span>
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-medium">Montaje</span>
                            </div>
                          </div>

                          <div className="relative group">
                            <div className="absolute -left-[30px] top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-gray-950 shadow-[0_0_10px_rgba(59,130,246,0.5)] group-hover:scale-125 transition-transform duration-300" />
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="font-bold text-blue-300 font-mono">20:00</span>
                              <span className="text-gray-200">Inicio del evento (Showtime)</span>
                              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-medium">Showtime</span>
                            </div>
                          </div>

                          <div className="relative group">
                            <div className="absolute -left-[30px] top-1.5 w-4 h-4 rounded-full bg-red-500 border-4 border-gray-950 shadow-[0_0_10px_rgba(239,68,68,0.5)] group-hover:scale-125 transition-transform duration-300" />
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="font-bold text-red-300 font-mono">00:00</span>
                              <span className="text-gray-200">Finalización del evento y desmontaje</span>
                              <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-medium">Desmontaje</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </GlassCard>
                </motion.div>
              );
            })
          )}
        </motion.section>

        {/* Panel lateral: Estado, Disponibilidad, Notificaciones, Actividad (Right Side) */}
        <motion.section variants={itemVariants} className="lg:col-span-1 space-y-6">
          
          {/* Mi Estado & Disponibilidad */}
          <GlassCard className="p-6 border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Mi Estado
            </h2>
            <div className="flex items-center gap-4 mb-5 bg-black/20 p-3 rounded-2xl border border-white/5">
              <img 
                src={user?.avatar_url || user?.avatar || "https://ui-avatars.com/api/?name=" + (user?.name || "User")} 
                alt="Avatar" 
                className="w-14 h-14 rounded-full border-2 border-amber-500 object-cover shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
              />
              <div className="overflow-hidden">
                <p className="font-bold text-white truncate">{user?.name || "Trabajador"}</p>
                <p className="text-xs text-amber-400 capitalize font-semibold tracking-wider mt-0.5">{user?.role || "Staff"}</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-400">Definir Disponibilidad</p>
                <div className="flex gap-2.5 items-center text-xs text-gray-400">
                   <button onClick={handlePrevMonth} className="hover:text-white transition-colors bg-white/5 hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-lg border border-white/5 transition-all duration-300">&lt;</button>
                   <span className="w-18 text-center font-bold text-gray-200 capitalize">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                   <button onClick={handleNextMonth} className="hover:text-white transition-colors bg-white/5 hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-lg border border-white/5 transition-all duration-300">&gt;</button>
                </div>
              </div>
              
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] mb-2 text-gray-500 font-extrabold uppercase tracking-widest">
                 {DAY_NAMES.map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1">
                 {blanks.map(b => <div key={`b-${b}`} className="aspect-square rounded-lg bg-transparent" />)}
                 {days.map(day => {
                    const y = currentYear;
                    const m = String(currentMonth + 1).padStart(2, '0');
                    const d = String(day).padStart(2, '0');
                    const dateStr = `${y}-${m}-${d}`;
                    const status = availability[dateStr];
                    const isSyncing = syncingDays[dateStr];

                    // Check if day has an assigned event
                    const hasAssignedEvent = assignedEvents.some(event => event.date === dateStr);
                    
                    let bgClass = "bg-white/5 hover:bg-white/10 text-gray-300 border border-transparent";
                    let tooltipText = "Sin definir disponibilidad";

                    if (hasAssignedEvent) {
                      const ev = assignedEvents.find(e => e.date === dateStr);
                      bgClass = "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.15)] cursor-not-allowed";
                      tooltipText = `Evento Asignado: ${ev?.name || "Producción"}`;
                    } else if (status === "available") {
                      bgClass = "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.15)] hover:bg-emerald-500/30";
                      tooltipText = "Disponible para trabajar";
                    } else if (status === "busy") {
                      bgClass = "bg-red-500/20 text-red-300 border border-red-500/40 shadow-[0_0_10px_rgba(239,68,68,0.15)] hover:bg-red-500/30";
                      tooltipText = "No disponible para trabajar";
                    }

                    return (
                      // 1️⃣ Mejorar Calendario (Click cycling, transitions, custom tooltips, loading state)
                      <div key={day} className="relative group flex items-center justify-center">
                        <button
                          onClick={() => toggleAvailability(day)}
                          disabled={hasAssignedEvent}
                          className={`w-full aspect-square rounded-lg text-xs transition-all duration-300 flex items-center justify-center font-bold relative active:scale-90 ${bgClass}`}
                        >
                          {isSyncing ? (
                            <svg className="animate-spin h-3.5 w-3.5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : (
                            day
                          )}
                        </button>
                        
                        {/* Custom Animated Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-[99] bg-gray-950/95 border border-white/10 text-[10px] text-white rounded-lg px-2.5 py-1 shadow-2xl whitespace-nowrap pointer-events-none transition-all duration-300 transform translate-y-1">
                          {tooltipText}
                        </div>
                      </div>
                    );
                 })}
              </div>
              
              <div className="mt-5 flex flex-col gap-2 text-[11px] text-gray-400 border-t border-white/5 pt-4">
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-emerald-500/20 border border-emerald-500/40"></div> Disponible</div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/40"></div> No Disponible</div>
                 <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500/40"></div> Evento Asignado (Bloqueado)</div>
                 <p className="mt-2 text-[10px] text-gray-500 italic leading-relaxed">
                   * Haz clic en los días desbloqueados para alternar tus preferencias de disponibilidad en tiempo real.
                 </p>
              </div>
            </div>
          </GlassCard>

          {/* 7️⃣ Notificaciones Panel */}
          <GlassCard className="p-6 border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              Notificaciones Operativas
            </h2>
            <div className="space-y-3.5">
              {notifications.map(n => {
                let cardStyle = "border-amber-500/20 bg-amber-500/5";
                let icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
                if (n.type === "info") {
                  cardStyle = "border-blue-500/20 bg-blue-500/5";
                  icon = <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;
                } else if (n.type === "danger") {
                  cardStyle = "border-red-500/20 bg-red-500/5";
                  icon = <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
                }

                return (
                  <div key={n.id} className={`p-3.5 rounded-2xl border text-xs flex gap-3 shadow-inner ${cardStyle}`}>
                    {icon}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center gap-2">
                        <strong className="text-gray-100 font-bold leading-none">{n.title}</strong>
                        <span className="text-[9px] text-gray-500 font-medium whitespace-nowrap">{n.time}</span>
                      </div>
                      <p className="text-gray-300 leading-normal">{n.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* 6️⃣ Feed de Actividad Panel */}
          <GlassCard className="p-6 border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              Actividad Reciente
            </h2>
            <div className="space-y-4 max-h-56 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
              <AnimatePresence initial={false}>
                {activities.map(act => (
                  <motion.div 
                    key={act.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex gap-2.5 items-start text-xs border-b border-white/5 pb-3 last:border-b-0 last:pb-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <div className="space-y-0.5">
                      <p className="text-gray-200 font-medium leading-normal">{act.text}</p>
                      <span className="text-[9px] text-gray-500 block font-semibold">{act.time}</span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </GlassCard>

        </motion.section>

      </div>

      {/* Details Modal */}
      <AnimatePresence>
        {selectedDetailedEvent && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-gray-900 border border-white/10 rounded-3xl p-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-[60px] pointer-events-none" />
              
              <button 
                onClick={() => setSelectedDetailedEvent(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>

              <h3 className="text-2xl font-bold text-white mb-4 pr-8">{selectedDetailedEvent.name}</h3>
              
              <div className="space-y-4 text-sm text-gray-300">
                <div className="bg-white/5 p-4 rounded-xl space-y-2 border border-white/5 shadow-inner">
                  <p><strong className="text-amber-400">Cliente:</strong> {selectedDetailedEvent.client || 'Por definir'}</p>
                  <p><strong className="text-amber-400">Ubicación:</strong> {selectedDetailedEvent.location}</p>
                  <p><strong className="text-amber-400">Hora de Montaje:</strong> 2 horas antes ({selectedDetailedEvent.time})</p>
                  <p><strong className="text-amber-400">Estado del Evento:</strong> {selectedDetailedEvent.status}</p>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider text-amber-400">Descripción del Evento:</h4>
                  <p className="text-gray-400 italic bg-black/20 p-3 rounded-xl border border-white/5 leading-relaxed">
                    {selectedDetailedEvent.description || "Sin descripción adicional proporcionada para esta fecha de producción."}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedDetailedEvent(null)}
                  className="px-5 py-2.5 bg-amber-500 text-gray-900 font-bold rounded-xl hover:bg-amber-400 transition-colors shadow-lg shadow-amber-500/20 active:scale-95 transition-all duration-300"
                >
                  Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
