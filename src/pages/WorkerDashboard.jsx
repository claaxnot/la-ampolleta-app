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
  AlertTriangle,
  Check,
  BellOff,
  Sliders,
  User,
  DollarSign,
  Building,
  Wallet,
  Landmark,
  Coins,
  ChevronDown,
  ChevronUp
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
  
  // Perfil del trabajador para consultar su rol real
  const [workerProfile, setWorkerProfile] = useState(null);
  const [financeMonthFilter, setFinanceMonthFilter] = useState("all");

  const completedEvents = React.useMemo(() => {
    return assignedEvents.filter(event => {
      const isFinished = event.date ? new Date(event.date) < new Date() : false;
      return event.assignment_status === "Confirmado" && isFinished;
    });
  }, [assignedEvents]);

  // Obtener los periodos únicos de meses para rellenar el dropdown
  const uniqueFinanceMonths = React.useMemo(() => {
    const periods = new Set();
    completedEvents.forEach(e => {
      if (e.date) {
        const [year, month] = e.date.split("-");
        if (year && month) {
          periods.add(`${year}-${month}`);
        }
      }
    });
    return Array.from(periods).sort().reverse();
  }, [completedEvents]);

  const filteredCompletedEvents = React.useMemo(() => {
    if (financeMonthFilter === "all") return completedEvents;
    return completedEvents.filter(e => e.date && e.date.startsWith(financeMonthFilter));
  }, [completedEvents, financeMonthFilter]);

  // Estados de Finanzas y Sub-pestañas sincronizados con la URL
  const [activeSubTab, setActiveSubTab] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get("tab") === "finanzas" ? "finanzas" : "dashboard";
  });

  // Escuchar cambios en la URL (como cuando se hace clic en la barra lateral)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get("tab");
    if (tabParam === "finanzas") {
      setActiveSubTab("finanzas");
    } else {
      setActiveSubTab("dashboard");
    }
  }, [window.location.search]);
  const [bankForm, setBankForm] = useState({
    cuenta_destino: "",
    codigo_banco_destino: ""
  });
  const [isUpdatingBank, setIsUpdatingBank] = useState(false);

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

  // Real-time Notifications state (Con estado de lectura y animaciones)
  const [notifications, setNotifications] = useState([]);
  const [showAllNotifications, setShowAllNotifications] = useState(false);

  const generateDynamicNotifications = (eventsList) => {
    if (!eventsList || eventsList.length === 0) return [];
    
    const list = [];
    eventsList.forEach(e => {
      const isPending = e.assignment_status === "Pendiente";
      
      // 1. Notificación de Asignación
      list.push({
        id: `assign-${e.assignment_id}`,
        title: isPending ? "📅 Nueva Asignación de Evento" : "✅ Asistencia Confirmada",
        desc: isPending 
          ? `Has sido asignado para el evento "${e.name}" el ${e.date}. Por favor responde a la citación.`
          : `Confirmaste tu asistencia para el evento "${e.name}" el ${e.date}.`,
        type: isPending ? "warning" : "info",
        time: e.time ? `Showtime: ${e.time.slice(0, 5)}` : "Programado",
        read: !isPending
      });

      // 2. Notificación de Citación
      if (e.call_time) {
        list.push({
          id: `times-${e.assignment_id}`,
          title: "⏱️ Citación y Horarios Definidos",
          desc: `Citación: ${e.call_time.slice(0, 5)} hrs.${e.setup_time ? ` | Montaje: ${e.setup_time.slice(0, 5)} hrs.` : ''}`,
          type: "info",
          time: "Confirmado",
          read: true
        });
      }

      // 3. Notificación de Planificación Pendiente
      if (e.operational_info_pending) {
        list.push({
          id: `pending-${e.assignment_id}`,
          title: "⚠️ Planificación Operativa Pendiente",
          desc: `Los horarios de montaje y citación para "${e.name}" aún están siendo validados por producción.`,
          type: "danger",
          time: "Pendiente",
          read: false
        });
      }

      // 4. Notificación de Pago de Honorarios Realizado
      if (e.payment_status === "Pagado") {
        list.push({
          id: `payment-${e.assignment_id}`,
          title: "💰 Pago de Honorarios Realizado",
          desc: `Se ha procesado y liquidado con éxito el pago por tu participación en el evento "${e.name}".`,
          type: "info",
          time: "Liquidado",
          read: false
        });
      }
    });

    return list;
  };

  const fetchMyDbNotifications = async (workerId, currentEventsList = []) => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', workerId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.warn("⚠️ [NOTIFICATIONS TABLE]: La tabla no existe o error en consulta, usando notificaciones dinámicas reales.");
        setNotifications(generateDynamicNotifications(currentEventsList));
      } else if (data && data.length > 0) {
        const formatted = data.map(n => ({
          id: n.id,
          title: n.title,
          desc: n.description,
          type: n.type || "info",
          time: getTimeAgo(n.created_at),
          read: n.read
        }));
        setNotifications(formatted);
      } else {
        // Si la tabla está vacía, usar las notificaciones dinámicas reales de sus eventos asignados
        setNotifications(generateDynamicNotifications(currentEventsList));
      }
    } catch (err) {
      console.warn("⚠️ [NOTIFICATIONS TABLE]: Fallo de conexión, usando notificaciones dinámicas reales:", err);
      setNotifications(generateDynamicNotifications(currentEventsList));
    }
  };
  
  // Real-time Activity Feed state
  const [activities, setActivities] = useState([
    { id: 1, text: "Sistema operativo inicializado correctamente.", type: "system", time: "Hace unos minutos" },
    { id: 2, text: "Sesión iniciada con éxito.", type: "auth", time: "Hace 5 minutes" }
  ]);

  const addActivity = (text, type) => {
    setActivities(prev => [
      { id: Date.now(), text, type, time: "Ahora mismo" },
      ...prev
    ]);
  };

  const markAsRead = async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    toast.success("Notificación marcada como leída", { duration: 1500 });
    
    if (typeof id === 'string') {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('id', id);
      } catch (err) {
        console.error("Error updating notification in database:", err);
      }
    }
  };

  const markAllAsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    toast.success("Todas las notificaciones leídas", { duration: 1500 });
    
    if (user?.id) {
      try {
        await supabase
          .from('notifications')
          .update({ read: true })
          .eq('user_id', user.id);
      } catch (err) {
        console.error("Error marking all notifications as read in database:", err);
      }
    }
  };

  // Clock updates every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch inicial de datos y Subscripción Realtime para notificaciones físicas de base de datos
  useEffect(() => {
    if (user?.id) {
      fetchMyEvents(user.id);
      fetchMyAvailability(user.id);
      
      // Cargar perfil real del trabajador
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        if (data) {
          setWorkerProfile(data);
          setBankForm({
            cuenta_destino: data.cuenta_destino || "",
            codigo_banco_destino: data.codigo_banco_destino || ""
          });
        }
      });

      console.log("🔌 [REALTIME] - Subscribiendo WorkerDashboard a tabla 'notifications'...");
      const channel = supabase
        .channel('db-notifications-updates')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            if (payload.new && payload.new.user_id === user.id) {
              console.log("🔔 [REALTIME] - Nueva notificación física recibida:", payload.new);
              const newNotif = {
                id: payload.new.id,
                title: payload.new.title,
                desc: payload.new.description,
                type: payload.new.type || "info",
                time: "Ahora mismo",
                read: payload.new.read
              };
              setNotifications(prev => [newNotif, ...prev]);
              toast.success(`Nueva notificación: ${payload.new.title}`, {
                icon: "🔔",
                duration: 4000,
                style: {
                  background: 'rgba(31, 41, 55, 0.95)',
                  color: '#fff',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)'
                }
              });
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications' },
          (payload) => {
            if (payload.new && payload.new.user_id === user.id) {
              console.log("🔔 [REALTIME] - Notificación física modificada:", payload.new);
              setNotifications(prev => prev.map(n => n.id === payload.new.id ? {
                ...n,
                read: payload.new.read
              } : n));
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  // Suscripción Realtime en Supabase para actualizaciones en vivo
  useEffect(() => {
    if (!user?.id || assignedEvents.length === 0) return;

    console.log("🔌 [REALTIME] - Subscribiendo a eventos en vivo para trabajador:", user.id);
    const channel = supabase
      .channel('events-updates-worker')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        async (payload) => {
          const updatedEvent = payload.new;
          
          // Verificar si el trabajador está asignado a este evento actualizado
          const isAssigned = assignedEvents.some(e => e.id === updatedEvent.id);
          if (isAssigned) {
            console.log("🔔 [REALTIME] - Evento asignado actualizado en BD:", updatedEvent);
            const oldEvent = assignedEvents.find(e => e.id === updatedEvent.id);
            
            const newNotifs = [];
            let changesText = [];

            // Detectar cambios en tiempos técnicos
            if (oldEvent.call_time !== updatedEvent.call_time && updatedEvent.call_time) {
              newNotifs.push({
                id: Date.now() + 1,
                title: "⏱️ Hora de Citación Definida",
                desc: `Tu hora de presentación para "${updatedEvent.name}" se fijó a las ${updatedEvent.call_time.slice(0, 5)} hrs.`,
                type: "info",
                time: "Ahora mismo",
                read: false
              });
              changesText.push("citación");
            }

            if (oldEvent.setup_time !== updatedEvent.setup_time && updatedEvent.setup_time) {
              newNotifs.push({
                id: Date.now() + 2,
                title: "🏗️ Hora de Montaje Cargada",
                desc: `Se estableció el montaje técnico para "${updatedEvent.name}" a las ${updatedEvent.setup_time.slice(0, 5)} hrs.`,
                type: "warning",
                time: "Ahora mismo",
                read: false
              });
              changesText.push("montaje");
            }

            if (oldEvent.operational_info_pending && !updatedEvent.operational_info_pending) {
              newNotifs.push({
                id: Date.now() + 3,
                title: "✅ Planificación Completada",
                desc: `La planificación técnica de "${updatedEvent.name}" ya se encuentra definida por el Administrador.`,
                type: "info",
                time: "Ahora mismo",
                read: false
              });
              changesText.push("planificación");
            }

            if (newNotifs.length > 0) {
              setNotifications(prev => [...newNotifs, ...prev]);
              addActivity(`Se actualizó la información de tu evento: "${updatedEvent.name}" (${changesText.join(", ")}).`, "event");
              
              toast.success(`¡Tu evento "${updatedEvent.name}" fue actualizado!`, {
                icon: "🔔",
                duration: 5000,
                style: {
                  background: 'rgba(31, 41, 55, 0.95)',
                  color: '#fff',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  boxShadow: '0 0 20px rgba(245, 158, 11, 0.2)'
                }
              });
            } else {
              toast.success(`Evento actualizado: "${updatedEvent.name}"`, { icon: "📝" });
              addActivity(`Tu evento "${updatedEvent.name}" fue modificado.`, "event");
            }

            // Recargar eventos para actualizar transiciones en UI en tiempo real
            fetchMyEvents(user.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'event_assignments' },
        async (payload) => {
          if (payload.new && payload.new.staff_id === user.id) {
            console.log("🔔 [REALTIME] - Asignación o Pago actualizado en BD:", payload.new);
            
            // Si el estado de pago cambió a "Pagado", notificar
            if (payload.old && payload.old.payment_status !== "Pagado" && payload.new.payment_status === "Pagado") {
              toast.success("¡Recibiste un nuevo pago! Revisa tu historial.", {
                icon: "💰",
                duration: 5000,
                style: {
                  background: 'rgba(16, 185, 129, 0.95)',
                  color: '#fff',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  boxShadow: '0 0 20px rgba(16, 185, 129, 0.2)'
                }
              });
              addActivity("Se procesó y liquidó el pago de uno de tus eventos.", "success");
            } else {
              toast.success("Información de asignación o pago actualizada", { icon: "🔄" });
            }
            
            // Recargar eventos para refrescar montos y estados en la interfaz
            fetchMyEvents(user.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, assignedEvents]);

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
        payment_status,
        custom_rate,
        event_id,
        events (
          id, name, date, time, location, client, status, description,
          call_time, setup_time, end_time, priority, operational_notes,
          supervisor_id, type, operational_info_pending,
          profiles:supervisor_id (
            name
          )
        )
      `)
      .eq('staff_id', workerId);
      
    if (data) {
      const formattedEvents = data.map(assignment => ({
        assignment_id: assignment.id,
        assignment_status: assignment.status,
        payment_status: assignment.payment_status,
        custom_rate: assignment.custom_rate,
        ...assignment.events
      }));
      setAssignedEvents(formattedEvents);
      fetchMyDbNotifications(workerId, formattedEvents);
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
      
      // Crear notificación física de confirmación/rechazo para el trabajador
      try {
        await supabase.from('notifications').insert({
          user_id: user.id,
          title: newStatus === "Confirmado" ? "✅ Asistencia Confirmada" : "❌ Asistencia Rechazada",
          description: `Has ${newStatus === "Confirmado" ? "confirmado tu asistencia al" : "rechazado el"} evento "${eventInfo?.name || 'Evento'}" programado para el ${eventInfo?.date || ''}.`,
          type: newStatus === "Confirmado" ? "info" : "danger"
        });
      } catch (err) {
        console.warn("⚠️ [NOTIFICATIONS TABLE]: La tabla notifications no existe aún.");
      }
      
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

  // Detectar roles simples (Anfitriona, Modelo, Promotora)
  const workerRoleName = (workerProfile?.role || user?.role || "Staff").toLowerCase();
  const isWorkerSimpleRole = workerRoleName.includes("anfitriona") || workerRoleName.includes("promotora") || workerRoleName.includes("modelo");

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

      {/* Hero Section */}
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
              Bienvenido de vuelta. Tu rol operativo es <span className="text-amber-300 font-semibold capitalize">{workerProfile?.role || user?.role || "Staff"}</span>.
            </p>
          </div>

          <div className="flex flex-col md:items-end gap-1.5 bg-black/40 border border-white/5 p-4 rounded-2xl backdrop-blur-sm shadow-inner min-w-[240px]">
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
              {currentTime.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-2xl font-mono font-bold text-white tracking-widest">
              {currentTime.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-xs text-gray-300 font-medium border-t border-white/10 pt-1.5 mt-1.5 w-full md:text-right flex flex-col md:items-end gap-0.5">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Tiempo para próximo trabajo</span>
              <span className="flex items-center gap-1 font-semibold text-amber-300">
                🕒 {getCountdownString()}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Selector de Pestañas Premium (Visible solo en móviles/tablets) */}
      <motion.div 
        variants={itemVariants}
        className="flex md:hidden items-center gap-2 bg-gray-900/60 p-1.5 rounded-2xl border border-white/5 mb-6 backdrop-blur-sm max-w-md relative z-10"
      >
        <button
          onClick={() => setActiveSubTab("dashboard")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeSubTab === "dashboard"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
              : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Dashboard Principal
        </button>
        <button
          onClick={() => setActiveSubTab("finanzas")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${
            activeSubTab === "finanzas"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
              : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          Finanzas y Mis Datos
        </button>
      </motion.div>

      {activeSubTab === "dashboard" && (
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

              const isEventSimpleType = event.type === "Anfitrionas" || event.type === "Promotoría";
              
              // Planificación Técnica / Operacional Pendiente
              const isPlanPending = event.operational_info_pending ?? false;

              // Decidir si mostrar el bloque operacional o el timeline técnico en el dashboard
              const shouldShowOperationalSection = 
                !isWorkerSimpleRole && 
                !isEventSimpleType && 
                (isPlanPending || event.setup_time || event.call_time || event.end_time);

              // Decidir si mostrar supervisor y citación
              const shouldShowSupervisor = !isEventSimpleType && (event.profiles?.name || isPlanPending);
              const shouldShowCallTime = !isWorkerSimpleRole && !isEventSimpleType && (event.call_time || isPlanPending);

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

              // Real presentation time and supervisor name from DB
              const presentationTime = event.call_time 
                ? `${event.call_time.slice(0, 5)} hrs` 
                : (isPlanPending ? 'Por definir' : null);

              const supervisorName = event.profiles?.name 
                ? event.profiles.name 
                : (isPlanPending ? 'Por definir' : null);

              const priorityName = event.priority || 'Media';

              return (
                <motion.div
                  key={event.id}
                  whileHover={{ y: -4, scale: 1.01 }}
                  transition={{ duration: 0.2 }}
                  layout
                >
                  <GlassCard className={`p-6 border-l-4 ${isConfirmed ? 'border-l-emerald-500' : isRejected ? 'border-l-red-500' : 'border-l-amber-500'} ${glowColor} transition-all duration-300 relative overflow-hidden`}>
                    
                    {/* Badge indicador de Planificación Pendiente */}
                    {isPlanPending && (
                      <div className="absolute top-0 right-0 bg-amber-500/20 border-l border-b border-amber-500/30 text-amber-300 px-3 py-1 rounded-bl-xl text-[9px] font-extrabold uppercase tracking-widest animate-pulse">
                        Planificación Pendiente
                      </div>
                    )}

                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                      <div className="flex-1 space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xl font-bold text-white tracking-wide">{event.name}</h3>
                            <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400 font-semibold uppercase tracking-wider">
                              {event.type || "Producción técnica"}
                            </span>
                            <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${
                              priorityName === "Crítica" ? "bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]" :
                              priorityName === "Alta" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                              priorityName === "Media" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                              "bg-gray-500/20 text-gray-400 border-gray-500/30"
                            }`}>
                              Prioridad {priorityName}
                            </span>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${statusBadge}`}>
                            Asistencia: {event.assignment_status}
                          </span>
                        </div>

                        {/* Grid de Datos Adaptativo */}
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
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Showtime</span>
                            <span className="flex items-center gap-1.5 font-semibold text-gray-100">
                              🎬 {event.time ? event.time.slice(0, 5) : 'Por definir'}
                            </span>
                          </div>

                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Tu Rol</span>
                            <span className="flex items-center gap-1.5 font-semibold text-gray-100 capitalize">
                              🛠️ {workerProfile?.role || user?.role || "Staff"}
                            </span>
                          </div>

                          {shouldShowCallTime && presentationTime && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Presentación</span>
                              <span className={`flex items-center gap-1.5 font-semibold ${presentationTime === "Por definir" ? "text-amber-500/50 italic animate-pulse" : "text-amber-300"}`}>
                                <Clock className="w-4 h-4 text-amber-400" /> 
                                {presentationTime}
                              </span>
                            </div>
                          )}

                          {shouldShowSupervisor && supervisorName && (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Supervisor</span>
                              <span className={`flex items-center gap-1.5 font-semibold ${supervisorName === "Por definir" ? "text-gray-500 italic animate-pulse" : "text-gray-100 truncate"}`}>
                                👤 {supervisorName}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Notas operativas si existen */}
                        {event.operational_notes && (
                          <div className="text-xs bg-amber-500/5 text-amber-300 border border-amber-500/10 p-3 rounded-xl leading-relaxed">
                            <strong>⚠️ Notas de Operación:</strong> {event.operational_notes}
                          </div>
                        )}
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
                              ✓ Confirmada
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

                    {/* Timeline Operativo Adaptativo e Inteligente */}
                    {isConfirmed && shouldShowOperationalSection && (
                      <div className="mt-6 border-t border-white/5 pt-6">
                        <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-400 mb-4 flex items-center gap-1.5">
                          📋 Cronograma Operativo Técnico
                        </h4>
                        <div className="relative pl-6 border-l border-white/10 space-y-4">
                          
                          {/* 1. Montaje */}
                          {(!isEventSimpleType || isPlanPending) && (
                            <div className="relative group">
                              <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-4 border-gray-950 group-hover:scale-125 transition-transform duration-300 ${
                                event.setup_time ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-700'
                              }`} />
                              <div className="flex items-center justify-between text-xs md:text-sm">
                                <span className={`font-bold font-mono ${event.setup_time ? 'text-emerald-300' : 'text-gray-500 italic animate-pulse'}`}>
                                  {event.setup_time ? event.setup_time.slice(0, 5) : 'Por definir'}
                                </span>
                                <span className={event.setup_time ? 'text-gray-200' : 'text-gray-500 italic'}>
                                  {event.setup_time ? 'Inicio de montaje técnico y descarga' : 'Horario de montaje técnico por definir'}
                                </span>
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-medium">Montaje</span>
                              </div>
                            </div>
                          )}

                          {/* 2. Presentación (Llegada) */}
                          <div className="relative group">
                            <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-4 border-gray-950 group-hover:scale-125 transition-transform duration-300 ${
                              event.call_time ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gray-700'
                            }`} />
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className={`font-bold font-mono ${event.call_time ? 'text-amber-300' : 'text-gray-500 italic animate-pulse'}`}>
                                {event.call_time ? event.call_time.slice(0, 5) : 'Por definir'}
                              </span>
                              <span className={event.call_time ? 'text-gray-200' : 'text-gray-500 italic'}>
                                {event.call_time ? 'Hora de presentación en recinto (Call Time)' : 'Hora de citación por definir'}
                              </span>
                              <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20 font-medium">Llegada</span>
                            </div>
                          </div>

                          {/* 3. Showtime (Siempre visible) */}
                          <div className="relative group">
                            <div className="absolute -left-[30px] top-1.5 w-4 h-4 rounded-full bg-blue-500 border-4 border-gray-950 shadow-[0_0_10px_rgba(59,130,246,0.5)] group-hover:scale-125 transition-transform duration-300" />
                            <div className="flex items-center justify-between text-xs md:text-sm">
                              <span className="font-bold text-blue-300 font-mono">{event.time ? event.time.slice(0, 5) : 'Por definir'}</span>
                              <span className="text-gray-200">Inicio de show / Activación principal</span>
                              <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20 font-medium">Showtime</span>
                            </div>
                          </div>

                          {/* 4. Término */}
                          {(!isEventSimpleType || isPlanPending) && (
                            <div className="relative group">
                              <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-4 border-gray-950 group-hover:scale-125 transition-transform duration-300 ${
                                event.end_time ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gray-700'
                              }`} />
                              <div className="flex items-center justify-between text-xs md:text-sm">
                                <span className={`font-bold font-mono ${event.end_time ? 'text-red-300' : 'text-gray-500 italic animate-pulse'}`}>
                                  {event.end_time ? event.end_time.slice(0, 5) : 'Por definir'}
                                </span>
                                <span className={event.end_time ? 'text-gray-200' : 'text-gray-500 italic'}>
                                  {event.end_time ? 'Finalización del evento y desmontaje' : 'Hora de desmontaje y término por definir'}
                                </span>
                                <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20 font-medium">Término</span>
                              </div>
                            </div>
                          )}

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
          
          {/* Notificaciones Panel */}
          <GlassCard className="p-6 border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-400 animate-bounce" />
                Notificaciones
              </h2>
              {notifications.some(n => !n.read) && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] text-amber-400 hover:text-amber-300 transition-colors hover:underline font-bold"
                >
                  Marcar todas
                </button>
              )}
            </div>

            <div className={`space-y-3 pr-0.5 ${showAllNotifications ? "max-h-[360px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10" : ""}`}>
              <AnimatePresence initial={false}>
                {notifications.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 text-xs flex flex-col items-center gap-2">
                    <BellOff className="w-8 h-8 text-gray-700" />
                    <span>Sin notificaciones pendientes</span>
                  </div>
                ) : (
                  (showAllNotifications ? notifications : notifications.slice(0, 5)).map(n => {
                    let cardStyle = "border-amber-500/10 bg-amber-500/5 hover:bg-amber-500/10";
                    let icon = <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />;
                    if (n.type === "info") {
                      cardStyle = "border-blue-500/10 bg-blue-500/5 hover:bg-blue-500/10";
                      icon = <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />;
                    } else if (n.type === "danger") {
                      cardStyle = "border-red-500/10 bg-red-500/5 hover:bg-red-500/10";
                      icon = <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
                    }

                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        layout
                        className={`p-3 rounded-2xl border text-xs flex gap-2.5 transition-all duration-300 relative group overflow-hidden ${cardStyle} ${
                          !n.read ? 'shadow-[0_0_12px_rgba(245,158,11,0.06)] border-amber-500/30' : 'opacity-55 hover:opacity-80'
                        }`}
                      >
                        {/* Glow decorativo sutil si no está leída */}
                        {!n.read && (
                          <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 animate-pulse pointer-events-none" />
                        )}

                        {icon}
                        <div className="space-y-1 flex-1 min-w-0 relative z-10">
                          <div className="flex justify-between items-start gap-1">
                            <strong className="text-gray-100 font-bold leading-tight truncate pr-8">{n.title}</strong>
                            <span className="text-[8px] text-gray-500 font-medium whitespace-nowrap">{n.time}</span>
                          </div>
                          <p className="text-gray-300 leading-normal text-[11px]">{n.desc}</p>
                          
                          {/* Acciones de la notificación */}
                          {!n.read && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="text-[9px] text-amber-400 hover:text-amber-300 font-bold mt-1 block hover:underline"
                            >
                              Marcar como leído
                            </button>
                          )}
                        </div>

                        {/* Badge de Nuevo */}
                        {!n.read && (
                          <span className="absolute top-2 right-2 bg-amber-500 text-gray-900 text-[8px] font-extrabold px-1.5 py-0.5 rounded-full uppercase tracking-wider scale-90">
                            Nuevo
                          </span>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>

            {notifications.length > 5 && (
              <button
                onClick={() => setShowAllNotifications(!showAllNotifications)}
                className="w-full text-center py-2 text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors mt-2 border-t border-white/5 pt-3 hover:underline flex items-center justify-center gap-1.5"
              >
                {showAllNotifications ? (
                  <>
                    <span>Ver menos</span>
                    <ChevronUp className="w-3.5 h-3.5" />
                  </>
                ) : (
                  <>
                    <span>Ver todas ({notifications.length})</span>
                    <ChevronDown className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            )}
          </GlassCard>
          
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
                <p className="text-xs text-amber-400 capitalize font-semibold tracking-wider mt-0.5">{workerProfile?.role || user?.role || "Staff"}</p>
              </div>
            </div>

            <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs font-extrabold uppercase tracking-wider text-amber-400">Definir Disponibilidad</p>
                <div className="flex gap-2.5 items-center text-xs text-gray-400">
                   <button onClick={handlePrevMonth} className="hover:text-white bg-white/5 hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-lg border border-white/5 transition-all duration-300">&lt;</button>
                   <span className="w-18 text-center font-bold text-gray-200 capitalize">{MONTH_NAMES[currentMonth].slice(0,3)} {currentYear}</span>
                   <button onClick={handleNextMonth} className="hover:text-white bg-white/5 hover:bg-white/10 w-6 h-6 flex items-center justify-center rounded-lg border border-white/5 transition-all duration-300">&gt;</button>
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
                   * Haz clic en los días desbloqueados para alternar tus preferences de disponibilidad en tiempo real.
                 </p>
              </div>
            </div>
          </GlassCard>


          {/* Feed de Actividad Panel */}
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
                    <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0 animate-pulse" />
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
      )}

      {activeSubTab === "finanzas" && (() => {
        const BANCOS_CHILE = [
          { code: "1", name: "Banco de Chile / Edwards" },
          { code: "9", name: "Banco Internacional" },
          { code: "12", name: "Banco Estado" },
          { code: "14", name: "Scotiabank Chile" },
          { code: "16", name: "Banco BCI/Mach" },
          { code: "28", name: "Banco Bice" },
          { code: "31", name: "HSBC Bank (Chile)" },
          { code: "37", name: "Banco Santander" },
          { code: "39", name: "Banco Itaú" },
          { code: "49", name: "Banco Security" },
          { code: "51", name: "Banco Falabella" },
          { code: "53", name: "Banco Ripley" },
          { code: "55", name: "Banco Consorcio" },
          { code: "59", name: "Banco BTG Pactual Chile" },
          { code: "672", name: "Coopeuch" },
          { code: "729", name: "Prepago Los Héroes" },
          { code: "730", name: "Tenpo" },
          { code: "732", name: "Prepago Los Andes (Tapp)" },
          { code: "738", name: "Global 66" },
          { code: "875", name: "Mercado Pago" },
        ];

        const formatPeriod = (period) => {
          if (!period || period === "all") return "Todos los meses";
          const [year, monthStr] = period.split("-");
          const monthIndex = parseInt(monthStr, 10) - 1;
          return `${MONTH_NAMES[monthIndex]} ${year}`;
        };

        const searchParams = new URLSearchParams(window.location.search);
        const isRequireBankActive = searchParams.get("requireBank") === "true";
        const isMissingBank = !workerProfile?.cuenta_destino || !workerProfile?.codigo_banco_destino;
        const showBankWarning = isRequireBankActive && isMissingBank;

        const baselineRate = workerProfile?.monto_transferencia ? parseFloat(workerProfile.monto_transferencia) : 25000;

        const totalEarnedPaid = filteredCompletedEvents
          .filter(e => e.payment_status === "Pagado")
          .reduce((sum, e) => sum + (e.custom_rate ? parseFloat(e.custom_rate) : baselineRate), 0);

        const totalEarnedPending = filteredCompletedEvents
          .filter(e => e.payment_status !== "Pagado")
          .reduce((sum, e) => sum + (e.custom_rate ? parseFloat(e.custom_rate) : baselineRate), 0);

        const handleUpdateBankDetails = async (e) => {
          e.preventDefault();
          if (!bankForm.cuenta_destino || !bankForm.codigo_banco_destino) {
            toast.error("Por favor completa todos los campos bancarios.");
            return;
          }

          setIsUpdatingBank(true);
          try {
            const { error } = await supabase
              .from('profiles')
              .update({
                cuenta_destino: bankForm.cuenta_destino,
                codigo_banco_destino: bankForm.codigo_banco_destino
              })
              .eq('id', user.id);

            if (error) throw error;

            toast.success("¡Datos de transferencia actualizados con éxito!");
            
            setWorkerProfile(prev => ({
              ...prev,
              cuenta_destino: bankForm.cuenta_destino,
              codigo_banco_destino: bankForm.codigo_banco_destino
            }));
          } catch (err) {
            console.error("Error updating bank details:", err);
            toast.error("Error al guardar tus datos de transferencia.");
          } finally {
            setIsUpdatingBank(false);
          }
        };

        return (
          <div className="space-y-6 relative z-10">
            {/* Filtro Mensual de Finanzas */}
            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
              <div>
                <h4 className="text-sm font-bold text-white">Filtro por Período Mensual</h4>
                <p className="text-[11px] text-gray-400">Filtra tus cobros y honorarios según el mes de ejecución.</p>
              </div>
              <div className="relative">
                <select
                  value={financeMonthFilter}
                  onChange={(e) => setFinanceMonthFilter(e.target.value)}
                  className="bg-gray-800/80 border border-gray-700 rounded-xl px-4 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500/50 appearance-none pr-10 cursor-pointer"
                >
                  <option value="all">Todos los meses</option>
                  {uniqueFinanceMonths.map(p => (
                    <option key={p} value={p}>{formatPeriod(p)}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
                  <Sliders className="w-3.5 h-3.5" />
                </div>
              </div>
            </motion.div>

            {/* Stats Cards */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <GlassCard className="p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <CheckCircle className="w-20 h-20 text-emerald-500" />
                </div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Cobrado (Liquidado)</p>
                <h3 className="text-3xl font-extrabold text-emerald-400 mt-2">
                  ${totalEarnedPaid.toLocaleString("es-CL")}
                </h3>
                <p className="text-xs text-gray-500 mt-2 font-medium">Eventos finalizados y pagados por la productora</p>
              </GlassCard>

              <GlassCard className="p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Clock className="w-20 h-20 text-amber-500" />
                </div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Pendiente de Pago</p>
                <h3 className="text-3xl font-extrabold text-amber-400 mt-2">
                  ${totalEarnedPending.toLocaleString("es-CL")}
                </h3>
                <p className="text-xs text-gray-500 mt-2 font-medium">Eventos realizados pendientes de transferencia</p>
              </GlassCard>

              <GlassCard className="p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                  <Wallet className="w-20 h-20 text-amber-500" />
                </div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Monto Base de Cobro</p>
                <h3 className="text-3xl font-extrabold text-amber-300 mt-2">
                  ${baselineRate.toLocaleString("es-CL")}
                </h3>
                <p className="text-xs text-gray-500 mt-2 font-medium">Tu tarifa estándar registrada por turno / día</p>
              </GlassCard>
            </motion.div>

            {/* Layout Dos Columnas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna Izquierda: Historial de Pagos */}
              <motion.section variants={itemVariants} className="lg:col-span-2 space-y-4">
                <GlassCard className="p-6 border border-white/5">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Coins className="w-5 h-5 text-amber-400" />
                    Historial de Pagos de Producciones
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 text-gray-400 text-xs font-semibold uppercase bg-white/5">
                          <th className="py-3 px-4">Evento</th>
                          <th className="py-3 px-4">Fecha</th>
                          <th className="py-3 px-4">Honorario</th>
                          <th className="py-3 px-4 text-center">Estado Pago</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {filteredCompletedEvents.length === 0 ? (
                          <tr>
                            <td colSpan="4" className="py-8 text-center text-gray-500 italic">
                              No tienes eventos completados registrados para este período.
                            </td>
                          </tr>
                        ) : (
                          filteredCompletedEvents.map(event => {
                            const rate = event.custom_rate ? parseFloat(event.custom_rate) : baselineRate;
                            const isPaid = event.payment_status === "Pagado";

                            return (
                              <tr key={event.id} className="hover:bg-white/5 transition-colors">
                                <td className="py-3.5 px-4 font-bold text-gray-200">{event.name}</td>
                                <td className="py-3.5 px-4 text-gray-400">{event.date}</td>
                                <td className="py-3.5 px-4 font-extrabold text-amber-400">${rate.toLocaleString("es-CL")}</td>
                                <td className="py-3.5 px-4 text-center">
                                  <span className={`px-2.5 py-1 rounded-full text-2xs font-extrabold border ${
                                    isPaid 
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                                  }`}>
                                    {isPaid ? "Pagado" : "Pendiente"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </motion.section>

              {/* Columna Derecha: Datos de Transferencia */}
              <motion.section variants={itemVariants} className="lg:col-span-1 space-y-4">
                <GlassCard className="p-6 border border-white/5 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
                  
                  <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                    <Landmark className="w-5 h-5 text-amber-400" />
                    Mis Datos de Transferencia
                  </h3>
                  <p className="text-xs text-gray-400 mb-6">
                    Mantén tus datos actualizados para recibir tus pagos masivos sin demoras.
                  </p>

                  {showBankWarning && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="mb-4 p-3 rounded-xl text-xs font-semibold border bg-red-500/10 text-red-400 border-red-500/20 leading-relaxed animate-pulse"
                    >
                      ⚠️ <span className="font-extrabold uppercase">Obligatorio:</span> Por políticas de la productora, debes ingresar tus datos de transferencia bancaria para activar tu portal de eventos.
                    </motion.div>
                  )}

                  <form onSubmit={handleUpdateBankDetails} className="space-y-4">
                    <div className="flex flex-col">
                      <label htmlFor="w_banco" className="text-gray-300 mb-1 text-xs font-bold uppercase tracking-wider">Banco Destino</label>
                      <select
                        id="w_banco"
                        value={bankForm.codigo_banco_destino}
                        onChange={(e) => setBankForm({ ...bankForm, codigo_banco_destino: e.target.value })}
                        className="w-full bg-gray-950/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-semibold"
                        required
                      >
                        <option value="" disabled className="bg-gray-900 text-gray-500">Selecciona tu banco...</option>
                        {BANCOS_CHILE.map(b => (
                          <option key={b.code} value={b.code} className="bg-gray-900 text-white font-medium">{b.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label htmlFor="w_cuenta" className="text-gray-300 mb-1 text-xs font-bold uppercase tracking-wider">Número de Cuenta</label>
                      <input
                        type="text"
                        id="w_cuenta"
                        value={bankForm.cuenta_destino}
                        onChange={(e) => setBankForm({ ...bankForm, cuenta_destino: e.target.value })}
                        placeholder="Ej: 123456789"
                        className="w-full bg-gray-950/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-mono"
                        required
                      />
                    </div>

                    <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-2xs text-amber-400 leading-relaxed">
                      ⚠️ <span className="font-bold">Nota de Obligatoriedad:</span> Tus datos de transferencia son de carácter obligatorio para poder ver tu panel de eventos asignados. Cualquier cambio afectará tus próximos depósitos de honorarios.
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={isUpdatingBank}
                      className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-gray-900 font-extrabold rounded-xl hover:bg-amber-400 disabled:opacity-50 transition-all duration-300 text-sm shadow-lg shadow-amber-500/10 mt-2"
                    >
                      {isUpdatingBank ? (
                        <span>Guardando...</span>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Actualizar Datos Bancarios
                        </>
                      )}
                    </motion.button>
                  </form>
                </GlassCard>
              </motion.section>
            </div>
          </div>
        );
      })()}

      {/* Details Modal Adaptativo */}
      <AnimatePresence>
        {selectedDetailedEvent && (() => {
          const isEventSimpleType = selectedDetailedEvent.type === "Anfitrionas" || selectedDetailedEvent.type === "Promotoría";
          const isPlanPending = selectedDetailedEvent.operational_info_pending ?? false;

          // Decidir qué tiempos técnicos renderizar en el modal
          const shouldShowSetup = !isWorkerSimpleRole && !isEventSimpleType && (selectedDetailedEvent.setup_time || isPlanPending);
          const shouldShowCall = !isWorkerSimpleRole && !isEventSimpleType && (selectedDetailedEvent.call_time || isPlanPending);
          const shouldShowEnd = !isWorkerSimpleRole && !isEventSimpleType && (selectedDetailedEvent.end_time || isPlanPending);

          return (
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

                <div className="mb-4 pr-8">
                  <h3 className="text-2xl font-bold text-white leading-tight">{selectedDetailedEvent.name}</h3>
                  <span className="inline-block mt-1.5 text-xs px-2.5 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400 font-semibold uppercase tracking-wider">
                    {selectedDetailedEvent.type || "Producción técnica"}
                  </span>
                </div>
                
                <div className="space-y-4 text-sm text-gray-300">
                  <div className="bg-white/5 p-4 rounded-xl space-y-2 border border-white/5 shadow-inner">
                    <p><strong className="text-amber-400">Cliente:</strong> {selectedDetailedEvent.client || 'Por definir'}</p>
                    <p><strong className="text-amber-400">Ubicación:</strong> {selectedDetailedEvent.location}</p>
                    <p><strong className="text-amber-400">Prioridad:</strong> {selectedDetailedEvent.priority || 'Media'}</p>
                    <p><strong className="text-amber-400">Estado Operacional:</strong> {selectedDetailedEvent.status}</p>
                  </div>

                  <div className="bg-black/30 p-4 rounded-xl space-y-1.5 border border-white/5 text-xs">
                    <h4 className="font-bold uppercase tracking-wider text-amber-400 mb-1.5">⏱ Horarios de Producción</h4>
                    
                    {shouldShowSetup && (
                      <p>
                        <strong className="text-gray-400">Montaje:</strong>{' '}
                        <span className={selectedDetailedEvent.setup_time ? '' : 'text-amber-500/60 italic animate-pulse'}>
                          {selectedDetailedEvent.setup_time ? `${selectedDetailedEvent.setup_time.slice(0, 5)} hrs` : 'Por definir'}
                        </span>
                      </p>
                    )}
                    
                    {shouldShowCall && (
                      <p>
                        <strong className="text-gray-400">Presentación:</strong>{' '}
                        <span className={selectedDetailedEvent.call_time ? '' : 'text-amber-500/60 italic animate-pulse'}>
                          {selectedDetailedEvent.call_time ? `${selectedDetailedEvent.call_time.slice(0, 5)} hrs` : 'Por definir'}
                        </span>
                      </p>
                    )}
                    
                    <p>
                      <strong className="text-gray-400">Inicio Show:</strong>{' '}
                      <span>
                        {selectedDetailedEvent.time ? `${selectedDetailedEvent.time.slice(0, 5)} hrs` : 'Por definir'}
                      </span>
                    </p>
                    
                    {shouldShowEnd && (
                      <p>
                        <strong className="text-gray-400">Término Show:</strong>{' '}
                        <span className={selectedDetailedEvent.end_time ? '' : 'text-amber-500/60 italic animate-pulse'}>
                          {selectedDetailedEvent.end_time ? `${selectedDetailedEvent.end_time.slice(0, 5)} hrs` : 'Por definir'}
                        </span>
                      </p>
                    )}
                  </div>

                  {selectedDetailedEvent.operational_notes && (
                    <div className="space-y-1">
                      <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">⚠️ Notas Operativas:</h4>
                      <p className="text-amber-200 bg-amber-950/20 p-3 rounded-xl border border-amber-500/10 leading-relaxed text-xs">
                        {selectedDetailedEvent.operational_notes}
                      </p>
                    </div>
                  )}

                  <div className="space-y-1">
                    <h4 className="font-bold text-xs uppercase tracking-wider text-amber-400">Descripción del Evento:</h4>
                    <p className="text-gray-400 italic bg-black/20 p-3 rounded-xl border border-white/5 leading-relaxed text-xs">
                      {selectedDetailedEvent.description || "Sin descripción adicional proporcionada para esta fecha de producción."}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setSelectedDetailedEvent(null)}
                    className="px-5 py-2.5 bg-amber-500 text-gray-900 font-bold rounded-xl hover:bg-amber-400 shadow-lg shadow-amber-500/20 active:scale-95 transition-all duration-300"
                  >
                    Cerrar
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
}
