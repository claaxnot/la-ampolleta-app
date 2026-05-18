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

  React.useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*');
    if (data) setEvents(data);
  };
  
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentYear, currentMonth + 1, 1));
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

  return (
    <motion.div
      className="p-4 md:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlassCard className="p-6 flex flex-col min-h-[85vh]">
        {/* Cabecera del Calendario */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/20 rounded-xl text-primary shadow-[0_0_15px_rgba(234,179,8,0.3)]">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-wide">
              {MONTH_NAMES[currentMonth]} <span className="text-gray-400 font-light">{currentYear}</span>
            </h2>
          </div>
          
          <div className="flex items-center space-x-2 bg-gray-800/40 p-1 rounded-xl border border-gray-700/50 backdrop-blur-md">
            <button 
              onClick={handlePrevMonth} 
              className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())} 
              className="px-6 py-2 rounded-lg bg-gray-700/30 hover:bg-primary/20 hover:text-primary text-white transition-all font-medium"
            >
              Hoy
            </button>
            <button 
              onClick={handleNextMonth} 
              className="p-2 rounded-lg hover:bg-gray-700/50 text-gray-300 hover:text-white transition-all"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Días de la Semana */}
        <div className="grid grid-cols-7 gap-2 md:gap-4 mb-2 md:mb-4">
          {DAY_NAMES.map(day => (
            <div key={day} className="text-center text-xs md:text-sm font-semibold text-gray-400 uppercase tracking-wider py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Cuadrícula del Calendario */}
        <div className="grid grid-cols-7 gap-2 md:gap-4 flex-1">
          {/* Celdas vacías (días del mes anterior) */}
          {blanks.map(blank => (
            <div 
              key={`blank-${blank}`} 
              className="rounded-2xl bg-white/5 border border-white/5 opacity-40 min-h-[100px] md:min-h-[140px]" 
            />
          ))}
          
          {/* Celdas con días reales */}
          {days.map(day => {
            const dayEvents = getEventsForDay(day);
            const isToday = 
              day === new Date().getDate() && 
              currentMonth === new Date().getMonth() && 
              currentYear === new Date().getFullYear();

            return (
              <motion.div
                key={day}
                whileHover={{ scale: 1.02, zIndex: 10 }}
                className={`p-2 md:p-3 rounded-2xl border min-h-[100px] md:min-h-[140px] transition-all flex flex-col relative group ${
                  isToday 
                    ? 'bg-primary/10 border-primary/50 shadow-[inset_0_0_20px_rgba(234,179,8,0.15)]' 
                    : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`flex items-center justify-center w-8 h-8 rounded-full text-sm md:text-base font-bold ${
                    isToday ? 'bg-primary text-gray-900' : 'text-gray-200'
                  }`}>
                    {day}
                  </span>
                  
                  {/* Badge contador de eventos */}
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] md:text-xs bg-gray-800/80 text-gray-300 px-2 py-0.5 rounded-full border border-gray-700">
                      {dayEvents.length} {dayEvents.length === 1 ? 'Evt' : 'Evts'}
                    </span>
                  )}
                </div>
                
                {/* Lista de eventos del día */}
                <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                  {dayEvents.map(event => {
                    // Determinar el color según el estado
                    let statusColor = "bg-amber-500/20 text-amber-300 border-amber-500/30"; // Pendiente / Planificado
                    if (event.status.toLowerCase() === 'confirmado' || event.status.toLowerCase() === 'active') {
                      statusColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
                    } else if (event.status.toLowerCase() === 'completado') {
                      statusColor = "bg-gray-500/20 text-gray-400 border-gray-500/30";
                    }

                    return (
                      <div 
                        key={event.id}
                        onClick={() => {
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
      </GlassCard>

      {/* Modal de Detalles del Evento */}
      <EventDetails 
        event={selectedEvent} 
        isOpen={isDetailsOpen} 
        onClose={() => setIsDetailsOpen(false)} 
      />
    </motion.div>
  );
}