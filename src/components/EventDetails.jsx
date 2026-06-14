import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { X, Clock, Edit, Save, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { toast } from "react-hot-toast";
import DatePicker from "./DatePicker.jsx";
import ClockPicker from "./ClockPicker.jsx";

/**
 * EventDetails – shows full information for a selected event.
 * Props:
 *   event: object – the event data to display
 *   isOpen: boolean – controls visibility
 *   onClose: () => void – close handler
 */
export default function EventDetails({ event, isOpen, onClose }) {
  const [assigned, setAssigned] = React.useState([]);
  const [attendance, setAttendance] = React.useState({});
  const [editingStaffId, setEditingStaffId] = React.useState(null);
  const [editNotes, setEditNotes] = React.useState("");
  const [editCheckInDate, setEditCheckInDate] = React.useState("");
  const [editCheckInTime, setEditCheckInTime] = React.useState("09:00");
  const [editCheckOutDate, setEditCheckOutDate] = React.useState("");
  const [editCheckOutTime, setEditCheckOutTime] = React.useState("18:00");
  const [eventDays, setEventDays] = React.useState([]);
  const [selectedDayId, setSelectedDayId] = React.useState(null);
  const [isSavingCorrection, setIsSavingCorrection] = React.useState(false);

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

  const renderGPSBadge = (status, distance, accuracy, lat, lng) => {
    if (!status || status === "unavailable") {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-gray-400 border border-white/5 font-extrabold uppercase tracking-wider">
          ⚪ Sin GPS
        </span>
      );
    }
    
    const formattedDist = distance !== null && distance !== undefined ? `${Math.round(distance)}m` : "?m";
    const formattedAcc = accuracy !== null && accuracy !== undefined ? `±${Math.round(accuracy)}m` : "";
    const tooltip = `Coordenadas: ${lat || '?'}, ${lng || '?'}. Precisión del dispositivo: ${formattedAcc}`;

    if (status === "verified") {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-extrabold uppercase tracking-wider cursor-help" title={tooltip}>
          🟢 Verificada ({formattedDist})
        </span>
      );
    }
    if (status === "approximate") {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-extrabold uppercase tracking-wider cursor-help" title={tooltip}>
          🟡 Aproximada ({formattedDist})
        </span>
      );
    }
    if (status === "out_of_range") {
      return (
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20 font-extrabold uppercase tracking-wider cursor-help animate-pulse" title={tooltip}>
          🔴 Fuera de rango ({formattedDist})
        </span>
      );
    }
    return null;
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

  const toDatetimeLocalString = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "America/Santiago",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const formatted = formatter.format(d);
    return formatted.replace(" ", "T");
  };

  const fetchAssignedStaff = async (currentDayId = null) => {
    if (!event?.id) return;
    
    // 1. Fetch event days
    const { data: daysData } = await supabase
      .from('event_days')
      .select('*')
      .eq('event_id', event.id)
      .order('date', { ascending: true });
    
    let activeDayId = currentDayId || selectedDayId;
    if (daysData && daysData.length > 0) {
      setEventDays(daysData);
      if (!activeDayId) {
        activeDayId = daysData[0].id;
        setSelectedDayId(activeDayId);
      }
    } else {
      setEventDays([]);
      setSelectedDayId(null);
    }
    
    // 2. Fetch assignments
    let query = supabase
      .from('event_assignments')
      .select(`
        id,
        staff_id,
        status,
        custom_rate,
        event_day_id,
        profiles:staff_id (name, role)
      `);
    
    if (activeDayId) {
      query = query.eq('event_day_id', activeDayId);
    } else {
      query = query.eq('event_id', event.id);
    }
    
    const { data: assignmentsData } = await query;
    
    if (assignmentsData) {
      setAssigned(assignmentsData.map(d => ({
        assignment_id: d.id,
        id: d.staff_id,
        status: d.status,
        custom_rate: d.custom_rate,
        name: d.profiles?.name || 'Desconocido',
        role: d.profiles?.role || ''
      })));
    } else {
      setAssigned([]);
    }

    // 3. Fetch attendance logs
    let logsQuery = supabase
      .from('event_attendance_logs')
      .select('*');
    
    if (activeDayId) {
      logsQuery = logsQuery.eq('event_day_id', activeDayId);
    } else {
      logsQuery = logsQuery.eq('event_id', event.id);
    }
    
    const { data: attendanceData } = await logsQuery;
    
    if (attendanceData) {
      const attMap = {};
      attendanceData.forEach(log => {
        attMap[log.worker_id] = log;
      });
      setAttendance(attMap);
    } else {
      setAttendance({});
    }
  };

  const handleDaySelect = (dayId) => {
    setSelectedDayId(dayId);
    fetchAssignedStaff(dayId);
  };

  React.useEffect(() => {
    if (!isOpen || !event?.id) return;

    fetchAssignedStaff();

    // Suscribirse a cambios en tiempo real de asignaciones y logs
    const channel = supabase
      .channel(`event-details-realtime-${event.id}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'event_assignments', 
          filter: `event_id=eq.${event.id}` 
        },
        () => {
          console.log("🔔 [REALTIME EVENT DETAILS] - Cambio de asignaciones detectado. Actualizando...");
          fetchAssignedStaff();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'event_attendance_logs',
          filter: `event_id=eq.${event.id}`
        },
        () => {
          console.log("🔔 [REALTIME EVENT DETAILS] - Cambio de asistencia detectado. Actualizando...");
          fetchAssignedStaff();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, event]);

  const startEditingAttendance = (staffId) => {
    const log = attendance[staffId];
    setEditingStaffId(staffId);
    if (log) {
      const checkInFormatted = toDatetimeLocalString(log.check_in_at);
      if (checkInFormatted) {
        const [d, t] = checkInFormatted.split("T");
        setEditCheckInDate(d);
        setEditCheckInTime(t);
      } else {
        const evDate = event.date || new Date().toISOString().split("T")[0];
        setEditCheckInDate(evDate);
        setEditCheckInTime("09:00");
      }

      if (log.check_out_at) {
        const checkOutFormatted = toDatetimeLocalString(log.check_out_at);
        const [d, t] = checkOutFormatted.split("T");
        setEditCheckOutDate(d);
        setEditCheckOutTime(t);
      } else {
        const evDate = event.date || new Date().toISOString().split("T")[0];
        setEditCheckOutDate(evDate);
        setEditCheckOutTime("");
      }
      setEditNotes(log.admin_adjustment_notes || "");
    } else {
      const evDate = event.date || new Date().toISOString().split("T")[0];
      setEditCheckInDate(evDate);
      setEditCheckInTime("09:00");
      setEditCheckOutDate(evDate);
      setEditCheckOutTime("");
      setEditNotes("");
    }
  };

  const handleSaveCorrection = async (staffId, assignmentId) => {
    if (!editNotes.trim()) {
      toast.error("Por favor, ingresa el motivo de la corrección.");
      return;
    }

    if (!editCheckInDate || !editCheckInTime) {
      toast.error("La fecha y hora de entrada son obligatorias.");
      return;
    }

    setIsSavingCorrection(true);
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser) {
        toast.error("Sesión de administrador no válida.");
        setIsSavingCorrection(false);
        return;
      }

      // Convert local date/time in Chile to ISO string
      const checkInISO = new Date(`${editCheckInDate}T${editCheckInTime}`).toISOString();
      
      const checkOutISO = (editCheckOutDate && editCheckOutTime && editCheckOutTime !== "")
        ? new Date(`${editCheckOutDate}T${editCheckOutTime}`).toISOString()
        : null;

      let durationMins = 0;
      if (checkOutISO) {
        const diffMs = new Date(checkOutISO) - new Date(checkInISO);
        durationMins = Math.max(0, Math.floor(diffMs / 60000));
      }

      const existingLog = attendance[staffId];

      if (existingLog) {
        const { error } = await supabase
          .from('event_attendance_logs')
          .update({
            check_in_at: checkInISO,
            check_out_at: checkOutISO,
            verified_by_admin: true,
            admin_adjusted_by: adminUser.id,
            admin_adjustment_notes: editNotes,
            is_complete: !!checkOutISO,
            total_duration_minutes: durationMins,
            original_check_in_at: existingLog.original_check_in_at || existingLog.check_in_at,
            original_check_out_at: existingLog.original_check_out_at || existingLog.check_out_at,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingLog.id);

        if (error) throw error;
        toast.success("Asistencia corregida correctamente.");
      } else {
        const { error } = await supabase
          .from('event_attendance_logs')
          .insert([{
            event_id: event.id,
            event_day_id: selectedDayId || null,
            worker_id: staffId,
            assignment_id: assignmentId || null,
            check_in_at: checkInISO,
            check_out_at: checkOutISO,
            verified_by_admin: true,
            admin_adjusted_by: adminUser.id,
            admin_adjustment_notes: editNotes,
            is_complete: !!checkOutISO,
            total_duration_minutes: durationMins,
            check_in_source: 'admin_manual',
            check_out_source: 'admin_manual'
          }]);

        if (error) throw error;
        toast.success("Asistencia manual registrada.");
      }

      setEditingStaffId(null);
      setEditNotes("");
      setEditCheckInDate("");
      setEditCheckInTime("09:00");
      setEditCheckOutDate("");
      setEditCheckOutTime("18:00");
      
      await fetchAssignedStaff();
    } catch (err) {
      console.error("Error saving attendance correction:", err);
      toast.error(err.message || "Error al guardar los cambios.");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  const handleQuickConfirm = async (staffId, assignmentId) => {
    setIsSavingCorrection(true);
    try {
      const { data: { user: adminUser } } = await supabase.auth.getUser();
      if (!adminUser) {
        toast.error("Sesión de administrador no válida.");
        setIsSavingCorrection(false);
        return;
      }

      const dayObj = eventDays.find(d => d.id === selectedDayId);
      const evDate = dayObj?.date || event.date || new Date().toISOString().split("T")[0];
      const startTime = dayObj?.start_time || event.time || "10:00";
      const endTime = dayObj?.end_time || event.end_time || "18:00";

      const checkInISO = new Date(`${evDate}T${startTime.substring(0, 5)}`).toISOString();
      const checkOutISO = new Date(`${evDate}T${endTime.substring(0, 5)}`).toISOString();

      let finalCheckOutISO = checkOutISO;
      if (endTime.substring(0, 5) <= startTime.substring(0, 5)) {
        const d = new Date(`${evDate}T${endTime.substring(0, 5)}`);
        d.setDate(d.getDate() + 1);
        finalCheckOutISO = d.toISOString();
      }

      const diffMs = new Date(finalCheckOutISO) - new Date(checkInISO);
      const durationMins = Math.max(0, Math.floor(diffMs / 60000));

      const { error } = await supabase
        .from('event_attendance_logs')
        .insert([{
          event_id: event.id,
          event_day_id: selectedDayId || null,
          worker_id: staffId,
          assignment_id: assignmentId || null,
          check_in_at: checkInISO,
          check_out_at: finalCheckOutISO,
          verified_by_admin: true,
          admin_adjusted_by: adminUser.id,
          admin_adjustment_notes: "Confirmado automáticamente por administración",
          is_complete: true,
          total_duration_minutes: durationMins,
          check_in_source: 'admin_manual',
          check_out_source: 'admin_manual'
        }]);

      if (error) throw error;
      toast.success("Asistencia confirmada rápidamente.");
      await fetchAssignedStaff();
    } catch (err) {
      console.error("Error doing quick confirm:", err);
      toast.error(err.message || "Error al confirmar asistencia.");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  if (!event) return null;

  const isFinalized = event.status ? ['finalizado', 'completado', 'completed'].includes(event.status.toLowerCase()) : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur p-4 overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-2xl my-auto"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassCard className="p-6 md:p-8 relative max-h-[90vh] overflow-y-auto custom-scrollbar border border-white/10 shadow-2xl">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors p-1 bg-white/5 rounded-full hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-white tracking-tight border-b border-white/5 pb-3">Detalle del Evento</h2>
              
              {/* Selector horizontal de Jornadas (Event Days) */}
              {eventDays.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-4 mb-4 border-b border-white/5 scrollbar-thin">
                  {eventDays.map((day, idx) => {
                    const isSelected = selectedDayId === day.id;
                    const dateStr = day.date ? day.date.split('-').reverse().join('/') : `Día ${idx + 1}`;
                    return (
                      <button
                        key={day.id}
                        onClick={() => handleDaySelect(day.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap border ${
                          isSelected
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-md"
                            : "bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-white"
                        }`}
                      >
                        📅 Día {idx + 1} ({dateStr})
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="space-y-4 text-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p><strong>Nombre:</strong> {event.name}</p>
                  <p><strong>Cliente:</strong> {event.client}</p>
                  <p>
                    <strong>Fecha:</strong>{" "}
                    {selectedDayId
                      ? (eventDays.find(d => d.id === selectedDayId)?.date ? eventDays.find(d => d.id === selectedDayId).date.split('-').reverse().join('/') : '')
                      : (event.date ? event.date.split('-').reverse().join('/') : '')}
                  </p>
                  <p>
                    <strong>Hora:</strong>{" "}
                    {selectedDayId
                      ? (eventDays.find(d => d.id === selectedDayId)?.start_time?.substring(0, 5) || event.time)
                      : event.time}
                  </p>
                  <p><strong>Ubicación:</strong> {event.location}</p>
                  <p>
                    <strong>Estado:</strong>{" "}
                    {selectedDayId
                      ? (eventDays.find(d => d.id === selectedDayId)?.status || event.status)
                      : event.status}
                  </p>
                </div>
                {(() => {
                  const dayObj = eventDays.find(d => d.id === selectedDayId);
                  const notes = dayObj?.notes || event.description;
                  if (!notes) return null;
                  return (
                    <p>
                      <strong>{dayObj?.notes ? "Notas de esta Jornada:" : "Descripción:"}</strong> {notes}
                    </p>
                  );
                })()}                {/* Staff Asignado / Sección de Personal */}
                {(assigned.length > 0 || ['planificado', 'planned', 'confirmado', 'confirmed', 'active', 'activo', 'en curso', 'finalizado', 'completado', 'completed'].includes(event.status?.toLowerCase())) && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                    <div className="flex flex-col mb-2">
                      <strong className="text-sm text-gray-100">
                        {isFinalized ? "Auditoría Final de Personal y Asistencia:" : "Personal y Asistencia:"}
                      </strong>
                      {!event.attendance_control_enabled && (
                        <span className="text-[11px] text-amber-400/90 font-medium mt-0.5 flex items-center gap-1">
                          ⚠️ Este evento no tenía control de ingreso/salida habilitado.
                        </span>
                      )}
                    </div>

                    {assigned.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">Ningún trabajador asignado a este evento.</span>
                    ) : (
                      // Vista única detallada de Personal, Asistencia y Corrección Administrativa
                      <div className="flex flex-col gap-3">
                        {assigned.map(s => {
                          const log = attendance[s.id];
                          const isEditing = editingStaffId === s.id;
                          
                          let badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                          let statusLabel = "Pendiente";
                          if (s.status === "Confirmado" || s.status === "Aceptado") {
                            badgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                            statusLabel = "Confirmado";
                          } else if (s.status === "Rechazado") {
                            badgeStyle = "bg-red-500/10 text-red-400 border-red-500/20";
                            statusLabel = "Rechazado";
                          }

                          return (
                            <div key={s.id} className="p-4 rounded-2xl bg-black/30 border border-white/5 space-y-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-bold text-gray-100 text-sm">{s.name}</span>
                                  <span className="text-[10px] text-gray-500 block capitalize">{s.role}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold ${badgeStyle}`}>
                                    {statusLabel}
                                  </span>
                                  {/* Honorario Líquido Badge */}
                                  <span className="px-2 py-0.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] font-black font-mono">
                                    Liq: ${s.custom_rate && parseFloat(s.custom_rate) > 0 ? parseFloat(s.custom_rate).toLocaleString("es-CL") : "25.000"}
                                  </span>
                                  {!isEditing && (
                                    <button
                                      onClick={() => startEditingAttendance(s.id)}
                                      className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-amber-400 hover:text-amber-300 border border-white/10 transition-colors shadow-sm"
                                      title="Corregir asistencia o registrar manual"
                                    >
                                      <Edit className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isEditing ? (
                                // Formulario de edición administrativa
                                <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 space-y-3">
                                  <div className="text-[10px] font-extrabold text-amber-400 flex items-center gap-1 uppercase tracking-wider">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Corrección Administrativa
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Entrada Column */}
                                    <div className="flex flex-col gap-2 bg-black/20 p-3 rounded-2xl border border-white/5">
                                      <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block mb-1">⏰ Entrada (Chile)</span>
                                      <div className="grid grid-cols-2 gap-2">
                                        <DatePicker
                                          value={editCheckInDate}
                                          onChange={(val) => setEditCheckInDate(val)}
                                          label="Fecha"
                                        />
                                        <ClockPicker
                                          value={editCheckInTime}
                                          onChange={(val) => setEditCheckInTime(val)}
                                          label="Hora"
                                        />
                                      </div>
                                    </div>

                                    {/* Salida Column */}
                                    <div className="flex flex-col gap-2 bg-black/20 p-3 rounded-2xl border border-white/5">
                                      <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider block mb-1">🚪 Salida (Chile)</span>
                                      <div className="grid grid-cols-2 gap-2">
                                        <DatePicker
                                          value={editCheckOutDate}
                                          onChange={(val) => setEditCheckOutDate(val)}
                                          label="Fecha"
                                        />
                                        <ClockPicker
                                          value={editCheckOutTime}
                                          onChange={(val) => setEditCheckOutTime(val)}
                                          label="Hora"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Motivo del Ajuste (Obligatorio)</label>
                                    <input
                                      type="text"
                                      placeholder="Ej: Olvidó marcar salida al finalizar el evento"
                                      value={editNotes}
                                      onChange={(e) => setEditNotes(e.target.value)}
                                      className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium w-full"
                                    />
                                  </div>
                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      onClick={() => setEditingStaffId(null)}
                                      className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-semibold text-gray-300 transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleSaveCorrection(s.id, s.assignment_id)}
                                      disabled={isSavingCorrection}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-gray-900 hover:bg-emerald-400 rounded-lg text-xs font-bold transition-all shadow-md"
                                    >
                                      {isSavingCorrection ? (
                                        <span className="w-3.5 h-3.5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <><Save className="w-3.5 h-3.5" /> Guardar</>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                 (() => {
                                   const isOutOfRange = log && (log.check_in_location_status === 'out_of_range' || log.check_out_location_status === 'out_of_range');
                                   const containerBg = isOutOfRange 
                                     ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.07)]' 
                                     : 'bg-black/20 border-white/5';
                                   return (
                                     <div className={`rounded-xl p-3 border flex flex-wrap justify-between items-center gap-3 transition-all ${containerBg}`}>
                                       {!log ? (
                                         <div className="flex items-center justify-between w-full">
                                           <span className="text-xs font-extrabold text-amber-400/90 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 shadow-inner flex items-center gap-1">
                                             ⚠️ Sin registro de asistencia
                                           </span>
                                           <button
                                             onClick={() => handleQuickConfirm(s.id, s.assignment_id)}
                                             disabled={isSavingCorrection}
                                             className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                                           >
                                             <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                             <span>Confirmar Asistencia</span>
                                           </button>
                                         </div>
                                       ) : (
                                         <>
                                           <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-300">
                                             <div className="flex flex-col gap-0.5">
                                               <span className="text-[9px] text-gray-500 uppercase tracking-wider font-extrabold">Entrada</span>
                                               <span className="font-semibold text-gray-200">📥 {formatChileDateTime(log.check_in_at)}</span>
                                               <div className="mt-1">
                                                 {renderGPSBadge(
                                                   log.check_in_location_status,
                                                   log.check_in_distance_meters,
                                                   log.check_in_accuracy,
                                                   log.check_in_lat,
                                                   log.check_in_lng
                                                 )}
                                               </div>
                                             </div>
                                             <div className="flex flex-col gap-0.5">
                                               <span className="text-[9px] text-gray-500 uppercase tracking-wider font-extrabold">Salida</span>
                                               <span className="font-semibold text-gray-200">
                                                 {log.check_out_at ? `📤 ${formatChileDateTime(log.check_out_at)}` : "En curso ⏳"}
                                               </span>
                                               {log.check_out_at && (
                                                 <div className="mt-1">
                                                   {renderGPSBadge(
                                                     log.check_out_location_status,
                                                     log.check_out_distance_meters,
                                                     log.check_out_accuracy,
                                                     log.check_out_lat,
                                                     log.check_out_lng
                                                   )}
                                                 </div>
                                               )}
                                             </div>
                                           </div>

                                           <div className="flex items-center gap-2">
                                             {log.verified_by_admin && (
                                               <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider cursor-help" title={`Corregido por admin: ${log.admin_adjustment_notes || 'Sin observaciones'}`}>
                                                 ✍️ Corregido
                                               </span>
                                             )}
                                             <span className="text-xs font-extrabold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20 shadow-inner">
                                               {formatDurationMinutes(log.total_duration_minutes)}
                                             </span>
                                           </div>
                                         </>
                                       )}
                                     </div>
                                   );
                                 })()
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-end mt-6 pt-4 border-t border-white/5">
                <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
