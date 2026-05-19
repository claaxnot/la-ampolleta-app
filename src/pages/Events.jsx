import React, { useState } from "react";
import { supabase } from "../lib/supabase.js";
import EventToolbar from "../components/EventToolbar.jsx";
import EventModal from "../components/EventModal.jsx";
import EventDetails from "../components/EventDetails.jsx";
import GlassCard from "../components/GlassCard.jsx";
import { permissions } from "../lib/permissions.js";
import { toast } from "react-hot-toast";
import { Copy } from "lucide-react";

export default function Events({ user }) {
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [isModalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  
  const currentYearStr = String(new Date().getFullYear());
  const currentMonthStr = String(new Date().getMonth() + 1).padStart(2, '0');

  const [selectedYear, setSelectedYear] = useState(currentYearStr);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const handleSearch = (term) => setSearch(term);
  const handleFilter = (status) => setFilter(status);

  const rolePermissions = permissions[user?.systemRole] || permissions.viewer;

  const openModal = (event = null, isDuplicate = false) => {
    if (event) {
      if (isDuplicate) {
        if (!rolePermissions.canCreate) return;
        setEditingEvent({
          ...event,
          id: undefined,
          name: `${event.name} (Copia)`,
          isDuplicate: true,
          duplicateFromId: event.id
        });
      } else {
        if (!rolePermissions.canEdit) return;
        setEditingEvent(event);
      }
    } else {
      if (!rolePermissions.canCreate) return;
      setEditingEvent(null);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingEvent(null);
  };

  const fetchEvents = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: true });
    if (data) setEvents(data);
    setIsLoading(false);
  };

  React.useEffect(() => {
    fetchEvents();
  }, []);

  const handleSubmit = async (eventData) => {
    if (eventData.id && !rolePermissions.canEdit) {
      toast.error("No tienes permisos para editar eventos");
      throw new Error("No edit permissions");
    }
    if (!eventData.id && !rolePermissions.canCreate) {
      toast.error("No tienes permisos para crear eventos");
      throw new Error("No create permissions");
    }

    const staffIds = eventData.staffIds || [];
    delete eventData.staffIds;
    delete eventData.assignedStaff;

    const customRates = eventData.customRates || {};
    delete eventData.customRates;

    // Extraer y borrar bandera del panel avanzado
    const isAdvancedActive = eventData.isAdvancedActive;
    delete eventData.isAdvancedActive;

    // Map camelCase to snake_case for Supabase
    eventData.required_staff = eventData.requiredStaff;
    delete eventData.requiredStaff;

    // 1. Normalizar campos operacionales avanzados
    const advancedFields = ['supervisor_id', 'call_time', 'setup_time', 'end_time', 'priority', 'operational_notes'];
    
    if (isAdvancedActive === false) {
      console.log("ℹ️ Panel avanzado desactivado. Forzando campos avanzados a NULL.");
      advancedFields.forEach(field => {
        eventData[field] = null;
      });
    } else {
      console.log("ℹ️ Panel avanzado activo. Normalizando campos avanzados.");
      advancedFields.forEach(field => {
        const val = eventData[field];
        if (val === "" || val === undefined || val === null || (typeof val === 'number' && Number.isNaN(val))) {
          eventData[field] = null;
        }
      });
    }

    // 2. Normalizar campos generales de texto y número
    const generalTextFields = ['description', 'client', 'location', 'name'];
    generalTextFields.forEach(field => {
      const val = eventData[field];
      if (val === "" || val === undefined || val === null) {
        eventData[field] = null;
      }
    });

    if (eventData.required_staff === undefined || eventData.required_staff === null || Number.isNaN(eventData.required_staff)) {
      eventData.required_staff = 1;
    }

    eventData.operational_info_pending = !!eventData.operational_info_pending;

    let eventId = eventData.id;
    console.log("4️⃣ [INSERTING EVENT] - Iniciando transacción en Supabase con payload normalizado:", eventData);

    try {
      if (eventId) {
        // Update Event
        const { error } = await supabase.from('events').update(eventData).eq('id', eventId);
        console.log("5️⃣ [UPDATE RESPONSE] - Error de actualización:", error);
        if (error) throw error;
        
        // Clear old assignments
        const { error: deleteError } = await supabase.from('event_assignments').delete().eq('event_id', eventId);
        if (deleteError) throw deleteError;
      } else {
        // Insert new Event
        const { data, error } = await supabase.from('events').insert([eventData]).select();
        console.log("5️⃣ [INSERT RESPONSE] - Datos recibidos:", data, "Error:", error);
        if (error) throw error;
        if (data && data.length > 0) {
          eventId = data[0].id;
        }
      }

      // Insert new assignments with optional custom rates
      if (eventId && staffIds.length > 0) {
        const assignments = staffIds.map(id => {
          const rateVal = customRates[id] ? parseFloat(customRates[id]) : null;
          return { 
            event_id: eventId, 
            staff_id: id,
            custom_rate: rateVal && !Number.isNaN(rateVal) ? rateVal : null
          };
        });
        const { error: assignError } = await supabase.from('event_assignments').insert(assignments);
        if (assignError) throw assignError;
        
        // Crear notificaciones físicas para los trabajadores asignados
        try {
          const notificationsPayload = staffIds.map(id => ({
            user_id: id,
            title: "📅 Nueva Asignación de Evento",
            description: `Has sido asignado para el evento "${eventData.name || 'Producción'}" el ${eventData.date || ''}.`,
            type: "info"
          }));
          await supabase.from('notifications').insert(notificationsPayload);
        } catch (err) {
          console.warn("⚠️ [NOTIFICATIONS TABLE]: La tabla notifications no existe aún en BD.");
        }
      }

      toast.success(eventData.id ? "¡Evento actualizado con éxito!" : "¡Evento creado con éxito!");
      fetchEvents();
      closeModal();
    } catch (dbError) {
      console.error("❌ SUPABASE TRANSACTION FAILED:", dbError);
      toast.error(`Error en base de datos: ${dbError.message || "Operación fallida"}`);
      throw dbError;
    }
  };

  const openDetails = (event) => {
    setSelectedEvent(event);
    setDetailsOpen(true);
  };
  const closeDetails = () => setDetailsOpen(false);

  const handleDelete = async (id) => {
    if (!rolePermissions.canDelete) return;
    if (window.confirm("¿Estás seguro de que deseas eliminar este evento?")) {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (!error) fetchEvents();
    }
  };

  // 1. Obtener lista inteligente de AÑOS que tienen eventos (+ el año actual por defecto)
  const yearsWithEvents = [...new Set(events.map(e => e.date ? e.date.substring(0, 4) : ""))].filter(Boolean);
  if (!yearsWithEvents.includes(currentYearStr)) {
    yearsWithEvents.push(currentYearStr);
  }
  yearsWithEvents.sort((a, b) => b - a); // Mostrar años más recientes primero

  // 2. Obtener lista inteligente de MESES que tienen eventos en el año seleccionado
  const eventsForYear = selectedYear === 'all'
    ? events
    : events.filter(e => e.date && e.date.startsWith(selectedYear));
    
  const monthsWithEvents = [...new Set(eventsForYear.map(e => e.date ? e.date.substring(5, 7) : ""))].filter(Boolean);
  
  // Asegurar que el mes actual sea seleccionable si estamos en el año actual
  if (selectedYear === currentYearStr && !monthsWithEvents.includes(currentMonthStr)) {
    monthsWithEvents.push(currentMonthStr);
  }
  monthsWithEvents.sort();

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const monthOptions = monthsWithEvents.map(m => ({
    value: m,
    label: monthNames[parseInt(m) - 1]
  }));

  const filteredEvents = events.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter ? e.status.toLowerCase() === filter : true;
    
    // Filtro por Año
    let matchesYear = true;
    if (selectedYear && selectedYear !== 'all') {
      matchesYear = e.date && e.date.startsWith(selectedYear);
    }
    
    // Filtro por Mes
    let matchesMonth = true;
    if (selectedMonth && selectedMonth !== 'all') {
      matchesMonth = e.date && e.date.substring(5, 7) === selectedMonth;
    }
    
    return matchesSearch && matchesFilter && matchesYear && matchesMonth;
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
      <EventToolbar 
        onSearch={handleSearch} 
        onFilter={handleFilter} 
        onAdd={() => openModal()} 
        canCreate={rolePermissions.canCreate} 
        selectedYear={selectedYear}
        onYearChange={setSelectedYear}
        yearOptions={yearsWithEvents}
        selectedMonth={selectedMonth} 
        onMonthChange={setSelectedMonth} 
        monthOptions={monthOptions}
      />
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
                  <td className="p-4 flex items-center gap-3">
                    <button 
                      onClick={() => openModal(event)} 
                      className={`transition-colors ${!rolePermissions.canEdit ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-primary hover:text-white font-medium text-sm'}`}
                      title={!rolePermissions.canEdit ? "Disponible solo para administradores" : "Editar evento"}
                      disabled={!rolePermissions.canEdit}
                    >
                      Editar
                    </button>
                    <button 
                      onClick={() => openModal(event, true)} 
                      className={`transition-colors flex items-center gap-1 ${!rolePermissions.canCreate ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-emerald-400 hover:text-emerald-300 font-medium text-sm'}`}
                      title={!rolePermissions.canCreate ? "Disponible solo para administradores" : "Duplicar este evento"}
                      disabled={!rolePermissions.canCreate}
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplicar</span>
                    </button>
                    <button 
                      onClick={() => handleDelete(event.id)} 
                      className={`transition-colors ${!rolePermissions.canDelete ? 'opacity-50 cursor-not-allowed text-gray-500' : 'text-red-500 hover:text-red-300 font-medium text-sm'}`}
                      title={!rolePermissions.canDelete ? "Disponible solo para administradores" : "Eliminar evento"}
                      disabled={!rolePermissions.canDelete}
                    >
                      Eliminar
                    </button>
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
            status: "Planificado",
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