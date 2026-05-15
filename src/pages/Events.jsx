import React, { useState } from "react";
import { mockStaff } from "../data.js";
import { supabase } from "../lib/supabase.js";
import EventToolbar from "../components/EventToolbar.jsx";
import EventModal from "../components/EventModal.jsx";
import EventDetails from "../components/EventDetails.jsx";
import GlassCard from "../components/GlassCard.jsx";

export default function Events() {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const handleSearch = (term) => setSearch(term);
  const handleFilter = (status) => setFilter(status);

  const openModal = (event = null) => {
    setEditingEvent(event);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  React.useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase.from('events').select('*').order('date', { ascending: true });
    if (data) setEvents(data);
    setIsLoading(false);
  };

  const handleSubmit = async (eventData) => {
    const staffIds = eventData.staffIds || [];
    delete eventData.staffIds;
    delete eventData.assignedStaff;

    // Map camelCase to snake_case for Supabase
    eventData.required_staff = eventData.requiredStaff;
    delete eventData.requiredStaff;

    let eventId = eventData.id;

    if (eventId) {
      // Update Event
      const { error } = await supabase.from('events').update(eventData).eq('id', eventId);
      if (!error) {
        // Clear old assignments
        await supabase.from('event_assignments').delete().eq('event_id', eventId);
      }
    } else {
      // Insert new Event
      const { data, error } = await supabase.from('events').insert([eventData]).select();
      if (!error && data && data.length > 0) {
        eventId = data[0].id;
      }
    }

    // Insert new assignments
    if (eventId && staffIds.length > 0) {
      const assignments = staffIds.map(id => ({ event_id: eventId, staff_id: id }));
      await supabase.from('event_assignments').insert(assignments);
    }

    fetchEvents();
    closeModal();
  };

  const openDetails = (event) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };
  const closeDetails = () => setDetailsOpen(false);

  const handleDelete = async (id) => {
    if (window.confirm("¿Estás seguro de que deseas eliminar este evento?")) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (!error) fetchEvents();
    }
  };

  const filteredEvents = events.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter ? e.status.toLowerCase() === filter : true;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case "confirmado":
      case "active":
      case "activo":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";
      case "completado":
        return "bg-gray-500/20 text-gray-400 border-gray-500/30";
      case "planned":
      case "planificado":
      case "pendiente":
      default:
        return "bg-amber-500/20 text-amber-300 border-amber-500/30";
    }
  };

  return (
    <div className="p-8 min-h-screen text-white relative">
      <EventToolbar onSearch={handleSearch} onFilter={handleFilter} onAdd={() => openModal()} />
      <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] relative z-10 mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-900/50 text-gray-400 text-sm font-semibold tracking-wider">
                <th className="p-4 pl-6">Nombre</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Fecha & Hora</th>
                <th className="p-4">Ubicación</th>
                <th className="p-4">Estado</th>
                <th className="p-4">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50 text-gray-200">
              {filteredEvents.map((event) => (
                <tr key={event.id} className="hover:bg-gray-700/20 transition-colors group">
                  <td className="p-4 pl-6">
                    <p className="font-semibold text-white group-hover:text-accent transition-colors" onClick={() => openDetails(event)}>{event.name}</p>
                  </td>
                  <td className="p-4 font-medium text-gray-300">{event.client}</td>
                  <td className="p-4">
                    <p className="text-sm">{event.date}</p>
                    <p className="text-xs text-gray-500">{event.time}</p>
                  </td>
                  <td className="p-4 text-sm text-gray-300">{event.location}</td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(event.status)}`}>{event.status}</span>
                  </td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => openModal(event)} className="text-primary hover:text-white transition-colors">Editar</button>
                    <button onClick={() => handleDelete(event.id)} className="text-red-500 hover:text-red-300 transition-colors">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && (
        <EventModal
          isOpen={isModalOpen}
          onClose={closeModal}
          onSubmit={handleSubmit}
          initialData={editingEvent || {
            name: "",
            client: "",
            date: "",
            time: "",
            location: "",
            description: "",
            status: "planned",
            assignedStaff: []
          }}
        />
      )}
      {detailsOpen && selectedEvent && (
        <EventDetails event={selectedEvent} isOpen={detailsOpen} onClose={closeDetails} />
      )}
    </div>
  );
}