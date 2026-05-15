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
    if (isOpen && event?.id) {
      // Fetch the staff assigned to this event
      supabase
        .from('event_assignments')
        .select(`
          staff_id,
          profiles (name, role)
        `)
        .eq('event_id', event.id)
        .then(({ data }) => {
          if (data) {
            setAssigned(data.map(d => d.profiles));
          }
        });
    }
  }, [isOpen, event]);

  if (!event) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-2xl mx-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassCard className="p-6 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold mb-4 text-white">Detalle del Evento</h2>
              <div className="space-y-3 text-gray-200">
                <p><strong>Nombre:</strong> {event.name}</p>
                <p><strong>Cliente:</strong> {event.client}</p>
                <p><strong>Fecha:</strong> {event.date}</p>
                <p><strong>Hora:</strong> {event.time}</p>
                <p><strong>Ubicación:</strong> {event.location}</p>
                <p><strong>Descripción:</strong> {event.description}</p>
                <p><strong>Estado:</strong> {event.status}</p>
                <p><strong>Staff asignado:</strong> {assigned.length ? assigned.map(s => `${s.name} (${s.role})`).join(", ") : "Ninguno"}</p>
              </div>
              <div className="flex justify-end mt-4">
                <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
              </div>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
