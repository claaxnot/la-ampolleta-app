import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { X, Clock, Edit, Save, AlertTriangle } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { toast } from "react-hot-toast";

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
  const [editCheckIn, setEditCheckIn] = React.useState("");
  const [editCheckOut, setEditCheckOut] = React.useState("");
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

  const fetchAssignedStaff = async () => {
    if (!event?.id) return;
    
    const { data: assignmentsData } = await supabase
      .from('event_assignments')
      .select(`
        id,
        staff_id,
        status,
        profiles (name, role)
      `)
      .eq('event_id', event.id);
    
    if (assignmentsData) {
      setAssigned(assignmentsData.map(d => ({
        assignment_id: d.id,
        id: d.staff_id,
        status: d.status,
        name: d.profiles?.name || 'Desconocido',
        role: d.profiles?.role || ''
      })));
    }

    // Fetch attendance logs for this event
    const { data: attendanceData } = await supabase
      .from('event_attendance_logs')
      .select('*')
      .eq('event_id', event.id);
    
    if (attendanceData) {
      const attMap = {};
      attendanceData.forEach(log => {
        attMap[log.worker_id] = log;
      });
      setAttendance(attMap);
    }
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
      setEditCheckIn(toDatetimeLocalString(log.check_in_at));
      setEditCheckOut(toDatetimeLocalString(log.check_out_at));
      setEditNotes(log.admin_adjustment_notes || "");
    } else {
      const evDate = event.date || new Date().toISOString().split("T")[0];
      setEditCheckIn(`${evDate}T09:00`);
      setEditCheckOut(`${evDate}T18:00`);
      setEditNotes("");
    }
  };

  const handleSaveCorrection = async (staffId, assignmentId) => {
    if (!editNotes.trim()) {
      toast.error("Por favor, ingresa el motivo de la corrección.");
      return;
    }

    if (!editCheckIn) {
      toast.error("La hora de entrada es obligatoria.");
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

      const checkInISO = new Date(editCheckIn).toISOString();
      const checkOutISO = editCheckOut ? new Date(editCheckOut).toISOString() : null;

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
      setEditCheckIn("");
      setEditCheckOut("");
      
      await fetchAssignedStaff();
    } catch (err) {
      console.error("Error saving attendance correction:", err);
      toast.error(err.message || "Error al guardar los cambios.");
    } finally {
      setIsSavingCorrection(false);
    }
  };

  if (!event) return null;

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
              <div className="space-y-4 text-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p><strong>Nombre:</strong> {event.name}</p>
                  <p><strong>Cliente:</strong> {event.client}</p>
                  <p><strong>Fecha:</strong> {event.date ? event.date.split('-').reverse().join('/') : ''}</p>
                  <p><strong>Hora:</strong> {event.time}</p>
                  <p><strong>Ubicación:</strong> {event.location}</p>
                  <p><strong>Estado:</strong> {event.status}</p>
                </div>
                {event.description && (
                  <p><strong>Descripción:</strong> {event.description}</p>
                )}                {/* Staff Asignado con estados visuales detallados y módulo de asistencia */}
                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                  <strong className="text-sm text-gray-100 mb-1">
                    {event.attendance_control_enabled ? "Auditoría de Asistencia y Personal:" : "Staff asignado y confirmación:"}
                  </strong>
                  {assigned.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">Ningún trabajador asignado a este evento.</span>
                  ) : event.attendance_control_enabled ? (
                    // Vista detallada de Auditoría de Asistencia
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Hora de Entrada (Chile)</label>
                                    <input
                                      type="datetime-local"
                                      value={editCheckIn}
                                      onChange={(e) => setEditCheckIn(e.target.value)}
                                      className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <label className="text-[10px] text-gray-400 font-extrabold uppercase tracking-wider">Hora de Salida (Chile)</label>
                                    <input
                                      type="datetime-local"
                                      value={editCheckOut}
                                      onChange={(e) => setEditCheckOut(e.target.value)}
                                      className="bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all font-medium [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-70 [&::-webkit-calendar-picker-indicator]:hover:opacity-100 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                                    />
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
                              // Estado de asistencia actual
                              <div className="bg-black/20 rounded-xl p-3 border border-white/5 flex flex-wrap justify-between items-center gap-3">
                                {!log ? (
                                  <span className="text-xs text-gray-500 italic">No ha registrado entrada / salida</span>
                                ) : (
                                  <>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-gray-300">
                                      <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-extrabold">Entrada</span>
                                        <span className="font-semibold text-gray-200">📥 {formatChileDateTime(log.check_in_at)}</span>
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-extrabold">Salida</span>
                                        <span className="font-semibold text-gray-200">
                                          {log.check_out_at ? `📤 ${formatChileDateTime(log.check_out_at)}` : "En curso ⏳"}
                                        </span>
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
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    // Vista simple original
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {assigned.map(s => {
                        let badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        let statusIcon = "⏳";
                        let statusLabel = "Pendiente";
                        
                        if (s.status === "Confirmado" || s.status === "Aceptado") {
                          badgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                          statusIcon = "✅";
                          statusLabel = "Confirmado";
                        } else if (s.status === "Rechazado") {
                          badgeStyle = "bg-red-500/10 text-red-400 border-red-500/20";
                          statusIcon = "❌";
                          statusLabel = "Rechazado";
                        }
                        
                        return (
                          <div key={s.id} className="flex items-center justify-between p-3 rounded-2xl bg-black/20 border border-white/5 text-xs">
                            <span className="font-semibold text-gray-100 truncate pr-2">
                              {s.name} <span className="text-[10px] text-gray-500 font-normal block capitalize">{s.role}</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded-full border text-[9px] font-extrabold flex items-center gap-1.5 shrink-0 ${badgeStyle}`}>
                              <span>{statusIcon}</span>
                              <span>{statusLabel}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
