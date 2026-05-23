import React, { useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.js";
import { User, Settings, Plus, Trash2, Power, Search, Filter, X, Download, Mail } from "lucide-react";
import * as XLSX from "xlsx";
import StaffModal from "../components/StaffModal.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { permissions } from "../lib/permissions.js";
import { toast } from "react-hot-toast";

const translateAuthError = (message) => {
  if (!message) return "Error desconocido";
  let cleanMsg = String(message);
  if (cleanMsg.startsWith("Error en autenticación: ")) {
    cleanMsg = cleanMsg.replace("Error en autenticación: ", "");
  }
  const msg = cleanMsg.toLowerCase();
  
  if (msg.includes("only request this after")) {
    const secondsMatch = msg.match(/\d+/);
    const seconds = secondsMatch ? secondsMatch[0] : "60";
    return `Por seguridad, debes esperar ${seconds} segundos antes de solicitar otro reenvío de correo.`;
  }
  if (msg.includes("email rate limit exceeded")) {
    return "Límite de envío de correos excedido. Por favor, intenta de nuevo más tarde.";
  }
  if (msg.includes("already registered") || msg.includes("already exists")) {
    return "Este correo electrónico ya está registrado.";
  }
  if (msg.includes("invalid login credentials")) {
    return "Credenciales de inicio de sesión no válidas.";
  }
  if (msg.includes("database error saving new user")) {
    return "Error al registrar el staff. Revisa que el RUT no esté duplicado.";
  }
  if (msg.includes("error sending confirmation email")) {
    return "Error al enviar el correo de confirmación. Por favor, revisa la configuración SMTP en tu panel de Supabase.";
  }
  if (msg.includes("rate limit exceeded")) {
    return "Límite de velocidad superado. Por favor, espera un momento.";
  }
  
  return cleanMsg;
};

export default function Staff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resendingEmails, setResendingEmails] = useState({});

  const handleResendEmail = async (email) => {
    setResendingEmails(prev => ({ ...prev, [email]: true }));
    const loadingToast = toast.loading("Reenviando correo de activación...");
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      });
      if (error) throw error;
      toast.success("Correo de activación reenviado correctamente.", { id: loadingToast });
    } catch (err) {
      console.error("Resend error:", err);
      toast.error(translateAuthError(err.message || "Error al reenviar el correo de activación."), { id: loadingToast });
    } finally {
      setResendingEmails(prev => ({ ...prev, [email]: false }));
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  React.useEffect(() => {
    fetchStaff();
  }, []);

  const fetchStaff = async () => {
    setIsLoading(true);
    // Filtrar para que no aparezcan el administrador
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('email', 'admin@laampolleta.tv')
      .order('created_at', { ascending: false });

    if (data) {
      setStaff(data);
    }
    setIsLoading(false);
  };

  const rolePermissions = permissions[user?.systemRole] || permissions.viewer;

  const openAddModal = () => {
    if (!rolePermissions.canCreate) return;
    setEditingStaff(null);
    setIsModalOpen(true);
  };
  const openEditModal = (member) => {
    if (!rolePermissions.canEdit) return;
    setEditingStaff(member);
    setIsModalOpen(true);
  };
  const closeModal = () => setIsModalOpen(false);

  const handleStaffSubmit = async (staffData) => {
    if (staffData.id && !rolePermissions.canEdit) return;
    if (!staffData.id && !rolePermissions.canCreate) return;

    setIsSaving(true);
    const loadingToast = toast.loading(staffData.id ? "Actualizando miembro de staff..." : "Creando cuenta de staff...");

    // Helper para normalizar RUT
    const normalizeRut = (rut) =>
      rut.replace(/\./g, "").trim().toLowerCase();

    const normalizedRut = normalizeRut(staffData.rut || "");

    try {
      if (staffData.id) {
        // Edit mode
        const { error } = await supabase
          .from('profiles')
          .update({
            name: staffData.name,
            rut: normalizedRut,
            role: staffData.role,
            cuenta_origen: staffData.cuenta_origen,
            cuenta_destino: staffData.cuenta_destino,
            codigo_banco_destino: staffData.codigo_banco_destino,
            monto_transferencia: staffData.monto_transferencia,
            glosa_transferencia: staffData.glosa_transferencia,
            mensaje_beneficiario: staffData.mensaje_beneficiario
          })
          .eq('id', staffData.id);

        if (error) throw error;

        toast.success("Staff actualizado correctamente.", { id: loadingToast });
        fetchStaff();
        closeModal();
      } else {
        // Check duplicates
        const { data: existingRut } = await supabase
          .from('profiles')
          .select('id')
          .eq('rut', normalizedRut)
          .maybeSingle();

        const { data: existingEmail } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', staffData.email)
          .maybeSingle();

        if (existingRut) {
          toast.error("El RUT ya está registrado.", { id: loadingToast });
          setIsSaving(false);
          return;
        }

        if (existingEmail) {
          toast.error("El correo ya está registrado.", { id: loadingToast });
          setIsSaving(false);
          return;
        }

        // Generate password using the exact requested formula (no points, no hyphen, no verifier, no prefix):
        const defaultPassword = normalizedRut.split('-')[0];

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

        const { createClient } = await import('@supabase/supabase-js');
        const tempClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage: {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {}
            }
          }
        });

        const { data: authData, error: authError } = await tempClient.auth.signUp({
          email: staffData.email,
          password: defaultPassword,
        });

        if (authError) {
          throw new Error("Error en autenticación: " + authError.message);
        }

        // Wait 1.5s for the database trigger to create the profile, then update the rest of the fields
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const { error: profileError } = await supabase.from('profiles').update({
          name: staffData.name,
          rut: normalizedRut,
          role: staffData.role,
          cuenta_origen: staffData.cuenta_origen,
          cuenta_destino: staffData.cuenta_destino,
          codigo_banco_destino: staffData.codigo_banco_destino,
          monto_transferencia: staffData.monto_transferencia,
          glosa_transferencia: staffData.glosa_transferencia,
          mensaje_beneficiario: staffData.mensaje_beneficiario
        }).eq('email', staffData.email);

        if (profileError) throw profileError;

        toast.success(
          `Staff creado. Credenciales: Correo: ${staffData.email} | Contraseña: ${defaultPassword}`,
          { id: loadingToast, duration: 8000 }
        );
        fetchStaff();
        closeModal();
      }
    } catch (err) {
      console.error(err);
      toast.error(translateAuthError(err.message || "Error al procesar la operación"), { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!rolePermissions.canDelete) return;
    if (window.confirm("¿Estás seguro de que deseas eliminar a este miembro? (Solo se borrará su perfil, no su cuenta de acceso)")) {
      const { error } = await supabase.from('profiles').delete().eq('id', id);
      if (!error) {
        toast.success("Miembro de staff eliminado.");
        fetchStaff();
      } else {
        toast.error("Error al eliminar: " + error.message);
      }
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    if (!rolePermissions.canEdit) return;
    const newStatus = currentStatus === 'Inactivo' ? 'Activo' : 'Inactivo';
    const { error } = await supabase.from('profiles').update({ status: newStatus }).eq('id', id);
    if (!error) {
      toast.success(`Estado actualizado a ${newStatus}`);
      fetchStaff();
    } else {
      toast.error("Error al cambiar estado: " + error.message);
    }
  };

  const uniqueRoles = [...new Set(staff.map(s => s.role?.toLowerCase() || ''))].filter(Boolean);

  const filteredStaff = staff.filter(member => {
    const matchesSearch =
      (member.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.rut || "").toLowerCase().includes(searchTerm.toLowerCase());

    const matchesRole = roleFilter === "" ? true : (member.role || "").toLowerCase() === roleFilter;

    return matchesSearch && matchesRole;
  });

  const exportToExcel = () => {
    try {
      const dataToExport = filteredStaff.map(member => ({
        "Nombre": member.name,
        "RUT": member.rut,
        "Correo": member.email,
        "Rol": member.role,
        "Cuenta Origen": member.cuenta_origen || "",
        "Moneda Origen": "CLP",
        "Moneda Destino": "CLP",
        "Codigo banco destino": member.codigo_banco_destino || "",
        "Cuenta destino": member.cuenta_destino || "",
        "Glosa personalizada transferencia": member.glosa_transferencia || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Datos Staff");

      // Generar buffer y descargar como Blob de forma ultra compatible
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Datos_Staff.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("¡Excel de Staff descargado con éxito!");
    } catch (error) {
      console.error("Error al exportar Excel de staff:", error);
      toast.error(`Error al generar Excel: ${error.message || "Error desconocido"}`);
    }
  };

  return (
    <>
      <motion.div
        className="p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GlassCard className="p-6 backdrop-blur-sm bg-white/5 border border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between mb-6 gap-4">
            <h2 className="text-2xl font-semibold text-white">Equipo</h2>

            <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, RUT o correo..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 w-full md:w-64"
                />
              </div>

              <div className="relative">
                <Filter className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500/50 appearance-none w-full md:w-48 capitalize"
                >
                  <option value="">Todos los cargos</option>
                  {uniqueRoles.map(role => (
                    <option key={role} value={role}>{role}</option>
                  ))}
                </select>
              </div>

              <Button
                variant="primary"
                className={`flex items-center gap-2 justify-center ${!rolePermissions.canCreate ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={openAddModal}
                title={!rolePermissions.canCreate ? "Disponible solo para administradores" : ""}
              >
                <Plus className="w-4 h-4" /> Añadir Staff
              </Button>
              <Button
                variant="secondary"
                className="flex items-center gap-2 justify-center border-amber-500/50 text-amber-500 hover:bg-amber-500/10"
                onClick={exportToExcel}
              >
                <Download className="w-4 h-4" /> Exportar Excel
              </Button>
            </div>
          </div>
          {filteredStaff.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <User className="w-12 h-12 mx-auto mb-4 text-gray-500" />
              {staff.length === 0 ? "No hay personal registrado." : "Ningún miembro coincide con tu búsqueda."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-800/30">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Nombre</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">RUT</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Correo</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Rol</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Estado</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-300">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filteredStaff.map((member) => {
                    const isConfirmed = !!(member.avatar_url || member.cuenta_destino);
                    return (
                      <tr key={member.id} className="hover:bg-gray-800/30 transition-colors">
                        <td className="px-4 py-2 flex items-center space-x-3 text-gray-100">
                          <div
                            className="w-10 h-10 rounded-full overflow-hidden border border-gray-600 cursor-pointer relative group"
                            onClick={() => setSelectedPhoto(member.avatar_url || "https://ui-avatars.com/api/?name=" + member.name)}
                          >
                            <img src={member.avatar_url || "https://ui-avatars.com/api/?name=" + member.name} alt={member.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Search className="w-4 h-4 text-white" />
                            </div>
                          </div>
                          <span className="font-medium">{member.name}</span>
                        </td>
                        <td className="px-4 py-2 text-gray-300 text-sm">{member.rut || "-"}</td>
                        <td className="px-4 py-2 text-gray-300 text-sm">{member.email || "-"}</td>
                        <td className="px-4 py-2 text-gray-100 capitalize">{member.role}</td>
                        <td className="px-4 py-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${member.status === 'Inactivo' ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'}`}>
                            {member.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-2">
                            <motion.div layout className="flex items-center">
                              {isConfirmed ? (
                                <motion.span
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
                                >
                                  Cuenta activa
                                </motion.span>
                              ) : (
                                <motion.button
                                  initial={{ opacity: 0, scale: 0.9 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  onClick={() => handleResendEmail(member.email)}
                                  disabled={resendingEmails[member.email] || !rolePermissions.canEdit}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_10px_rgba(245,158,11,0.2)] active:scale-95 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed`}
                                  title={!rolePermissions.canEdit ? "Disponible solo para administradores" : "Reenviar correo de activación"}
                                >
                                  {resendingEmails[member.email] ? (
                                    <svg className="animate-spin h-3.5 w-3.5 text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <Mail className="w-3.5 h-3.5" />
                                  )}
                                  <span>Reenviar</span>
                                </motion.button>
                              )}
                            </motion.div>

                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => openEditModal(member)}
                              className={!rolePermissions.canEdit ? "opacity-50 cursor-not-allowed" : ""}
                              title={!rolePermissions.canEdit ? "Disponible solo para administradores" : ""}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                            <button
                              onClick={() => handleToggleStatus(member.id, member.status)}
                              className={`p-2 rounded-lg transition-colors ${member.status === 'Inactivo' ? 'text-emerald-500 hover:bg-emerald-500/10' : 'text-amber-500 hover:bg-amber-500/10'} ${!rolePermissions.canEdit ? "opacity-50 cursor-not-allowed text-gray-500" : ""}`}
                              title={!rolePermissions.canEdit ? "Disponible solo para administradores" : (member.status === 'Inactivo' ? 'Activar Staff' : 'Desactivar Staff')}
                              disabled={!rolePermissions.canEdit}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(member.id)}
                              className={`p-2 rounded-lg transition-colors ${!rolePermissions.canDelete ? "opacity-50 cursor-not-allowed text-gray-500" : "text-red-500 hover:text-red-400 hover:bg-red-500/10"}`}
                              title={!rolePermissions.canDelete ? "Disponible solo para administradores" : "Eliminar permanentemente"}
                              disabled={!rolePermissions.canDelete}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </motion.div>
      <StaffModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleStaffSubmit}
        initialData={editingStaff || {}}
        isLoading={isSaving}
      />

      {/* Modal de Foto Ampliada */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="relative max-w-2xl w-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-amber-400 transition-colors bg-black/50 p-2 rounded-full"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedPhoto}
              alt="Vista ampliada"
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border-2 border-amber-500/30"
            />
          </motion.div>
        </div>
      )}
    </>
  );
}