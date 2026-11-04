// src/pages/RegisterStaff.jsx
// Formulario público de auto-registro y postulación para Anfitrionas & Staff
import React, { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  User, 
  Mail, 
  Lock, 
  Phone, 
  CreditCard, 
  Building2, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  ArrowLeft, 
  Eye, 
  EyeOff, 
  Lightbulb,
  Sparkles,
  HelpCircle
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.js";
import { validateRut, formatRut, sanitizeRut } from "../utils/validateRut.js";
import { formatChileanPhone, validateChileanPhone, getCleanWhatsAppPhone } from "../utils/formatPhone.js";
import { BANCOS_CHILE, TIPOS_CUENTA, getBankName } from "../utils/banks.js";
import { sendPostulacionRecibidaEmail } from "../services/emailService.js";
import { toast } from "react-hot-toast";

export default function RegisterStaff() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    rut: "",
    email: "",
    phone: "",
    codigo_banco_destino: "12", // Banco Estado por defecto (CuentaRUT muy común)
    tipo_cuenta: "Cuenta Vista / CuentaRUT",
    cuenta_destino: "",
    password: "",
    confirmPassword: ""
  });

  const [avatarPreview, setAvatarPreview] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [rutError, setRutError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedData, setSubmittedData] = useState(null);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "rut") {
      const formatted = formatRut(value);
      setFormData(prev => ({ ...prev, rut: formatted }));
      if (formatted.length >= 8) {
        if (!validateRut(formatted)) {
          setRutError("RUT inválido (ej: 12345678-9)");
        } else {
          setRutError("");
        }
      } else {
        setRutError("");
      }
      return;
    }

    if (name === "phone") {
      const formattedPhone = formatChileanPhone(value);
      setFormData(prev => ({ ...prev, phone: formattedPhone }));
      if (formattedPhone.length >= 7) {
        if (!validateChileanPhone(formattedPhone)) {
          setPhoneError("Celular incompleto (+56 9 XXXX XXXX)");
        } else {
          setPhoneError("");
        }
      } else {
        setPhoneError("");
      }
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Image compressor using Canvas (max 400x400 JPEG 0.70 ~35KB)
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor selecciona un archivo de imagen válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const maxDim = 420;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Compress to high efficiency JPEG
        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.72);
        setAvatarPreview(compressedDataUrl);
        toast.success("Foto cargada y optimizada con éxito.");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // Handle Form Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    // 1. Validaciones locales
    const cleanName = formData.name.trim();
    if (cleanName.length < 3) {
      setErrorMessage("Por favor ingresa tu nombre completo.");
      return;
    }

    const cleanRut = sanitizeRut(formData.rut);
    if (!validateRut(cleanRut)) {
      setRutError("RUT chileno inválido (verifica el dígito verificador).");
      setErrorMessage("El RUT ingresado no es válido.");
      return;
    }

    if (!formData.email || !formData.email.includes("@")) {
      setErrorMessage("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (!formData.phone || !validateChileanPhone(formData.phone)) {
      setPhoneError("Ingresa un celular chileno válido (+56 9 XXXX XXXX).");
      setErrorMessage("Por favor ingresa un número de celular chileno válido (+56 9 XXXX XXXX).");
      return;
    }

    if (!formData.cuenta_destino || formData.cuenta_destino.trim().length < 4) {
      setErrorMessage("Por favor ingresa tu número de cuenta bancaria.");
      return;
    }

    if (formData.password.length < 6) {
      setErrorMessage("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden. Por favor verifícalas.");
      return;
    }

    setIsSubmitting(true);
    const loadingToast = toast.loading("Procesando tu postulación...");

    try {
      const normalizedRut = formatRut(cleanRut);
      const normalizedEmail = formData.email.trim().toLowerCase();

      // 2. Verificar si el RUT ya existe vía RPC segura si existe
      try {
        const { data: rutExists } = await supabase.rpc('check_rut_exists', { p_rut: normalizedRut });
        if (rutExists) {
          throw new Error("Este RUT ya se encuentra registrado en el sistema. Si ya tienes cuenta, inicia sesión o contacta a soporte.");
        }
      } catch (rpcErr) {
        // Si la función RPC aún no está creada en DB, continuamos de forma segura
        if (rpcErr.message && rpcErr.message.includes("Este RUT ya se encuentra")) {
          throw rpcErr;
        }
      }

      const bankName = getBankName(formData.codigo_banco_destino);

      // 3. Registrar usuario mediante Edge Function blindada
      // (Bypasea límites de correos/hora de Supabase y despacha confirmación desde no-reply)
      const { data: regResult, error: regError } = await supabase.functions.invoke("send-email", {
        body: {
          action: "register-staff",
          email: normalizedEmail,
          password: formData.password,
          name: cleanName,
          rut: normalizedRut,
          phone: formData.phone.trim(),
          codigo_banco_destino: formData.codigo_banco_destino,
          cuenta_destino: formData.cuenta_destino.trim(),
          tipo_cuenta: formData.tipo_cuenta,
          bankName,
          avatar_url: avatarPreview || null,
        },
      });

      if (regError) {
        throw new Error(regError.message || "Error al registrar postulación.");
      }
      if (regResult?.error) {
        throw new Error(regResult.error);
      }

      // 4. Cerrar cualquier sesión huérfana para que no quede logueado en modo 'Pendiente'
      await supabase.auth.signOut();

      // 5. Marcar éxito
      toast.success("¡Postulación enviada exitosamente!", { id: loadingToast, duration: 5000 });
      setSubmittedData({
        name: cleanName,
        email: normalizedEmail,
        rut: normalizedRut,
        phone: formData.phone.trim(),
        bankName,
        accountNumber: formData.cuenta_destino.trim()
      });
      setIsSuccess(true);

    } catch (err) {
      console.error("Error en registro de staff:", err);
      const friendlyMsg = err.message || "Ocurrió un error al enviar tu postulación. Inténtalo nuevamente.";
      setErrorMessage(friendlyMsg);
      toast.error(friendlyMsg, { id: loadingToast, duration: 5000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col justify-center items-center py-10 px-4 relative overflow-x-hidden">
      
      {/* Background Glows */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[600px] h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-xl z-10">
        
        {/* Header Branding */}
        <div className="text-center mb-8">
          <Link to="/login" className="inline-block group mb-3 focus:outline-none">
            <div className="w-20 h-20 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center mx-auto shadow-2xl border border-white/10 group-hover:border-amber-500/40 group-hover:scale-105 transition-all duration-300">
              <img
                src="/logo.png"
                alt="Logo La Ampolleta"
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                className="w-14 h-14 object-contain drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]"
              />
            </div>
          </Link>
          <div className="flex items-center justify-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Postulación Anfitrionas & Staff
            </h1>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Únete al equipo oficial de <span className="text-amber-400 font-medium">La Ampolleta Producciones</span> para participar en nuestros eventos y activaciones.
          </p>
        </div>

        {/* State 1: Success Screen */}
        <AnimatePresence mode="wait">
          {isSuccess ? (
            <motion.div
              key="success-card"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
            >
              <GlassCard className="p-8 backdrop-blur-xl bg-gray-900/80 border border-emerald-500/30 text-center shadow-2xl">
                <div className="w-20 h-20 bg-emerald-500/10 border-2 border-emerald-500/40 rounded-full flex items-center justify-center mx-auto mb-5 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
                  <CheckCircle2 className="w-10 h-10 animate-pulse" />
                </div>

                <div className="inline-block px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs font-bold text-amber-400 mb-3 uppercase tracking-wider">
                  Postulación en Revisión
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">
                  ¡Gracias por postular, {submittedData?.name}!
                </h2>
                <p className="text-gray-300 text-sm leading-relaxed mb-6">
                  Tus datos han sido registrados en nuestro sistema de manera exitosa. Nuestro equipo de coordinación revisará tu ficha y te contactará.
                </p>

                {/* Info Card */}
                <div className="bg-gray-800/40 border border-gray-700/50 rounded-2xl p-5 text-left mb-6 space-y-2 text-xs text-gray-300">
                  <div className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-gray-400">RUT:</span>
                    <span className="font-semibold text-white">{submittedData?.rut}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-gray-400">Correo registrado:</span>
                    <span className="font-semibold text-white">{submittedData?.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-gray-400">WhatsApp / Teléfono:</span>
                    <span className="font-semibold text-white">{submittedData?.phone}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-700/40 pb-2">
                    <span className="text-gray-400">Banco para transferencias:</span>
                    <span className="font-semibold text-white">{submittedData?.bankName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Estado inicial:</span>
                    <span className="font-semibold text-amber-400">Pendiente de Aprobación</span>
                  </div>
                </div>

                {/* Friendly Instructions */}
                <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl text-left text-xs text-amber-200/90 leading-relaxed mb-6 flex items-start gap-3">
                  <HelpCircle className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong className="block text-amber-300 font-semibold mb-1">¿Qué sucede ahora?</strong>
                    Hemos enviado un correo de respaldo a tu casilla. Cuando tu cuenta sea aprobada por producción, podrás ingresar en el login con tu correo y contraseña para ver tus turnos y eventos asignados.
                  </div>
                </div>

                <Button
                  onClick={() => navigate("/login")}
                  variant="primary"
                  className="w-full justify-center py-3.5 text-sm font-bold shadow-lg"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Volver al Inicio de Sesión
                </Button>
              </GlassCard>
            </motion.div>
          ) : (

            /* State 2: Registration Form */
            <motion.div
              key="registration-form"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
            >
              <GlassCard className="p-6 md:p-8 backdrop-blur-xl bg-gray-900/80 border border-white/10 shadow-2xl">
                
                {errorMessage && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 text-sm flex items-start gap-3"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 text-red-400 mt-0.5" />
                    <span>{errorMessage}</span>
                  </motion.div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">

                  {/* FOTO DE PERFIL / AVATAR */}
                  <div className="flex flex-col items-center justify-center pb-2">
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="relative w-24 h-24 rounded-full border-2 border-dashed border-amber-500/60 bg-gray-800/60 hover:bg-gray-800 flex items-center justify-center cursor-pointer overflow-hidden group transition-all duration-300 shadow-lg"
                      title="Haz clic para subir o tomar tu foto de perfil"
                    >
                      {avatarPreview ? (
                        <img 
                          src={avatarPreview} 
                          alt="Previsualización" 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-gray-400 group-hover:text-amber-400 transition-colors">
                          <Camera className="w-7 h-7 mb-1" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider">Subir Foto</span>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold">
                        Cambiar
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="user"
                      onChange={handlePhotoSelect}
                      className="hidden"
                    />
                    <span className="text-xs text-gray-400 mt-2 text-center">
                      Foto de perfil tipo carnet o primer plano (opcional pero recomendada)
                    </span>
                  </div>

                  {/* SECCIÓN 1: DATOS PERSONALES */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-gray-700/60 pb-2">
                      <User className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        1. Datos Personales
                      </h3>
                    </div>

                    {/* Nombre Completo */}
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                        Nombre Completo <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="name"
                        required
                        placeholder="Ej: Valentina Paz González Silva"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder-gray-500"
                      />
                    </div>

                    {/* RUT y Teléfono / WhatsApp */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                          RUT Chileno <span className="text-amber-400">*</span>
                        </label>
                        <input
                          type="text"
                          name="rut"
                          required
                          maxLength={12}
                          placeholder="12.345.678-9"
                          value={formData.rut}
                          onChange={handleChange}
                          className={`w-full px-4 py-2.5 bg-gray-800/60 border ${rutError ? 'border-red-500/70' : 'border-gray-700/70'} rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-all placeholder-gray-500`}
                        />
                        {rutError && (
                          <span className="text-[11px] text-red-400 mt-1 block ml-1">{rutError}</span>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1 flex items-center justify-between">
                          <span>WhatsApp / Celular <span className="text-amber-400">*</span></span>
                          <span className="text-[10px] text-gray-400 font-mono">+56 9 XXXX XXXX</span>
                        </label>
                        <div className="relative">
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
                            <span className="text-xs select-none">🇨🇱</span>
                            <Phone className="w-3.5 h-3.5 text-gray-500" />
                          </div>
                          <input
                            type="tel"
                            name="phone"
                            required
                            maxLength={17}
                            placeholder="+56 9 8765 4321"
                            value={formData.phone}
                            onChange={handleChange}
                            className={`w-full pl-14 pr-4 py-2.5 bg-gray-800/60 border ${
                              phoneError ? 'border-red-500/70 focus:border-red-500' : 'border-gray-700/70 focus:border-amber-500'
                            } rounded-xl text-white text-sm font-mono focus:outline-none transition-all placeholder-gray-500`}
                          />
                        </div>
                        {phoneError ? (
                          <span className="text-[11px] text-red-400 mt-1 block ml-1">{phoneError}</span>
                        ) : formData.phone && validateChileanPhone(formData.phone) ? (
                          <span className="text-[11px] text-emerald-400 mt-1 block ml-1 flex items-center gap-1 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Formato chileno válido para WhatsApp
                          </span>
                        ) : (
                          <span className="text-[10px] text-gray-500 mt-1 block ml-1">
                            Ingresa tu número (se auto-formatea con prefijo chileno)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Correo Electrónico */}
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                        Correo Electrónico (será tu usuario) <span className="text-amber-400">*</span>
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          name="email"
                          required
                          placeholder="tu.correo@ejemplo.cl"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-2.5 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-all placeholder-gray-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* SECCIÓN 2: DATOS BANCARIOS */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 border-b border-gray-700/60 pb-2">
                      <CreditCard className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        2. Datos para Pago de Honorarios
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Banco */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                          Banco <span className="text-amber-400">*</span>
                        </label>
                        <select
                          name="codigo_banco_destino"
                          value={formData.codigo_banco_destino}
                          onChange={handleChange}
                          className="w-full px-3.5 py-2.5 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-all"
                        >
                          {Object.entries(BANCOS_CHILE).map(([code, name]) => (
                            <option key={code} value={code} className="bg-gray-800 text-white">
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Tipo de Cuenta */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                          Tipo de Cuenta <span className="text-amber-400">*</span>
                        </label>
                        <select
                          name="tipo_cuenta"
                          value={formData.tipo_cuenta}
                          onChange={handleChange}
                          className="w-full px-3.5 py-2.5 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-all"
                        >
                          {TIPOS_CUENTA.map((type) => (
                            <option key={type} value={type} className="bg-gray-800 text-white">
                              {type}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Número de Cuenta */}
                    <div>
                      <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                        Número de Cuenta <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        name="cuenta_destino"
                        required
                        placeholder="Ej: 12345678 (en CuentaRUT ingresar tu RUT sin dígito verificador)"
                        value={formData.cuenta_destino}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-all placeholder-gray-500 font-mono"
                      />
                    </div>
                  </div>

                  {/* SECCIÓN 3: CONTRASEÑA DE ACCESO */}
                  <div className="space-y-4 pt-2">
                    <div className="flex items-center gap-2 border-b border-gray-700/60 pb-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                        3. Contraseña de Acceso
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Contraseña */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                          Contraseña <span className="text-amber-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            required
                            placeholder="Mínimo 6 caracteres"
                            value={formData.password}
                            onChange={handleChange}
                            className="w-full pl-4 pr-10 py-2.5 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-all placeholder-gray-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Confirmar Contraseña */}
                      <div>
                        <label className="block text-xs font-medium text-gray-300 mb-1 ml-1">
                          Confirmar Contraseña <span className="text-amber-400">*</span>
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            name="confirmPassword"
                            required
                            placeholder="Repite tu contraseña"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            className="w-full pl-4 pr-10 py-2.5 bg-gray-800/60 border border-gray-700/70 rounded-xl text-white text-sm focus:outline-none focus:border-amber-500 transition-all placeholder-gray-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                          >
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-4">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={isSubmitting}
                      className="w-full justify-center py-3.5 text-sm font-bold shadow-xl shadow-amber-500/10"
                    >
                      {isSubmitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                          <span>Enviando Ficha...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span>Enviar Postulación</span>
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      )}
                    </Button>
                  </div>

                  {/* Back to login */}
                  <div className="text-center pt-2">
                    <p className="text-xs text-gray-400">
                      ¿Ya tienes una cuenta activa?{" "}
                      <Link to="/login" className="text-amber-400 hover:underline font-semibold ml-1">
                        Inicia sesión aquí
                      </Link>
                    </p>
                  </div>
                </form>
              </GlassCard>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer info */}
        <div className="mt-8 text-center text-[10px] text-gray-500 tracking-wider uppercase">
          La Ampolleta Platform · Registro Seguro de Anfitrionas & Staff
        </div>
      </div>
    </div>
  );
}
