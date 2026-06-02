import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import { supabase } from "../lib/supabase.js";
import EventDetails from "../components/EventDetails.jsx";

// Helper functions for calendar grid logic
const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => {
  let day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Ajustamos para que Lunes = 0, Domingo = 6
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DAY_NAMES = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default function Calendar() {
  // Estado inicial: fecha actual
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());

  React.useEffect(() => {
    fetchEvents();

    console.log("🔌 [REALTIME CALENDAR] - Subscribiendo a cambios en tablas events y event_days...");
    const channel = supabase
      .channel('calendar-events-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events' },
        (payload) => {
          console.log("🔔 [REALTIME CALENDAR] - Cambio detectado en tabla events:", payload);
          fetchEvents();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_days' },
        (payload) => {
          console.log("🔔 [REALTIME CALENDAR] - Cambio detectado en tabla event_days:", payload);
          fetchEvents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from('event_days')
      .select('*, events(*)');
      
    if (error) {
      console.error("Error fetching event days for calendar:", error);
      return;
    }

    if (data) {
      const mapped = data.map(d => {
        const parent = d.events || {};
        return {
          ...parent,
          ...d,
          id: d.event_id, // Detalle modal uses parent event_id
          day_id: d.id,
          name: parent.name || "Sin nombre",
          location: parent.location || "Sin ubicación",
          date: d.date, // Usar la fecha específica de la jornada
          time: d.start_time ? d.start_time.substring(0, 5) : "09:00",
          end_time: d.end_time ? d.end_time.substring(0, 5) : "18:00",
          call_time: d.call_time ? d.call_time.substring(0, 5) : "",
          setup_time: d.setup_time ? d.setup_time.substring(0, 5) : "",
          status: d.status || parent.status || "Planificado"
        };
      });
      setEvents(mapped);
    }
  };
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
    setSelectedDay(1);
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
    setSelectedDay(1);
  };

  // Crear arrays para dibujar la cuadrícula
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Filtrar eventos de Supabase para el día específico
  const getEventsForDay = (day) => {
    return events.filter(event => {
      // Usamos split para evitar problemas de zona horaria con new Date()
      const [eYear, eMonth, eDay] = event.date.split('-').map(Number);
      return (
        eDay === day &&
        (eMonth - 1) === currentMonth && // los meses en JS van de 0 a 11
        eYear === currentYear
      );
    });
  };

  const selectedDayEvents = getEventsForDay(selectedDay);

  return (
    <motion.div
      className="p-4 md:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="p-4 md:p-6 flex flex-col min-h-[85vh]">
        {/* Cabecera del Calendario */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-6 md:mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-xl text-primary shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-wide">
              {MONTH_NAMES[currentMonth]} <span className="text-gray-400 font-light">{currentYear}</span>
            </h2>
          </div>
          
          <div className="flex items-center space-x-2 bg-gray-800/40 p-1 rounded-xl border border-gray-700/50 backdrop-blur-md">
            <button 
              onClick={handlePrevMonth} 
              className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all"
            >
              <ChevronLeft className="w-5 h-5 md:w-6 md:h-6" />
            </button>
            <button 
              onClick={() => {
                const today = new Date();
                setCurrentDate(today);
                setSelectedDay(today.getDate());
              }} 
              className="px-4 md:px-6 py-2 rounded-lg bg-gray-700/30 hover:bg-primary/20 hover:text-primary text-white transition-all text-sm md:text-base font-medium"
            >
              Hoy
            </button>
            <button 
              onClick={handleNextMonth} 
              className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all"
            >
              <ChevronRight className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          </div>
        </div>

        {/* Días de la Semana */}
        <div className="grid grid-cols-7 gap-1 md:gap-4 mb-2 md:mb-4">
          {DAY_NAMES.map(day => (
            <div key={day} className="text-center text-[10px] md:text-sm font-semibold text-gray-400 uppercase tracking-wider py-1 md:py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Cuadrícula del Calendario */}
        <div className="grid grid-cols-7 gap-1 md:gap-4">
          {/* Celdas vacías (días del mes anterior) */}
          {blanks.map(blank => (
            <div 
              key={`blank-${blank}`} 
              className="rounded-xl md:rounded-2xl bg-white/5 border border-white/5 opacity-30 h-10 md:min-h-[140px]" 
            />
          ))}
          
          {/* Celdas con días reales */}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isToday = 
              day === new Date().getDate() && 
              currentMonth === new Date().getMonth() && 
              currentYear === new Date().getFullYear();
            const isSelected = day === selectedDay;

            return (
              <motion.div
                key={day}
                whileHover={{ scale: 1.02, zIndex: 10 }}
                onClick={() => setSelectedDay(day)}
                className={`p-1 md:p-3 rounded-xl md:rounded-2xl border h-12 md:h-auto md:min-h-[140px] transition-all flex flex-col justify-between md:justify-start cursor-pointer relative group ${
                  isToday 
                    ? 'bg-primary/10 border-primary/50 shadow-[inset_0_0_20px_rgba(234,179,8,0.15)]' 
                    : isSelected
                      ? 'bg-amber-500/10 border-amber-500/50 shadow-[inset_0_0_15px_rgba(245,158,11,0.15)]'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-center md:items-start w-full">
                  <span className={`flex items-center justify-center w-5 h-5 md:w-8 md:h-8 rounded-full text-xs md:text-base font-bold ${
                    isToday ? 'bg-primary text-gray-900' : 'text-gray-200'
                  }`}>
                    {day}
                  </span>
                  
                  {/* Badge contador de eventos - Desktop */}
                  {dayEvents.length > 0 && (
                    <span className="hidden md:inline-block text-[10px] md:text-xs bg-gray-800/80 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700">
                      {dayEvents.length} {dayEvents.length === 1 ? 'Evt' : 'Evts'}
                    </span>
                  )}
                </div>

                {/* Mobile: Puntos indicadores de eventos */}
                {dayEvents.length > 0 && (
                  <div className="flex md:hidden justify-center gap-0.5 mt-0.5 w-full">
                    {dayEvents.slice(0, 3).map((event, idx) => {
                      const getDotColor = (status) => {
                        switch (status?.toLowerCase()) {
                          case "confirmado":
                          case "confirmed":
                          case "active":
                          case "activo":
                            return "bg-emerald-400";
                          case "completado":
                          case "completed":
                          case "finalizado":
                            return "bg-gray-400";
                          case "cancelado":
                          case "cancelled":
                            return "bg-red-400";
                          default:
                            return "bg-amber-400";
                        }
                      };
                      return (
                        <span 
                          key={idx} 
                          className={`w-1 h-1 rounded-full ${getDotColor(event.status)}`}
                        />
                      );
                    })}
                    {dayEvents.length > 3 && (
                      <span className="text-[7px] text-gray-500 font-black leading-none">+</span>
                    )}
                  </div>
                )}
                
                {/* Lista de eventos del día - Desktop */}
                <div className="hidden md:block flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1 mt-2">
                  {dayEvents.map(event => {
                    const getStatusColor = (status) => {
                      switch (status?.toLowerCase()) {
                        case "confirmado":
                        case "confirmed":
                        case "active":
                        case "activo":
                          return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30";
                        case "completado":
                        case "completed":
                        case "finalizado":
                          return "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30";
                        case "cancelado":
                        case "cancelled":
                          return "bg-red-500/20 text-red-300 border-red-500/30 hover:bg-red-500/30";
                        default:
                          return "bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30";
                      }
                    };
                    const statusColor = getStatusColor(event.status);

                    return (
                      <div 
                        key={event.day_id || event.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                          setIsDetailsOpen(true);
                        }}
                        className={`text-[10px] md:text-xs px-2 py-1.5 rounded-lg border backdrop-blur-sm cursor-pointer transition-colors hover:brightness-125 flex flex-col gap-1 ${statusColor}`}
                        title={`${event.name} - ${event.time} en ${event.location}`}
                      >
                        <div className="font-semibold truncate">{event.name}</div>
                        <div className="flex items-center gap-1 opacity-80 text-[9px] md:text-[10px]">
                          <Clock className="w-3 h-3" />
                          {event.time}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Mobile: Detalle de Eventos para el día seleccionado */}
        <div className="block md:hidden mt-6 border-t border-white/10 pt-4 flex-1">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>Eventos del {selectedDay} de {MONTH_NAMES[currentMonth]}</span>
            </h3>
            <span className="text-[10px] bg-gray-800 text-gray-300 px-2 py-0.5 rounded-lg border border-gray-700 font-medium">
              {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'evento' : 'eventos'}
            </span>
          </div>
          
          {selectedDayEvents.length === 0 ? (
            <div className="p-6 text-center text-xs text-gray-500 bg-white/5 rounded-2xl border border-white/5">
              No hay eventos programados para este día.
            </div>
          ) : (
            <div className="space-y-3">
              {selectedDayEvents.map(event => {
                const getStatusColor = (status) => {
                  switch (status?.toLowerCase()) {
                    case "confirmado":
                    case "confirmed":
                    case "active":
                    case "activo":
                      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    case "completado":
                    case "completed":
                    case "finalizado":
                      return "bg-gray-500/10 text-gray-400 border-gray-500/20";
                    case "cancelado":
                    case "cancelled":
                      return "bg-red-500/10 text-red-400 border-red-500/20";
                    default:
                      return "bg-amber-500/10 text-amber-400 border-amber-500/20";
                  }
                };
                const statusClass = getStatusColor(event.status);
                
                return (
                  <div
                    key={event.day_id || event.id}
                    onClick={() => {
                      setSelectedEvent(event);
                      setIsDetailsOpen(true);
                    }}
                    className="p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer flex flex-col gap-2 active:scale-[0.98]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-white leading-snug">{event.name}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border uppercase tracking-wider font-extrabold shrink-0 ${statusClass}`}>
                        {event.status || 'Planificado'}
                      </span>
                    </div>
                    
                    <div className="flex flex-col gap-1 text-[11px] text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>Horario: <strong className="text-gray-200">{event.time} - {event.end_time}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 flex items-center justify-center text-amber-400 shrink-0">📍</span>
                        <span className="truncate">{event.location}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {/* Modal de Detalles del Evento */}
      <EventDetails 
        event={selectedEvent} 
        isOpen={isDetailsOpen} 
        onClose={() => {
          setIsDetailsOpen(false);
          fetchEvents();
        }} 
      />
    </motion.div>
  );
}