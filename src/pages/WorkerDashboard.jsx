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
  Cloud,
  CloudRain,
  CloudSnow,
  CloudLightning,
  CloudFog,
  CloudSun,
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
  ChevronUp,
  FileText,
  Upload,
  Plus,
  Eye,
  Layers,
  ShieldCheck
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import { supabase } from "../lib/supabase.js";
import { toast } from "react-hot-toast";
import DatePicker from "../components/DatePicker.jsx";
import CurrencyInputCLP from "../components/CurrencyInputCLP.jsx";


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

  // Control de asistencia (Check-In / Check-Out)
  const [attendanceLogs, setAttendanceLogs] = useState({});
  const [loadingAttendanceId, setLoadingAttendanceId] = useState(null);

  // Perfil del trabajador para consultar su rol real
  const [workerProfile, setWorkerProfile] = useState(null);
  const [financeMonthFilter, setFinanceMonthFilter] = useState("all");

  // Estados de Viáticos y Reembolsos (Worker)
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [financeSection, setFinanceSection] = useState("events"); // "events" o "expenses"
  const [expenseForm, setExpenseForm] = useState({
    requested_amount: "",
    expense_type: "Viático",
    expense_date: new Date().toISOString().split("T")[0],
    event_id: "",
    description: ""
  });
  const [receiptFile, setReceiptFile] = useState(null);
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);


  // Estado del Clima en tiempo real por Geolocalización IP / Open-Meteo
  const [weatherData, setWeatherData] = useState({ temp: 18, city: "Santiago", icon: "sun" });

  // Control de Boletas por Trabajador (Lotes V3)
  const [workerInvoiceBatches, setWorkerInvoiceBatches] = useState([]);
  const [retentionRateSetting, setRetentionRateSetting] = useState(15.25);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        let city = "Santiago";
        let lat = -33.4489;
        let lon = -70.6693;

        // Try freeipapi.com first (highly available free HTTPS geolocator)
        try {
          const ipRes = await fetch("https://free.freeipapi.com/api/json");
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            city = ipData.cityName || "Santiago";
            lat = ipData.latitude || -33.4489;
            lon = ipData.longitude || -70.6693;
          } else {
            throw new Error("freeipapi failed");
          }
        } catch (err) {
          console.warn("⚠️ [WEATHER API] - freeipapi failed, trying ipapi.co:", err);
          // Fallback to ipapi.co
          try {
            const ipRes2 = await fetch("https://ipapi.co/json/");
            if (ipRes2.ok) {
              const ipData2 = await ipRes2.json();
              if (ipData2 && !ipData2.error) {
                city = ipData2.city || "Santiago";
                lat = ipData2.latitude || -33.4489;
                lon = ipData2.longitude || -70.6693;
              }
            }
          } catch (err2) {
            console.warn("⚠️ [WEATHER API] - ipapi.co also failed:", err2);
          }
        }

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout for fast fallback

          const weatherRes = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`,
            { signal: controller.signal }
          );
          clearTimeout(timeoutId);

          if (!weatherRes.ok) {
            throw new Error(`Open-Meteo returned status ${weatherRes.status}`);
          }
          const wData = await weatherRes.json();

          if (wData && wData.current_weather) {
            const temp = Math.round(wData.current_weather.temperature);
            const weatherCode = wData.current_weather.weathercode;

            let icon = "sun";
            if (weatherCode >= 1 && weatherCode <= 3) icon = "cloudy";
            else if (weatherCode >= 45 && weatherCode <= 48) icon = "fog";
            else if (weatherCode >= 51 && weatherCode <= 67) icon = "rain";
            else if (weatherCode >= 71 && weatherCode <= 77) icon = "snow";
            else if (weatherCode >= 80 && weatherCode <= 82) icon = "rain";
            else if (weatherCode >= 95 && weatherCode <= 99) icon = "storm";

            setWeatherData({ temp, city, icon });
            return;
          }
        } catch (openMeteoErr) {
          console.log("ℹ️ [WEATHER API] - Open-Meteo offline or timed out, executing fast fallback to wttr.in...");

          try {
            const wttrRes = await fetch(`https://wttr.in/${encodeURIComponent(city || "Santiago")}?format=j1`);
            if (wttrRes.ok) {
              const wttrData = await wttrRes.json();
              if (wttrData && wttrData.current_condition && wttrData.current_condition[0]) {
                const cond = wttrData.current_condition[0];
                const temp = Math.round(parseFloat(cond.temp_C));
                const desc = (cond.weatherDesc && cond.weatherDesc[0] && cond.weatherDesc[0].value)
                  ? cond.weatherDesc[0].value.toLowerCase()
                  : "sunny";

                let icon = "sun";
                if (desc.includes("cloud") || desc.includes("overcast")) icon = "cloudy";
                else if (desc.includes("fog") || desc.includes("mist")) icon = "fog";
                else if (desc.includes("rain") || desc.includes("drizzle") || desc.includes("shower")) icon = "rain";
                else if (desc.includes("snow") || desc.includes("sleet") || desc.includes("hail")) icon = "snow";
                else if (desc.includes("thunder") || desc.includes("storm")) icon = "storm";

                setWeatherData({ temp, city: city || "Santiago", icon });
                console.log("☀️ [WEATHER API] - Fallback to wttr.in successful:", temp, desc);
                return;
              }
            }
          } catch (wttrErr) {
            console.log("⚠️ [WEATHER API] - wttr.in fallback also failed, using offline defaults.");
          }
        }

        // Final fallback to default values in case both fail
        setWeatherData({ temp: 18, city: city || "Santiago", icon: "sun" });
      } catch (err) {
        console.warn("⚠️ [WEATHER API] - Error al obtener clima en tiempo real:", err);
      }
    };

    fetchWeather();
  }, []);

  const renderWeatherIcon = () => {
    switch (weatherData.icon) {
      case "cloudy":
        return <Cloud className="w-3.5 h-3.5 text-blue-300" />;
      case "fog":
        return <CloudFog className="w-3.5 h-3.5 text-gray-400" />;
      case "rain":
        return <CloudRain className="w-3.5 h-3.5 text-sky-400" />;
      case "snow":
        return <CloudSnow className="w-3.5 h-3.5 text-white animate-bounce" />;
      case "storm":
        return <CloudLightning className="w-3.5 h-3.5 text-yellow-400" />;
      case "sun":
      default:
        return <Sun className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const completedEvents = React.useMemo(() => {
    return assignedEvents.filter(event => {
      const eventStatus = event.status ? event.status.toLowerCase() : "";
      const isValidAssignment = event.assignment_status === "Confirmado" || event.assignment_status === "Aceptado";
      return isValidAssignment && eventStatus !== "cancelado";
    });
  }, [assignedEvents]);

  // Lista de eventos mostrados en el Dashboard:
  // 1. Oculta eventos completados de meses anteriores.
  // 2. Ordena los eventos por proximidad (fecha más cercana primero).
  const displayedEvents = React.useMemo(() => {
    if (!assignedEvents) return [];

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");
    const currentYear = now.getFullYear();
    const currentMonthStr = String(now.getMonth() + 1).padStart(2, '0');
    const currentMonthPrefix = `${currentYear}-${currentMonthStr}`; // "YYYY-MM"

    return assignedEvents
      .filter(event => {
        const eventStatus = event.status ? event.status.toLowerCase() : "";
        const isFinished = event.date ? event.date < todayStr : false;
        const isCompleted = eventStatus === "completado" || eventStatus === "finalizado" || isFinished;

        if (isCompleted) {
          // Si está completado, mostrar solo si es del mes actual
          return event.date && event.date.startsWith(currentMonthPrefix);
        }

        // Si está activo (futuro o en progreso), mostrar siempre
        return true;
      })
      .sort((a, b) => {
        const todayStrLocal = new Date().toLocaleDateString("en-CA");
        const isACompleted = (a.status ? a.status.toLowerCase() : "") === "completado" || (a.status ? a.status.toLowerCase() : "") === "finalizado" || (a.date && a.date < todayStrLocal);
        const isBCompleted = (b.status ? b.status.toLowerCase() : "") === "completado" || (b.status ? b.status.toLowerCase() : "") === "finalizado" || (b.date && b.date < todayStrLocal);

        // Si uno está completado y el otro no, el completado va al final
        if (isACompleted && !isBCompleted) return 1;
        if (!isACompleted && isBCompleted) return -1;

        // Si ambos están en el mismo estado de completación, ordenar por proximidad
        const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
        const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
        return dateA - dateB;
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

  // Agrupar eventos completados y lotes de base de datos por periodo mensual (Versión 3.1)
  const groupedInvoicePeriods = React.useMemo(() => {
    const periods = {};
    const baselineRate = workerProfile?.monto_transferencia ? parseFloat(workerProfile.monto_transferencia) : 25000;

    // 1. Agrupar eventos completados por mes
    completedEvents.forEach(e => {
      if (!e.date) return;
      const periodKey = e.date.substring(0, 7); // "YYYY-MM"
      if (!periods[periodKey]) {
        periods[periodKey] = {
          period_key: periodKey,
          total_liquid: 0,
          events_count: 0,
          events: [],
          invoice_required: false,
          activeBatch: null
        };
      }
      periods[periodKey].events.push(e);
      const rate = e.custom_rate ? parseFloat(e.custom_rate) : baselineRate;
      periods[periodKey].total_liquid += rate;
      periods[periodKey].events_count += 1;
      if (e.invoice_required) {
        periods[periodKey].invoice_required = true;
      }
    });

    // 2. Asociar lotes del trabajador desde workerInvoiceBatches
    if (workerInvoiceBatches) {
      workerInvoiceBatches.forEach(b => {
        const periodKey = b.period_label || (b.created_at ? b.created_at.substring(0, 7) : new Date().toISOString().substring(0, 7));
        if (!periods[periodKey]) {
          periods[periodKey] = {
            period_key: periodKey,
            total_liquid: parseFloat(b.total_liquid_amount) || 0,
            events_count: 0,
            events: [],
            invoice_required: true,
            activeBatch: b
          };
        } else {
          periods[periodKey].activeBatch = b;
        }
      });
    }

    // 3. Procesar y definir estado dinámico por período
    const list = Object.values(periods).map(p => {
      const activeBatch = p.activeBatch;
      let status = "Falta boleta";

      const totalEvents = p.events.length;
      const paidEvents = p.events.filter(e => e.payment_status === "Pagado").length;

      if (totalEvents > 0 && paidEvents === totalEvents) {
        status = "Pagada";
      } else if (activeBatch && activeBatch.status === "verified") {
        status = "En proceso de pago";
      } else if (!p.invoice_required) {
        status = "En proceso de pago";
      } else if (p.events.some(e => e.invoice_received)) {
        status = "Boleta recibida";
      } else {
        status = "Falta boleta";
      }

      // Nombre del mes formateado bonito
      const [year, monthStr] = p.period_key.split("-");
      const monthNames = [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
      ];
      const monthIndex = parseInt(monthStr, 10) - 1;
      const periodLabel = `${monthNames[monthIndex]} ${year}`;

      return {
        ...p,
        period_label: periodLabel,
        status,
        paid_count: paidEvents
      };
    });

    // 3.5 Filtrar según regla de negocio: período actual, o pasados pendientes. Excluir futuros.
    const today = new Date();
    const currentPeriodKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const filteredList = list.filter(p => {
      if (p.period_key === currentPeriodKey) {
        return true; // Período actual: mostrar siempre
      }
      if (p.period_key < currentPeriodKey) {
        return p.status !== "Pagada"; // Períodos pasados: mostrar solo si están pendientes de pago
      }
      return false; // Períodos futuros: no mostrar todavía
    });

    // 4. Ordenación inteligente: los pendientes primero, y los pagados (historial) abajo
    return filteredList.sort((a, b) => {
      const isAPending = a.status !== "Pagada";
      const isBPending = b.status !== "Pagada";
      if (isAPending && !isBPending) return -1;
      if (!isAPending && isBPending) return 1;
      return b.period_key.localeCompare(a.period_key);
    });
  }, [completedEvents, workerInvoiceBatches, workerProfile]);

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
      fetchExpenses();

      // Cargar configuraciones de retención (V3)
      supabase.from("app_settings").select("*").eq("key", "honorarios_retention_rate").single().then(({ data }) => {
        if (data && data.value && data.value.rate !== undefined) {
          setRetentionRateSetting(parseFloat(data.value.rate));
        }
      });

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

  const fetchAttendanceLogs = async (workerId) => {
    if (!workerId) return;
    try {
      const { data, error } = await supabase
        .from('event_attendance_logs')
        .select('*')
        .eq('worker_id', workerId);

      if (data) {
        const logsMap = {};
        data.forEach(log => {
          const key = log.event_day_id || log.event_id;
          logsMap[key] = log;
        });
        setAttendanceLogs(logsMap);
      }
    } catch (err) {
      console.error("Error fetching attendance logs:", err);
    }
  };

  const getCurrentLocation = () => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({ error: "no_support" });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          resolve({ error: error.code || "unknown" });
        },
        {
          enableHighAccuracy: true,
          timeout: 15000, // 15 seconds timeout for mobile GPS warm-up
          maximumAge: 0
        }
      );
    });
  };

  const handleMarkCheckIn = async (eventId, assignmentId) => {
    if (!eventId || !assignmentId) return;
    setLoadingAttendanceId(`in-${assignmentId}`);
    try {
      const eventObj = assignedEvents.find(e => e.assignment_id === assignmentId);
      const hasCoordinates = eventObj && eventObj.latitude !== null && eventObj.longitude !== null && eventObj.latitude !== "";

      let lat = null;
      let lng = null;
      let accuracy = null;
      let showWarning = false;

      if (hasCoordinates) {
        const proceed = window.confirm("📍 [Verificación de Ubicación]\n\nPara registrar tu entrada necesitamos solicitar tu ubicación GPS una sola vez.");
        if (!proceed) {
          setLoadingAttendanceId(null);
          return;
        }

        toast.loading("Obteniendo ubicación GPS...", { id: "gps-worker-loader" });
        const locResult = await getCurrentLocation();
        toast.dismiss("gps-worker-loader");

        if (locResult.error) {
          showWarning = true;
          console.warn("GPS Check-In failed or was denied:", locResult.error);
        } else {
          lat = locResult.lat;
          lng = locResult.lng;
          accuracy = locResult.accuracy;
        }
      }

      const { data, error } = await supabase.rpc('mark_event_check_in', {
        p_event_id: eventId,
        p_assignment_id: assignmentId,
        p_lat: lat,
        p_lng: lng,
        p_accuracy: accuracy
      });

      if (error) {
        toast.error(error.message || "Error al registrar la entrada.");
      } else {
        // Autocorrección / Auto-healing para guardar el event_day_id en el log de asistencia
        if (eventObj && eventObj.event_day_id) {
          await supabase
            .from('event_attendance_logs')
            .update({ event_day_id: eventObj.event_day_id })
            .eq('assignment_id', assignmentId);
        }

        if (showWarning) {
          toast("Entrada registrada con éxito, pero tu marca quedará registrada sin verificación GPS debido a un error de ubicación.", {
            icon: "⚠️",
            duration: 8000,
            style: {
              background: 'rgba(217, 119, 6, 0.95)',
              color: '#fff',
              border: '1px solid rgba(217, 119, 6, 0.3)',
            }
          });
        } else {
          toast.success("¡Entrada registrada con éxito!", {
            icon: "⚡",
            style: {
              background: 'rgba(245, 158, 11, 0.95)',
              color: '#fff',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }
          });
        }
        await fetchAttendanceLogs(user.id);
      }
    } catch (err) {
      console.error("Error in check-in:", err);
      toast.error("Ocurrió un error inesperado al registrar la entrada.");
    } finally {
      setLoadingAttendanceId(null);
    }
  };

  const handleMarkCheckOut = async (eventId, assignmentId) => {
    if (!eventId || !assignmentId) return;
    setLoadingAttendanceId(`out-${assignmentId}`);
    try {
      const eventObj = assignedEvents.find(e => e.assignment_id === assignmentId);
      const hasCoordinates = eventObj && eventObj.latitude !== null && eventObj.longitude !== null && eventObj.latitude !== "";

      let lat = null;
      let lng = null;
      let accuracy = null;
      let showWarning = false;

      if (hasCoordinates) {
        const proceed = window.confirm("📍 [Verificación de Ubicación]\n\nPara registrar tu salida necesitamos solicitar tu ubicación GPS una sola vez.");
        if (!proceed) {
          setLoadingAttendanceId(null);
          return;
        }

        toast.loading("Obteniendo ubicación GPS...", { id: "gps-worker-loader" });
        const locResult = await getCurrentLocation();
        toast.dismiss("gps-worker-loader");

        if (locResult.error) {
          showWarning = true;
          console.warn("GPS Check-Out failed or was denied:", locResult.error);
        } else {
          lat = locResult.lat;
          lng = locResult.lng;
          accuracy = locResult.accuracy;
        }
      }

      const { data, error } = await supabase.rpc('mark_event_check_out', {
        p_event_id: eventId,
        p_assignment_id: assignmentId,
        p_lat: lat,
        p_lng: lng,
        p_accuracy: accuracy
      });

      if (error) {
        toast.error(error.message || "Error al registrar la salida.");
      } else {
        // Autocorrección / Auto-healing para guardar el event_day_id en el log de asistencia
        if (eventObj && eventObj.event_day_id) {
          await supabase
            .from('event_attendance_logs')
            .update({ event_day_id: eventObj.event_day_id })
            .eq('assignment_id', assignmentId);
        }

        if (showWarning) {
          toast("Salida registrada con éxito, pero tu marca quedará registrada sin verificación GPS debido a un error de ubicación.", {
            icon: "⚠️",
            duration: 8000,
            style: {
              background: 'rgba(217, 119, 6, 0.95)',
              color: '#fff',
              border: '1px solid rgba(217, 119, 6, 0.3)',
            }
          });
        } else {
          toast.success("¡Salida registrada con éxito! Jornada finalizada.", {
            icon: "🎉",
            style: {
              background: 'rgba(16, 185, 129, 0.95)',
              color: '#fff',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }
          });
        }
        await fetchAttendanceLogs(user.id);
      }
    } catch (err) {
      console.error("Error in check-out:", err);
      toast.error("Ocurrió un error inesperado al registrar la salida.");
    } finally {
      setLoadingAttendanceId(null);
    }
  };

  const formatChileDateTime = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString("es-CL", {
      timeZone: "America/Santiago",
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
    const timeStr = date.toLocaleTimeString("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    return `${dateStr} ${timeStr}`;
  };

  const formatChileTimeOnly = (isoString) => {
    if (!isoString) return "";
    const date = new Date(isoString);
    return date.toLocaleTimeString("es-CL", {
      timeZone: "America/Santiago",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
  };

  const formatDurationMinutes = (mins) => {
    if (!mins) return "0 min";
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
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
      .eq('staff_id', workerId);

    if (data) {
      const formattedEvents = data
        .map(assignment => {
          const day = assignment.event_days;
          const parent = assignment.events || {};

          return {
            assignment_id: assignment.id,
            assignment_status: assignment.status,
            payment_status: assignment.payment_status,
            custom_rate: assignment.custom_rate,
            event_day_id: assignment.event_day_id,
            invoice_required: assignment.invoice_required !== undefined ? assignment.invoice_required : true,
            invoice_received: assignment.invoice_received !== undefined ? assignment.invoice_received : false,
            invoice_number: assignment.invoice_number || null,
            invoice_received_at: assignment.invoice_received_at || null,
            invoice_amount: assignment.invoice_amount ? parseFloat(assignment.invoice_amount) : null,

            // Parent info
            id: parent.id,
            name: parent.name,
            location: parent.location,
            client: parent.client,
            description: parent.description,
            priority: parent.priority,
            supervisor_id: parent.supervisor_id,
            profiles: parent.profiles,
            type: parent.type,
            operational_info_pending: parent.operational_info_pending,
            attendance_control_enabled: parent.attendance_control_enabled,
            attendance_require_confirmed: parent.attendance_require_confirmed,
            latitude: parent.latitude,
            longitude: parent.longitude,
            allowed_radius_meters: parent.allowed_radius_meters,

            // Dynamic day values with parent fallback
            date: day ? day.date : parent.date,
            time: day ? (day.start_time ? day.start_time.substring(0, 5) : parent.time) : parent.time,
            end_time: day ? (day.end_time ? day.end_time.substring(0, 5) : parent.end_time) : parent.end_time,
            call_time: day ? (day.call_time ? day.call_time.substring(0, 5) : parent.call_time) : parent.call_time,
            setup_time: day ? (day.setup_time ? day.setup_time.substring(0, 5) : parent.setup_time) : parent.setup_time,
            status: day ? day.status : parent.status,
            notes: day ? day.notes : parent.operational_notes
          };
        })
        .filter(e => e.status?.toLowerCase() !== "cancelado" && e.status?.toLowerCase() !== "cancelled");

      setAssignedEvents(formattedEvents);
      fetchMyInvoiceBatches(workerId);
      fetchMyDbNotifications(workerId, formattedEvents);
      await fetchAttendanceLogs(workerId);
    }
    setIsLoading(false);
  };

  const fetchMyInvoiceBatches = async (workerId) => {
    try {
      const { data, error } = await supabase
        .from("worker_invoice_batches")
        .select(`
          *,
          profiles:invoice_verified_by (
            name
          )
        `)
        .eq("worker_id", workerId);

      if (data) {
        setWorkerInvoiceBatches(data);
      }
    } catch (err) {
      console.warn("⚠️ [BATCHES]: No se pudieron cargar los lotes del trabajador.", err);
    }
  };

  const fetchExpenses = async () => {
    if (!user?.id) return;
    setLoadingExpenses(true);
    try {
      const { data, error } = await supabase
        .from("expense_requests")
        .select(`
          *,
          events:event_id (
            id,
            name,
            date
          )
        `)
        .eq("worker_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (err) {
      console.error("Error fetching expenses:", err);
    } finally {
      setLoadingExpenses(false);
    }
  };

  const handleViewReceipt = async (filePath) => {
    if (!filePath) return;

    // Open a blank window synchronously to bypass iOS Safari's popup blocker
    const newWindow = window.open("about:blank", "_blank");
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Cargando Comprobante...</title>
            <style>
              body { background-color: #111827; color: #f59e0b; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .loader { border: 4px solid rgba(245, 158, 11, 0.1); border-top: 4px solid #f59e0b; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .container { text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="loader"></div>
              <div>Generando enlace seguro...</div>
            </div>
          </body>
        </html>
      `);
    }

    try {
      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(filePath, 900); // 15 minutos de vigencia

      if (error) throw error;
      if (data?.signedUrl) {
        if (newWindow) {
          newWindow.location.href = data.signedUrl;
        } else {
          // Fallback if popup blocker completely blocked about:blank
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        if (newWindow) newWindow.close();
        toast.error("No se pudo generar el enlace temporal para el comprobante.");
      }
    } catch (err) {
      if (newWindow) newWindow.close();
      console.error("Error generating signed URL:", err);
      toast.error("Error al abrir el comprobante.");
    }
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    if (!expenseForm.requested_amount || !expenseForm.description) {
      toast.error("Por favor completa los campos obligatorios.");
      return;
    }

    setIsSubmittingExpense(true);
    const loadingToast = toast.loading("Enviando solicitud de gasto...");
    try {
      let receiptPath = null;

      // 1. Subir el comprobante si existe
      if (receiptFile) {
        const fileExt = receiptFile.name.split(".").pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("receipts")
          .upload(filePath, receiptFile);

        if (uploadError) throw uploadError;
        receiptPath = filePath;
      }

      // 2. Insertar la solicitud de gasto
      const { error: insertError } = await supabase
        .from("expense_requests")
        .insert({
          worker_id: user.id,
          event_id: expenseForm.event_id || null,
          expense_type: expenseForm.expense_type,
          requested_amount: parseFloat(expenseForm.requested_amount),
          approved_amount: null, // Inicialmente nulo hasta que el admin apruebe
          expense_date: expenseForm.expense_date,
          description: expenseForm.description,
          receipt_url: receiptPath,
          status: "Pendiente",
          included_in_payroll: false,
          payroll_batch_id: null
        });

      if (insertError) throw insertError;

      toast.success("¡Solicitud de gasto enviada con éxito!", { id: loadingToast });

      // Reiniciar formulario
      setExpenseForm({
        requested_amount: "",
        expense_type: "Viático",
        expense_date: new Date().toISOString().split("T")[0],
        event_id: "",
        description: ""
      });
      setReceiptFile(null);

      // Recargar lista y registrar actividad
      fetchExpenses();
      addActivity(`Registraste una solicitud de ${expenseForm.expense_type} por $${parseFloat(expenseForm.requested_amount).toLocaleString("es-CL")}`, "info");

    } catch (err) {
      console.error("Error creating expense:", err);
      toast.error(`Error al enviar solicitud: ${err.message || "Error de conexión"}`, { id: loadingToast });
    } finally {
      setIsSubmittingExpense(false);
    }
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
    const eventInfo = assignedEvents.find(e => e.assignment_id === assignmentId);
    if (eventInfo) {
      const eventStatus = eventInfo.status ? eventInfo.status.toLowerCase() : "";
      const todayStr = new Date().toLocaleDateString("en-CA");
      const isFinished = eventInfo.date ? eventInfo.date < todayStr : false;
      const isEventCompleted = eventStatus === "completado" || eventStatus === "finalizado" || isFinished;

      if (isEventCompleted) {
        toast.error("No puedes cambiar tu asistencia en un evento que ya está completado o finalizado.");
        return;
      }
    }

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
        if (e.assignment_status === "Rechazado" || e.status === "Rechazado") return false;
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
              <span className="text-xs px-3 py-1 rounded-full bg-white/5 text-gray-300 border border-white/5 flex items-center gap-1.5 shadow-sm">
                {renderWeatherIcon()}
                {weatherData.temp}° · {weatherData.city}
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
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${activeSubTab === "dashboard"
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
            : "text-gray-400 hover:bg-white/5 hover:text-gray-200"
            }`}
        >
          <CalendarDays className="w-4 h-4" />
          Menú Principal
        </button>
        <button
          onClick={() => setActiveSubTab("finanzas")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 ${activeSubTab === "finanzas"
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
            ) : displayedEvents.length === 0 ? (
              <GlassCard className="p-12 text-center text-gray-400 border border-white/5">
                <CalendarDays className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="font-semibold">No tienes eventos asignados por el momento.</p>
                <p className="text-xs text-gray-500 mt-1">Cuando seas asignado a una producción, aparecerá aquí.</p>
              </GlassCard>
            ) : (
              displayedEvents.map(event => {
                const todayStr = new Date().toLocaleDateString("en-CA");
                const isPending = event.assignment_status === 'Pendiente';
                const isConfirmed = event.assignment_status === 'Confirmado';
                const isRejected = event.assignment_status === 'Rechazado';

                const log = attendanceLogs[event.event_day_id || event.id];
                // Validación de Asistencia: check-in permitido solo el día del evento
                const isEventToday = event.date === todayStr;
                const isConfirmedForAttendance = !event.attendance_require_confirmed || isConfirmed;
                const checkInDisabled = !isConfirmedForAttendance || !isEventToday;

                // Validación de Asistencia: check-out permitido hoy o mañana
                const checkInLocalDateStr = log?.check_in_at ? new Date(log.check_in_at).toLocaleDateString("en-CA") : null;
                let isCheckOutAllowed = true;
                if (checkInLocalDateStr) {
                  const parts = checkInLocalDateStr.split('-').map(Number);
                  const checkInDateObj = new Date(parts[0], parts[1] - 1, parts[2]);
                  const nextDayDateObj = new Date(checkInDateObj);
                  nextDayDateObj.setDate(checkInDateObj.getDate() + 1);
                  const nextDayLocalDateStr = nextDayDateObj.toLocaleDateString("en-CA");
                  isCheckOutAllowed = todayStr === checkInLocalDateStr || todayStr === nextDayLocalDateStr;
                }
                const checkOutDisabled = !isCheckOutAllowed;

                const isEventSimpleType = event.type === "Anfitrionas" || event.type === "Promotoría";

                // Planificación Técnica / Operacional Pendiente
                const isPlanPending = event.operational_info_pending ?? false;

                // Decidir si mostrar el bloque operacional o el timeline técnico en el dashboard
                const shouldShowOperationalSection =
                  isPlanPending &&
                  !isWorkerSimpleRole &&
                  !isEventSimpleType;

                // Decidir si mostrar supervisor y término aproximado
                const shouldShowSupervisor = isPlanPending || (!isEventSimpleType && event.profiles?.name);
                const shouldShowEndTime = isPlanPending || (!isWorkerSimpleRole && !isEventSimpleType && event.end_time);

                // Determinar si el evento ya está completado/finalizado
                const eventStatus = event.status ? event.status.toLowerCase() : "";
                const isFinished = event.date ? event.date < todayStr : false;
                const isEventCompleted = eventStatus === "completado" || eventStatus === "finalizado" || isFinished;

                // Dynamic styling based on assignment status
                let glowColor = "border-white/5 hover:border-amber-500/20";
                let statusBadge = "bg-amber-500/20 text-amber-300 border-amber-500/30";

                if (isEventCompleted) {
                  glowColor = "border-white/5 opacity-60 hover:opacity-95 hover:border-gray-500/30 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.02)]";
                  statusBadge = "bg-gray-500/20 text-gray-400 border-gray-500/30";
                } else if (isConfirmed) {
                  glowColor = "border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)] hover:border-emerald-500/40";
                  statusBadge = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]";
                } else if (isRejected) {
                  glowColor = "border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.05)] hover:border-red-500/40";
                  statusBadge = "bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]";
                }

                // Real end time and supervisor name from DB
                const endTimeStr = event.end_time
                  ? `${event.end_time.slice(0, 5)} hrs`
                  : (isPlanPending ? 'Por definir' : null);

                const supervisorName = event.profiles?.name
                  ? event.profiles.name
                  : (isPlanPending ? 'Por definir' : null);

                const priorityName = event.priority || 'Media';

                return (
                  <motion.div
                    key={event.assignment_id}
                    whileHover={{ y: -4, scale: 1.01 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <GlassCard className={`p-6 border-l-4 ${isEventCompleted ? 'border-l-gray-500' : isConfirmed ? 'border-l-emerald-500' : isRejected ? 'border-l-red-500' : 'border-l-amber-500'} ${glowColor} transition-all duration-300 relative overflow-hidden`}>

                      {/* Badge indicador de Planificación Pendiente o Completado */}
                      {isEventCompleted ? (
                        <div className="absolute top-0 right-0 bg-gray-500/20 border-l border-b border-gray-500/30 text-gray-400 px-3 py-1 rounded-bl-xl text-[9px] font-extrabold uppercase tracking-widest flex items-center gap-1 shadow-sm">
                          <CheckCircle className="w-3 h-3 text-gray-400" /> Evento Finalizado
                        </div>
                      ) : isPlanPending ? (
                        <div className="absolute top-0 right-0 bg-amber-500/20 border-l border-b border-amber-500/30 text-amber-300 px-3 py-1 rounded-bl-xl text-[9px] font-extrabold uppercase tracking-widest animate-pulse">
                          Planificación Pendiente
                        </div>
                      ) : null}

                      <div className="flex flex-col lg:flex-row justify-between gap-6">
                        <div className="flex-1 space-y-4">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className={`text-xl font-bold tracking-wide transition-all ${isEventCompleted ? 'text-gray-400 line-through decoration-gray-500/50' : 'text-white'}`}>{event.name}</h3>
                              {event.event_day_id && (
                                <span className="text-[10px] px-2 py-0.5 rounded border border-amber-500/20 bg-amber-500/10 text-amber-300 font-extrabold uppercase tracking-wider">
                                  Jornada
                                </span>
                              )}
                              <span className="text-[10px] px-2 py-0.5 rounded border border-white/10 bg-white/5 text-gray-400 font-semibold uppercase tracking-wider">
                                {event.type || "Producción técnica"}
                              </span>
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold ${priorityName === "Crítica" ? "bg-red-500/20 text-red-300 border-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.1)]" :
                                priorityName === "Alta" ? "bg-amber-500/20 text-amber-300 border-amber-500/30" :
                                  priorityName === "Media" ? "bg-blue-500/20 text-blue-300 border-blue-500/30" :
                                    "bg-gray-500/20 text-gray-400 border-gray-500/30"
                                }`}>
                                Prioridad {priorityName}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${statusBadge}`}>
                                Asistencia: {event.assignment_status}
                              </span>
                              {isEventCompleted && (
                                <span className="px-3 py-1 rounded-full text-xs font-semibold border bg-gray-500/10 text-gray-400 border-gray-500/20 shadow-inner uppercase tracking-wider text-[10px]">
                                  Finalizado
                                </span>
                              )}
                            </div>
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

                            {shouldShowSupervisor && supervisorName && (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Supervisor</span>
                                <span className={`flex items-center gap-1.5 font-semibold ${supervisorName === "Por definir" ? "text-gray-500 italic animate-pulse" : "text-gray-100 truncate"}`}>
                                  👤 {supervisorName}
                                </span>
                              </div>
                            )}

                            {shouldShowEndTime && endTimeStr && (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Término (Aprox)</span>
                                <span className={`flex items-center gap-1.5 font-semibold ${endTimeStr === "Por definir" ? "text-amber-500/50 italic animate-pulse" : "text-amber-300"}`}>
                                  <Clock className="w-4 h-4 text-amber-400" />
                                  {endTimeStr}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Notas operativas si existen */}
                          {event.notes && (
                            <div className="text-xs bg-amber-500/5 text-amber-300 border border-amber-500/10 p-3 rounded-xl leading-relaxed">
                              <strong>⚠️ Notas de Operación:</strong> {event.notes}
                            </div>
                          )}

                          {/* Módulo de Control de Asistencia */}
                          {event.attendance_control_enabled && (
                            <div className="mt-4 bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3 shadow-sm backdrop-blur-sm relative z-10">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                                  ⏰ Control de Asistencia
                                </span>
                                {log?.verified_by_admin && (
                                  <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold uppercase tracking-wider cursor-help" title={`Corregido manualmente por el Administrador: ${log.admin_adjustment_notes || 'Sin observaciones'}`}>
                                    ✍️ Corregido por Admin
                                  </span>
                                )}
                              </div>

                              {!log ? (
                                /* Estado: Sin Entrada */
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                                  <div className="flex flex-col">
                                    <span className="text-xs text-gray-400">Registra tu ingreso al recinto del evento.</span>
                                    {!isConfirmedForAttendance ? (
                                      <span className="text-[10px] text-amber-500 italic mt-0.5">⚠️ Requiere confirmar asistencia primero</span>
                                    ) : !isEventToday ? (
                                      <span className="text-[10px] text-amber-500 italic mt-0.5">⚠️ Entrada disponible solo el día del evento ({event.date.split('-').reverse().join('/')})</span>
                                    ) : null}
                                  </div>
                                  <motion.button
                                    whileHover={!checkInDisabled ? { scale: 1.02 } : {}}
                                    whileTap={!checkInDisabled ? { scale: 0.98 } : {}}
                                    onClick={() => handleMarkCheckIn(event.id, event.assignment_id)}
                                    disabled={checkInDisabled || loadingAttendanceId === `in-${event.assignment_id}`}
                                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 shrink-0 select-none ${checkInDisabled
                                        ? "bg-gray-800/40 text-gray-500 border border-gray-700/50 cursor-not-allowed"
                                        : "bg-amber-500/20 text-amber-300 hover:bg-amber-500 hover:text-gray-900 border border-amber-500/50 shadow-md"
                                      }`}
                                  >
                                    {loadingAttendanceId === `in-${event.assignment_id}` ? (
                                      <span className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>⚡ Marcar Entrada</>
                                    )}
                                  </motion.button>
                                </div>
                              ) : !log.check_out_at ? (
                                /* Estado: Con Entrada, Sin Salida */
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/30 p-3 rounded-xl border border-white/5">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-extrabold">Entrada Registrada</span>
                                    <span className="text-xs text-amber-300 font-bold flex items-center gap-1.5">
                                      📥 {formatChileDateTime(log.check_in_at)}
                                    </span>
                                    {!isCheckOutAllowed && (
                                      <span className="text-[10px] text-red-400 italic mt-1 font-semibold">⚠️ Plazo de salida vencido (máx. 24h). Contacta a soporte.</span>
                                    )}
                                  </div>
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => handleMarkCheckOut(event.id, event.assignment_id)}
                                    disabled={checkOutDisabled || loadingAttendanceId === `out-${event.assignment_id}`}
                                    className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all duration-300 border shadow-md shrink-0 select-none ${checkOutDisabled
                                        ? "bg-gray-800/40 text-gray-500 border-gray-700/50 cursor-not-allowed"
                                        : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-gray-900 border-emerald-500/50"
                                      }`}
                                  >
                                    {loadingAttendanceId === `out-${event.assignment_id}` ? (
                                      <span className="w-4 h-4 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                      <>📤 Marcar Salida</>
                                    )}
                                  </motion.button>
                                </div>
                              ) : (
                                /* Estado: Completa (Con Entrada y Salida) */
                                <div className="bg-emerald-500/5 border border-emerald-500/10 p-3.5 rounded-xl space-y-2.5 shadow-inner">
                                  <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[9px] text-gray-500 uppercase tracking-widest font-extrabold">Entrada</span>
                                      <span className="text-gray-300 font-semibold flex items-center gap-1">
                                        📥 {formatChileDateTime(log.check_in_at)}
                                      </span>
                                    </div>
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[9px] text-gray-500 uppercase tracking-widest font-extrabold">Salida</span>
                                      <span className="text-gray-300 font-semibold flex items-center gap-1">
                                        📤 {formatChileDateTime(log.check_out_at)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between border-t border-emerald-500/10 pt-2.5 text-xs">
                                    <span className="text-emerald-400 font-extrabold flex items-center gap-1.5 tracking-wide">
                                      ✓ Jornada registrada
                                    </span>
                                    <span className="text-emerald-300 font-extrabold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                      Duración: {formatDurationMinutes(log.total_duration_minutes)}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col sm:flex-row lg:flex-col justify-end items-stretch sm:items-center gap-2.5 mt-4 lg:mt-0 lg:self-center w-full lg:w-auto">
                          {!isEventCompleted && isPending && (
                            <>
                              <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleStatusChange(event.assignment_id, 'Confirmado')}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500 hover:text-gray-900 rounded-xl transition-all duration-300 border border-emerald-500/50 shadow-md font-bold text-sm w-full sm:flex-1 lg:flex-none lg:w-44"
                              >
                                <CheckCircle className="w-4 h-4" /> Confirmar
                              </motion.button>
                              <motion.button
                                whileHover={{ scale: 1.03 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => handleStatusChange(event.assignment_id, 'Rechazado')}
                                className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/20 text-red-300 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-300 border border-red-500/50 shadow-md font-bold text-sm w-full sm:flex-1 lg:flex-none lg:w-44"
                              >
                                <XCircle className="w-4 h-4" /> Rechazar
                              </motion.button>
                            </>
                          )}

                          {!isEventCompleted && isConfirmed && (
                            <div className="flex flex-col justify-center items-center py-1 w-full sm:flex-1 lg:flex-none lg:w-44">
                              <motion.button
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleStatusChange(event.assignment_id, 'Rechazado')}
                                className="text-[11px] text-red-400/80 hover:text-red-400 transition-colors hover:underline text-center cursor-pointer font-semibold"
                              >
                                Cancelar Asistencia
                              </motion.button>
                            </div>
                          )}

                          {!isEventCompleted && isRejected && (
                            <div className="flex flex-col gap-2 w-full sm:flex-1 lg:flex-none lg:w-44">
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

                          {isEventCompleted && (
                            <div className="flex flex-col gap-1 w-full sm:flex-1 lg:flex-none lg:w-44">
                              <span className={`flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border font-extrabold text-xs shadow-inner text-center tracking-wide ${isConfirmed ? 'bg-emerald-500/5 text-emerald-400/60 border-emerald-500/10' :
                                isRejected ? 'bg-red-500/5 text-red-400/60 border-red-500/10' :
                                  'bg-gray-500/5 text-gray-400/60 border-gray-500/10'
                                }`}>
                                {isConfirmed ? '✓ Asistió' : isRejected ? '✗ No Asistió' : 'Sin respuesta'}
                              </span>
                            </div>
                          )}

                          <motion.button
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.97 }}
                            onClick={() => setSelectedDetailedEvent(event)}
                            className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-white/5 text-gray-300 hover:bg-white/10 rounded-xl border border-white/10 text-sm font-semibold transition-all duration-300 w-full sm:flex-1 lg:flex-none lg:w-44"
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
                            {(event.setup_time || isPlanPending) && (!isEventSimpleType || isPlanPending) && (
                              <div className="relative group">
                                <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-4 border-gray-950 group-hover:scale-125 transition-transform duration-300 ${event.setup_time ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-gray-700'
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
                            {(event.call_time || isPlanPending) && (
                              <div className="relative group">
                                <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-4 border-gray-950 group-hover:scale-125 transition-transform duration-300 ${event.call_time ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-gray-700'
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
                            )}

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
                            {(event.end_time || isPlanPending) && (!isEventSimpleType || isPlanPending) && (
                              <div className="relative group">
                                <div className={`absolute -left-[30px] top-1.5 w-4 h-4 rounded-full border-4 border-gray-950 group-hover:scale-125 transition-transform duration-300 ${event.end_time ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-gray-700'
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
                          className={`p-3 rounded-2xl border text-xs flex gap-2.5 transition-all duration-300 relative group overflow-hidden ${cardStyle} ${!n.read ? 'shadow-[0_0_12px_rgba(245,158,11,0.06)] border-amber-500/30' : 'opacity-55 hover:opacity-80'
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
                    <span className="w-18 text-center font-bold text-gray-200 capitalize">{MONTH_NAMES[currentMonth].slice(0, 3)} {currentYear}</span>
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
            {/* Selector de sub-sección: Honorarios vs Viáticos */}
            <motion.div variants={itemVariants} className="flex items-center gap-2 bg-gray-900/60 p-1.5 rounded-xl border border-white/5 max-w-sm mb-4">
              <button
                onClick={() => setFinanceSection("events")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${financeSection === "events" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]" : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                Honorarios Eventos
              </button>
              <button
                onClick={() => setFinanceSection("expenses")}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${financeSection === "expenses" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]" : "text-gray-400 hover:text-gray-200"
                  }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Viáticos y Gastos
              </button>
            </motion.div>

            {financeSection === "events" ? (
              <>
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

                {/* CONTROL DE BOLETAS POR LOTES (SII LOTES V3) */}
                <motion.div variants={itemVariants} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Layers className="w-5 h-5 text-amber-400" />
                        Control de Boletas SII (Lotes de Validación Consolidada V3.6)
                      </h3>
                      <p className="text-xs text-gray-400">
                        Administración agrupa tus eventos completados en un solo período para validación ágil y transferencias masivas.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {groupedInvoicePeriods.length === 0 ? (
                      <GlassCard className="p-6 border border-white/5 flex flex-col justify-center items-center text-center col-span-2">
                        <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center text-gray-500 mb-3 border border-white/10">
                          <Layers className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-bold text-gray-400">Sin registros de pago</h4>
                        <p className="text-xs text-gray-500 max-w-xs mt-1 leading-relaxed">
                          Aún no tienes eventos completados ni boletas registradas en el sistema.
                        </p>
                      </GlassCard>
                    ) : (
                      groupedInvoicePeriods.map(period => {
                        const activeBatch = period.activeBatch;
                        const rate = parseFloat(retentionRateSetting || 15.25);

                        const liquidAmount = activeBatch ? parseFloat(activeBatch.total_liquid_amount) : period.total_liquid;
                        const grossExpected = activeBatch ? parseFloat(activeBatch.expected_gross_amount) : Math.round(liquidAmount / (1 - (rate / 100)));
                        const retentionEstimated = activeBatch ? parseFloat(activeBatch.estimated_retention) : (grossExpected - liquidAmount);
                        const numEvents = activeBatch ? (activeBatch.events_count || period.events_count) : period.events_count;

                        if (period.status === "Pagada") {
                          // Estado Pagada (Verde/Historial)
                          return (
                            <GlassCard
                              key={period.period_key}
                              className="p-6 border border-emerald-500/10 relative overflow-hidden bg-gradient-to-br from-emerald-500/[0.01] to-transparent shadow-sm opacity-85 hover:opacity-100 transition-all duration-300"
                            >
                              <div className="absolute top-0 right-0 p-4">
                                <span className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  Pagada
                                </span>
                              </div>

                              <h4 className="text-sm font-black text-emerald-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                                Boleta {period.period_label}
                              </h4>
                              <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                                Lote consolidado de honorarios liquidado y transferido exitosamente.
                              </p>

                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="bg-gray-950/60 p-2.5 rounded-lg border border-white/5 font-mono">
                                  <p className="text-[9px] text-gray-500 font-bold uppercase">Boleta Asociada</p>
                                  <p className="text-xs font-black text-white mt-0.5">Nº {activeBatch?.invoice_number || "N/A"}</p>
                                  <p className="text-[9px] text-gray-400 mt-0.5">${parseFloat(activeBatch?.invoice_amount || grossExpected).toLocaleString("es-CL")}</p>
                                </div>
                                <div className="bg-gray-950/60 p-2.5 rounded-lg border border-white/5 font-mono">
                                  <p className="text-[9px] text-gray-500 font-bold uppercase">Líquido Recibido</p>
                                  <p className="text-xs font-black text-emerald-400 mt-0.5">${liquidAmount.toLocaleString("es-CL")}</p>
                                  <p className="text-[9px] text-gray-400 mt-0.5">Bruto: ${grossExpected.toLocaleString("es-CL")}</p>
                                </div>
                              </div>

                              <div className="bg-gray-900/60 border border-white/5 p-3 rounded-xl space-y-1 text-[10px] text-gray-300 font-mono">
                                <div className="flex justify-between border-b border-white/5 pb-1">
                                  <span className="text-gray-500">Eventos Cubiertos:</span>
                                  <span className="font-bold text-gray-200">{numEvents} eventos</span>
                                </div>
                                <div className="flex justify-between border-b border-white/5 pb-1 pt-1">
                                  <span className="text-gray-500">Validado Por:</span>
                                  <span className="font-bold text-gray-200">{activeBatch?.profiles?.name || "Administración"}</span>
                                </div>
                                {activeBatch?.invoice_received_at && (
                                  <div className="flex justify-between pt-1">
                                    <span className="text-gray-500">Fecha Pago:</span>
                                    <span className="font-bold text-gray-200">{new Date(activeBatch.invoice_received_at).toLocaleDateString("es-CL")}</span>
                                  </div>
                                )}
                              </div>
                            </GlassCard>
                          );
                        }

                        if (period.status === "Falta boleta") {
                          // Estado Falta Boleta (Naranja/Amber)
                          return (
                            <GlassCard
                              key={period.period_key}
                              className="p-6 border border-amber-500/20 relative overflow-hidden bg-gradient-to-br from-amber-500/[0.03] to-transparent shadow-[0_0_24px_rgba(245,158,11,0.02)]"
                            >
                              <div className="absolute top-0 right-0 p-4">
                                <span className="px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider animate-pulse flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                                  Falta Boleta
                                </span>
                              </div>

                              <h4 className="text-sm font-black text-amber-300 flex items-center gap-1.5 mb-1.5 uppercase tracking-wider">
                                Boleta {period.period_label}
                              </h4>
                              <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                                Monto calculado para emitir una única boleta de honorarios consolidada por los <b>{numEvents} eventos</b> de este período.
                              </p>

                              <div className="grid grid-cols-3 gap-2 bg-gray-950/60 p-3 rounded-xl border border-white/5 mb-4 font-mono">
                                <div className="text-center border-r border-white/5">
                                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Líquido</p>
                                  <p className="text-xs font-black text-white mt-0.5">${liquidAmount.toLocaleString("es-CL")}</p>
                                </div>
                                <div className="text-center border-r border-white/5">
                                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Retención ({rate}%)</p>
                                  <p className="text-xs font-black text-gray-400 mt-0.5">${retentionEstimated.toLocaleString("es-CL")}</p>
                                </div>
                                <div className="text-center">
                                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Bruto</p>
                                  <p className="text-xs font-black text-amber-400 mt-0.5">${grossExpected.toLocaleString("es-CL")}</p>
                                </div>
                              </div>

                              <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-[10px] text-amber-200 leading-relaxed space-y-1">
                                <p className="font-extrabold flex items-center gap-1">
                                  💡 Instrucciones de Emisión SII:
                                </p>
                                <p>
                                  1. Emite <b>una boleta de honorarios</b> en el portal del SII por el monto bruto de <b className="text-amber-300 font-extrabold font-mono">${grossExpected.toLocaleString("es-CL")}</b>.
                                </p>
                                <p>
                                  2. Envíala en PDF a <span className="text-white underline font-semibold">contacto@laampolleta.tv</span> indicando tu RUT y número de boleta.
                                </p>
                                <p>
                                  3. Al validarse, administración autorizará la transferencia en la próxima fecha masiva de pago.
                                </p>
                              </div>
                            </GlassCard>
                          );
                        }

                        // Estado Boleta Recibida / En Proceso de Pago (Azul/Teal)
                        const isVerified = period.status === "En proceso de pago";
                        return (
                          <GlassCard
                            key={period.period_key}
                            className={`p-6 border relative overflow-hidden bg-gradient-to-br shadow-sm transition-all duration-300 ${isVerified
                                ? 'border-teal-500/20 from-teal-500/[0.03] to-transparent shadow-[0_0_24px_rgba(20,184,166,0.02)]'
                                : 'border-indigo-500/20 from-indigo-500/[0.03] to-transparent shadow-[0_0_24px_rgba(99,102,241,0.02)]'
                              }`}
                          >
                            <div className="absolute top-0 right-0 p-4">
                              <span className={`px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ${isVerified
                                  ? 'bg-teal-500/15 border border-teal-500/30 text-teal-300'
                                  : 'bg-indigo-500/15 border border-indigo-500/30 text-indigo-300'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${isVerified ? 'bg-teal-400 animate-pulse' : 'bg-indigo-400 animate-pulse'}`} />
                                {isVerified ? "En Proceso de Pago" : "Boleta Recibida"}
                              </span>
                            </div>

                            <h4 className={`text-sm font-black flex items-center gap-1.5 mb-1.5 uppercase tracking-wider ${isVerified ? 'text-teal-300' : 'text-indigo-300'
                              }`}>
                              Boleta {period.period_label}
                            </h4>
                            <p className="text-[10px] text-gray-400 mb-4 leading-relaxed">
                              {isVerified
                                ? "Boleta consolidada validada con éxito. Los pagos están autorizados para transferencia masiva."
                                : "Tu boleta consolidada ha sido cargada y está pendiente de validación formal administrativa."
                              }
                            </p>

                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div className="bg-gray-950/60 p-2.5 rounded-lg border border-white/5 font-mono">
                                <p className="text-[9px] text-gray-500 font-bold uppercase">Boleta Recibida</p>
                                <p className="text-xs font-black text-white mt-0.5">Nº {activeBatch?.invoice_number || "Registrada"}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">${parseFloat(activeBatch?.invoice_amount || grossExpected).toLocaleString("es-CL")}</p>
                              </div>
                              <div className="bg-gray-950/60 p-2.5 rounded-lg border border-white/5 font-mono">
                                <p className="text-[9px] text-gray-500 font-bold uppercase">Líquido Proyectado</p>
                                <p className="text-xs font-black text-emerald-400 mt-0.5">${liquidAmount.toLocaleString("es-CL")}</p>
                                <p className="text-[9px] text-gray-400 mt-0.5">Bruto: ${grossExpected.toLocaleString("es-CL")}</p>
                              </div>
                            </div>

                            <div className="bg-gray-900/60 border border-white/5 p-3 rounded-xl space-y-1 text-[10px] text-gray-300 font-mono">
                              <div className="flex justify-between border-b border-white/5 pb-1">
                                <span className="text-gray-500">Eventos Cubiertos:</span>
                                <span className="font-bold text-gray-200">{numEvents} eventos</span>
                              </div>
                              {activeBatch?.profiles?.name && (
                                <div className="flex justify-between border-b border-white/5 pb-1 pt-1">
                                  <span className="text-gray-500">Validado Por:</span>
                                  <span className="font-bold text-gray-200">{activeBatch.profiles.name}</span>
                                </div>
                              )}
                              {activeBatch?.invoice_notes && (
                                <div className="pt-1">
                                  <span className="text-gray-500 block">Nota Administración:</span>
                                  <span className="font-medium text-amber-300 italic">"{activeBatch.invoice_notes}"</span>
                                </div>
                              )}
                            </div>
                          </GlassCard>
                        );
                      })
                    )}
                  </div>
                </motion.div>

                {/* Layout Dos Columnas */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Columna Izquierda: Historial de Pagos */}
                  <motion.section variants={itemVariants} className="lg:col-span-2 space-y-4">
                    <GlassCard className="p-6 border border-white/5">
                      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <Coins className="w-5 h-5 text-amber-400" />
                        Historial de Pagos de Eventos
                      </h3>

                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[550px] text-left border-collapse text-sm">
                          <thead>
                            <tr className="border-b border-white/10 text-gray-400 text-xs font-semibold uppercase bg-white/5">
                              <th className="py-3 px-4">Evento</th>
                              <th className="py-3 px-4">Fecha</th>
                              <th className="py-3 px-4">Honorario</th>
                              <th className="py-3 px-4 text-center">Boleta (DTE)</th>
                              <th className="py-3 px-4 text-center">Estado Pago</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {filteredCompletedEvents.length === 0 ? (
                              <tr>
                                <td colSpan="5" className="py-8 text-center text-gray-500 italic">
                                  No tienes eventos completados registrados para este período.
                                </td>
                              </tr>
                            ) : (
                              filteredCompletedEvents.map(event => {
                                const rate = event.custom_rate ? parseFloat(event.custom_rate) : baselineRate;
                                const isPaid = event.payment_status === "Pagado";

                                // Determinar si el período/lote de este evento ya está verificado ("En proceso de pago")
                                const periodKey = event.date ? event.date.substring(0, 7) : "";
                                const activeBatch = workerInvoiceBatches?.find(b => {
                                  const bPeriod = b.period_label || (b.created_at ? b.created_at.substring(0, 7) : "");
                                  return bPeriod === periodKey;
                                });
                                const isVerified = activeBatch?.status === "verified";

                                return (
                                  <tr key={event.id} className="hover:bg-white/5 transition-colors">
                                    <td className="py-3.5 px-4 font-bold text-gray-200">{event.name}</td>
                                    <td className="py-3.5 px-4 text-gray-400">{event.date}</td>
                                    <td className="py-3.5 px-4 font-extrabold text-amber-400">${rate.toLocaleString("es-CL")}</td>
                                    <td className="py-3.5 px-4 text-center">
                                      {event.invoice_required ? (
                                        event.invoice_received ? (
                                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-2xs font-extrabold whitespace-nowrap" title={event.invoice_received_at ? `Validada en lote el ${new Date(event.invoice_received_at).toLocaleDateString("es-CL")}` : ""}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                            Lote Nº {event.invoice_number}
                                          </span>
                                        ) : (
                                          <div className="flex flex-col items-center gap-1 justify-center">
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-2xs font-extrabold whitespace-nowrap animate-pulse">
                                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                              Falta Boleta
                                            </span>
                                            <span className="text-[9px] text-gray-500 whitespace-nowrap">
                                              enviar a contacto@laampolleta.tv
                                            </span>
                                          </div>
                                        )
                                      ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-gray-800 border border-white/10 text-gray-400 text-2xs font-extrabold whitespace-nowrap">
                                          <span className="w-1.5 h-1.5 rounded-full bg-gray-500 shrink-0" />
                                          No requiere
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-3.5 px-4 text-center">
                                      <span className={`px-2.5 py-1 rounded-full text-2xs font-extrabold border ${isPaid
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                        : isVerified
                                          ? 'bg-teal-500/10 border-teal-500/30 text-teal-300'
                                          : 'bg-red-500/10 border-red-500/30 text-red-400'
                                        }`}>
                                        {isPaid ? "Pagado" : isVerified ? "En Proceso de Pago" : "Pendiente"}
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
                          ⚠️ <span className="font-bold">Nota de Obligatoriedad:</span> Tus datos de transferencia son de carácter obligatorio para poder ver tu portal de eventos.
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
              </>
            ) : (() => {
              // Cálculo de estadísticas de viáticos
              let pendingSum = 0;
              let approvedSum = 0;
              let paidSum = 0;

              expenses.forEach(e => {
                const reqAmt = parseFloat(e.requested_amount) || 0;
                const appAmt = parseFloat(e.approved_amount) || 0;

                if (e.status === "Pagado") {
                  paidSum += appAmt;
                } else if (e.status === "Aprobado") {
                  approvedSum += appAmt;
                } else if (e.status === "Pendiente" || e.status === "En revisión") {
                  pendingSum += reqAmt;
                }
              });

              return (
                <div className="space-y-6">
                  {/* Tarjetas de Estadísticas de Viáticos */}
                  <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <GlassCard className="p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Clock className="w-20 h-20 text-yellow-500" />
                      </div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Monto Solicitado (Pendiente)</p>
                      <h3 className="text-3xl font-extrabold text-yellow-400 mt-2">
                        ${pendingSum.toLocaleString("es-CL")}
                      </h3>
                      <p className="text-xs text-gray-500 mt-2 font-medium">Solicitudes en revisión o pendientes de aprobación</p>
                    </GlassCard>

                    <GlassCard className="p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CheckCircle className="w-20 h-20 text-emerald-500" />
                      </div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Monto Aprobado (Por Cobrar)</p>
                      <h3 className="text-3xl font-extrabold text-emerald-400 mt-2">
                        ${approvedSum.toLocaleString("es-CL")}
                      </h3>
                      <p className="text-xs text-gray-500 mt-2 font-medium">Aprobado por administración, listo para nómina masiva</p>
                    </GlassCard>

                    <GlassCard className="p-6 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Coins className="w-20 h-20 text-amber-500" />
                      </div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Pagado Histórico</p>
                      <h3 className="text-3xl font-extrabold text-amber-300 mt-2">
                        ${paidSum.toLocaleString("es-CL")}
                      </h3>
                      <p className="text-xs text-gray-500 mt-2 font-medium">Viáticos y reembolsos transferidos exitosamente</p>
                    </GlassCard>
                  </motion.div>

                  {/* Layout Dos Columnas para Solicitudes de Viáticos */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Columna Izquierda: Historial/Listado */}
                    <motion.section variants={itemVariants} className="lg:col-span-2 space-y-4">
                      <GlassCard className="p-6 border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Coins className="w-5 h-5 text-amber-400" />
                          Mis Solicitudes de Gastos
                        </h3>

                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-white/10 text-gray-400 text-xs font-semibold uppercase bg-white/5">
                                <th className="py-3 px-4">Tipo & Descripción</th>
                                <th className="py-3 px-4">Fecha & Evento</th>
                                <th className="py-3 px-4 text-right">Monto</th>
                                <th className="py-3 px-4 text-center">Estado</th>
                                <th className="py-3 px-4 text-center">Comprobante</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {expenses.length === 0 ? (
                                <tr>
                                  <td colSpan="5" className="py-8 text-center text-gray-500 italic">
                                    No has registrado ninguna solicitud de viáticos o reembolsos.
                                  </td>
                                </tr>
                              ) : (
                                expenses.map(expense => {
                                  const reqAmt = parseFloat(expense.requested_amount) || 0;
                                  const appAmt = parseFloat(expense.approved_amount) || 0;
                                  const eventName = expense.events?.name || "Gasto Operacional";

                                  let statusClass = "bg-amber-500/10 border-amber-500/30 text-amber-400";
                                  if (expense.status === "En revisión") statusClass = "bg-sky-500/10 border-sky-500/30 text-sky-400";
                                  if (expense.status === "Aprobado") statusClass = "bg-emerald-500/10 border-emerald-500/30 text-emerald-400";
                                  if (expense.status === "Rechazado") statusClass = "bg-red-500/10 border-red-500/30 text-red-400";
                                  if (expense.status === "Pagado") statusClass = "bg-gray-500/20 border-white/10 text-gray-400";

                                  return (
                                    <tr key={expense.id} className="hover:bg-white/5 transition-colors">
                                      <td className="py-3.5 px-4">
                                        <div className="font-bold text-gray-200">{expense.expense_type}</div>
                                        <div className="text-xs text-gray-400 truncate max-w-[200px]">{expense.description}</div>
                                        {expense.admin_comment && (
                                          <div className="text-[10px] text-amber-400 mt-1 italic leading-tight">
                                            Obs: {expense.admin_comment}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-3.5 px-4 text-xs">
                                        <div className="text-gray-300">{expense.expense_date}</div>
                                        <div className="text-gray-500 font-medium truncate max-w-[150px]">{eventName}</div>
                                      </td>
                                      <td className="py-3.5 px-4 text-right">
                                        <div className="font-extrabold text-amber-400">${reqAmt.toLocaleString("es-CL")}</div>
                                        {expense.status === "Aprobado" && (
                                          <div className="text-[10px] text-emerald-400 font-bold">Aprobado: ${appAmt.toLocaleString("es-CL")}</div>
                                        )}
                                        {expense.status === "Pagado" && (
                                          <div className="text-[10px] text-gray-400 font-medium">Pagado: ${appAmt.toLocaleString("es-CL")}</div>
                                        )}
                                      </td>
                                      <td className="py-3.5 px-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-2xs font-extrabold border ${statusClass}`}>
                                          {expense.status}
                                        </span>
                                      </td>
                                      <td className="py-3.5 px-4 text-center">
                                        {expense.receipt_url ? (
                                          <button
                                            onClick={() => handleViewReceipt(expense.receipt_url)}
                                            className="p-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-amber-500/50 hover:bg-amber-500/10 text-gray-300 hover:text-amber-400 transition-all inline-flex items-center gap-1 text-2xs font-bold"
                                            title="Ver Comprobante Seguro"
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            Ver
                                          </button>
                                        ) : (
                                          <span className="text-2xs text-gray-500 font-medium">Sin adjunto</span>
                                        )}
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

                    {/* Columna Derecha: Formulario de Registro */}
                    <motion.section variants={itemVariants} className="lg:col-span-1 space-y-4">
                      <GlassCard className="p-6 border border-white/5 relative overflow-hidden">
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                          <Upload className="w-5 h-5 text-amber-400" />
                          Nueva Solicitud
                        </h3>
                        <p className="text-xs text-gray-400 mb-6">
                          Ingresa los datos para solicitar la aprobación de un viático o reembolso.
                        </p>

                        <form onSubmit={handleCreateExpense} className="space-y-4">
                          <div className="flex flex-col">
                            <label className="text-gray-300 mb-1 text-xs font-bold uppercase tracking-wider">Tipo de Gasto</label>
                            <select
                              value={expenseForm.expense_type}
                              onChange={(e) => setExpenseForm({ ...expenseForm, expense_type: e.target.value })}
                              className="w-full bg-gray-950/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-semibold cursor-pointer"
                              required
                            >
                              <option value="Viático" className="bg-gray-900">Viático</option>
                              <option value="Reembolso" className="bg-gray-900">Reembolso</option>
                              <option value="Compra Operacional" className="bg-gray-900">Compra Operacional</option>
                              <option value="Otro" className="bg-gray-900">Otro</option>
                            </select>
                          </div>

                          <CurrencyInputCLP
                            label="Monto Solicitado (CLP)"
                            id="requested_amount"
                            value={expenseForm.requested_amount}
                            onChange={(val) => setExpenseForm({ ...expenseForm, requested_amount: val })}
                            placeholder="Ej: 15.000"
                            required
                          />

                          <div className="flex flex-col">
                            <DatePicker
                              label="Fecha del Gasto"
                              id="expense_date"
                              value={expenseForm.expense_date}
                              onChange={(date) => setExpenseForm({ ...expenseForm, expense_date: date })}
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="text-gray-300 mb-1 text-xs font-bold uppercase tracking-wider">Evento Relacionado</label>
                            <select
                              value={expenseForm.event_id}
                              onChange={(e) => setExpenseForm({ ...expenseForm, event_id: e.target.value })}
                              className="w-full bg-gray-950/60 border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-amber-500 transition-all font-semibold cursor-pointer"
                            >
                              <option value="" className="bg-gray-900 text-gray-500">General / Ningún evento...</option>
                              {assignedEvents
                                .filter(ev => ev.assignment_status === "Confirmado")
                                .map(ev => (
                                  <option key={ev.id} value={ev.id} className="bg-gray-900">{ev.name} ({ev.date})</option>
                                ))}
                            </select>
                          </div>

                          <div className="flex flex-col">
                            <label className="text-gray-300 mb-1 text-xs font-bold uppercase tracking-wider">Descripción / Motivo</label>
                            <textarea
                              value={expenseForm.description}
                              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                              placeholder="Ej: Pago de estacionamiento del evento o viático de alimentación de la jornada."
                              className="w-full bg-gray-950/60 border border-white/10 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500 transition-all leading-relaxed resize-none h-20"
                              required
                            />
                          </div>

                          <div className="flex flex-col">
                            <label className="text-gray-300 mb-1 text-xs font-bold uppercase tracking-wider flex items-center justify-between">
                              <span>Comprobante (Opcional)</span>
                              <span className="text-[10px] text-gray-500 font-semibold font-mono">Max 5MB</span>
                            </label>
                            <div className="relative group border border-dashed border-white/10 hover:border-amber-500/40 rounded-xl p-4 text-center cursor-pointer transition-all bg-black/20">
                              <input
                                type="file"
                                id="receipt"
                                onChange={(e) => setReceiptFile(e.target.files[0])}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                accept="image/*,application/pdf"
                              />
                              <div className="space-y-1">
                                <Upload className="w-6 h-6 text-gray-400 group-hover:text-amber-400 mx-auto transition-colors" />
                                <div className="text-xs text-gray-300 font-bold group-hover:text-gray-200">
                                  {receiptFile ? receiptFile.name : "Subir comprobante"}
                                </div>
                                <p className="text-[10px] text-gray-500">JPG, PNG o PDF permitidos</p>
                              </div>
                            </div>
                          </div>

                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            type="submit"
                            disabled={isSubmittingExpense}
                            className="w-full flex items-center justify-center gap-2 py-3 bg-amber-500 text-gray-900 font-extrabold rounded-xl hover:bg-amber-400 disabled:opacity-50 transition-all duration-300 text-sm shadow-lg shadow-amber-500/10 mt-4"
                          >
                            {isSubmittingExpense ? (
                              <span>Enviando...</span>
                            ) : (
                              <>
                                <Check className="w-4 h-4" />
                                Enviar Solicitud Gasto
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
