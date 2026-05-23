import React from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import Button from '../components/Button.jsx';

/**
 * EventCard – displays a single event in the table view with actions.
 * Props:
 *   event: object
 *   onEdit: (event) => void
 *   onDelete: (eventId) => void
 *   onView: (event) => void
 */
export default function EventCard({ event, onEdit, onDelete, onView }) {
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
      case "planned":
      case "planificado":
      case "pendiente":
      case "en progreso":
      default:
        return "bg-amber-500/10 text-amber-400 border-amber-500/20";
    }
  };

  return (
    <motion.tr
      className="group hover:bg-gray-700/20 transition-colors"
      whileHover={{ scale: 1.005 }}
      layout
    >
      <td className="p-4 pl-6 cursor-pointer" onClick={() => onView(event)}>
        <p className="font-semibold text-white group-hover:text-accent transition-colors">
          {event.name}
        </p>
        <p className="text-xs text-gray-500 truncate max-w-[200px]">
          {event.description}
        </p>
      </td>
      <td className="p-4 font-medium text-gray-300">{event.client}</td>
      <td className="p-4">
        <p className="text-sm">{event.date}</p>
        <p className="text-xs text-gray-500">{event.time}</p>
      </td>
      <td className="p-4 text-sm text-gray-300">{event.location}</td>
      <td className="p-4">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(event.status)}`}
        >
          {event.status}
        </span>
      </td>
      <td className="p-4 flex space-x-2">
        <Button variant="secondary" size="sm" onClick={() => onEdit(event)}>
          <Pencil className="w-4 h-4" />
        </Button>
        <Button variant="danger" size="sm" onClick={() => onDelete(event.id)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </td>
    </motion.tr>
  );
}
