// src/pages/Staff.jsx
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.js";
import { 
  User, 
  Settings, 
  Plus, 
  Trash2, 
  Power, 
  Search, 
  Filter, 
  X, 
  Download, 
  Mail, 
  Clock, 
  UserCheck, 
  CheckCircle2, 
  XCircle, 
  Phone, 
  CreditCard, 
  ExternalLink,
  Sparkles,
  Copy
} from "lucide-react";
import * as XLSX from "xlsx";
import StaffModal from "../components/StaffModal.jsx";
import { useAuth } from "../hooks/useAuth.js";
import { permissions } from "../lib/permissions.js";
import { toast } from "react-hot-toast";
import { useSmartPolling } from "../hooks/useSmartPolling.js";
import { getBankName } from "../utils/banks.js";
import { formatChileanPhone, getCleanWhatsAppPhone } from "../utils/formatPhone.js";
import { sendCuentaAprobadaEmail } from "../services/emailService.js";

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

  // Pestañas de estado: 'Activo' (por defecto), 'Pendiente', 'Inactivo', 'Todos'
  const [statusTab, setStatusTab] = useState("Activo");
  const [approvingId, setApprovingId] = useState(null);
  const [rejectingId, setRejectingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [selectedPhoto, setSelectedPhoto] = useState(null);

  const fetchStaff = async (silent = false) => {
    if (!silent) setIsLoading(true);
    // Filtrar para que no aparezca el superadmin del sistema
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .neq('email', 'admin@laampolleta.tv')
      .order('created_at', { ascending: false });

    if (data) {
      setStaff(data);
    }
    if (!silent) setIsLoading(false);
  };

  React.useEffect(() => {
    fetchStaff();
  }, []);

  // Smart Short-Polling: sincroniza staff cada 6 segundos cuando el modal está cerrado
  useSmartPolling(() => fetchStaff(true), 6000, !isModalOpen);

  const rolePermissions = permissions[user?.systemRole] || permissions.viewer;

  // Reenviar correo de confirmación auth
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

  // APROBAR POSTULACIÓN DE ANFITRIONA / STAFF
  const handleApproveApplicant = async (applicant) => {
    if (!rolePermissions.canEdit) {
      toast.error("No tienes permisos para aprobar personal.");
      return;
    }

    setApprovingId(applicant.id);
    const loadingToast = toast.loading(`Aprobando a ${applicant.name}...`);

    try {
      // 1. Actualizar estado a 'Activo'
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ status: 'Activo' })
        .eq('id', applicant.id);

      if (updateError) throw updateError;

      // 2. Despachar correo de felicitaciones y aprobación con estilo oficial
      sendCuentaAprobadaEmail({
        name: applicant.name,
        email: applicant.email,
        userId: applicant.id
      });

      toast.success(`¡${applicant.name} ha sido aprobada con éxito!`, { id: loadingToast, duration: 4000 });
      fetchStaff();

      // 3. Ofrecer apertura de WhatsApp con mensaje de bienvenida pre-redactado
      const rawPhone = applicant.phone || applicant.mensaje_beneficiario || "";
      const cleanPhone = getCleanWhatsAppPhone(rawPhone);

      if (cleanPhone) {
        const welcomeText = encodeURIComponent(
          `¡Hola ${applicant.name}! Te damos la bienvenida a La Ampolleta Producciones. Tu cuenta ha sido aprobada con éxito. Ya puedes ingresar a nuestra app: https://app.laampolleta.tv con tu correo y contraseña.`
        );

        setTimeout(() => {
          if (window.confirm(`¿Deseas abrir WhatsApp para enviarle el mensaje de bienvenida a ${applicant.name}?`)) {
            window.open(`https://wa.me/${cleanPhone}?text=${welcomeText}`, '_blank');
          }
        }, 300);
      }

    } catch (err) {
      console.error("Error al aprobar postulante:", err);
      toast.error("Error al aprobar: " + (err.message || "Error desconocido"), { id: loadingToast });
    } finally {
      setApprovingId(null);
    }
  };

  // RECHAZAR POSTULACIÓN
  const handleRejectApplicant = async (applicant) => {
    if (!rolePermissions.canDelete) {
      toast.error("No tienes permisos para rechazar personal.");
      return;
    }

    if (!window.confirm(`¿Estás seguro de que deseas rechazar la postulación de ${applicant.name}? Esto eliminará su ficha permanentemente del sistema.`)) {
      return;
    }

    setRejectingId(applicant.id);
    const loadingToast = toast.loading(`Rechazando postulación...`);

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', applicant.id);
      if (error) throw error;
      toast.success(`Postulación de ${applicant.name} rechazada correctamente.`, { id: loadingToast });
      fetchStaff();
    } catch (err) {
      console.error("Error al rechazar:", err);
      toast.error("Error al rechazar: " + (err.message || "Error desconocido"), { id: loadingToast });
    } finally {
      setRejectingId(null);
    }
  };

  // CREACIÓN / EDICIÓN MANUAL DESDE EL MODAL
  const handleStaffSubmit = async (staffData) => {
    if (staffData.id && !rolePermissions.canEdit) return;
    if (!staffData.id && !rolePermissions.canCreate) return;

    setIsSaving(true);
    const loadingToast = toast.loading(staffData.id ? "Actualizando miembro de staff..." : "Creando cuenta de staff...");

    const normalizeRut = (rut) => rut.replace(/\./g, "").trim().toLowerCase();
    const normalizedRut = normalizeRut(staffData.rut || "");

    try {
      if (staffData.id) {
        // Edit mode
        const normalizedEmail = (staffData.email || "").trim().toLowerCase();

        if (normalizedEmail && editingStaff?.email && normalizedEmail !== editingStaff.email.toLowerCase()) {
          const { data: existingEmail } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', normalizedEmail)
            .neq('id', staffData.id)
            .maybeSingle();

          if (existingEmail) {
            toast.error("El correo ya está registrado por otro miembro.", { id: loadingToast });
            setIsSaving(false);
            return;
          }
        }

        const updatePayload = {
          name: staffData.name,
          rut: normalizedRut,
          role: staffData.role,
          system_role: staffData.system_role,
          phone: staffData.phone || "",
          cuenta_origen: staffData.cuenta_origen,
          cuenta_destino: staffData.cuenta_destino,
          codigo_banco_destino: staffData.codigo_banco_destino,
          monto_transferencia: staffData.monto_transferencia,
          glosa_transferencia: staffData.glosa_transferencia,
          mensaje_beneficiario: staffData.phone || staffData.mensaje_beneficiario
        };

        if (normalizedEmail) {
          updatePayload.email = normalizedEmail;
        }

        const { error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', staffData.id);

        if (error) throw error;

        toast.success("Staff actualizado correctamente.", { id: loadingToast });
        fetchStaff();
        closeModal();
      } else {
        // Create mode
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

        await new Promise((resolve) => setTimeout(resolve, 1500));

        const { error: profileError } = await supabase.from('profiles').update({
          name: staffData.name,
          rut: normalizedRut,
          role: staffData.role,
          system_role: staffData.system_role,
          status: 'Activo',
          phone: staffData.phone || "",
          cuenta_origen: staffData.cuenta_origen,
          cuenta_destino: staffData.cuenta_destino,
          codigo_banco_destino: staffData.codigo_banco_destino,
          monto_transferencia: staffData.monto_transferencia,
          glosa_transferencia: staffData.glosa_transferencia,
          mensaje_beneficiario: staffData.phone || staffData.mensaje_beneficiario
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
    if (window.confirm("¿Estás seguro de que deseas eliminar permanentemente a este miembro de staff?")) {
      const loadingToast = toast.loading("Eliminando miembro de staff...");
      try {
        const { error } = await supabase.from('profiles').delete().eq('id', id);
        if (error) throw error;
        toast.success("Miembro de staff eliminado correctamente.", { id: loadingToast });
        fetchStaff();
      } catch (err) {
        console.error("Error al eliminar:", err);
        toast.error("Error al eliminar: " + (err.message || "Error desconocido"), { id: loadingToast });
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

  // Contadores para pestañas
  const activeCount = staff.filter(m => m.status === 'Activo').length;
  const pendingCount = staff.filter(m => m.status === 'Pendiente').length;
  const inactiveCount = staff.filter(m => m.status === 'Inactivo').length;
  const totalCount = activeCount + inactiveCount;

  const uniqueRoles = [...new Set(staff.map(s => s.role?.toLowerCase() || ''))].filter(Boolean);

  // Filtrado de staff de acuerdo a la pestaña seleccionada
  const filteredStaff = staff.filter(member => {
    // 1. Filtro de estado según la pestaña activa
    if (statusTab === "Activo" && member.status !== "Activo") return false;
    if (statusTab === "Inactivo" && member.status !== "Inactivo") return false;
    if (statusTab === "Pendiente" && member.status !== "Pendiente") return false;
    // En la pestaña "Todos", no mezclamos a los pendientes para proteger la lista operativa
    if (statusTab === "Todos" && member.status === "Pendiente") return false;

    // 2. Filtro de búsqueda
    const matchesSearch =
      (member.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.rut || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (member.phone || member.mensaje_beneficiario || "").toLowerCase().includes(searchTerm.toLowerCase());

    // 3. Filtro de rol
    const matchesRole = roleFilter === "" ? true : (member.role || "").toLowerCase() === roleFilter;

    return matchesSearch && matchesRole;
  });

  const exportToExcel = () => {
    try {
      const dataToExport = filteredStaff.map(member => ({
        "Nombre": member.name,
        "RUT": member.rut,
        "Correo": member.email,
        "Teléfono": member.phone || member.mensaje_beneficiario || "",
        "Rol": member.role,
        "Estado": member.status,
        "Banco Destino": getBankName(member.codigo_banco_destino),
        "Cuenta Destino": member.cuenta_destino || "",
        "Tipo Cuenta": member.glosa_transferencia || "",
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Staff");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Staff_Ampolleta_${statusTab}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("¡Excel descargado con éxito!");
    } catch (error) {
      console.error("Error al exportar Excel de staff:", error);
      toast.error(`Error al generar Excel: ${error.message || "Error desconocido"}`);
    }
  };

  return (
    <>
      <motion.div
        className="p-4 md:p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <GlassCard className="p-5 md:p-6 backdrop-blur-sm bg-white/5 border border-white/10">
          
          {/* HEADER PRINCIPAL */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span>Equipo de Staff</span>
              </h2>
              <p className="text-gray-400 text-xs mt-0.5">
                Gestión operativa, anfitrionas y aprobaciones de personal
              </p>
            </div>

            {/* Acciones principales */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Button
                variant="primary"
                className={`flex items-center gap-2 justify-center text-xs py-2 px-3.5 ${!rolePermissions.canCreate ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={openAddModal}
                title={!rolePermissions.canCreate ? "Disponible solo para administradores" : ""}
              >
                <Plus className="w-4 h-4" /> Añadir Staff
              </Button>
              <Button
                variant="secondary"
                className="flex items-center gap-2 justify-center border-amber-500/50 text-amber-500 hover:bg-amber-500/10 text-xs py-2 px-3.5"
                onClick={exportToExcel}
              >
                <Download className="w-4 h-4" /> Exportar
              </Button>
            </div>
          </div>

          {/* PESTAÑAS DE ESTADO (Activos, Pendientes, Inactivos, Todos) */}
          <div className="flex items-center gap-2 border-b border-gray-700/60 pb-3 mb-6 overflow-x-auto scrollbar-none">
            
            {/* Tab: Activos */}
            <button
              onClick={() => setStatusTab("Activo")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                statusTab === "Activo"
                  ? "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Activos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${statusTab === "Activo" ? "bg-black/20" : "bg-gray-700/60"}`}>
                {activeCount}
              </span>
            </button>

            {/* Tab: Pendientes de Aprobación */}
            <button
              onClick={() => setStatusTab("Pendiente")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap relative ${
                statusTab === "Pendiente"
                  ? "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Pendientes de Aprobación</span>
              {pendingCount > 0 ? (
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold font-mono ${
                  statusTab === "Pendiente"
                    ? "bg-gray-950 text-amber-400"
                    : "bg-amber-500 text-gray-950 shadow-[0_0_10px_rgba(245,158,11,0.5)] animate-pulse"
                }`}>
                  {pendingCount}
                </span>
              ) : (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${statusTab === "Pendiente" ? "bg-black/20" : "bg-gray-700/60"}`}>
                  0
                </span>
              )}
            </button>

            {/* Tab: Inactivos */}
            <button
              onClick={() => setStatusTab("Inactivo")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                statusTab === "Inactivo"
                  ? "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>Inactivos</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${statusTab === "Inactivo" ? "bg-black/20" : "bg-gray-700/60"}`}>
                {inactiveCount}
              </span>
            </button>

            {/* Tab: Todos */}
            <button
              onClick={() => setStatusTab("Todos")}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                statusTab === "Todos"
                  ? "bg-amber-500 text-gray-950 shadow-lg shadow-amber-500/20"
                  : "bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              <span>Todos (Activos + Inactivos)</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${statusTab === "Todos" ? "bg-black/20" : "bg-gray-700/60"}`}>
                {totalCount}
              </span>
            </button>
          </div>

          {/* BUSCADOR Y FILTROS SECUNDARIOS */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre, RUT, correo o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 w-full"
              />
            </div>

            <div className="relative">
              <Filter className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="pl-8 pr-8 py-2 bg-gray-800/50 border border-gray-700 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500/50 appearance-none w-full sm:w-44 capitalize"
              >
                <option value="">Todos los cargos</option>
                {uniqueRoles.map(role => (
                  <option key={role} value={role}>{role}</option>
                ))}
              </select>
            </div>
          </div>

          {/* VISTA 1: PENDIENTES DE APROBACIÓN (DISEÑO ESPECIALIZADO) */}
          {statusTab === "Pendiente" ? (
            <div>
              {filteredStaff.length === 0 ? (
                <div className="text-center py-16 px-4 bg-gray-800/20 border border-gray-700/40 rounded-2xl">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-base font-bold text-white mb-1">
                    No hay postulaciones pendientes
                  </h3>
                  <p className="text-gray-400 text-xs max-w-md mx-auto">
                    Todas las solicitudes de anfitrionas y staff han sido revisadas. Cuando una nueva postulante complete el formulario público, aparecerá aquí.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredStaff.map((applicant) => {
                    const rawPhone = applicant.phone || applicant.mensaje_beneficiario || "";
                    const formattedPhone = formatChileanPhone(rawPhone) || rawPhone || "-";
                    const cleanPhone = getCleanWhatsAppPhone(rawPhone);
                    const waLink = cleanPhone ? `https://wa.me/${cleanPhone}` : null;
                    const bankName = getBankName(applicant.codigo_banco_destino);
                    const formattedDate = applicant.created_at 
                      ? new Date(applicant.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
                      : "Reciente";

                    return (
                      <motion.div
                        key={applicant.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-gray-800/40 border border-amber-500/30 rounded-2xl p-5 hover:border-amber-500/60 transition-all shadow-xl relative overflow-hidden"
                      >
                        {/* Indicador superior */}
                        <div className="flex items-center justify-between mb-4 border-b border-gray-700/50 pb-3">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3 h-3" /> Postulante Pendiente
                          </span>
                          <span className="text-[11px] text-gray-400 font-mono">
                            {formattedDate}
                          </span>
                        </div>

                        {/* Contenido principal */}
                        <div className="flex flex-col sm:flex-row items-start gap-4">
                          {/* Foto con zoom */}
                          <div 
                            className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border-2 border-amber-500/40 bg-gray-900 cursor-pointer shrink-0 relative group shadow-md"
                            onClick={() => setSelectedPhoto(applicant.avatar_url || `https://ui-avatars.com/api/?name=${applicant.name}`)}
                            title="Haz clic para ver la foto en grande"
                          >
                            <img 
                              src={applicant.avatar_url || `https://ui-avatars.com/api/?name=${applicant.name}`} 
                              alt={applicant.name} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold">
                              Ver Foto
                            </div>
                          </div>

                          {/* Datos del postulante */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div>
                              <h4 className="text-base font-bold text-white truncate">
                                {applicant.name}
                              </h4>
                              <p className="text-xs text-amber-400 font-medium">
                                Postulación: {applicant.role || "Anfitriona"}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300">
                              <div>
                                <span className="text-gray-500 block text-[10px] uppercase">RUT</span>
                                <span className="font-semibold text-white">{applicant.rut || "-"}</span>
                              </div>
                              <div>
                                <span className="text-gray-500 block text-[10px] uppercase">Correo</span>
                                <span className="truncate block text-gray-200" title={applicant.email}>{applicant.email}</span>
                              </div>
                              <div className="sm:col-span-2 mt-1">
                                <span className="text-gray-500 block text-[10px] uppercase">WhatsApp / Celular</span>
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-white font-mono">{formattedPhone}</span>
                                  {waLink && (
                                    <a
                                      href={waLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20"
                                      title="Abrir chat en WhatsApp"
                                    >
                                      <Phone className="w-3 h-3" /> WhatsApp
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Ficha Bancaria */}
                        <div className="mt-4 p-3 bg-gray-900/60 border border-gray-700/60 rounded-xl text-xs space-y-1">
                          <div className="flex items-center justify-between text-gray-400 text-[10px] uppercase tracking-wider font-bold mb-1">
                            <span className="flex items-center gap-1">
                              <CreditCard className="w-3 h-3 text-amber-400" /> Datos de Transferencia
                            </span>
                            <span className="text-amber-400/80 lowercase">{applicant.glosa_transferencia || "cuenta vista"}</span>
                          </div>
                          <div className="flex items-center justify-between text-gray-200">
                            <span>Banco: <strong className="text-white">{bankName}</strong></span>
                            <span>Cuenta: <strong className="text-white font-mono">{applicant.cuenta_destino || "-"}</strong></span>
                          </div>
                        </div>

                        {/* Botones de acción: Aprobar / Rechazar */}
                        <div className="mt-4 pt-3 border-t border-gray-700/60 flex items-center gap-2 justify-end">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRejectApplicant(applicant)}
                            disabled={rejectingId === applicant.id || !rolePermissions.canDelete}
                            className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-xs py-1.5 px-3"
                          >
                            <XCircle className="w-3.5 h-3.5 mr-1.5" />
                            {rejectingId === applicant.id ? "Rechazando..." : "Rechazar"}
                          </Button>

                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleApproveApplicant(applicant)}
                            disabled={approvingId === applicant.id || !rolePermissions.canEdit}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white border-none text-xs py-1.5 px-4 font-bold shadow-lg shadow-emerald-600/20"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                            {approvingId === applicant.id ? "Aprobando..." : "Aprobar Postulante"}
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (

            /* VISTA 2: TABLA REGULAR PARA ACTIVOS / INACTIVOS / TODOS */
            <div>
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
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Nombre</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">RUT</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Contacto</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Rol</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Estado</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700/60">
                      {filteredStaff.map((member) => {
                        const isConfirmed = !!member.email_confirmed;
                        const rawPhone = member.phone || member.mensaje_beneficiario || "";
                        const formattedPhone = formatChileanPhone(rawPhone) || rawPhone || "-";
                        const cleanPhone = getCleanWhatsAppPhone(rawPhone);

                        return (
                          <tr key={member.id} className="hover:bg-gray-800/30 transition-colors">
                            {/* Nombre y Foto */}
                            <td className="px-4 py-2 flex items-center space-x-3 text-gray-100">
                              <div
                                className="w-10 h-10 rounded-full overflow-hidden border border-gray-600 cursor-pointer relative group shrink-0"
                                onClick={() => setSelectedPhoto(member.avatar_url || "https://ui-avatars.com/api/?name=" + member.name)}
                              >
                                <img 
                                  src={member.avatar_url || "https://ui-avatars.com/api/?name=" + member.name} 
                                  alt={member.name} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" 
                                />
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Search className="w-3.5 h-3.5 text-white" />
                                </div>
                              </div>
                              <span className="font-medium text-sm">{member.name}</span>
                            </td>

                            {/* RUT */}
                            <td className="px-4 py-2 text-gray-300 text-xs font-mono">{member.rut || "-"}</td>

                            {/* Contacto: Correo y WhatsApp */}
                            <td className="px-4 py-2 text-gray-300 text-xs">
                              <div>{member.email || "-"}</div>
                              {cleanPhone && (
                                <div className="text-[11px] text-gray-400 flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-emerald-400" />
                                  <a 
                                    href={`https://wa.me/${cleanPhone}`}
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="hover:text-emerald-300 font-mono"
                                  >
                                    {formattedPhone}
                                  </a>
                                </div>
                              )}
                            </td>

                            {/* Rol */}
                            <td className="px-4 py-2 text-gray-100 capitalize text-xs">{member.role}</td>

                            {/* Estado */}
                            <td className="px-4 py-2">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                                member.status === 'Inactivo' 
                                  ? 'bg-gray-500/20 text-gray-400 border-gray-500/30' 
                                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}>
                                {member.status}
                              </span>
                            </td>

                            {/* Acciones */}
                            <td className="px-4 py-2">
                              <div className="flex items-center space-x-2">
                                <motion.div layout className="flex items-center">
                                  {isConfirmed ? (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                      Cuenta activa
                                    </span>
                                  ) : (
                                    <button
                                      onClick={() => handleResendEmail(member.email)}
                                      disabled={resendingEmails[member.email] || !rolePermissions.canEdit}
                                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-50"
                                      title="Reenviar correo de activación"
                                    >
                                      {resendingEmails[member.email] ? (
                                        <div className="w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                                      ) : (
                                        <Mail className="w-3 h-3" />
                                      )}
                                      <span>Reenviar</span>
                                    </button>
                                  )}
                                </motion.div>

                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openEditModal(member)}
                                  className={`p-1.5 ${!rolePermissions.canEdit ? "opacity-50 cursor-not-allowed" : ""}`}
                                  title={!rolePermissions.canEdit ? "Disponible solo para administradores" : "Editar"}
                                >
                                  <Settings className="w-3.5 h-3.5" />
                                </Button>

                                <button
                                  onClick={() => handleToggleStatus(member.id, member.status)}
                                  className={`p-1.5 rounded-lg transition-colors ${
                                    member.status === 'Inactivo' 
                                      ? 'text-emerald-500 hover:bg-emerald-500/10' 
                                      : 'text-amber-500 hover:bg-amber-500/10'
                                  } ${!rolePermissions.canEdit ? "opacity-50 cursor-not-allowed text-gray-500" : ""}`}
                                  title={member.status === 'Inactivo' ? 'Activar Staff' : 'Desactivar Staff'}
                                  disabled={!rolePermissions.canEdit}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDelete(member.id)}
                                  className={`p-1.5 rounded-lg transition-colors ${!rolePermissions.canDelete ? "opacity-50 cursor-not-allowed text-gray-500" : "text-red-500 hover:text-red-400 hover:bg-red-500/10"}`}
                                  title="Eliminar permanentemente"
                                  disabled={!rolePermissions.canDelete}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </div>
          )}

        </GlassCard>
      </motion.div>

      {/* Modal para crear o editar staff */}
      <StaffModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSubmit={handleStaffSubmit}
        initialData={editingStaff || undefined}
        isLoading={isSaving}
        userRole={user?.systemRole}
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
