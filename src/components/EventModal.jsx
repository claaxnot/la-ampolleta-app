import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import {
  X, Search, Filter, Calendar, Clock, MapPin,
  Users, UserCheck, Shield, ChevronDown, Check,
  AlertCircle, FileText, Activity, AlertTriangle, Settings, Sliders
} from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { toast } from "react-hot-toast";
import ClockPicker from "./ClockPicker.jsx";
import DatePicker from "./DatePicker.jsx";
import CurrencyInputCLP from "./CurrencyInputCLP.jsx";

// Zod Schema tolerante y flexible para evitar bloqueos silenciosos
const eventSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  client: z.string().min(2, "El nombre del cliente es obligatorio"),
  date: z.string().min(1, "Selecciona una fecha"),
  time: z.string().min(1, "La hora de inicio es obligatoria"),
  location: z.string().min(3, "La ubicación es obligatoria"),
  requiredStaff: z.coerce.number().min(1, "Debe requerir al menos 1 persona"),
  description: z.string().optional(),
  status: z.string().min(1, "El estado es obligatorio"),
  staffIds: z.array(z.string()).default([]),

  // Tipo de Evento
  type: z.string().default("Producción técnica"),

  // Campos avanzados flexibles
  supervisor_id: z.string().nullable().optional(),
  call_time: z.string().optional().or(z.literal("")),
  setup_time: z.string().optional().or(z.literal("")),
  end_time: z.string().optional().or(z.literal("")),
  priority: z.string().default("Media"),
  operational_notes: z.string().optional(),
  operational_info_pending: z.boolean().default(false),
  attendance_control_enabled: z.boolean().default(false),
  attendance_require_confirmed: z.boolean().default(true),
  latitude: z.string().nullable().optional(),
  longitude: z.string().nullable().optional(),
  allowed_radius_meters: z.preprocess((val) => val === "" || val === null || val === undefined ? 300 : Number(val), z.number().default(300)),
}).refine((data) => {
  // Validar: hora presentación < hora inicio
  if (!data.call_time || !data.time || !data.call_time.includes(":") || !data.time.includes(":")) return true;
  return data.call_time < data.time;
}, {
  message: "La hora de presentación debe ser anterior a la hora de inicio",
  path: ["call_time"]
}).refine((data) => {
  // Validar: hora montaje <= presentación
  if (!data.setup_time || !data.call_time || !data.setup_time.includes(":") || !data.call_time.includes(":")) return true;
  return data.setup_time <= data.call_time;
}, {
  message: "La hora de montaje debe ser anterior o igual a la de presentación",
  path: ["setup_time"]
}).refine((data) => {
  // Validar: hora finalización > inicio
  if (!data.end_time || !data.time || !data.end_time.includes(":") || !data.time.includes(":")) return true;
  return data.end_time > data.time;
}, {
  message: "La hora de finalización debe ser posterior a la de inicio del evento",
  path: ["end_time"]
});

export default function EventModal({ isOpen, onClose, onSubmit, initialData = {} }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: "",
      client: "",
      date: "",
      time: "",
      location: "",
      requiredStaff: 1,
      description: "",
      status: "Planificado",
      staffIds: [],
      type: "Producción técnica",
      supervisor_id: "",
      call_time: "",
      setup_time: "",
      end_time: "",
      priority: "Media",
      operational_notes: "",
      operational_info_pending: false,
      attendance_control_enabled: false,
      attendance_require_confirmed: true,
      latitude: "",
      longitude: "",
      allowed_radius_meters: 300
    }
  });

  const selectedStaffIds = watch("staffIds") || [];
  const eventDate = watch("date");
  const selectedSupervisorId = watch("supervisor_id");
  const eventType = watch("type") || "Producción técnica";
  const eventStartTime = watch("time");

  const [staffSearch, setStaffSearch] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);
  const [dbStaff, setDbStaff] = useState([]);
  const [availabilityMap, setAvailabilityMap] = useState({});
  const [assignedStaffMap, setAssignedStaffMap] = useState({});
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [customRates, setCustomRates] = useState({});

  // Drawer colapsable para configuración avanzada
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAdvancedFinished, setShowAdvancedFinished] = useState(false);

  // Searchable select para Supervisor
  const [supervisorSearch, setSupervisorSearch] = useState("");
  const [isSupervisorDropdownOpen, setIsSupervisorDropdownOpen] = useState(false);

  // Ocultar dinámicamente según Tipo de Evento (Siempre visibles por requerimiento del administrador)
  const showSetupField = true;
  const showSupervisorField = true;

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'Activo')
        .neq('email', 'admin@laampolleta.tv');
      if (data) setDbStaff(data);
    };
    fetchStaff();
  }, []);

  // Autocompletado inteligente al cambiar Tipo de Evento
  useEffect(() => {
    if (!isOpen) return;

    if (eventType === "Anfitrionas" || eventType === "Promotoría") {
      setValue("priority", "Baja");
      setValue("setup_time", "");
      setValue("supervisor_id", "");

      // Sugerir citación de presentación 30 min antes si hay hora de inicio
      if (eventStartTime && eventStartTime.includes(":")) {
        const [h, m] = eventStartTime.split(":");
        let hr = parseInt(h);
        let min = parseInt(m) - 30;
        if (min < 0) {
          min += 60;
          hr = (hr - 1 + 24) % 24;
        }
        const callTimeSuggest = `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
        setValue("call_time", callTimeSuggest);
      }
    } else if (eventType === "Producción técnica" || eventType === "Streaming") {
      setValue("priority", "Media");
    }
  }, [eventType, setValue, isOpen, eventStartTime]);

  useEffect(() => {
    if (!isOpen) return;

    const fetchAvailabilityAndAssignments = async () => {
      if (!eventDate) {
        setAvailabilityMap({});
        setAssignedStaffMap({});
        return;
      }
      setIsLoadingAvailability(true);
      try {
        const { data: availData } = await supabase
          .from('staff_availability')
          .select('staff_id, status')
          .eq('date', eventDate);

        const newAvailMap = {};
        if (availData) {
          availData.forEach(item => {
            newAvailMap[item.staff_id] = item.status;
          });
        }
        setAvailabilityMap(newAvailMap);

        const { data: eventsOnDate } = await supabase
          .from('events')
          .select('id')
          .eq('date', eventDate);

        const eventIds = eventsOnDate ? eventsOnDate.map(e => e.id) : [];

        const newAssignedMap = {};
        if (eventIds.length > 0) {
          const { data: assignmentsOnDate } = await supabase
            .from('event_assignments')
            .select('staff_id, event_id')
            .in('event_id', eventIds);

          if (assignmentsOnDate) {
            assignmentsOnDate.forEach(a => {
              if (!initialData?.id || a.event_id !== initialData.id) {
                newAssignedMap[a.staff_id] = true;
              }
            });
          }
        }
        setAssignedStaffMap(newAssignedMap);
      } catch (err) {
        console.error("Error al obtener la disponibilidad:", err);
      } finally {
        setIsLoadingAvailability(false);
      }
    };

    fetchAvailabilityAndAssignments();
  }, [eventDate, isOpen, initialData?.id]);

  const activeStaff = dbStaff;
  const uniqueRoles = [...new Set(activeStaff.map(s => s.role?.toLowerCase() || ''))].filter(Boolean);

  const getStaffStatus = (staffId) => {
    if (assignedStaffMap[staffId]) return "En evento";
    const avail = availabilityMap[staffId];
    if (avail === "busy") return "No disponible";
    return "Disponible";
  };

  const filteredStaff = activeStaff.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(staffSearch.toLowerCase());
    const matchesRole = staffRole === "" ? true : s.role?.toLowerCase() === staffRole;

    const isChecked = selectedStaffIds.includes(s.id);
    const status = getStaffStatus(s.id);
    const passesAvailability = !showOnlyAvailable || !eventDate || isChecked || status === "Disponible";

    return matchesSearch && matchesRole && passesAvailability;
  });

  const availableCount = activeStaff.filter(s => !eventDate || getStaffStatus(s.id) === "Disponible").length;

  const filteredSupervisors = dbStaff.filter(s =>
    s.name?.toLowerCase().includes(supervisorSearch.toLowerCase())
  );

  const selectedSupervisor = dbStaff.find(s => s.id === selectedSupervisorId);

  // Sync initial data for edit mode or reset when opening
  useEffect(() => {
    if (isOpen) {
      setSupervisorSearch("");
      setIsSupervisorDropdownOpen(false);
      setIsSubmittingForm(false);

      const hasAdvancedFields = initialData.supervisor_id || initialData.call_time || initialData.setup_time || initialData.operational_notes;
      setShowAdvanced(!!hasAdvancedFields);
      setShowAdvancedFinished(!!hasAdvancedFields);

      if (initialData && Object.keys(initialData).length > 0) {
        reset({
          name: initialData.name || "",
          client: initialData.client || "",
          date: initialData.date || "",
          time: initialData.time || "",
          location: initialData.location || "",
          requiredStaff: initialData.required_staff || initialData.requiredStaff || 1,
          description: initialData.description || "",
          status: initialData.status || "Planificado",
          staffIds: [],
          type: initialData.type || "Producción técnica",
          supervisor_id: initialData.supervisor_id || "",
          call_time: initialData.call_time || "",
          setup_time: initialData.setup_time || "",
          end_time: initialData.end_time || "",
          priority: initialData.priority || "Media",
          operational_notes: initialData.operational_notes || "",
          operational_info_pending: initialData.operational_info_pending || false,
          attendance_control_enabled: initialData.attendance_control_enabled || false,
          attendance_require_confirmed: initialData.attendance_require_confirmed !== false,
          latitude: initialData.latitude !== null && initialData.latitude !== undefined ? String(initialData.latitude) : "",
          longitude: initialData.longitude !== null && initialData.longitude !== undefined ? String(initialData.longitude) : "",
          allowed_radius_meters: initialData.allowed_radius_meters !== null && initialData.allowed_radius_meters !== undefined ? initialData.allowed_radius_meters : 300
        });

        const targetIdForAssignments = initialData.id || initialData.duplicateFromId;
        if (targetIdForAssignments) {
          supabase.from('event_assignments').select('staff_id, custom_rate').eq('event_id', targetIdForAssignments).then(({ data }) => {
            if (data) {
              setValue("staffIds", data.map(a => a.staff_id));
              const rates = {};
              data.forEach(a => {
                if (a.custom_rate !== null && a.custom_rate !== undefined) {
                  rates[a.staff_id] = String(a.custom_rate);
                }
              });
              setCustomRates(rates);
            }
          });
        }
      } else {
        setCustomRates({});
        reset({
          name: "", client: "", date: "", time: "", location: "",
          requiredStaff: 1, description: "", status: "Planificado", staffIds: [],
          type: "Producción técnica", supervisor_id: "", call_time: "",
          setup_time: "", end_time: "", priority: "Media", operational_notes: "",
          operational_info_pending: false,
          attendance_control_enabled: false,
          attendance_require_confirmed: true,
          latitude: "",
          longitude: "",
          allowed_radius_meters: 300
        });
      }
    }
  }, [initialData, isOpen, reset, setValue]);

  const onSubmitForm = async (data) => {
    console.log("3️⃣ [VALIDATIONS PASSED] - Formulario válido. Preparando datos para el controlador padre:", data);

    const eventData = { ...data };
    if (initialData.id) eventData.id = initialData.id;
    eventData.staffIds = data.staffIds || [];
    eventData.customRates = customRates;
    eventData.isAdvancedActive = showAdvanced;

    setIsSubmittingForm(true);
    try {
      // Llamar al submit asíncrono de la página padre
      await onSubmit(eventData);
      console.log("🟢 [SUBMIT SUCCESS] - Evento guardado con éxito.");
      onClose();
    } catch (err) {
      console.error("❌ [SUBMIT TRANSACTION ERROR] - Error al guardar evento:", err);
      // Mantener modal abierto en caso de error
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    console.log("1️⃣ [SUBMIT START] - Iniciando envío del formulario");

    // Obtener los datos actuales del formulario antes de validar
    const currentValues = {
      name: watch("name"),
      client: watch("client"),
      date: watch("date"),
      time: watch("time"),
      location: watch("location"),
      requiredStaff: watch("requiredStaff"),
      type: watch("type"),
      status: watch("status"),
      priority: watch("priority")
    };
    console.log("2️⃣ [FORM DATA] - Datos antes de validar:", currentValues);

    handleSubmit(
      (data) => {
        onSubmitForm(data);
      },
      (formErrors) => {
        console.error("❌ [VALIDATION FAILED] - Errores de Zod detectados:", formErrors);

        // Desplegar un toast visual indicando qué campo está fallando
        const firstErrorKey = Object.keys(formErrors)[0];
        const firstErrorMessage = formErrors[firstErrorKey]?.message || "Verifica los campos obligatorios";

        toast.error(`Error de validación: ${firstErrorMessage}`, {
          duration: 4000,
          position: "top-center",
          style: {
            background: "#1f2937",
            color: "#f87171",
            border: "1px solid rgba(248, 113, 113, 0.2)"
          }
        });
      }
    )(e);
  };

  const toggleStaff = (id) => {
    const current = selectedStaffIds || [];
    if (current.includes(id)) {
      setValue("staffIds", current.filter(sId => sId !== id), { shouldDirty: true });
      setCustomRates(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } else {
      const staff = dbStaff.find(s => s.id === id);
      const status = getStaffStatus(id);

      if (status === "En evento") {
        const confirmAssign = window.confirm(
          `⚠️ ADVERTENCIA OPERACIONAL:\n\n¿Estás seguro de que quieres asignar a "${staff?.name || 'este trabajador'}"?\nYa cuenta con otro evento asignado para este mismo día.`
        );
        if (!confirmAssign) return;
      } else if (status === "No disponible") {
        const confirmAssign = window.confirm(
          `⚠️ ADVERTENCIA DE DISPONIBILIDAD:\n\n¿Estás seguro de que quieres asignar a "${staff?.name || 'este trabajador'}"?\nHa marcado este día como NO disponible en su calendario.`
        );
        if (!confirmAssign) return;
      }

      setValue("staffIds", [...current, id], { shouldDirty: true });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/85 backdrop-blur overflow-y-auto p-4 md:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-3xl my-auto"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassCard className="p-6 md:p-8 relative border border-white/10 shadow-2xl max-h-[90vh] overflow-y-auto">

              <button
                type="button"
                onClick={onClose}
                className="absolute top-5 right-5 text-gray-400 hover:text-white transition-colors p-1 bg-white/5 rounded-full hover:bg-white/10 z-10"
              >
                <X className="w-5 h-5" />
              </button>

              <h2 className="text-2xl font-black mb-6 text-white tracking-tight flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Calendar className="w-6 h-6" />
                </span>
                {initialData.id ? "Editar Evento" : initialData.isDuplicate ? "Duplicar Evento" : "Crear Nuevo Evento"}
              </h2>

              <form onSubmit={handleFormSubmit} className="space-y-6">

                {/* 1️⃣ SECCIÓN BASE: INFORMACIÓN GENERAL (SIEMPRE VISIBLE) */}
                <div className="border-b border-white/5 pb-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {/* Selector del Tipo de Evento */}
                    <div className="flex flex-col">
                      <label className="text-amber-400 mb-1.5 text-xs font-bold uppercase tracking-wider flex items-center gap-1" htmlFor="type">
                        <Sliders className="w-3.5 h-3.5" /> Tipo de Evento
                      </label>
                      <select
                        id="type"
                        {...register("type")}
                        className="w-full bg-gray-800/80 border border-amber-500/30 rounded-xl p-2.5 text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-500 transition-colors"
                      >
                        <option value="Producción técnica">Producción técnica</option>
                        <option value="Evento corporativo">Evento corporativo</option>
                        <option value="Activación">Activación</option>
                        <option value="Anfitrionas">Anfitrionas (Modelo/Promotora)</option>
                        <option value="Promotoría">Promotoría</option>
                        <option value="Streaming">Streaming / Streaming Live</option>
                        <option value="Montaje/Desmontaje">Montaje / Desmontaje</option>
                        <option value="CCTV">CCTV</option>
                        <option value="Encuestadores/as">Encuestadores/as</option>
                        <option value="Flete/transporte">Flete / Transporte</option>
                        <option value="Instalación/es">Instalación/es</option>
                        <option value="Reciclaje/Basura">Reciclaje/Basura</option>
                        <option value="Traslado a Vertedero">Traslado a Vertedero</option>
                        <option value="Servicios Especiales">Servicios Especiales</option>
                        <option value="Servicios Fotografía">Servicios Fotografía</option>
                        <option value="Visita Técnica">Visita Técnica</option>
                        <option value="Otro">Otro</option>
                      </select>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="name">Nombre del Evento</label>
                      <input
                        id="name"
                        placeholder="Ej: Arauco Talentos..."
                        {...register("name")}
                        className={`w-full bg-gray-800/50 border rounded-xl p-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors ${errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`}
                      />
                      {errors.name && <span className="text-red-400 text-xs mt-1">{errors.name.message}</span>}
                    </div>

                    <div className="flex flex-col">
                      <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="client">Cliente</label>
                      <input
                        id="client"
                        placeholder="Ej: Mall Arauco"
                        {...register("client")}
                        className={`w-full bg-gray-800/50 border rounded-xl p-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors ${errors.client ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`}
                      />
                      {errors.client && <span className="text-red-400 text-xs mt-1">{errors.client.message}</span>}
                    </div>

                    <div className="flex flex-col">
                      <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="location">Ubicación</label>
                      <input
                        id="location"
                        placeholder="Dirección o Recinto del evento"
                        {...register("location")}
                        className={`w-full bg-gray-800/50 border rounded-xl p-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors ${errors.location ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`}
                      />
                      {errors.location && <span className="text-red-400 text-xs mt-1">{errors.location.message}</span>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col">
                        <DatePicker
                          value={watch("date")}
                          onChange={(val) => setValue("date", val, { shouldDirty: true })}
                          label="Fecha"
                          id="date"
                          error={errors.date}
                        />
                      </div>

                      <div className="flex flex-col">
                        <ClockPicker
                          value={watch("time")}
                          onChange={(val) => setValue("time", val, { shouldDirty: true })}
                          label="Hora Inicio"
                          id="time"
                          error={errors.time}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="requiredStaff">Staff Requerido</label>
                      <input
                        id="requiredStaff"
                        type="number"
                        min="1"
                        {...register("requiredStaff")}
                        className={`w-full bg-gray-800/50 border rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors ${errors.requiredStaff ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`}
                      />
                      {errors.requiredStaff && <span className="text-red-400 text-xs mt-1">{errors.requiredStaff.message}</span>}
                    </div>
                  </div>

                  <div className="flex flex-col mt-4">
                    <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="description">Descripción Breve</label>
                    <textarea
                      id="description"
                      placeholder="Detalles rápidos y breves del evento..."
                      {...register("description")}
                      className="w-full h-16 bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                </div>

                {/* 2️⃣ SECCIÓN DE CONFIGURACIÓN OPERACIONAL AVANZADA (COLAPSABLE CON FRAMER MOTION) */}
                <div className="border-b border-white/5 pb-4">
                  <div className="flex flex-wrap items-center gap-4 mb-1">
                    <button
                      type="button"
                      onClick={() => {
                        if (showAdvanced) {
                          setShowAdvancedFinished(false);
                        }
                        setShowAdvanced(!showAdvanced);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-xs font-bold uppercase tracking-wider text-amber-400 transition-colors focus:outline-none shadow-md"
                    >
                      <span>{showAdvanced ? "▼ Ocultar Configuración Avanzada" : "▶ Mostrar Configuración Avanzada"}</span>
                      <span className="text-[10px] text-gray-400 normal-case font-medium">
                        ({showAdvanced ? "Haga clic para cerrar" : "Supervisor, horarios detallados, notas"})
                      </span>
                    </button>

                    <label className="flex items-center gap-2.5 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-amber-300 transition-colors shadow-md select-none">
                      <input
                        type="checkbox"
                        {...register("operational_info_pending")}
                        className="form-checkbox h-4 w-4 text-amber-500 bg-gray-700 border-gray-600 rounded focus:ring-amber-500/50"
                      />
                      <span>Información operacional pendiente</span>
                    </label>

                    <label className="flex items-center gap-2.5 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-amber-300 transition-colors shadow-md select-none" title="Activa esta opción para que las trabajadoras puedan registrar su horario de entrada y salida en este evento.">
                      <input
                        type="checkbox"
                        {...register("attendance_control_enabled")}
                        className="form-checkbox h-4 w-4 text-amber-500 bg-gray-700 border-gray-600 rounded focus:ring-amber-500/50"
                      />
                      <span>Habilitar control de ingreso/salida</span>
                    </label>

                    {watch("attendance_control_enabled") && (
                      <label className="flex items-center gap-2.5 cursor-pointer bg-white/5 hover:bg-white/10 px-3 py-2 rounded-xl border border-white/10 text-xs font-bold text-emerald-300 transition-colors shadow-md select-none" title="Exigir que la trabajadora tenga su asignación en estado 'Confirmado' o 'Aceptado' para marcar entrada. Si se desmarca, permite marcar en estado 'Pendiente'.">
                        <input
                          type="checkbox"
                          {...register("attendance_require_confirmed")}
                          className="form-checkbox h-4 w-4 text-emerald-500 bg-gray-700 border-gray-600 rounded focus:ring-emerald-500/50"
                        />
                        <span>Exigir asignación confirmada</span>
                      </label>
                    )}

                    {watch("attendance_control_enabled") && (
                      <div className="col-span-full bg-white/[0.02] border border-white/10 rounded-2xl p-4 mt-2 space-y-4 shadow-xl backdrop-blur-md">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2.5">
                          <MapPin className="w-4 h-4 text-amber-400" />
                          <h4 className="text-xs font-black text-amber-300 uppercase tracking-wider">Ubicación para control de asistencia</h4>
                        </div>

                        {/* Paste Coord box or Current Location Button */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                          <div className="md:col-span-2 flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">
                              Pegar Enlace Google Maps o Coordenadas (lat, lng)
                            </label>
                            <input
                              type="text"
                              placeholder="Ej: https://maps.google.com/?q=-33.4429,-70.6538 o -33.4429, -70.6538"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (!val) return;
                                // Regex to find lat/lng coordinates in string or google maps url
                                const coordRegex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
                                const match = val.match(coordRegex);
                                if (match) {
                                  setValue("latitude", match[1]);
                                  setValue("longitude", match[2]);
                                  toast.success(`Coordenadas extraídas: Lat ${match[1]}, Lng ${match[2]}`);
                                } else {
                                  // Check for google maps @lat,lng format
                                  const urlRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
                                  const matchUrl = val.match(urlRegex);
                                  if (matchUrl) {
                                    setValue("latitude", matchUrl[1]);
                                    setValue("longitude", matchUrl[2]);
                                    toast.success(`Coordenadas de enlace extraídas: Lat ${matchUrl[1]}, Lng ${matchUrl[2]}`);
                                  }
                                }
                              }}
                              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                            />
                          </div>

                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              if (!navigator.geolocation) {
                                toast.error("Geolocalización no soportada en este navegador.");
                                return;
                              }
                              toast.loading("Obteniendo tu ubicación actual...", { id: "gps-admin-loader" });
                              navigator.geolocation.getCurrentPosition(
                                (position) => {
                                  setValue("latitude", String(position.coords.latitude.toFixed(6)));
                                  setValue("longitude", String(position.coords.longitude.toFixed(6)));
                                  toast.success("Ubicación actual obtenida con éxito.", { id: "gps-admin-loader" });
                                },
                                (err) => {
                                  toast.error("Error al obtener ubicación. Asegúrate de dar permisos de GPS.", { id: "gps-admin-loader" });
                                },
                                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                              );
                            }}
                            className="w-full text-xs py-2 h-9 flex items-center justify-center gap-1.5"
                          >
                            <span>📍 Usar ubicación actual</span>
                          </Button>
                        </div>

                        {/* Lat, Lng, Radius inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Latitud</label>
                            <input
                              type="text"
                              placeholder="Ej: -33.4429"
                              {...register("latitude")}
                              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Longitud</label>
                            <input
                              type="text"
                              placeholder="Ej: -70.6538"
                              {...register("longitude")}
                              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest">Radio permitido (metros)</label>
                            <input
                              type="number"
                              placeholder="Ej: 300"
                              {...register("allowed_radius_meters")}
                              className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                            />
                          </div>
                        </div>

                        <p className="text-[10px] text-gray-500 leading-relaxed italic">
                          💡 Deja latitud/longitud en blanco si no deseas exigir control de ubicación para este evento. Las trabajadoras podrán marcar desde cualquier lugar sin advertencias si no hay coordenadas.
                        </p>
                      </div>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {showAdvanced && (
                      <motion.div
                        key="advanced-drawer"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: "easeInOut" }}
                        className={showAdvancedFinished ? "overflow-visible" : "overflow-hidden"}
                        onAnimationComplete={(definition) => {
                          if (definition.opacity === 1) {
                            setShowAdvancedFinished(true);
                          }
                        }}
                      >
                        <div className="pt-5 space-y-6">

                          {/* Subsección: Tiempos operacionales */}
                          <div className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-4">
                            <h4 className="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5" /> Cronograma de Horarios
                            </h4>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                              {showSetupField ? (
                                <div className="flex flex-col">
                                  <ClockPicker
                                    value={watch("setup_time")}
                                    onChange={(val) => setValue("setup_time", val, { shouldDirty: true })}
                                    label="Hora Montaje Técnico"
                                    id="setup_time"
                                    error={errors.setup_time}
                                  />
                                </div>
                              ) : (
                                <div className="hidden" />
                              )}

                              <div className="flex flex-col">
                                <ClockPicker
                                  value={watch("call_time")}
                                  onChange={(val) => setValue("call_time", val, { shouldDirty: true })}
                                  label="Hora Presentación (Citación)"
                                  id="call_time"
                                  error={errors.call_time}
                                />
                              </div>

                              <div className="flex flex-col">
                                <ClockPicker
                                  value={watch("end_time")}
                                  onChange={(val) => setValue("end_time", val, { shouldDirty: true })}
                                  label="Hora Finalización Estimada"
                                  id="end_time"
                                  error={errors.end_time}
                                  align="right"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Subsección: Estado, Prioridad y Supervisor */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                            {/* Supervisor del Evento (Native Select) */}
                            {showSupervisorField ? (
                              <div className="flex flex-col">
                                <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="supervisor_id">Supervisor Operativo</label>
                                <select
                                  id="supervisor_id"
                                  {...register("supervisor_id")}
                                  className="bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors font-medium"
                                >
                                  <option value="">Sin Supervisor</option>
                                  {dbStaff.map(s => (
                                    <option key={s.id} value={s.id}>
                                      {s.name} ({s.role})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <div className="hidden" />
                            )}

                            <div className="flex flex-col">
                              <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="status">Estado Operacional</label>
                              <select
                                id="status"
                                {...register("status")}
                                className="bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                              >
                                <option value="Planificado">Planificado</option>
                                <option value="Confirmado">Confirmado</option>
                                <option value="En progreso">En progreso</option>
                                <option value="Finalizado">Finalizado</option>
                                <option value="Cancelado">Cancelado</option>
                              </select>
                            </div>

                            <div className="flex flex-col">
                              <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="priority">Prioridad</label>
                              <select
                                id="priority"
                                {...register("priority")}
                                className="bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-colors"
                              >
                                <option value="Baja">Baja (Gris)</option>
                                <option value="Media">Media (Azul)</option>
                                <option value="Alta">Alta (Amarillo)</option>
                                <option value="Crítica">Crítica (Rojo)</option>
                              </select>
                            </div>
                          </div>

                          {/* Notas operativas avanzadas */}
                          <div className="flex flex-col">
                            <label className="text-gray-300 mb-1.5 text-xs font-semibold" htmlFor="operational_notes">Notas de Logística & Acceso Técnico (Instrucciones Especiales)</label>
                            <textarea
                              id="operational_notes"
                              placeholder="Ej: Acceso de carga por calle norte. Contacto cliente: +569... Exigir credenciales..."
                              {...register("operational_notes")}
                              className="w-full h-20 bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                            />
                          </div>

                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* 3️⃣ SECCIÓN: ASIGNACIÓN DE STAFF CON VALIDACIÓN DE DISPONIBILIDAD (SIEMPRE VISIBLE) */}
                <div>
                  <h3 className="text-xs font-extrabold text-amber-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Users className="w-4 h-4" /> Asignación de Staff
                  </h3>

                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-300 font-semibold">Trabajadores Disponibles:</span>
                      {eventDate ? (
                        <span className="text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold shadow-inner">
                          {availableCount} {availableCount === 1 ? 'disponible' : 'disponibles'}
                        </span>
                      ) : (
                        <span className="text-xs bg-white/5 text-gray-400 border border-white/5 px-2 py-0.5 rounded-full font-medium">
                          Selecciona una fecha
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
                      <label className="flex items-center gap-1.5 cursor-pointer bg-white/5 hover:bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 text-[11px] font-bold text-gray-300 transition-all select-none">
                        <input
                          type="checkbox"
                          checked={showOnlyAvailable}
                          onChange={(e) => setShowOnlyAvailable(e.target.checked)}
                          className="form-checkbox h-3.5 w-3.5 text-amber-500 bg-gray-700 border-gray-600 rounded focus:ring-amber-500/30"
                        />
                        <span>Solo disponibles</span>
                      </label>

                      <div className="relative flex-1 md:flex-initial">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                          type="text"
                          placeholder="Buscar por nombre..."
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>

                      <div className="relative flex-1 md:flex-initial">
                        <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <select
                          value={staffRole}
                          onChange={(e) => setStaffRole(e.target.value)}
                          className="w-full pl-8 pr-6 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-xs text-white focus:outline-none focus:border-amber-500/50 appearance-none capitalize"
                        >
                          <option value="">Todos los roles</option>
                          {uniqueRoles.map(role => (
                            <option key={role} value={role} className="capitalize">{role}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-black/30 p-3.5 rounded-xl border border-white/5 max-h-48 overflow-y-auto">
                    {isLoadingAvailability ? (
                      <p className="text-gray-400 text-xs col-span-2 text-center py-4 flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Consultando disponibilidad real...
                      </p>
                    ) : filteredStaff.length === 0 ? (
                      <p className="text-gray-400 text-xs col-span-2 text-center py-4">
                        No hay trabajadores disponibles que coincidan con la búsqueda.
                      </p>
                    ) : (
                      filteredStaff.map((staff) => {
                        const isChecked = selectedStaffIds.includes(staff.id);
                        const status = getStaffStatus(staff.id);
                        let badgeColor = "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
                        if (status === "En evento") badgeColor = "bg-amber-500/20 text-amber-300 border-amber-500/30";
                        if (status === "No disponible") badgeColor = "bg-red-500/20 text-red-300 border-red-500/30";

                        return (
                          <label key={staff.id} className="flex items-center justify-between text-gray-200 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors border border-transparent hover:border-white/5">
                            <div className="flex items-center space-x-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleStaff(staff.id)}
                                className="form-checkbox h-4 w-4 text-amber-500 bg-gray-700 border-gray-600 rounded focus:ring-amber-500/50"
                              />
                              <span className="flex items-center gap-2">
                                <img src={staff.avatar || "https://ui-avatars.com/api/?name=" + staff.name} alt="" className="w-6 h-6 rounded-full" />
                                <span className="truncate max-w-[125px] text-xs font-semibold">{staff.name}</span>
                                <span className="text-[10px] text-gray-400 capitalize">({staff.role})</span>
                              </span>
                            </div>
                            {eventDate && (
                              <span className={`px-2 py-0.5 text-[9px] rounded-full border font-bold ${badgeColor}`}>
                                {status}
                              </span>
                            )}
                          </label>
                        );
                      })
                    )}
                  </div>

                  {selectedStaffIds.length > 0 && (
                    <div className="mt-4 p-3.5 bg-black/40 rounded-xl border border-white/5">
                      <h4 className="text-[11px] font-extrabold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                        <Sliders className="w-3.5 h-3.5 text-amber-400" /> Tarifas de Turno para este Evento
                      </h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {selectedStaffIds.map(id => {
                          const staff = dbStaff.find(s => s.id === id);
                          if (!staff) return null;
                          const baseline = staff.monto_transferencia ? parseInt(staff.monto_transferencia) : 25000;
                          return (
                            <div key={id} className="flex items-center justify-between gap-3 bg-gray-900/40 p-2 rounded-lg border border-white/5">
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={staff.avatar || "https://ui-avatars.com/api/?name=" + staff.name} alt="" className="w-5 h-5 rounded-full shrink-0" />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-[11px] font-semibold text-gray-200 truncate">{staff.name}</span>
                                  <span className="text-[9px] text-gray-400 font-medium">Tarifa base: ${baseline.toLocaleString('es-CL')}</span>
                                </div>
                              </div>
                              <div className="flex items-center shrink-0">
                                <CurrencyInputCLP
                                  compact
                                  placeholder={String(baseline)}
                                  value={customRates[id] || ""}
                                  onChange={(val) => {
                                    setCustomRates(prev => ({
                                      ...prev,
                                      [id]: val
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-800">
                  <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmittingForm}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={isSubmittingForm}>
                    {isSubmittingForm ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4 text-gray-900" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Guardando...
                      </span>
                    ) : (
                      initialData.id ? "Actualizar Evento" : "Crear Evento"
                    )}
                  </Button>
                </div>

              </form>

            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}