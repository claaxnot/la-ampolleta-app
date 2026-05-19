import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase.js";
import { CalendarDays, Users, Zap, Bell, ArrowRight, Download, Activity, Clock } from "lucide-react";
import StatCard from "../components/StatCard.jsx";
import GlassCard from "../components/GlassCard.jsx";
import EventDetails from "../components/EventDetails.jsx";
import { toast } from "react-hot-toast";

// Variants for framer-motion staggered animations
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const [events, setEvents] = useState([]);
  const [staffCount, setStaffCount] = useState(0);
  const [activities, setActivities] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const getTimeAgo = (dateString) => {
    if (!dateString) return "Hace poco";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return `Hace unos segundos`;
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
  };

  React.useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setIsLoading(true);

    const { data: eventsData } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (eventsData) setEvents(eventsData);

    const { count: sCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    setStaffCount(sCount || 0);

    // Fetch Recent Activities
    const { data: recentEventsData } = await supabase.from('events').select('id, name, client, created_at').order('created_at', { ascending: false }).limit(5);
    const { data: recentStaffData } = await supabase.from('profiles').select('id, name, role, created_at').order('created_at', { ascending: false }).limit(5);

    const combinedActivities = [];
    if (recentEventsData) {
      recentEventsData.forEach(e => {
        combinedActivities.push({
          id: `e-${e.id}`,
          text: `Nuevo evento creado: ${e.name} para ${e.client}`,
          time: getTimeAgo(e.created_at),
          date: new Date(e.created_at)
        });
      });
    }
    if (recentStaffData) {
      recentStaffData.forEach(s => {
        combinedActivities.push({
          id: `s-${s.id}`,
          text: `Nuevo trabajador registrado: ${s.name} (${s.role})`,
          time: getTimeAgo(s.created_at),
          date: new Date(s.created_at)
        });
      });
    }

    combinedActivities.sort((a, b) => b.date - a.date);
    setActivities(combinedActivities.slice(0, 5));

    setIsLoading(false);
  };

  const totalEvents = events.length;
  const totalStaff = Math.max(0, staffCount - 1);

  const upcomingEvents = events.filter(e => {
    const statusLower = e.status ? e.status.toLowerCase() : "";
    if (statusLower === "completado" || statusLower === "finalizado" || statusLower === "cancelado") return false;
    const [eYear, eMonth, eDay] = e.date.split('-').map(Number);
    const eventDate = new Date(eYear, eMonth - 1, eDay);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return eventDate >= today;
  }).length;

  const currentMonthEvents = events.filter(e => {
    if (!e.date) return false;
    const [eYear, eMonth] = e.date.split('-').map(Number);
    const today = new Date();
    return eYear === today.getFullYear() && eMonth === (today.getMonth() + 1);
  }).length;

  const stats = [
    { title: "Eventos Totales", value: totalEvents, icon: CalendarDays, color: "bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]" },
    { title: "Personal", value: totalStaff, icon: Users, color: "bg-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]" },
    { title: "Próximos Eventos", value: upcomingEvents, icon: Zap, color: "bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]" },
    { title: "Eventos del Mes", value: currentMonthEvents, icon: CalendarDays, color: "bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]" },
  ];

  const recentEvents = events
    .filter(e => {
      const statusLower = e.status ? e.status.toLowerCase() : "";
      return statusLower !== "completado" && statusLower !== "finalizado" && statusLower !== "cancelado";
    })
    .slice(0, 5);

  return (
    <motion.div
      className="p-6 lg:p-8 min-h-[calc(100vh-64px)]"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.header variants={itemVariants} className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
            Panel de Control
          </h1>
          <p className="text-gray-400 mt-1">Resumen general de La Ampolleta Producciones</p>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500 hover:text-gray-900 rounded-xl font-medium transition-all shadow-[0_0_15px_rgba(245,158,11,0.15)] group"
        >
          <Download className="w-4 h-4" />
          Descargar Reporte
        </button>
      </motion.header>

      {/* Stat cards */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <motion.div key={i} whileHover={{ y: -5, scale: 1.02 }} transition={{ type: "spring", stiffness: 300 }}>
            <StatCard
              title={stat.title}
              value={stat.value}
              Icon={stat.icon}
              colorClass={stat.color}
            />
          </motion.div>
        ))}
      </motion.section>

      {/* Main Grid: Events Table & Activities */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Recent events table (takes 2/3 space on large screens) */}
        <motion.section variants={itemVariants} className="xl:col-span-2">
          <GlassCard className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-amber-400" />
                Eventos Próximos
              </h2>
              <button
                onClick={() => navigate("/events")}
                className="text-sm text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-colors"
              >
                Ver todos <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-x-auto flex-1">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Evento</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Fecha</th>
                    <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/30">
                  {recentEvents.map((e, idx) => {
                    let statusColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                    if (e.status.toLowerCase() === 'confirmado' || e.status.toLowerCase() === 'active') {
                      statusColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
                    } else if (e.status.toLowerCase() === 'completado') {
                      statusColor = "bg-gray-500/20 text-gray-400 border-gray-500/30";
                    }

                    return (
                      <tr
                        key={idx}
                        onClick={() => {
                          setSelectedEvent(e);
                          setIsDetailsOpen(true);
                        }}
                        className="hover:bg-white/5 transition-colors group cursor-pointer"
                      >
                        <td className="px-4 py-4 text-gray-200 font-medium">{e.name}</td>
                        <td className="px-4 py-4 text-gray-400 text-sm">{e.client}</td>
                        <td className="px-4 py-4 text-gray-300 text-sm">
                          {e.date.split('-').reverse().join('/')}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs border ${statusColor}`}>
                            {e.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </motion.section>

        {/* Recent Activities Timeline (takes 1/3 space) */}
        <motion.section variants={itemVariants} className="xl:col-span-1">
          <GlassCard className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-400" />
                Actividad Reciente
              </h2>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
              {activities.length === 0 ? (
                <div className="text-gray-400 text-sm text-center mt-4">No hay actividad reciente.</div>
              ) : (
                activities.map((activity, idx) => (
                  <div key={activity.id} className="relative pl-6">
                    {/* Timeline vertical line */}
                    {idx !== activities.length - 1 && (
                      <div className="absolute left-2.5 top-5 bottom-[-24px] w-[1px] bg-gray-700/50"></div>
                    )}
                    {/* Timeline dot */}
                    <div className="absolute left-1 top-1.5 w-3 h-3 rounded-full bg-purple-500/50 border-2 border-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.5)]"></div>

                    <div className="bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 transition-colors">
                      <p className="text-sm text-gray-200 leading-snug">{activity.text}</p>
                      <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {activity.time}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button
              onClick={() => toast.success("El historial completo estará disponible próximamente.")}
              className="mt-6 w-full py-2.5 rounded-xl bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 border border-gray-700 transition-colors text-sm font-medium"
            >
              Ver todo el historial
            </button>
          </GlassCard>
        </motion.section>

      </div>

      {/* Modal de Detalles del Evento */}
      <EventDetails
        event={selectedEvent}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </motion.div>
  );
}