import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import GlassCard from "./GlassCard.jsx";
import { sanitizeRut, validateRut, formatRut } from "../utils/validateRut.js";
import Button from "../components/Button.jsx";
import { X } from "lucide-react";

// Validación estricta con Zod
const staffSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres"),
  rut: z.string()
    .min(1, "El RUT es obligatorio")
    .refine((val) => validateRut(val), {
      message: "RUT chileno inválido (ej: 12345678-9)",
    }),
  email: z.string().email("Debe ser un correo electrónico válido"),
  role: z.string().min(2, "El rol es obligatorio"),
  cuenta_origen: z.string().optional(),
  cuenta_destino: z.string().optional(),
  codigo_banco_destino: z.string().optional(),
  monto_transferencia: z.string().optional(),
  glosa_transferencia: z.string().optional(),
  mensaje_beneficiario: z.string().optional(),
});

export default function StaffModal({ isOpen, onClose, onSubmit, initialData = {}, isLoading = false }) {
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(staffSchema),
    defaultValues: {
      name: "",
      rut: "",
      email: "",
      role: "",
      cuenta_origen: "72052242",
      cuenta_destino: "",
      codigo_banco_destino: "",
      monto_transferencia: "",
      glosa_transferencia: "",
      mensaje_beneficiario: "",
    }
  });

  const watchName = watch("name");
  const watchRut = watch("rut");
  const watchEmail = watch("email");
  const watchRole = watch("role");

  const handleRutChange = (e) => {
    const rawVal = e.target.value;
    const formatted = formatRut(rawVal);
    setValue("rut", formatted, { shouldValidate: true });
  };

  // Sync initial data for edit mode or reset on open/close
  useEffect(() => {
    if (isOpen) {
      if (initialData && Object.keys(initialData).length > 0) {
        reset({
          name: initialData.name || "",
          rut: initialData.rut || "",
          email: initialData.email || "",
          role: initialData.role || "",
          cuenta_origen: initialData.cuenta_origen || "72052242",
          cuenta_destino: initialData.cuenta_destino || "",
          codigo_banco_destino: initialData.codigo_banco_destino || "",
          monto_transferencia: initialData.monto_transferencia || "",
          glosa_transferencia: initialData.glosa_transferencia || "",
          mensaje_beneficiario: initialData.mensaje_beneficiario || "",
        });
      } else {
        reset({ name: "", rut: "", email: "", role: "", cuenta_origen: "72052242", cuenta_destino: "", codigo_banco_destino: "", monto_transferencia: "", glosa_transferencia: "", mensaje_beneficiario: "" });
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
            className="relative w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto custom-scrollbar"
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
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-all duration-300 ${
                        errors.name 
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30' 
                          : watchName && watchName.length >= 3
                            ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                      }`}
                    />
                    {errors.name && <span className="text-red-400 text-xs mt-1">{errors.name.message}</span>}
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="rut" className="text-gray-300 mb-1">RUT</label>
                    <input
                      id="rut"
                      placeholder="12345678-9"
                      {...register("rut", {
                        onChange: handleRutChange
                      })}
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-all duration-300 ${
                        errors.rut 
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30' 
                          : watchRut && validateRut(watchRut)
                            ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                      }`}
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
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-all duration-300 ${
                        errors.email 
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30' 
                          : watchEmail && z.string().email().safeParse(watchEmail).success
                            ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                      }`}
                    />
                    {errors.email && <span className="text-red-400 text-xs mt-1">{errors.email.message}</span>}
                  </div>

                  <div className="flex flex-col">
                    <label htmlFor="role" className="text-gray-300 mb-1">Rol</label>
                    <input
                      id="role"
                      placeholder="Ej: Montajista"
                      {...register("role")}
                      className={`w-full bg-gray-800/50 border rounded-xl p-2 text-white placeholder-gray-500 transition-all duration-300 ${
                        errors.role 
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/30' 
                          : watchRole && watchRole.length >= 2
                            ? 'border-emerald-500/50 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30'
                            : 'border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30'
                      }`}
                    />
                    {errors.role && <span className="text-red-400 text-xs mt-1">{errors.role.message}</span>}
                  </div>
                </div>

                <div className="mt-6 border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-semibold text-amber-500 mb-4">Datos Bancarios</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col">
                      <label htmlFor="cuenta_origen" className="text-gray-300 mb-1 text-sm">Cuenta Origen</label>
                      <input id="cuenta_origen" {...register("cuenta_origen")} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white placeholder-gray-500" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="cuenta_destino" className="text-gray-300 mb-1 text-sm">Cuenta Destino</label>
                      <input id="cuenta_destino" {...register("cuenta_destino")} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white placeholder-gray-500" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="codigo_banco_destino" className="text-gray-300 mb-1 text-sm">Código Banco Destino</label>
                      <input id="codigo_banco_destino" {...register("codigo_banco_destino")} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white placeholder-gray-500" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="monto_transferencia" className="text-gray-300 mb-1 text-sm">Monto Transferencia</label>
                      <input id="monto_transferencia" type="number" {...register("monto_transferencia")} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white placeholder-gray-500" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="glosa_transferencia" className="text-gray-300 mb-1 text-sm">Glosa Transferencia</label>
                      <input id="glosa_transferencia" {...register("glosa_transferencia")} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white placeholder-gray-500" />
                    </div>
                    <div className="flex flex-col">
                      <label htmlFor="mensaje_beneficiario" className="text-gray-300 mb-1 text-sm">Mensaje Beneficiario</label>
                      <input id="mensaje_beneficiario" {...register("mensaje_beneficiario")} className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2 text-white placeholder-gray-500" />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>Cancelar</Button>
                  <Button type="submit" variant="primary" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {initialData.id ? "Guardando..." : "Creando..."}
                      </span>
                    ) : (
                      initialData.id ? "Actualizar" : "Crear"
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
