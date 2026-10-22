import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Plus, Edit2, Trash2, MapPin, Globe, Sparkles, Check, AlertCircle, Building2, ExternalLink } from "lucide-react";
import GlassCard from "./GlassCard.jsx";
import Button from "./Button.jsx";
import toast from "react-hot-toast";
import { parseGoogleMapsUrl } from "../hooks/useClientLocations.js";

export default function ClientLocationsModal({
  isOpen,
  onClose,
  locations = [],
  onSave,
  onDelete,
  userRole = ""
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Form State
  const [currentId, setCurrentId] = useState(null);
  const [originalCode, setOriginalCode] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("300");
  const [mapsUrlInput, setMapsUrlInput] = useState("");

  // Restricción de seguridad: Solo admin puede operar este modal
  const isAdmin = userRole === "admin";

  if (!isOpen || !isAdmin) return null;

  const handleOpenCreate = () => {
    setCurrentId(null);
    setOriginalCode("");
    setCode("");
    setName("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setRadius("300");
    setMapsUrlInput("");
    setIsEditing(true);
  };

  const handleOpenEdit = (loc) => {
    setCurrentId(loc.id || null);
    setOriginalCode(loc.code || "");
    setCode(loc.code || "");
    setName(loc.name || "");
    setAddress(loc.address || "");
    setLatitude(String(loc.latitude ?? ""));
    setLongitude(String(loc.longitude ?? ""));
    setRadius(String(loc.allowed_radius_meters ?? "300"));
    setMapsUrlInput("");
    setIsEditing(true);
  };

  const handleCancelForm = () => {
    setIsEditing(false);
    setCurrentId(null);
    setOriginalCode("");
  };

  // Asistente Inteligente de Google Maps
  const handleMapsUrlChange = (e) => {
    const val = e.target.value;
    setMapsUrlInput(val);
    if (!val) return;

    const parsed = parseGoogleMapsUrl(val);
    if (parsed) {
      setLatitude(String(parsed.latitude));
      setLongitude(String(parsed.longitude));
      toast.success("¡Coordenadas GPS extraídas con éxito del enlace!", {
        icon: "📍",
        duration: 3000,
        style: {
          background: 'rgba(31, 41, 55, 0.95)',
          color: '#fff',
          border: '1px solid rgba(245, 158, 11, 0.3)'
        }
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) {
      toast.error("El código del cliente es obligatorio (ej: LAAMP, PAK)");
      return;
    }
    if (!address.trim()) {
      toast.error("La dirección física o recinto es obligatorio");
      return;
    }
    const latNum = parseFloat(latitude);
    const lngNum = parseFloat(longitude);
    if (isNaN(latNum) || isNaN(lngNum)) {
      toast.error("Debes ingresar una latitud y longitud válidas o pegar un enlace de Google Maps");
      return;
    }

    const payload = {
      id: currentId,
      originalCode: originalCode,
      code: code.trim().toUpperCase(),
      name: name.trim() || code.trim().toUpperCase(),
      address: address.trim(),
      latitude: latNum,
      longitude: lngNum,
      allowed_radius_meters: parseInt(radius, 10) || 300
    };

    setIsSaving(true);
    const loadingToast = toast.loading(currentId ? "Actualizando cliente..." : "Registrando cliente...");
    try {
      await onSave(payload);
      toast.success(currentId ? "Cliente actualizado correctamente" : "Cliente agregado con éxito", { id: loadingToast });
      setIsEditing(false);
      setCurrentId(null);
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al guardar el cliente", { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (loc) => {
    if (!window.confirm(`¿Estás seguro de eliminar el cliente "${loc.code}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    setDeletingId(loc.code);
    const loadingToast = toast.loading("Eliminando cliente...");
    try {
      await onDelete(loc.id, loc.code);
      toast.success(`Cliente "${loc.code}" eliminado`, { id: loadingToast });
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al eliminar el cliente", { id: loadingToast });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredLocations = locations.filter((loc) => {
    const q = searchTerm.toLowerCase();
    return (
      (loc.code && loc.code.toLowerCase().includes(q)) ||
      (loc.name && loc.name.toLowerCase().includes(q)) ||
      (loc.address && loc.address.toLowerCase().includes(q))
    );
  });

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="relative w-full max-w-4xl max-h-[90vh] flex flex-col"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <GlassCard className="flex flex-col max-h-[90vh] p-6 overflow-hidden relative border border-amber-500/20 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    Catálogo de Clientes y Locaciones
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      Solo Administradores
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400">
                    Administra los códigos, direcciones y coordenadas GPS para el autocompletado en creación de eventos.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenido principal */}
            <div className="flex-1 overflow-y-auto custom-scrollbar py-4 space-y-4">
              {isEditing ? (
                /* FORMULARIO DE CREACIÓN / EDICIÓN */
                <form onSubmit={handleSubmit} className="space-y-4 bg-black/30 p-5 rounded-2xl border border-white/5">
                  <div className="flex items-center justify-between pb-2 border-b border-white/10">
                    <h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider flex items-center gap-2">
                      {currentId ? "Editar Cliente / Recinto" : "Nuevo Cliente / Recinto"}
                    </h3>
                    <span className="text-xs text-gray-400">* Campos obligatorios</span>
                  </div>

                  {/* Asistente Google Maps */}
                  <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 space-y-1.5">
                    <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Asistente Inteligente de Google Maps (Recomendado)
                    </label>
                    <input
                      type="text"
                      placeholder="Pega aquí el enlace copiado de Google Maps (ej: https://www.google.com/maps/place/...)"
                      value={mapsUrlInput}
                      onChange={handleMapsUrlChange}
                      className="w-full bg-gray-900/90 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                    <p className="text-[11px] text-gray-400">
                      Al pegar el link, el sistema extraerá automáticamente la latitud y longitud exactas.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Código */}
                    <div>
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        Código Único (Cliente / Mall) *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: LAAMP, PAK, MAM"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        required
                        className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[11px] text-gray-400">Es la clave que escribes al crear eventos.</span>
                    </div>

                    {/* Nombre Descriptivo */}
                    <div>
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        Nombre Descriptivo (Opcional)
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Base Central San Bernardo"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Dirección completa */}
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        Dirección Física o Recinto *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Mahuida 956, San Bernardo"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        required
                        className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Latitud */}
                    <div>
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        Latitud GPS *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: -33.5991537"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        required
                        className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Longitud */}
                    <div>
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        Longitud GPS *
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: -70.7119985"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        required
                        className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>

                    {/* Radio de tolerancia */}
                    <div>
                      <label className="text-xs font-semibold text-gray-300 mb-1 block">
                        Radio Permitido de Marcación (Metros)
                      </label>
                      <input
                        type="number"
                        min="50"
                        max="2000"
                        step="50"
                        value={radius}
                        onChange={(e) => setRadius(e.target.value)}
                        className="w-full bg-gray-900/60 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                      <span className="text-[11px] text-gray-400">Por defecto: 300 metros de margen.</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                    <Button type="button" variant="secondary" onClick={handleCancelForm} disabled={isSaving}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={isSaving}>
                      {isSaving ? "Guardando..." : currentId ? "Actualizar Cliente" : "Guardar Cliente"}
                    </Button>
                  </div>
                </form>
              ) : (
                /* VISTA LISTADO DE CLIENTES */
                <div className="space-y-4">
                  {/* Barra de acción: Búsqueda y Botón Añadir */}
                  <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                    <div className="relative w-full sm:max-w-md">
                      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar por código, nombre o dirección..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-900/60 border border-gray-700 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      onClick={handleOpenCreate}
                      className="w-full sm:w-auto flex items-center justify-center gap-1.5 text-xs py-2 px-3.5 shrink-0"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Nuevo Cliente / Recinto</span>
                    </Button>
                  </div>

                  {/* Lista de tarjetas */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {filteredLocations.length === 0 ? (
                      <div className="col-span-full py-12 text-center text-gray-500 text-sm">
                        No se encontraron clientes registrados con ese criterio.
                      </div>
                    ) : (
                      filteredLocations.map((loc) => (
                        <div
                          key={loc.code}
                          className="bg-gray-800/40 border border-white/5 hover:border-amber-500/30 rounded-2xl p-4 transition-all duration-200 flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 font-mono font-bold text-xs border border-amber-500/30">
                                  {loc.code}
                                </span>
                                {loc.name && loc.name !== loc.code && (
                                  <h4 className="text-sm font-semibold text-white line-clamp-1">
                                    {loc.name}
                                  </h4>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => handleOpenEdit(loc)}
                                  className="p-1.5 text-gray-400 hover:text-amber-400 hover:bg-white/5 rounded-lg transition-colors"
                                  title="Editar cliente"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(loc)}
                                  disabled={deletingId === loc.code}
                                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                                  title="Eliminar cliente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <p className="text-xs text-gray-300 flex items-start gap-1.5 mb-2 line-clamp-2">
                              <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                              <span>{loc.address}</span>
                            </p>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-gray-400">
                            <span className="font-mono">
                              GPS: {loc.latitude?.toFixed(4)}, {loc.longitude?.toFixed(4)}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-black/40 text-gray-300">
                              Radio: {loc.allowed_radius_meters || 300}m
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-gray-400 shrink-0">
              <span>Total de clientes registrados: {locations.length}</span>
              <Button type="button" variant="secondary" onClick={onClose} className="text-xs py-1.5 px-3">
                Cerrar
              </Button>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
