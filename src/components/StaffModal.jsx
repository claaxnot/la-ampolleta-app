import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { X } from "lucide-react";

// Validación estricta con Zod
const staffSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  rut: z.string().regex(/^[0-9\.]+-[0-9kK]{1}$/, "Formato de RUT inválido (ej: 12345678-9)"),
  email: z.string().email("Debe ser un correo electrónico válido"),
  role: z.string().min(2, "El rol es obligatorio"),
});

export default function StaffModal({ isOpen, onClose, onSubmit, initialData = {} }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      rut: "",
      email: "",
      role: "",
    }
  });

  // Sync initial data for edit mode or reset on open/close
  useEffect(() => {
    if (isOpen) {
      if (initialData && Object.keys(initialData).length > 0) {
        reset({
          name: initialData.name || "",
          rut: initialData.rut || "",
          email: initialData.email || "",
          role: initialData.role || "",
        });
      } else {
        reset({ name: "", rut: "", email: "", role: "" });
      }
    }
  }, [initialData, isOpen, reset]);

  const onSubmitForm = (data) => {
    const staffData = { ...data };
    if (initialData.id) staffData.id = initialData.id;
    onSubmit(staffData);
    onClose();
  };

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
            className="relative w-full max-w-lg mx-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <GlassCard className="p-6 relative">
              <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold mb-4 text-white">
                {initialData.id ? "Editar Staff" : "Añadir Staff"}
              </h2>

              <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <label htmlFor="name" className="text-gray-300 mb-1">Nombre</label>
                    <input
                      id="name"
                      placeholder="Ej: Juan Perez"
                      {...register("name")}
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-colors ${errors.name ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-700'}`}
                    />
                    {errors.name && <span className="text-red-400 text-xs mt-1">{errors.name.message}</span>}
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="rut" className="text-gray-300 mb-1">RUT</label>
                    <input
                      id="rut"
                      placeholder="12345678-9"
                      {...register("rut")}
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-colors ${errors.rut ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-700'}`}
                    />
                    {errors.rut && <span className="text-red-400 text-xs mt-1">{errors.rut.message}</span>}
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="email" className="text-gray-300 mb-1">Correo</label>
                    <input
                      id="email"
                      type="email"
                      placeholder="correo@ejemplo.com"
                      {...register("email")}
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-colors ${errors.email ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-700'}`}
                    />
                    {errors.email && <span className="text-red-400 text-xs mt-1">{errors.email.message}</span>}
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="role" className="text-gray-300 mb-1">Rol</label>
                    <input
                      id="role"
                      placeholder="Ej: Montajista"
                      {...register("role")}
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-colors ${errors.role ? 'border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500' : 'border-gray-700'}`}
                    />
                    {errors.role && <span className="text-red-400 text-xs mt-1">{errors.role.message}</span>}
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
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
