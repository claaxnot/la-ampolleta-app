import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { X, Search, Filter } from "lucide-react";
import { supabase } from "../lib/supabase.js";

// Zod Schema para validaciones estrictas del evento
const eventSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  client: z.string().min(2, "El nombre del cliente es obligatorio"),
  date: z.string().min(1, "Selecciona una fecha"),
  time: z.string().min(1, "Ingresa una hora válida"),
  location: z.string().min(3, "La ubicación es obligatoria"),
  requiredStaff: z.coerce.number().min(1, "Debe requerir al menos 1 persona"),
  description: z.string().optional(),
  status: z.enum(["Planificado", "Confirmado", "Activo", "Completado"]),
  staffIds: z.array(z.string()),
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
    }
  });

  const selectedStaffIds = watch("staffIds");

  const [staffSearch, setStaffSearch] = useState("");
  const [staffRole, setStaffRole] = useState("");
  const [dbStaff, setDbStaff] = useState([]);

  useEffect(() => {
    const fetchStaff = async () => {
      const { data } = await supabase.from('profiles').select('*').eq('status', 'Activo').neq('email', 'admin@laampolleta.tv');
      if (data) setDbStaff(data);
    };
    fetchStaff();
  }, []);

  const activeStaff = dbStaff;
  const uniqueRoles = [...new Set(activeStaff.map(s => s.role?.toLowerCase() || ''))].filter(Boolean);
  
  const filteredStaff = activeStaff.filter(s => {
    const matchesSearch = s.name?.toLowerCase().includes(staffSearch.toLowerCase());
    const matchesRole = staffRole === "" ? true : s.role?.toLowerCase() === staffRole;
    return matchesSearch && matchesRole;
  });

  // Sync initial data for edit mode or reset when opening
  useEffect(() => {
    if (isOpen) {
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
          staffIds: [], // We fetch them below
        });
        
        // Fetch assigned staff for this event
        if (initialData.id) {
          supabase.from('event_assignments').select('staff_id').eq('event_id', initialData.id).then(({ data }) => {
            if (data) {
              setValue("staffIds", data.map(a => a.staff_id));
            }
          });
        }
      } else {
        reset({
          name: "", client: "", date: "", time: "", location: "",
          requiredStaff: 1, description: "", status: "Planificado", staffIds: []
        });
      }
    }
  }, [initialData, isOpen, reset, setValue]);

  const onSubmitForm = (data) => {
    const eventData = { ...data };
    if (initialData.id) eventData.id = initialData.id;
    // Pasa los staffIds a la función padre para procesar la asignación
    eventData.staffIds = data.staffIds || [];
    
    onSubmit(eventData);
    onClose();
  };

  const toggleStaff = (id) => {
    const current = selectedStaffIds || [];
    if (current.includes(id)) {
      setValue("staffIds", current.filter(sId => sId !== id), { shouldDirty: true });
    } else {
      setValue("staffIds", [...current, id], { shouldDirty: true });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur overflow-y-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="relative w-full max-w-2xl mx-4 my-8"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassCard className="p-6 relative">
              <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold mb-6 text-white">
                {initialData.id ? "Editar Evento" : "Crear Nuevo Evento"}
              </h2>
              
              <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label className="text-gray-300 mb-1" htmlFor="name">Nombre del Evento</label>
                    <input 
                      id="name" 
                      placeholder="Ej: Concierto..." 
                      {...register("name")} 
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 ${errors.name ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`} 
                    />
                    {errors.name && <span className="text-red-400 text-xs mt-1">{errors.name.message}</span>}
                  </div>
                  
                  <div className="flex flex-col">
                    <label className="text-gray-300 mb-1" htmlFor="client">Cliente</label>
                    <input 
                      id="client" 
                      placeholder="Empresa o Persona" 
                      {...register("client")} 
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 ${errors.client ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`} 
                    />
                    {errors.client && <span className="text-red-400 text-xs mt-1">{errors.client.message}</span>}
                  </div>
                  
                  <div className="flex flex-col">
                    <label className="text-gray-300 mb-1" htmlFor="date">Fecha</label>
                    <input 
                      id="date" 
                      type="date" 
                      {...register("date")} 
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white ${errors.date ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`} 
                    />
                    {errors.date && <span className="text-red-400 text-xs mt-1">{errors.date.message}</span>}
                  </div>
                  
                  <div className="flex flex-col">
                    <label className="text-gray-300 mb-1" htmlFor="time">Hora</label>
                    <input 
                      id="time" 
                      type="time" 
                      {...register("time")} 
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white ${errors.time ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`} 
                    />
                    {errors.time && <span className="text-red-400 text-xs mt-1">{errors.time.message}</span>}
                  </div>
                  
                  <div className="flex flex-col">
                    <label className="text-gray-300 mb-1" htmlFor="location">Ubicación</label>
                    <input 
                      id="location" 
                      placeholder="Dirección del evento" 
                      {...register("location")} 
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 ${errors.location ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`} 
                    />
                    {errors.location && <span className="text-red-400 text-xs mt-1">{errors.location.message}</span>}
                  </div>
                  
                  <div className="flex flex-col">
                    <label className="text-gray-300 mb-1" htmlFor="requiredStaff">Staff requerido</label>
                    <input 
                      id="requiredStaff" 
                      type="number" 
                      min="1" 
                      {...register("requiredStaff")} 
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white ${errors.requiredStaff ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`} 
                    />
                    {errors.requiredStaff && <span className="text-red-400 text-xs mt-1">{errors.requiredStaff.message}</span>}
                  </div>
                </div>
                
                <div className="flex flex-col">
                  <label className="text-gray-300 mb-1" htmlFor="description">Descripción</label>
                  <textarea 
                    id="description" 
                    placeholder="Detalles adicionales..." 
                    {...register("description")} 
                    className="w-full h-24 bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white placeholder-gray-500" 
                  />
                </div>
                
                <div className="flex items-center space-x-4">
                  <label className="text-gray-300" htmlFor="status">Estado:</label>
                  <select 
                    id="status" 
                    {...register("status")} 
                    className="bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white focus:ring-1 focus:ring-primary"
                  >
                    <option value="Planificado">Planificado</option>
                    <option value="Confirmado">Confirmado</option>
                    <option value="Activo">Activo</option>
                    <option value="Completado">Completado</option>
                  </select>
                </div>
                
                {/* Staff assignment */}
                <div>
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2 gap-2">
                    <label className="text-gray-300">Asignar Staff:</label>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto">
                      <div className="relative flex-1 md:flex-initial">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                          type="text" 
                          placeholder="Buscar nombre..." 
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          className="w-full pl-8 pr-2 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
                        />
                      </div>
                      <div className="relative flex-1 md:flex-initial">
                        <Filter className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <select 
                          value={staffRole}
                          onChange={(e) => setStaffRole(e.target.value)}
                          className="w-full pl-8 pr-6 py-1.5 bg-gray-800/80 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-primary/50 appearance-none capitalize"
                        >
                          <option value="">Todos los roles</option>
                          {uniqueRoles.map(role => (
                            <option key={role} value={role} className="capitalize">{role}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-black/20 p-3 rounded-xl border border-white/5 max-h-48 overflow-y-auto">
                    {filteredStaff.length === 0 ? (
                      <p className="text-gray-400 text-sm col-span-2 text-center py-4">No hay staff que coincida con la búsqueda.</p>
                    ) : (
                      filteredStaff.map((staff) => {
                        const isChecked = selectedStaffIds.includes(staff.id);
                        return (
                          <label key={staff.id} className="flex items-center space-x-3 text-gray-200 cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-colors">
                            <input 
                              type="checkbox" 
                              checked={isChecked}
                              onChange={() => toggleStaff(staff.id)}
                              className="form-checkbox h-4 w-4 text-primary bg-gray-700 border-gray-600 rounded" 
                            />
                            <span className="flex items-center gap-2">
                              <img src={staff.avatar || "https://ui-avatars.com/api/?name=" + staff.name} alt="" className="w-6 h-6 rounded-full" />
                              <span className="truncate max-w-[120px]">{staff.name}</span>
                              <span className="text-xs text-gray-400 capitalize">({staff.role})</span>
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
                
                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-800">
                  <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
                  <Button type="submit" variant="primary">{initialData.id ? "Actualizar" : "Crear"}</Button>
                </div>
              </form>
            </GlassCard>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}