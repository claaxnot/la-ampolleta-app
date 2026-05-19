import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase.js";

/**
 * EventDetails – shows full information for a selected event.
 * Props:
 *   event: object – the event data to display
 *   isOpen: boolean – controls visibility
 *   onClose: () => void – close handler
 */
export default function EventDetails({ event, isOpen, onClose }) {
  const [assigned, setAssigned] = React.useState([]);

  React.useEffect(() => {
    if (!isOpen || !event?.id) return;

    const fetchAssignedStaff = async () => {
      const { data } = await supabase
        .from('event_assignments')
        .select(`
          staff_id,
          status,
          profiles (name, role)
        `)
        .eq('event_id', event.id);
      
      if (data) {
        setAssigned(data.map(d => ({
          id: d.staff_id,
          status: d.status,
          name: d.profiles?.name || 'Desconocido',
          role: d.profiles?.role || ''
        })));
      }
    };

    fetchAssignedStaff();

    // Suscribirse a cambios de asignaciones para este evento en tiempo real
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
          console.log("🔔 [REALTIME EVENT DETAILS] - Cambio de estado de asignación detectado. Actualizando...");
          fetchAssignedStaff();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, event]);

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
                )}
                
                {/* Staff Asignado con estados visuales detallados */}
                <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
                  <strong className="text-sm text-gray-100 mb-1">Staff asignado y confirmación:</strong>
                  {assigned.length === 0 ? (
                    <span className="text-xs text-gray-400 italic">Ningún trabajador asignado a este evento.</span>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {assigned.map(s => {
                        let badgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        let statusIcon = "⏳";
                        let statusLabel = "Pendiente";
                        
                        if (s.status === "Confirmado") {
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
