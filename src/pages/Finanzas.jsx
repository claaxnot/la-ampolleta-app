import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  DollarSign,
  Download,
  CheckCircle,
  Search,
  Filter,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Users,
  Building,
  CheckSquare,
  Square,
  Sliders
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.js";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

// Lista de bancos chilenos
const BANCOS_CHILE = {
  "1": "Banco de Chile / Edwards",
  "9": "Banco Internacional",
  "12": "Banco Estado",
  "14": "Scotiabank Chile",
  "16": "Banco BCI/Mach",
  "28": "Banco Bice",
  "31": "HSBC Bank (Chile)",
  "37": "Banco Santander",
  "39": "Banco Itaú",
  "49": "Banco Security",
  "51": "Banco Falabella",
  "53": "Banco Ripley",
  "55": "Banco Consorcio",
  "59": "Banco BTG Pactual Chile",
  "672": "Coopeuch",
  "729": "Prepago Los Héroes",
  "730": "Tenpo",
  "732": "Prepago Los Andes (Tapp)",
  "738": "Global 66",
  "875": "Mercado Pago"
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function Finanzas() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dbErrorWarning, setDbErrorWarning] = useState(false);

  // Filtro de Período Mensual
  const [monthFilter, setMonthFilter] = useState("all");

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // Intentamos traer las asignaciones con los datos del perfil y del evento
      const { data: assignments, error } = await supabase
        .from("event_assignments")
        .select(`
          id,
          status,
          payment_status,
          custom_rate,
          events:event_id (
            id,
            name,
            date,
            time
          ),
          profiles:staff_id (
            id,
            name,
            rut,
            email,
            role,
            cuenta_origen,
            cuenta_destino,
            codigo_banco_destino,
            monto_transferencia,
            glosa_transferencia,
            mensaje_beneficiario
          )
        `);

      if (error) throw error;

      if (assignments) {
        // Formatear y calcular montos
        const formatted = assignments.map(a => {
          const defaultRate = a.profiles?.monto_transferencia ? parseFloat(a.profiles.monto_transferencia) : 25000;
          const rate = a.custom_rate ? parseFloat(a.custom_rate) : defaultRate;
          const isFinished = a.events?.date ? new Date(a.events.date) < new Date() : false;

          return {
            id: a.id,
            event_name: a.events?.name || "Sin Nombre",
            event_date: a.events?.date || "",
            is_finished: isFinished,
            staff_id: a.profiles?.id || "",
            staff_name: a.profiles?.name || "Personal Desconocido",
            staff_rut: a.profiles?.rut || "",
            staff_email: a.profiles?.email || "",
            staff_role: a.profiles?.role || "",
            cuenta_origen: a.profiles?.cuenta_origen || "",
            cuenta_destino: a.profiles?.cuenta_destino || "",
            codigo_banco_destino: a.profiles?.codigo_banco_destino || "",
            glosa_transferencia: a.profiles?.glosa_transferencia || "",
            mensaje_beneficiario: a.profiles?.mensaje_beneficiario || "",
            banco_name: BANCOS_CHILE[a.profiles?.codigo_banco_destino] || "Banco No Registrado",
            monto: rate,
            status: a.payment_status || "Pendiente",
            assignment_status: a.status
          };
        }).filter(a => (a.assignment_status === "Confirmado" || a.assignment_status === "Aceptado") && a.is_finished); // Solo eventos terminados y aceptados o confirmados

        setPayments(formatted);
      }
    } catch (err) {
      console.warn("⚠️ [FINANZAS]: Columnas nuevas ausentes, usando fallback seguro.", err);
      setDbErrorWarning(true);
      // Fallback seguro con datos derivados de eventos
      fetchFallbackPayments();
    } finally {
      setLoading(false);
    }
  };

  const fetchFallbackPayments = async () => {
    // Si no existen las columnas de pago en BD, calculamos usando profiles.monto_transferencia y simulamos el status
    try {
      const { data: assignments } = await supabase
        .from("event_assignments")
        .select(`
          id,
          status,
          events:event_id ( id, name, date, time ),
          profiles:staff_id (
            id,
            name,
            rut,
            email,
            role,
            cuenta_origen,
            cuenta_destino,
            codigo_banco_destino,
            monto_transferencia,
            glosa_transferencia,
            mensaje_beneficiario
          )
        `);

      if (assignments) {
        const formatted = assignments.map(a => {
          const defaultRate = a.profiles?.monto_transferencia ? parseFloat(a.profiles.monto_transferencia) : 25000;
          const isFinished = a.events?.date ? new Date(a.events.date) < new Date() : false;

          return {
            id: a.id,
            event_name: a.events?.name || "Sin Nombre",
            event_date: a.events?.date || "",
            is_finished: isFinished,
            staff_id: a.profiles?.id || "",
            staff_name: a.profiles?.name || "Personal Desconocido",
            staff_rut: a.profiles?.rut || "",
            staff_email: a.profiles?.email || "",
            staff_role: a.profiles?.role || "",
            cuenta_origen: a.profiles?.cuenta_origen || "",
            cuenta_destino: a.profiles?.cuenta_destino || "",
            codigo_banco_destino: a.profiles?.codigo_banco_destino || "",
            glosa_transferencia: a.profiles?.glosa_transferencia || "",
            mensaje_beneficiario: a.profiles?.mensaje_beneficiario || "",
            banco_name: BANCOS_CHILE[a.profiles?.codigo_banco_destino] || "Banco No Registrado",
            monto: defaultRate,
            status: "Pendiente", // Fallback por defecto
            assignment_status: a.status
          };
        }).filter(a => (a.assignment_status === "Confirmado" || a.assignment_status === "Aceptado") && a.is_finished);

        setPayments(formatted);
      }
    } catch (err) {
      console.error("Error in fallback payments:", err);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSelectAll = () => {
    const pendingPayments = filteredPayments.filter(p => p.status !== "Pagado");
    if (selectedIds.length === pendingPayments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingPayments.map(p => p.id));
    }
  };

  const handleSelectOne = (id) => {
    const payment = payments.find(p => p.id === id);
    if (payment && payment.status === "Pagado") return; // Impedir selección individual si ya está pagado

    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Marcar como pagados masivamente
  const handleMarkAsPaid = async () => {
    // Filtrar de los ids seleccionados solo aquellos que realmente estén pendientes
    const pendingSelectedIds = selectedIds.filter(id => {
      const p = payments.find(item => item.id === id);
      return p && p.status !== "Pagado";
    });

    if (pendingSelectedIds.length === 0) {
      toast.error("Ninguno de los registros seleccionados está pendiente de pago.");
      return;
    }

    const loadingToast = toast.loading("Actualizando estados de pago...");
    try {
      // Intentamos actualizar la columna payment_status en Supabase
      const { error } = await supabase
        .from("event_assignments")
        .update({ payment_status: "Pagado" })
        .in("id", pendingSelectedIds);

      if (error) throw error;

      toast.success("¡Transacciones marcadas como Pagadas con éxito!", { id: loadingToast });
      setSelectedIds([]);
      fetchPayments();
    } catch (err) {
      console.warn("⚠️ [FINANZAS UPDATE FAILED]: Se simuló la actualización en interfaz.", err);
      // Fallback local en estado si no tiene la columna de base de datos
      setPayments(prev => prev.map(p => pendingSelectedIds.includes(p.id) ? { ...p, status: "Pagado" } : p));
      setSelectedIds([]);
      toast.success("¡Transacciones marcadas como Pagadas localmente!", { id: loadingToast });
    }
  };

  // Generador de nómina bancaria chilena en formato Excel
  const handleDownloadNomina = () => {
    if (selectedIds.length === 0) {
      toast.error("Selecciona al menos un pago para generar la nómina.");
      return;
    }

    try {
      const selectedPayments = payments.filter(p => selectedIds.includes(p.id));

      // Agrupar por RUT/ID para sumar los montos por persona
      const grouped = {};
      selectedPayments.forEach(p => {
        const key = p.staff_rut || p.staff_id;
        if (!grouped[key]) {
          grouped[key] = {
            name: p.staff_name,
            rut: p.staff_rut,
            email: p.staff_email,
            role: p.staff_role,
            cuenta_origen: p.cuenta_origen,
            cuenta_destino: p.cuenta_destino,
            codigo_banco_destino: p.codigo_banco_destino,
            glosa_transferencia: p.glosa_transferencia,
            mensaje_beneficiario: p.mensaje_beneficiario,
            monto_total: 0
          };
        }
        grouped[key].monto_total += parseFloat(p.monto) || 0;
      });

      // Mapear con la estructura exacta de exportToExcel en Staff.jsx
      const dataToExport = Object.values(grouped).map(item => ({
        "Nombre": item.name,
        "RUT": item.rut,
        "Correo": item.email,
        "Rol": item.role,
        "Cuenta Origen": item.cuenta_origen || "",
        "Moneda Origen": "CLP",
        "Moneda Destino": "CLP",
        "Codigo banco destino": item.codigo_banco_destino || "",
        "Cuenta destino": item.cuenta_destino || "",
        "Monto Transferencia": item.monto_total,
        "Glosa personalizada transferencia": item.glosa_transferencia || "",
        "Mensaje corre beneficiario": item.mensaje_beneficiario || "",
      }));

      // Generar el archivo Excel
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Pagos Staff");

      // Generar buffer y descargar como Blob de forma ultra compatible
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const fileName = `NOMINA_PAGOS_AMPOLLETA_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("¡Nómina de Excel de Pagos descargada con éxito!");
    } catch (error) {
      console.error("Error al exportar Excel:", error);
      toast.error(`Error al generar Excel: ${error.message || "Error desconocido"}`);
    }
  };

  const uniqueMonths = React.useMemo(() => {
    const periods = new Set();
    payments.forEach(p => {
      if (p.event_date) {
        const [year, month] = p.event_date.split("-");
        if (year && month) {
          periods.add(`${year}-${month}`);
        }
      }
    });
    return Array.from(periods).sort().reverse();
  }, [payments]);

  const MONTH_NAMES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const formatPeriod = (period) => {
    if (!period || period === "all") return "Todos los meses";
    const [year, monthStr] = period.split("-");
    const monthIndex = parseInt(monthStr, 10) - 1;
    return `${MONTH_NAMES[monthIndex]} ${year}`;
  };

  const filteredPayments = payments.filter(p => {
    const matchesSearch =
      p.staff_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.event_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.staff_rut.includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && p.status === "Pendiente") ||
      (statusFilter === "paid" && p.status === "Pagado");

    const matchesMonth =
      monthFilter === "all" ||
      (p.event_date && p.event_date.startsWith(monthFilter));

    return matchesSearch && matchesStatus && matchesMonth;
  });

  const stats = React.useMemo(() => {
    let pendingSum = 0;
    let paidSum = 0;
    let pendingCount = 0;
    let paidCount = 0;

    filteredPayments.forEach(p => {
      if (p.status === "Pagado") {
        paidSum += p.monto;
        paidCount++;
      } else {
        pendingSum += p.monto;
        pendingCount++;
      }
    });

    return {
      totalPending: pendingSum,
      totalPaid: paidSum,
      countPending: pendingCount,
      countPaid: paidCount
    };
  }, [filteredPayments]);

  return (
    <motion.div
      className="p-6 lg:p-8 min-h-[calc(100vh-64px)]"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
            Módulo de Finanzas
          </h1>
          <p className="text-gray-400 mt-1">Monitorea cobros, liquida eventos y genera nóminas de pago.</p>
        </div>
      </motion.header>

      {dbErrorWarning && (
        <motion.div
          variants={itemVariants}
          className="mb-6 p-4 rounded-xl border bg-amber-500/10 text-amber-400 border-amber-500/20 text-sm flex gap-3 items-start"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Aviso Técnico de Base de Datos:</span> La tabla de Supabase requiere las nuevas columnas operacionales de finanzas (`payment_status` y `custom_rate`). La aplicación está operando en modo **Fallback Inteligente** utilizando el monto predeterminado de los perfiles y simulando las transiciones localmente.
            <div className="mt-2 text-xs font-mono bg-black/40 p-2 rounded-lg border border-amber-500/20 overflow-x-auto text-amber-300/90">
              ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'Pendiente';<br />
              ALTER TABLE public.event_assignments ADD COLUMN IF NOT EXISTS custom_rate NUMERIC DEFAULT NULL;
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <GlassCard className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <DollarSign className="w-20 h-20 text-red-500" />
          </div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Pendiente de Pago</p>
          <h3 className="text-3xl font-extrabold text-red-400 mt-2">
            ${stats.totalPending.toLocaleString("es-CL")}
          </h3>
          <div className="flex items-center gap-2 mt-4 text-sm text-gray-400">
            <span className="px-2 py-0.5 bg-red-500/10 text-red-400 rounded-md border border-red-500/20 font-bold">
              {stats.countPending} transferencias
            </span>
            <span>por liquidar</span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <CheckCircle className="w-20 h-20 text-emerald-500" />
          </div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Liquidado (Pagado)</p>
          <h3 className="text-3xl font-extrabold text-emerald-400 mt-2">
            ${stats.totalPaid.toLocaleString("es-CL")}
          </h3>
          <div className="flex items-center gap-2 mt-4 text-sm text-gray-400">
            <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/20 font-bold">
              {stats.countPaid} transferencias
            </span>
            <span>liquidadas</span>
          </div>
        </GlassCard>

        <GlassCard className="p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Users className="w-20 h-20 text-amber-500" />
          </div>
          <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Histórico Procesado</p>
          <h3 className="text-3xl font-extrabold text-amber-400 mt-2">
            ${(stats.totalPending + stats.totalPaid).toLocaleString("es-CL")}
          </h3>
          <div className="flex items-center gap-2 mt-4 text-sm text-gray-400">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <span>Eventos finalizados con staff asignado</span>
          </div>
        </GlassCard>
      </motion.div>

      {/* Acciones de Lote y Filtros */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        {/* Filtros */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por staff o evento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-gray-800/40 border border-gray-700/60 rounded-xl py-2 pl-9 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 w-64 transition-all duration-300"
            />
          </div>

          <div className="relative">
            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="bg-gray-800/40 border border-gray-700/60 rounded-xl py-2 pl-4 pr-10 text-sm text-white focus:outline-none focus:border-amber-500 appearance-none transition-all duration-300 font-semibold cursor-pointer"
            >
              <option value="all">Todos los meses</option>
              {uniqueMonths.map(p => (
                <option key={p} value={p}>{formatPeriod(p)}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-400">
              <Sliders className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="flex items-center bg-gray-800/40 border border-gray-700/60 rounded-xl p-1 gap-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 ${statusFilter === "all" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20" : "text-gray-400 hover:text-gray-200"}`}
            >
              Todos
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 ${statusFilter === "pending" ? "bg-red-500/20 text-red-300 border border-red-500/20" : "text-gray-400 hover:text-gray-200"}`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setStatusFilter("paid")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all duration-200 ${statusFilter === "paid" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20" : "text-gray-400 hover:text-gray-200"}`}
            >
              Pagados
            </button>
          </div>
        </div>

        {/* Acciones masivas */}
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-2"
          >
            <span className="text-xs text-gray-400 mr-2 font-bold bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-700">
              {selectedIds.length} seleccionados
            </span>
            <Button
              variant="amber"
              onClick={handleDownloadNomina}
              className="flex items-center gap-2 text-xs py-2 px-3 bg-amber-500/25 border border-amber-500/30 text-amber-300 font-bold hover:bg-amber-500 hover:text-gray-900 rounded-xl transition-all"
            >
              <Download className="w-3.5 h-3.5" /> Generar Nómina
            </Button>
            <Button
              variant="emerald"
              onClick={handleMarkAsPaid}
              className="flex items-center gap-2 text-xs py-2 px-3 bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold hover:bg-emerald-500 hover:text-gray-900 rounded-xl transition-all"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Marcar Pagado
            </Button>
          </motion.div>
        )}
      </motion.div>

      {/* Tabla de Finanzas */}
      <motion.div variants={itemVariants}>
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs font-semibold uppercase bg-gray-800/20">
                  <th className="py-4 px-6 w-12">
                    <button
                      onClick={handleSelectAll}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {(() => {
                        const pending = filteredPayments.filter(item => item.status !== "Pagado");
                        return selectedIds.length === pending.length && pending.length > 0 ? (
                          <CheckSquare className="w-5 h-5 text-amber-500" />
                        ) : (
                          <Square className="w-5 h-5" />
                        );
                      })()}
                    </button>
                  </th>
                  <th className="py-4 px-6">Trabajador (Staff)</th>
                  <th className="py-4 px-6">Evento / Fecha</th>
                  <th className="py-4 px-6">Monto Honorario</th>
                  <th className="py-4 px-6">Datos de Transferencia</th>
                  <th className="py-4 px-6 text-center">Estado Pago</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800 text-sm">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500 font-medium">
                      Cargando registros financieros...
                    </td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-500 font-medium">
                      No se encontraron transferencias que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    const missingBank = !p.cuenta_destino || !p.codigo_banco_destino;

                    return (
                      <tr
                        key={p.id}
                        className={`transition-colors duration-200 ${isSelected ? 'bg-amber-500/5' : 'hover:bg-gray-800/10'}`}
                      >
                        <td className="py-4 px-6">
                          {p.status === "Pagado" ? (
                            <CheckSquare className="w-5 h-5 text-gray-600/50 cursor-not-allowed" title="Ya está pagado" />
                          ) : (
                            <button
                              onClick={() => handleSelectOne(p.id)}
                              className="text-gray-400 hover:text-white transition-colors"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-5 h-5 text-amber-500" />
                              ) : (
                                <Square className="w-5 h-5" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-bold text-white">{p.staff_name}</span>
                            <span className="text-xs text-gray-400 font-mono mt-0.5">{p.staff_rut}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-200">{p.event_name}</span>
                            <span className="text-xs text-gray-400 mt-0.5">{p.event_date}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-extrabold text-amber-400">
                            ${p.monto.toLocaleString("es-CL")}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {missingBank ? (
                            <span className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-semibold inline-flex items-center gap-1">
                              ⚠️ Sin Datos de Transferencia
                            </span>
                          ) : (
                            <div className="flex flex-col text-xs text-gray-300 gap-0.5">
                              <span className="font-bold flex items-center gap-1">
                                <Building className="w-3.5 h-3.5 text-gray-400" /> {p.banco_name}
                              </span>
                              <span className="text-gray-400">Nº Cuenta: <span className="font-mono text-white font-semibold">{p.cuenta_destino}</span></span>
                            </div>
                          )}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <span className={`px-3 py-1.5 rounded-full text-xs font-extrabold shadow-sm border ${p.status === "Pagado"
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-red-500/10 border-red-500/30 text-red-400'
                            }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
