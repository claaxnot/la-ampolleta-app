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
  Sliders,
  Eye,
  EyeOff,
  FileText,
  XCircle,
  MessageSquare
} from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.js";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import CurrencyInputCLP from "../components/CurrencyInputCLP.jsx";

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
  const [includeFuture, setIncludeFuture] = useState(false);

  // Enmascaramiento de Cuentas Bancarias (Shoulder-Surfing prevention)
  const [revealedAccounts, setRevealedAccounts] = useState({});
  
  // Estados de Gestión de Viáticos y Reembolsos (Módulo Administrativo)
  const [expenses, setExpenses] = useState([]);
  const [adminTab, setAdminTab] = useState("nominas"); // "nominas" | "viaticos"
  const [expenseStatusFilter, setExpenseStatusFilter] = useState("all");
  const [expenseComment, setExpenseComment] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [submittingExpenseAction, setSubmittingExpenseAction] = useState(false);
  const [approvedAmountInput, setApprovedAmountInput] = useState("");

  // Estados de Gestión de Boletas de Honorarios (Módulo Administrativo)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [selectedInvoicePayment, setSelectedInvoicePayment] = useState(null);
  const [invoiceFormNum, setInvoiceFormNum] = useState("");
  const [invoiceFormDate, setInvoiceFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [invoiceFormAmount, setInvoiceFormAmount] = useState("");
  const [invoiceFormNotes, setInvoiceFormNotes] = useState("");
  const [invoiceFormConfirmEmail, setInvoiceFormConfirmEmail] = useState(false);
  const [isSubmittingInvoice, setIsSubmittingInvoice] = useState(false);
  const [invoiceFormConfirmDifference, setInvoiceFormConfirmDifference] = useState(false);

  // Estados de Gestión de Boletas Agrupadas (Versión 3)
  const [invoiceBatches, setInvoiceBatches] = useState([]);
  const [invoiceBatchItems, setInvoiceBatchItems] = useState([]);
  const [selectedWorkerGroup, setSelectedWorkerGroup] = useState(null); // Para abrir el modal de validación agrupado

  // Estados de Configuración de Retención y Tolerancia (SII V2)
  const [retentionRateSetting, setRetentionRateSetting] = useState(15.25);
  const [toleranceSetting, setToleranceSetting] = useState(10);
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [inputRate, setInputRate] = useState("15.25");
  const [inputTolerance, setInputTolerance] = useState("10");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const toggleRevealAccount = (id) => {
    setRevealedAccounts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // React.useMemo: Agrupar pagos de eventos pendientes por trabajador (Versión 3)
  const workerInvoiceGroups = React.useMemo(() => {
    const pendingEvents = payments.filter(p => !p.is_expense && p.status !== "Pagado");

    const groups = {};
    pendingEvents.forEach(p => {
      const rutKey = p.staff_rut || p.staff_id;
      if (!rutKey) return;

      if (!groups[rutKey]) {
        groups[rutKey] = {
          staff_id: p.staff_id,
          staff_name: p.staff_name,
          staff_rut: p.staff_rut,
          staff_email: p.staff_email,
          payments: [],
          total_liquid: 0,
          invoice_required: false
        };
      }
      
      groups[rutKey].payments.push(p);
      groups[rutKey].total_liquid += parseFloat(p.monto) || 0;
      if (p.invoice_required) {
        groups[rutKey].invoice_required = true;
      }
    });

    return Object.values(groups).map(g => {
      const rate = parseFloat(retentionRateSetting || 15.25);
      const brutoEsperado = Math.round(g.total_liquid / (1 - (rate / 100)));
      const retencionEstimada = brutoEsperado - g.total_liquid;

      const requiredPayments = g.payments.filter(p => p.invoice_required);
      const allReceived = requiredPayments.length > 0 && requiredPayments.every(p => p.invoice_received);
      const someReceived = requiredPayments.some(p => p.invoice_received);

      let batchStatus = "pending"; 
      let activeBatch = null;

      if (!g.invoice_required) {
        batchStatus = "none";
      } else if (allReceived) {
        batchStatus = "verified";
        const invoiceNum = requiredPayments.find(p => p.invoice_number)?.invoice_number || "";
        const verificadoPor = requiredPayments.find(p => p.invoice_verified_by_name)?.invoice_verified_by_name || "Admin";
        const fechaVal = requiredPayments.find(p => p.invoice_received_at)?.invoice_received_at || "";
        const notes = requiredPayments.find(p => p.invoice_notes)?.invoice_notes || "";
        const amount = requiredPayments.reduce((sum, p) => sum + (p.invoice_amount || 0), 0);
        
        activeBatch = {
          invoice_number: invoiceNum,
          invoice_amount: amount,
          invoice_received_at: fechaVal,
          invoice_verified_by_name: verificadoPor,
          invoice_notes: notes
        };
      } else if (someReceived) {
        batchStatus = "partial";
      }

      if (invoiceBatches && invoiceBatches.length > 0) {
        const foundBatch = invoiceBatches.find(b => b.worker_id === g.staff_id && b.status === "verified");
        if (foundBatch) {
          batchStatus = "verified";
          activeBatch = {
            id: foundBatch.id,
            invoice_number: foundBatch.invoice_number,
            invoice_amount: foundBatch.invoice_amount,
            invoice_received_at: foundBatch.invoice_received_at,
            invoice_verified_by_name: "Admin",
            invoice_notes: foundBatch.invoice_notes
          };
        }
      }

      return {
        ...g,
        expected_gross: brutoEsperado,
        estimated_retention: retencionEstimada,
        batchStatus,
        activeBatch
      };
    });
  }, [payments, retentionRateSetting, invoiceBatches]);

  const handleToggleInvoiceRequired = async (assignmentId, currentValue) => {
    const loadingToast = toast.loading("Actualizando requerimiento de boleta...");
    try {
      const { error } = await supabase
        .from("event_assignments")
        .update({ invoice_required: !currentValue })
        .eq("id", assignmentId);

      if (error) throw error;
      toast.success("Requerimiento de boleta actualizado con éxito.", { id: loadingToast });
      fetchPayments();
    } catch (err) {
      console.error("Error updating invoice_required:", err);
      toast.error("Error al actualizar el requerimiento de boleta.", { id: loadingToast });
    }
  };

  const handleOpenInvoiceModal = (payment) => {
    setSelectedInvoicePayment(payment);
    setInvoiceFormNum(payment.invoice_number || "");
    setInvoiceFormDate(payment.invoice_received_at ? new Date(payment.invoice_received_at).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
    
    // Calcular bruto sugerido basado en la tasa de retención cargada
    const rate = parseFloat(retentionRateSetting || 15.25) / 100;
    const brutoSugerido = Math.round(payment.monto / (1 - rate));

    // Rellenar con monto de boleta existente o sugerir el bruto esperado
    setInvoiceFormAmount(payment.invoice_amount ? String(payment.invoice_amount) : String(brutoSugerido));
    setInvoiceFormNotes(payment.invoice_notes || "");
    setInvoiceFormConfirmEmail(false);
    setInvoiceFormConfirmDifference(false);
    setShowInvoiceModal(true);
  };

  const handleSaveInvoice = async (e) => {
    e.preventDefault();
    if (!selectedInvoicePayment && !selectedWorkerGroup) return;

    if (!invoiceFormNum.trim()) {
      toast.error("Por favor ingresa el número de la boleta.");
      return;
    }
    const cleanAmount = parseFloat(String(invoiceFormAmount).replace(/\D/g, ""));
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      toast.error("El monto de la boleta debe ser un número válido mayor a 0.");
      return;
    }
    if (!invoiceFormDate) {
      toast.error("Por favor selecciona la fecha de recepción.");
      return;
    }
    if (!invoiceFormConfirmEmail) {
      toast.error("Debes confirmar que recibiste la boleta en contacto@laampolleta.tv.");
      return;
    }

    // Failsafe V2: Validar diferencia contra tolerancia
    const rateVal = parseFloat(retentionRateSetting || 15.25);
    const liquidoVal = selectedInvoicePayment
      ? (parseFloat(selectedInvoicePayment.monto) || 0)
      : (parseFloat(selectedWorkerGroup.total_liquid) || 0);

    const brutoEsperado = Math.round(liquidoVal / (1 - (rateVal / 100)));
    const difference = Math.abs(cleanAmount - brutoEsperado);
    const hasDifference = difference > toleranceSetting;

    if (hasDifference) {
      if (!invoiceFormNotes.trim()) {
        toast.error("El monto de la boleta tiene una diferencia de redondeo. Debes ingresar obligatoriamente una nota justificando la diferencia.");
        return;
      }
      if (!invoiceFormConfirmDifference) {
        toast.error("Debes marcar la casilla para autorizar el registro de la boleta con diferencias.");
        return;
      }
    }

    setIsSubmittingInvoice(true);
    const loadingToast = toast.loading("Verificando boleta...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const verifierId = user?.id || null;
      const invoiceNum = invoiceFormNum.trim();
      const receivedAt = new Date(invoiceFormDate + "T12:00:00").toISOString();
      const notes = invoiceFormNotes.trim();

      if (selectedWorkerGroup) {
        // --- CASO 1: Validación Agrupada por Trabajador (V3) ---
        const workerId = selectedWorkerGroup.staff_id;

        // A. Insertar el lote en worker_invoice_batches
        const { data: newBatch, error: batchError } = await supabase
          .from("worker_invoice_batches")
          .insert({
            worker_id: workerId,
            period_label: new Date().toISOString().substring(0, 7),
            total_liquid_amount: liquidoVal,
            retention_rate: rateVal,
            expected_gross_amount: brutoEsperado,
            estimated_retention: brutoEsperado - liquidoVal,
            invoice_number: invoiceNum,
            invoice_amount: cleanAmount,
            invoice_received_at: receivedAt,
            invoice_verified_by: verifierId,
            invoice_notes: notes,
            status: 'verified'
          })
          .select()
          .single();

        if (batchError) throw batchError;

        // B. Insertar relaciones en worker_invoice_batch_items
        const batchItems = selectedWorkerGroup.payments.map(p => ({
          batch_id: newBatch.id,
          assignment_id: p.id,
          liquid_amount: parseFloat(p.monto) || 0
        }));

        const { error: itemsError } = await supabase
          .from("worker_invoice_batch_items")
          .insert(batchItems);

        if (itemsError) throw itemsError;

        // C. Sincronizar individualmente las asignaciones legacy para compatibilidad
        for (const p of selectedWorkerGroup.payments) {
          const propRatio = (parseFloat(p.monto) || 0) / liquidoVal;
          const propAmount = Math.round(cleanAmount * propRatio);

          const { error: syncError } = await supabase
            .from("event_assignments")
            .update({
              invoice_received: true,
              invoice_number: invoiceNum,
              invoice_received_at: receivedAt,
              invoice_amount: propAmount,
              invoice_verified_by: verifierId,
              invoice_notes: notes
            })
            .eq("id", p.id);

          if (syncError) throw syncError;
        }

      } else {
        // --- CASO 2: Validación Legacy Individual ---
        const { error } = await supabase
          .from("event_assignments")
          .update({
            invoice_received: true,
            invoice_number: invoiceNum,
            invoice_received_at: receivedAt,
            invoice_amount: cleanAmount,
            invoice_verified_by: verifierId,
            invoice_notes: notes
          })
          .eq("id", selectedInvoicePayment.id);

        if (error) throw error;
      }

      toast.success("¡Boleta verificada con éxito! Pagos liberados.", { id: loadingToast });
      setShowInvoiceModal(false);
      setSelectedInvoicePayment(null);
      setSelectedWorkerGroup(null);
      fetchPayments();
    } catch (err) {
      console.error("Error verifying invoice:", err);
      toast.error("Error al registrar la boleta.", { id: loadingToast });
    } finally {
      setIsSubmittingInvoice(false);
    }
  };

  const handleRevertInvoice = async (assignmentId) => {
    if (!window.confirm("¿Estás seguro de que deseas deshacer la verificación de esta boleta? Esto volverá a bloquear el pago.")) return;
    const loadingToast = toast.loading("Deshaciendo verificación...");
    try {
      const { error } = await supabase
        .from("event_assignments")
        .update({
          invoice_received: false,
          invoice_number: null,
          invoice_received_at: null,
          invoice_amount: null,
          invoice_verified_by: null,
          invoice_notes: null
        })
        .eq("id", assignmentId);

      if (error) throw error;
      toast.success("Verificación deshecha. El pago ha sido bloqueado nuevamente.", { id: loadingToast });
      fetchPayments();
    } catch (err) {
      console.error("Error undoing invoice verification:", err);
      toast.error("Error al deshacer la verificación.", { id: loadingToast });
    }
  };

  const handleOpenWorkerInvoiceModal = (group) => {
    setSelectedWorkerGroup(group);
    setSelectedInvoicePayment(null);
    setInvoiceFormNum("");
    setInvoiceFormDate(new Date().toISOString().split("T")[0]);

    const rate = parseFloat(retentionRateSetting || 15.25) / 100;
    const brutoSugerido = Math.round(group.total_liquid / (1 - rate));
    setInvoiceFormAmount(String(brutoSugerido));
    setInvoiceFormNotes("");
    setInvoiceFormConfirmEmail(false);
    setInvoiceFormConfirmDifference(false);
    setShowInvoiceModal(true);
  };

  const handleUndoWorkerInvoice = async (group) => {
    if (!window.confirm(`¿Estás seguro de que deseas deshacer la verificación de la boleta de ${group.staff_name}? Esto volverá a bloquear todos sus pagos.`)) return;
    const loadingToast = toast.loading("Deshaciendo verificación de lote...");
    try {
      const { error: deleteError } = await supabase
        .from("worker_invoice_batches")
        .delete()
        .eq("worker_id", group.staff_id)
        .eq("status", "verified");

      if (deleteError) throw deleteError;

      const assignmentIds = group.payments.map(p => p.id);
      if (assignmentIds.length > 0) {
        const { error: updateError } = await supabase
          .from("event_assignments")
          .update({
            invoice_received: false,
            invoice_number: null,
            invoice_received_at: null,
            invoice_amount: null,
            invoice_verified_by: null,
            invoice_notes: null
          })
          .in("id", assignmentIds);

        if (updateError) throw updateError;
      }

      toast.success("Verificación de lote deshecha correctamente.", { id: loadingToast });
      fetchPayments();
    } catch (err) {
      console.error("Error reverting worker invoice batch:", err);
      toast.error("Error al deshacer la verificación del lote.", { id: loadingToast });
    }
  };

  const maskAccountNumber = (accountNumber) => {
    if (!accountNumber) return "No registrada";
    const str = String(accountNumber);
    if (str.length <= 4) return "•••• " + str;
    return "•••• " + str.slice(-4);
  };

  const renderInvoiceBadge = (p) => {
    if (!p.invoice_required) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-gray-800 border border-white/10 text-gray-400">
          ⚪ No requiere
        </span>
      );
    }

    if (!p.invoice_received) {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-2xs font-extrabold bg-amber-500/10 border border-amber-500/30 text-amber-400 animate-pulse">
          🔴 Falta Boleta
        </span>
      );
    }

    const rate = parseFloat(retentionRateSetting || 15.25);
    const brutoEsperado = Math.round(p.monto / (1 - (rate / 100)));
    const retencionEstimada = brutoEsperado - p.monto;
    const montoRecibido = p.invoice_amount || 0;
    const diferencia = montoRecibido - brutoEsperado;
    const diffText = diferencia === 0 ? "Sin diferencia" : `${diferencia > 0 ? "+" : ""}$${diferencia.toLocaleString("es-CL")} CLP`;
    const verificadoPor = p.invoice_verified_by_name || 'Admin';
    const fechaVal = p.invoice_received_at ? new Date(p.invoice_received_at).toLocaleDateString("es-CL") : 'No registrada';
    
    const tooltipText = `Detalles Tributarios:\n` +
      `- Líquido Pactado: $${p.monto.toLocaleString("es-CL")} CLP\n` +
      `- Retención SII (${rate}%): $${retencionEstimada.toLocaleString("es-CL")} CLP\n` +
      `- Bruto Esperado: $${brutoEsperado.toLocaleString("es-CL")} CLP\n` +
      `- Monto Recibido: $${montoRecibido.toLocaleString("es-CL")} CLP\n` +
      `- Diferencia: ${diffText}\n` +
      `---------------------------------\n` +
      `- Verificado por: ${verificadoPor}\n` +
      `- Fecha de validación: ${fechaVal}` +
      `${p.invoice_notes ? '\n- Notas: ' + p.invoice_notes : ''}`;

    return (
      <span 
        className="px-2.5 py-1 rounded-full text-2xs font-extrabold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 cursor-help flex items-center gap-1"
        title={tooltipText}
      >
        🟢 Nº {p.invoice_number}
      </span>
    );
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const rateVal = parseFloat(inputRate);
    const toleranceVal = parseInt(inputTolerance);

    if (isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      toast.error("Por favor ingresa una tasa de retención válida entre 0 y 100.");
      return;
    }
    if (isNaN(toleranceVal) || toleranceVal < 0) {
      toast.error("Por favor ingresa un monto de tolerancia válido.");
      return;
    }

    setIsSavingSettings(true);
    const loadingToast = toast.loading("Guardando ajustes...");
    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Guardar tasa
      const { error: errorRate } = await supabase
        .from("app_settings")
        .upsert({
          key: "honorarios_retention_rate",
          value: { rate: rateVal },
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null
        });

      if (errorRate) throw errorRate;

      // Guardar tolerancia
      const { error: errorTolerance } = await supabase
        .from("app_settings")
        .upsert({
          key: "honorarios_invoice_tolerance",
          value: { tolerance: toleranceVal },
          updated_at: new Date().toISOString(),
          updated_by: user?.id || null
        });

      if (errorTolerance) throw errorTolerance;

      setRetentionRateSetting(rateVal);
      setToleranceSetting(toleranceVal);
      toast.success("¡Ajustes financieros actualizados con éxito!", { id: loadingToast });
      setIsEditingSettings(false);
      fetchPayments();
    } catch (err) {
      console.error("Error saving settings:", err);
      toast.error(`Error al guardar: ${err.message || "Operación fallida"}`, { id: loadingToast });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchPayments = async () => {
    setLoading(true);
    try {
      // Cargar configuraciones de retención y tolerancia del SII
      try {
        const { data: settingsData } = await supabase
          .from("app_settings")
          .select("*");
        
        if (settingsData) {
          const rateRow = settingsData.find(s => s.key === "honorarios_retention_rate");
          if (rateRow && rateRow.value && rateRow.value.rate !== undefined) {
            setRetentionRateSetting(parseFloat(rateRow.value.rate));
            setInputRate(String(rateRow.value.rate));
          }
          const toleranceRow = settingsData.find(s => s.key === "honorarios_invoice_tolerance");
          if (toleranceRow && toleranceRow.value && toleranceRow.value.tolerance !== undefined) {
            setToleranceSetting(parseInt(toleranceRow.value.tolerance));
            setInputTolerance(String(toleranceRow.value.tolerance));
          }
        }
      } catch (errSettings) {
        console.warn("⚠️ [APP_SETTINGS]: No se pudieron cargar las configuraciones de BD, usando fallbacks.", errSettings);
      }

      // Cargar lotes de boletas agrupadas (V3)
      try {
        const { data: dbBatches } = await supabase
          .from("worker_invoice_batches")
          .select("*");
        setInvoiceBatches(dbBatches || []);

        const { data: dbBatchItems } = await supabase
          .from("worker_invoice_batch_items")
          .select("*");
        setInvoiceBatchItems(dbBatchItems || []);
      } catch (errBatches) {
        console.warn("⚠️ [BATCHES]: No se pudieron cargar los lotes de boletas agrupadas de la BD.", errBatches);
      }

      // Intentamos traer las asignaciones con los datos del perfil y del evento
      const { data: assignments, error } = await supabase
        .from("event_assignments")
        .select(`
          id,
          status,
          payment_status,
          custom_rate,
          invoice_required,
          invoice_received,
          invoice_number,
          invoice_received_at,
          invoice_amount,
          invoice_verified_by,
          invoice_notes,
          verifier:invoice_verified_by (
            name
          ),
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

      // Fetch attendance logs to match
      const { data: attLogs } = await supabase
        .from("event_attendance_logs")
        .select("*");
      
      const attMap = {};
      if (attLogs) {
        attLogs.forEach(log => {
          attMap[`${log.event_id}-${log.worker_id}`] = log;
        });
      }

      // 2. Fetch Expense Requests (Viáticos y Reembolsos)
      const { data: dbExpenses, error: expensesError } = await supabase
        .from("expense_requests")
        .select(`
          *,
          profiles:worker_id (
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
          ),
          events:event_id (
            id,
            name,
            date
          )
        `)
        .order("created_at", { ascending: false });

      if (expensesError) throw expensesError;
      setExpenses(dbExpenses || []);

      let formattedExpenses = [];
      if (dbExpenses) {
        // Solo inyectamos a la nómina general si está "Aprobado" (para pagar) o "Pagado" (historial)
        formattedExpenses = dbExpenses
          .filter(e => e.status === "Aprobado" || e.status === "Pagado")
          .map(e => {
            const approvedAmt = parseFloat(e.approved_amount) || parseFloat(e.requested_amount) || 0;
            return {
              id: `expense_${e.id}`, // Prefijo para evitar colisiones
              expense_id: e.id,
              is_expense: true,
              event_name: e.events?.name ? `[${e.expense_type}] ${e.events.name}` : `[Gasto] ${e.expense_type}`,
              expense_type: e.expense_type,
              event_date: e.expense_date || "",
              is_finished: true,
              staff_id: e.profiles?.id || "",
              staff_name: e.profiles?.name || "Personal Desconocido",
              staff_rut: e.profiles?.rut || "",
              staff_email: e.profiles?.email || "",
              staff_role: e.profiles?.role || "",
              cuenta_origen: e.profiles?.cuenta_origen || "",
              cuenta_destino: e.profiles?.cuenta_destino || "",
              codigo_banco_destino: e.profiles?.codigo_banco_destino || "",
              glosa_transferencia: e.profiles?.glosa_transferencia || "",
              mensaje_beneficiario: e.profiles?.mensaje_beneficiario || "",
              banco_name: BANCOS_CHILE[e.profiles?.codigo_banco_destino] || "Banco No Registrado",
              monto: approvedAmt,
              status: e.status === "Pagado" ? "Pagado" : "Pendiente",
              assignment_status: "Confirmado",
              invoice_required: false,
              invoice_received: false,
              invoice_number: null,
              invoice_received_at: null,
              invoice_amount: null,
              invoice_verified_by: null,
              invoice_verified_by_name: null,
              invoice_notes: null
            };
          });
      }

      if (assignments) {
        // Formatear y calcular montos de eventos
        const formatted = assignments.map(a => {
          const defaultRate = a.profiles?.monto_transferencia ? parseFloat(a.profiles.monto_transferencia) : 25000;
          const rate = a.custom_rate ? parseFloat(a.custom_rate) : defaultRate;
          const isFinished = a.events?.date ? new Date(a.events.date) < new Date() : false;
          const attLog = attMap[`${a.events?.id}-${a.profiles?.id}`];

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
              assignment_status: a.status,
              attendance_log: attLog,
              invoice_required: a.invoice_required !== undefined ? a.invoice_required : true,
              invoice_received: a.invoice_received !== undefined ? a.invoice_received : false,
              invoice_number: a.invoice_number || null,
              invoice_received_at: a.invoice_received_at || null,
              invoice_amount: a.invoice_amount ? parseFloat(a.invoice_amount) : null,
              invoice_verified_by: a.invoice_verified_by || null,
              invoice_verified_by_name: a.verifier?.name || null,
              invoice_notes: a.invoice_notes || null
            };
        }).filter(a => a.assignment_status === "Confirmado" || a.assignment_status === "Aceptado");

        // Consolidación transparente
        const consolidated = [...formatted, ...formattedExpenses];
        setPayments(consolidated);
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
            assignment_status: a.status,
            invoice_required: true,
            invoice_received: false,
            invoice_number: null,
            invoice_received_at: null,
            invoice_amount: null,
            invoice_verified_by: null,
            invoice_verified_by_name: null,
            invoice_notes: null
          };
        }).filter(a => a.assignment_status === "Confirmado" || a.assignment_status === "Aceptado");

        setPayments(formatted);
      }
    } catch (err) {
      console.error("Error in fallback payments:", err);
    }
  };

  // Helper for admin to view receipt securely
  const handleAdminViewReceipt = async (receiptUrl) => {
    if (!receiptUrl) {
      toast.error("Esta solicitud no cuenta con un comprobante adjunto.");
      return;
    }
    
    // Open a blank window synchronously to bypass iOS Safari's popup blocker
    const newWindow = window.open("about:blank", "_blank");
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head>
            <title>Cargando Comprobante...</title>
            <style>
              body { background-color: #111827; color: #f59e0b; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
              .loader { border: 4px solid rgba(245, 158, 11, 0.1); border-top: 4px solid #f59e0b; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin-bottom: 20px; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
              .container { text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="loader"></div>
              <div>Generando enlace seguro...</div>
            </div>
          </body>
        </html>
      `);
    }

    const loadingToast = toast.loading("Generando enlace seguro...");
    try {
      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(receiptUrl, 900); // 15 minutos de vigencia

      if (error) throw error;

      if (data?.signedUrl) {
        toast.success("¡Enlace generado! Abriendo comprobante...", { id: loadingToast });
        if (newWindow) {
          newWindow.location.href = data.signedUrl;
        } else {
          // Fallback if popup blocker completely blocked about:blank
          window.open(data.signedUrl, "_blank", "noopener,noreferrer");
        }
      } else {
        throw new Error("No se pudo obtener el enlace firmado.");
      }
    } catch (err) {
      if (newWindow) newWindow.close();
      console.error("Error al obtener signed url:", err);
      toast.error("Error al generar enlace seguro para el comprobante.", { id: loadingToast });
    }
  };

  // Helper for admin to update expense status
  const handleUpdateExpenseStatus = async (expenseId, newStatus) => {
    if (!expenseId) return;
    setSubmittingExpenseAction(true);
    const loadingToast = toast.loading("Actualizando solicitud de gasto...");
    try {
      const updateData = {
        status: newStatus,
        admin_comment: expenseComment || null,
        updated_at: new Date().toISOString()
      };

      if (newStatus === "Aprobado") {
        const approvedAmount = typeof approvedAmountInput === "string"
          ? parseFloat(String(approvedAmountInput).replace(/\D/g, ""))
          : parseFloat(approvedAmountInput);
        if (isNaN(approvedAmount) || approvedAmount <= 0) {
          toast.error("El monto aprobado debe ser un número válido mayor a 0.", { id: loadingToast });
          setSubmittingExpenseAction(false);
          return;
        }
        updateData.approved_amount = approvedAmount;
      }

      const { error } = await supabase
        .from("expense_requests")
        .update(updateData)
        .eq("id", expenseId);

      if (error) throw error;

      toast.success(`Solicitud marcada como ${newStatus} con éxito.`, { id: loadingToast });
      setSelectedExpense(null);
      setExpenseComment("");
      setApprovedAmountInput("");
      fetchPayments(); // Recargar pagos y gastos
    } catch (err) {
      console.error("Error updating expense status:", err);
      toast.error("Error al actualizar la solicitud de gasto.", { id: loadingToast });
    } finally {
      setSubmittingExpenseAction(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const handleSelectAll = () => {
    // Only select pending payments that do not have a missing invoice
    const pendingPayments = filteredPayments.filter(p => 
      p.status !== "Pagado" && 
      !(p.invoice_required && !p.invoice_received)
    );
    if (selectedIds.length === pendingPayments.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingPayments.map(p => p.id));
    }
  };

  const handleSelectOne = (id) => {
    const payment = payments.find(p => p.id === id);
    if (!payment) return;
    if (payment.status === "Pagado") return; // Impedir selección individual si ya está pagado
    if (payment.invoice_required && !payment.invoice_received) {
      toast.error("Este pago requiere boleta de honorarios verificada antes de poder seleccionarlo.");
      return;
    }

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

    // Verificar doble protección: que ninguno de los pendientes requiera boleta y le falte
    const blockedCount = pendingSelectedIds.filter(id => {
      const p = payments.find(item => item.id === id);
      return p && p.invoice_required && !p.invoice_received;
    }).length;

    if (blockedCount > 0) {
      toast.error(`No se pueden pagar los registros seleccionados porque ${blockedCount} de ellos aún no tienen boleta verificada.`);
      return;
    }

    const loadingToast = toast.loading("Actualizando estados de pago...");
    try {
      // Separar los pagos de eventos de los pagos de viáticos
      const eventIds = pendingSelectedIds.filter(id => !String(id).startsWith("expense_"));
      const expenseIds = pendingSelectedIds
        .filter(id => String(id).startsWith("expense_"))
        .map(id => String(id).replace("expense_", ""));

      // 1. Actualizar event_assignments
      if (eventIds.length > 0) {
        const { error: eventError } = await supabase
          .from("event_assignments")
          .update({ payment_status: "Pagado" })
          .in("id", eventIds);
        if (eventError) throw eventError;
      }

      // 2. Actualizar expense_requests
      if (expenseIds.length > 0) {
        const { error: expenseError } = await supabase
          .from("expense_requests")
          .update({
            status: "Pagado",
            included_in_payroll: true
          })
          .in("id", expenseIds);
        if (expenseError) throw expenseError;
      }

      toast.success("¡Transacciones marcadas como Pagadas con éxito!", { id: loadingToast });
      setSelectedIds([]);
      fetchPayments();
    } catch (err) {
      console.error("Error al actualizar estados de pago:", err);
      toast.error("Error al guardar tus cambios de pago.", { id: loadingToast });
    }
  };

  // Generador de nómina bancaria chilena en formato Excel (3 Hojas)
  const handleDownloadNomina = async () => {
    if (selectedIds.length === 0) {
      toast.error("Selecciona al menos un pago para generar la nómina.");
      return;
    }

    const loadingToast = toast.loading("Generando archivo de nómina masiva...");
    try {
      const selectedPayments = payments.filter(p => selectedIds.includes(p.id));

      // Filtro de seguridad (V3): Si requiere boleta y no ha sido recibida, NO se incluye en el pago/transferencia
      const eligiblePayments = selectedPayments.filter(p => {
        if (p.is_expense) return true;
        if (!p.invoice_required) return true;
        return p.invoice_received === true;
      });

      const selectedEventPayments = selectedPayments.filter(p => !p.is_expense);
      const eligibleEventPayments = eligiblePayments.filter(p => !p.is_expense);
      const eligibleExpensePayments = eligiblePayments.filter(p => p.is_expense);

      // 1. HOJA 1: RESUMEN DE TRANSFERENCIAS (Agrupar y sumar todos los montos elegibles)
      const grouped = {};
      eligiblePayments.forEach(p => {
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

      const dataResumen = Object.values(grouped).map(item => {
        const cleanRut = item.rut ? String(item.rut).replace(/\./g, "") : "";
        const monto = parseFloat(item.monto_total) || 0;
        return {
          "Cuenta Origen": item.cuenta_origen || "",
          "Moneda Origen": "CLP",
          "Cuenta destino": item.cuenta_destino || "",
          "Moneda Destino": "CLP",
          "Codigo banco destino": item.codigo_banco_destino || "",
          "RUT": cleanRut,
          "Nombre": item.name || "",
          "Monto Transferencia": monto,
          "Glosa personalizada transferencia": item.glosa_transferencia || "",
          "Correo": item.email || "",
          "Mensaje corre beneficiario": item.mensaje_beneficiario || "",
          "Glosa cartola originador": "",
          "Glosa cartola beneficiario": ""
        };
      });

      // 2. HOJA 2: DESGLOSE COMPLETO POR EVENTO (Solo eventos elegibles, manteniendo compatibilidad)
      const dataDesglose = eligibleEventPayments.map(p => ({
        "Nombre Staff": p.staff_name,
        "RUT Staff": p.staff_rut,
        "Correo": p.staff_email,
        "Rol Staff": p.staff_role,
        "Evento": p.event_name,
        "Fecha Evento": p.event_date,
        "Monto Honorario": p.monto,
        "Estado Pago": p.status,
        "Banco Destino": p.banco_name,
        "Cuenta Destino": p.cuenta_destino || "No registrada",
        "Glosa": p.glosa_transferencia || "",
        "Mensaje": p.mensaje_beneficiario || ""
      }));

      // 3. HOJA 3: DETALLE VIÁTICOS
      const selectedExpenseIds = eligibleExpensePayments.map(p => p.expense_id);
      const matchingExpenses = expenses.filter(e => selectedExpenseIds.includes(e.id));

      const expensesWithUrls = await Promise.all(
        matchingExpenses.map(async (e) => {
          let signedUrl = "Sin adjunto";
          if (e.receipt_url) {
            try {
              const { data, error } = await supabase.storage
                .from("receipts")
                .createSignedUrl(e.receipt_url, 604800); // 7 días (604800s)
              if (!error && data?.signedUrl) {
                signedUrl = data.signedUrl;
              }
            } catch (err) {
              console.error("Error al generar Signed URL de 7 días:", err);
            }
          }
          return {
            ...e,
            signedUrl
          };
        })
      );

      const dataViaticos = expensesWithUrls.map(e => ({
        "Trabajador": e.profiles?.name || "Desconocido",
        "RUT": e.profiles?.rut || "",
        "Categoría": e.expense_type,
        "Fecha Gasto": e.expense_date,
        "Evento Relacionado": e.events?.name || "Gasto General",
        "Monto Solicitado": parseFloat(e.requested_amount || 0),
        "Monto Aprobado": parseFloat(e.approved_amount || 0),
        "Descripción / Motivo": e.description || "",
        "Estado": e.status,
        "Comprobante (Enlace Seguro 7 días)": e.signedUrl
      }));

      // 4. HOJA 4: AUDITORÍA BOLETAS (V3 - Lote por Trabajador)
      const auditGroups = {};
      selectedEventPayments.forEach(p => {
        const key = p.staff_rut || p.staff_id;
        if (!key) return;
        if (!auditGroups[key]) {
          auditGroups[key] = {
            staff_name: p.staff_name,
            staff_rut: p.staff_rut,
            staff_email: p.staff_email,
            events_count: 0,
            total_liquid: 0,
            invoice_required: false,
            invoice_received: false,
            invoice_number: "",
            invoice_amount: 0,
            invoice_received_at: "",
            invoice_verified_by_name: "",
            invoice_notes: ""
          };
        }
        auditGroups[key].events_count += 1;
        auditGroups[key].total_liquid += parseFloat(p.monto) || 0;
        if (p.invoice_required) {
          auditGroups[key].invoice_required = true;
        }
        if (p.invoice_received) {
          auditGroups[key].invoice_received = true;
          if (p.invoice_number) auditGroups[key].invoice_number = p.invoice_number;
          auditGroups[key].invoice_amount += parseFloat(p.invoice_amount) || 0;
          if (p.invoice_received_at) auditGroups[key].invoice_received_at = p.invoice_received_at;
          if (p.invoice_verified_by_name) auditGroups[key].invoice_verified_by_name = p.invoice_verified_by_name;
          if (p.invoice_notes) auditGroups[key].invoice_notes = p.invoice_notes;
        }
      });

      const dataAuditoriaBoletas = Object.values(auditGroups).map(g => {
        const rate = parseFloat(retentionRateSetting || 15.25);
        const brutoEsperado = Math.round(g.total_liquid / (1 - (rate / 100)));
        const retencionEstimada = brutoEsperado - g.total_liquid;
        const difference = g.invoice_received ? (g.invoice_amount - brutoEsperado) : 0;

        return {
          "Trabajador": g.staff_name,
          "RUT": g.staff_rut,
          "Correo": g.staff_email,
          "Cantidad Eventos": g.events_count,
          "Total Líquido Pactado (CLP)": g.total_liquid,
          "Requiere Boleta": g.invoice_required ? "Sí" : "No",
          "Estado Boleta Lote": g.invoice_required ? (g.invoice_received ? "Verificada (Lote)" : "Falta Boleta") : "Exento",
          "% Retención SII": g.invoice_required ? `${rate}%` : "N/A",
          "Monto Bruto Esperado": g.invoice_required ? brutoEsperado : "N/A",
          "Retención Estimada": g.invoice_required ? retencionEstimada : "N/A",
          "Monto Boleta Recibido": g.invoice_required && g.invoice_received ? g.invoice_amount : "N/A",
          "Diferencia": g.invoice_required && g.invoice_received ? difference : "N/A",
          "Número Boleta Lote": g.invoice_number || "N/A",
          "Fecha Recepción": g.invoice_received_at ? new Date(g.invoice_received_at).toLocaleDateString("es-CL") : "N/A",
          "Verificado Por": g.invoice_verified_by_name || "N/A",
          "Observación / Justificación": g.invoice_notes || ""
        };
      });

      // 5. HOJA 5: DETALLE BOLETA EVENTOS (Trazabilidad completa)
      const dataDetalleBoletaEventos = selectedEventPayments.map(p => {
        const rate = parseFloat(retentionRateSetting || 15.25);
        const brutoEsperado = Math.round(p.monto / (1 - (rate / 100)));
        const retencionEstimada = brutoEsperado - p.monto;

        return {
          "Trabajador": p.staff_name,
          "RUT": p.staff_rut,
          "Evento": p.event_name,
          "Fecha Evento": p.event_date,
          "Monto Líquido (CLP)": p.monto,
          "Requiere Boleta": p.invoice_required ? "Sí" : "No",
          "Estado Boleta Evento": p.invoice_required ? (p.invoice_received ? "Cubierto por Lote" : "Pendiente") : "Exento",
          "Bruto Proporcional": p.invoice_required ? brutoEsperado : "N/A",
          "Retención Proporcional": p.invoice_required ? retencionEstimada : "N/A",
          "Número Boleta Asociada": p.invoice_number || "N/A",
          "Fecha Validación": p.invoice_received_at ? new Date(p.invoice_received_at).toLocaleDateString("es-CL") : "N/A"
        };
      });

      const workbook = XLSX.utils.book_new();

      // Hojas
      const worksheetResumen = XLSX.utils.json_to_sheet(dataResumen);
      const maxColWidthsResumen = [];
      dataResumen.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsResumen[colIndex] = Math.max(maxColWidthsResumen[colIndex] || 10, length);
        });
      });
      worksheetResumen["!cols"] = maxColWidthsResumen.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetResumen, "Resumen Transferencias");

      const worksheetDesglose = XLSX.utils.json_to_sheet(dataDesglose);
      const maxColWidthsDesglose = [];
      dataDesglose.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsDesglose[colIndex] = Math.max(maxColWidthsDesglose[colIndex] || 10, length);
        });
      });
      worksheetDesglose["!cols"] = maxColWidthsDesglose.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetDesglose, "Detalle de Eventos");

      const worksheetViaticos = XLSX.utils.json_to_sheet(dataViaticos);
      const maxColWidthsViaticos = [];
      dataViaticos.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsViaticos[colIndex] = Math.max(maxColWidthsViaticos[colIndex] || 10, length);
        });
      });
      worksheetViaticos["!cols"] = maxColWidthsViaticos.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetViaticos, "Detalle Viáticos");

      const worksheetAuditoria = XLSX.utils.json_to_sheet(dataAuditoriaBoletas);
      const maxColWidthsAuditoria = [];
      dataAuditoriaBoletas.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsAuditoria[colIndex] = Math.max(maxColWidthsAuditoria[colIndex] || 10, length);
        });
      });
      worksheetAuditoria["!cols"] = maxColWidthsAuditoria.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetAuditoria, "Auditoría Boletas");

      const worksheetDetalleBoletas = XLSX.utils.json_to_sheet(dataDetalleBoletaEventos);
      const maxColWidthsDetalleBoletas = [];
      dataDetalleBoletaEventos.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsDetalleBoletas[colIndex] = Math.max(maxColWidthsDetalleBoletas[colIndex] || 10, length);
        });
      });
      worksheetDetalleBoletas["!cols"] = maxColWidthsDetalleBoletas.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetDetalleBoletas, "Detalle Boleta Eventos");

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

      toast.success("¡Nómina de Excel de Pagos (5 Hojas) descargada con éxito!", { id: loadingToast });
    } catch (error) {
      console.error("Error al exportar Excel:", error);
      toast.error(`Error al generar Excel: ${error.message || "Error desconocido"}`, { id: loadingToast });
    }
  };

  // Generador de reporte financiero filtrado (3 Hojas)
  const handleExportFilteredReport = async () => {
    if (filteredPayments.length === 0) {
      toast.error("No hay registros en el filtro actual para exportar.");
      return;
    }

    const loadingToast = toast.loading("Generando reporte financiero filtrado...");
    try {
      // Filtro de seguridad (V3): Si requiere boleta y no ha sido recibida, NO se incluye en el pago/transferencia
      const eligiblePayments = filteredPayments.filter(p => {
        if (p.is_expense) return true;
        if (!p.invoice_required) return true;
        return p.invoice_received === true;
      });

      const selectedEventPayments = filteredPayments.filter(p => !p.is_expense);
      const eligibleEventPayments = eligiblePayments.filter(p => !p.is_expense);
      const eligibleExpensePayments = eligiblePayments.filter(p => p.is_expense);

      // 1. HOJA 1: RESUMEN DE TRANSFERENCIAS
      const grouped = {};
      eligiblePayments.forEach(p => {
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
        if (p.status !== "Pagado") {
          grouped[key].monto_total += parseFloat(p.monto) || 0;
        }
      });

      const dataResumen = Object.values(grouped).map(item => {
        const cleanRut = item.rut ? String(item.rut).replace(/\./g, "") : "";
        const monto = parseFloat(item.monto_total) || 0;
        return {
          "Cuenta Origen": item.cuenta_origen || "",
          "Moneda Origen": "CLP",
          "Cuenta destino": item.cuenta_destino || "",
          "Moneda Destino": "CLP",
          "Codigo banco destino": item.codigo_banco_destino || "",
          "RUT": cleanRut,
          "Nombre": item.name || "",
          "Monto Transferencia": monto,
          "Glosa personalizada transferencia": item.glosa_transferencia || "",
          "Correo": item.email || "",
          "Mensaje corre beneficiario": item.mensaje_beneficiario || "",
          "Glosa cartola originador": "",
          "Glosa cartola beneficiario": ""
        };
      });

      // 2. HOJA 2: DESGLOSE COMPLETO POR EVENTO
      const dataDesglose = eligibleEventPayments.map(p => ({
        "Nombre Staff": p.staff_name,
        "RUT Staff": p.staff_rut,
        "Correo": p.staff_email,
        "Rol Staff": p.staff_role,
        "Evento": p.event_name,
        "Fecha Evento": p.event_date,
        "Monto Honorario": p.monto,
        "Estado Pago": p.status,
        "Banco Destino": p.banco_name,
        "Cuenta Destino": p.cuenta_destino || "No registrada",
        "Glosa": p.glosa_transferencia || "",
        "Mensaje": p.mensaje_beneficiario || ""
      }));

      // 3. HOJA 3: DETALLE VIÁTICOS
      const selectedExpenseIds = eligibleExpensePayments.map(p => p.expense_id);
      const matchingExpenses = expenses.filter(e => selectedExpenseIds.includes(e.id));

      const expensesWithUrls = await Promise.all(
        matchingExpenses.map(async (e) => {
          let signedUrl = "Sin adjunto";
          if (e.receipt_url) {
            try {
              const { data, error } = await supabase.storage
                .from("receipts")
                .createSignedUrl(e.receipt_url, 604800); // 7 días
              if (!error && data?.signedUrl) {
                signedUrl = data.signedUrl;
              }
            } catch (err) {
              console.error("Error al generar Signed URL de 7 días:", err);
            }
          }
          return {
            ...e,
            signedUrl
          };
        })
      );

      const dataViaticos = expensesWithUrls.map(e => ({
        "Trabajador": e.profiles?.name || "Desconocido",
        "RUT": e.profiles?.rut || "",
        "Categoría": e.expense_type,
        "Fecha Gasto": e.expense_date,
        "Evento Relacionado": e.events?.name || "Gasto General",
        "Monto Solicitado": parseFloat(e.requested_amount || 0),
        "Monto Aprobado": parseFloat(e.approved_amount || 0),
        "Descripción / Motivo": e.description || "",
        "Estado": e.status,
        "Comprobante (Enlace Seguro 7 días)": e.signedUrl
      }));

      // 4. HOJA 4: AUDITORÍA BOLETAS (V3 - Lote por Trabajador)
      const auditGroups = {};
      selectedEventPayments.forEach(p => {
        const key = p.staff_rut || p.staff_id;
        if (!key) return;
        if (!auditGroups[key]) {
          auditGroups[key] = {
            staff_name: p.staff_name,
            staff_rut: p.staff_rut,
            staff_email: p.staff_email,
            events_count: 0,
            total_liquid: 0,
            invoice_required: false,
            invoice_received: false,
            invoice_number: "",
            invoice_amount: 0,
            invoice_received_at: "",
            invoice_verified_by_name: "",
            invoice_notes: ""
          };
        }
        auditGroups[key].events_count += 1;
        auditGroups[key].total_liquid += parseFloat(p.monto) || 0;
        if (p.invoice_required) {
          auditGroups[key].invoice_required = true;
        }
        if (p.invoice_received) {
          auditGroups[key].invoice_received = true;
          if (p.invoice_number) auditGroups[key].invoice_number = p.invoice_number;
          auditGroups[key].invoice_amount += parseFloat(p.invoice_amount) || 0;
          if (p.invoice_received_at) auditGroups[key].invoice_received_at = p.invoice_received_at;
          if (p.invoice_verified_by_name) auditGroups[key].invoice_verified_by_name = p.invoice_verified_by_name;
          if (p.invoice_notes) auditGroups[key].invoice_notes = p.invoice_notes;
        }
      });

      const dataAuditoriaBoletas = Object.values(auditGroups).map(g => {
        const rate = parseFloat(retentionRateSetting || 15.25);
        const brutoEsperado = Math.round(g.total_liquid / (1 - (rate / 100)));
        const retencionEstimada = brutoEsperado - g.total_liquid;
        const difference = g.invoice_received ? (g.invoice_amount - brutoEsperado) : 0;

        return {
          "Trabajador": g.staff_name,
          "RUT": g.staff_rut,
          "Correo": g.staff_email,
          "Cantidad Eventos": g.events_count,
          "Total Líquido Pactado (CLP)": g.total_liquid,
          "Requiere Boleta": g.invoice_required ? "Sí" : "No",
          "Estado Boleta Lote": g.invoice_required ? (g.invoice_received ? "Verificada (Lote)" : "Falta Boleta") : "Exento",
          "% Retención SII": g.invoice_required ? `${rate}%` : "N/A",
          "Monto Bruto Esperado": g.invoice_required ? brutoEsperado : "N/A",
          "Retención Estimada": g.invoice_required ? retencionEstimada : "N/A",
          "Monto Boleta Recibido": g.invoice_required && g.invoice_received ? g.invoice_amount : "N/A",
          "Diferencia": g.invoice_required && g.invoice_received ? difference : "N/A",
          "Número Boleta Lote": g.invoice_number || "N/A",
          "Fecha Recepción": g.invoice_received_at ? new Date(g.invoice_received_at).toLocaleDateString("es-CL") : "N/A",
          "Verificado Por": g.invoice_verified_by_name || "N/A",
          "Observación / Justificación": g.invoice_notes || ""
        };
      });

      // 5. HOJA 5: DETALLE BOLETA EVENTOS (Trazabilidad completa)
      const dataDetalleBoletaEventos = selectedEventPayments.map(p => {
        const rate = parseFloat(retentionRateSetting || 15.25);
        const brutoEsperado = Math.round(p.monto / (1 - (rate / 100)));
        const retencionEstimada = brutoEsperado - p.monto;

        return {
          "Trabajador": p.staff_name,
          "RUT": p.staff_rut,
          "Evento": p.event_name,
          "Fecha Evento": p.event_date,
          "Monto Líquido (CLP)": p.monto,
          "Requiere Boleta": p.invoice_required ? "Sí" : "No",
          "Estado Boleta Evento": p.invoice_required ? (p.invoice_received ? "Cubierto por Lote" : "Pendiente") : "Exento",
          "Bruto Proporcional": p.invoice_required ? brutoEsperado : "N/A",
          "Retención Proporcional": p.invoice_required ? retencionEstimada : "N/A",
          "Número Boleta Asociada": p.invoice_number || "N/A",
          "Fecha Validación": p.invoice_received_at ? new Date(p.invoice_received_at).toLocaleDateString("es-CL") : "N/A"
        };
      });

      const workbook = XLSX.utils.book_new();

      // Hojas
      const worksheetResumen = XLSX.utils.json_to_sheet(dataResumen);
      const maxColWidthsResumen = [];
      dataResumen.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsResumen[colIndex] = Math.max(maxColWidthsResumen[colIndex] || 10, length);
        });
      });
      worksheetResumen["!cols"] = maxColWidthsResumen.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetResumen, "Resumen Transferencias");

      const worksheetDesglose = XLSX.utils.json_to_sheet(dataDesglose);
      const maxColWidthsDesglose = [];
      dataDesglose.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsDesglose[colIndex] = Math.max(maxColWidthsDesglose[colIndex] || 10, length);
        });
      });
      worksheetDesglose["!cols"] = maxColWidthsDesglose.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetDesglose, "Detalle de Eventos");

      const worksheetViaticos = XLSX.utils.json_to_sheet(dataViaticos);
      const maxColWidthsViaticos = [];
      dataViaticos.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsViaticos[colIndex] = Math.max(maxColWidthsViaticos[colIndex] || 10, length);
        });
      });
      worksheetViaticos["!cols"] = maxColWidthsViaticos.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetViaticos, "Detalle Viáticos");

      const worksheetAuditoria = XLSX.utils.json_to_sheet(dataAuditoriaBoletas);
      const maxColWidthsAuditoria = [];
      dataAuditoriaBoletas.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsAuditoria[colIndex] = Math.max(maxColWidthsAuditoria[colIndex] || 10, length);
        });
      });
      worksheetAuditoria["!cols"] = maxColWidthsAuditoria.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetAuditoria, "Auditoría Boletas");

      const worksheetDetalleBoletas = XLSX.utils.json_to_sheet(dataDetalleBoletaEventos);
      const maxColWidthsDetalleBoletas = [];
      dataDetalleBoletaEventos.forEach(row => {
        Object.keys(row).forEach((key, colIndex) => {
          const value = row[key] ? String(row[key]) : "";
          const length = Math.max(value.length, key.length) + 3;
          maxColWidthsDetalleBoletas[colIndex] = Math.max(maxColWidthsDetalleBoletas[colIndex] || 10, length);
        });
      });
      worksheetDetalleBoletas["!cols"] = maxColWidthsDetalleBoletas.map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(workbook, worksheetDetalleBoletas, "Detalle Boleta Eventos");

      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

      const filterStr = statusFilter === "all" ? "TODOS" : statusFilter === "paid" ? "PAGADOS" : "PENDIENTES";
      const fileName = `REPORTE_FINANZAS_${filterStr}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("¡Reporte financiero filtrado (5 Hojas) descargado con éxito!", { id: loadingToast });
    } catch (error) {
      console.error("Error al exportar reporte filtrado:", error);
      toast.error(`Error al generar reporte: ${error.message || "Error desconocido"}`, { id: loadingToast });
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
    const sName = p?.staff_name || "";
    const eName = p?.event_name || "";
    const sRut = p?.staff_rut || "";
    const sStatus = p?.status || "";
    const eDate = p?.event_date || "";

    const matchesSearch =
      sName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      eName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      sRut.includes(searchTerm);

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && sStatus === "Pendiente") ||
      (statusFilter === "paid" && sStatus === "Pagado");

    const matchesMonth =
      monthFilter === "all" ||
      (eDate && eDate.startsWith(monthFilter));

    const matchesFinished = includeFuture || p?.is_finished;

    return matchesSearch && matchesStatus && matchesMonth && matchesFinished;
  });

  const stats = React.useMemo(() => {
    let pendingSum = 0;
    let paidSum = 0;
    let pendingCount = 0;
    let paidCount = 0;

    filteredPayments.forEach(p => {
      const montoVal = parseFloat(p?.monto) || 0;
      if (p?.status === "Pagado") {
        paidSum += montoVal;
        paidCount++;
      } else {
        pendingSum += montoVal;
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

        {/* Panel Glassmorphic de Configuración de Retención y Tolerancia (SII V2) */}
        <div className="flex items-center gap-3">
          <div className="bg-gray-900/60 backdrop-blur-md border border-white/5 rounded-2xl px-4 py-2.5 flex items-center gap-5 text-sm shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Retención SII</span>
              <span className="text-amber-300 font-extrabold text-sm sm:text-base">{retentionRateSetting}%</span>
            </div>
            <div className="w-[1px] h-8 bg-white/10" />
            <div className="flex flex-col text-left">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-extrabold">Tolerancia Boleta</span>
              <span className="text-amber-300 font-extrabold text-sm sm:text-base">${toleranceSetting.toLocaleString("es-CL")} CLP</span>
            </div>
            <button
              onClick={() => {
                setInputRate(String(retentionRateSetting));
                setInputTolerance(String(toleranceSetting));
                setIsEditingSettings(true);
              }}
              className="ml-2 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/20 text-2xs font-extrabold uppercase transition-all duration-200 cursor-pointer flex items-center gap-1.5 hover:scale-[1.03] active:scale-95 shadow-inner"
            >
              <Sliders className="w-3.5 h-3.5 text-amber-400" />
              Ajustar
            </button>
          </div>
        </div>
      </motion.header>

      {/* Tabs Administrador de Finanzas */}
      <div className="relative z-10 flex items-center gap-2 bg-gray-900/60 p-1.5 rounded-xl border border-white/5 w-full max-w-sm sm:max-w-md mb-6">
        <button
          onClick={() => setAdminTab("nominas")}
          className={`flex-1 py-3 px-4 rounded-lg text-xs sm:text-sm font-extrabold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation active:bg-amber-500/30 active:opacity-90 ${
            adminTab === "nominas" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <DollarSign className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
          Nóminas y Pagos
        </button>
        <button
          onClick={() => setAdminTab("viaticos")}
          className={`flex-1 py-3 px-4 rounded-lg text-xs sm:text-sm font-extrabold transition-all duration-150 flex items-center justify-center gap-1.5 cursor-pointer touch-manipulation active:bg-amber-500/30 active:opacity-90 ${
            adminTab === "viaticos" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-400" />
          Aprobación Viáticos
        </button>
      </div>

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

      {adminTab === "nominas" ? (
        <>
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
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer touch-manipulation active:bg-white/10 active:opacity-90 ${statusFilter === "all" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20" : "text-gray-400 hover:text-gray-200"}`}
                >
                  Todos
                </button>
                <button
                  onClick={() => setStatusFilter("pending")}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer touch-manipulation active:bg-white/10 active:opacity-90 ${statusFilter === "pending" ? "bg-red-500/20 text-red-300 border border-red-500/20" : "text-gray-400 hover:text-gray-200"}`}
                >
                  Pendientes
                </button>
                <button
                  onClick={() => setStatusFilter("paid")}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all duration-150 cursor-pointer touch-manipulation active:bg-white/10 active:opacity-90 ${statusFilter === "paid" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/20" : "text-gray-400 hover:text-gray-200"}`}
                >
                  Pagados
                </button>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-gray-800/40 border border-gray-700/60 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:border-amber-500/30 transition-all h-[38px]">
                <input
                  type="checkbox"
                  checked={includeFuture}
                  onChange={(e) => setIncludeFuture(e.target.checked)}
                  className="accent-amber-500 rounded cursor-pointer w-3.5 h-3.5"
                />
                <span>Incluir Eventos Futuros</span>
              </label>
            </div>

            {/* Acciones masivas o reporte filtrado */}
            {selectedIds.length > 0 ? (
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
            ) : (
              <Button
                variant="amber"
                onClick={handleExportFilteredReport}
                className="flex items-center gap-2 text-xs py-2.5 px-4 bg-amber-500/10 border border-amber-500/20 text-amber-300 font-bold hover:bg-amber-500/20 hover:border-amber-500/40 rounded-xl transition-all h-[38px] self-start md:self-auto shadow-sm"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" /> Exportar Reporte Filtrado
              </Button>
            )}
          </motion.div>

          {/* CONTROL DE BOLETAS DE HONORARIOS AGRUPADAS (V3) */}
          <motion.div variants={itemVariants} className="mb-8">
            <GlassCard className="p-6 border border-white/5 relative overflow-hidden bg-gray-900/60 backdrop-blur-xl rounded-3xl">
              <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 pb-4 border-b border-white/5">
                <div>
                  <h3 className="text-base font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 flex items-center gap-2 uppercase tracking-wide">
                    📋 Control de Boletas por Trabajador (SII Lotes V3)
                  </h3>
                  <p className="text-2xs text-gray-400 mt-0.5">
                    Toda la app trabaja visualmente en líquidos, pero aquí puedes verificar la boleta combinada emitida por el total de eventos de cada staff.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-2xs font-extrabold text-gray-400 uppercase bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                    SII: {retentionRateSetting}% Tasa
                  </span>
                  <span className="text-2xs font-extrabold text-gray-400 uppercase bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                    Tol: ${toleranceSetting.toLocaleString("es-CL")} CLP
                  </span>
                </div>
              </div>

              {workerInvoiceGroups.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-500 italic">
                  No hay trabajadores con pagos de eventos pendientes en este lote.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 text-gray-400 font-extrabold uppercase bg-white/5">
                        <th className="py-3 px-4">Trabajador (Staff)</th>
                        <th className="py-3 px-4">RUT</th>
                        <th className="py-3 px-4 text-center">Eventos</th>
                        <th className="py-3 px-4 text-right">Total Líquido Pactado</th>
                        <th className="py-3 px-4 text-right">Bruto Sugerido (SII)</th>
                        <th className="py-3 px-4 text-right">Retención Estimada</th>
                        <th className="py-3 px-4 text-center">Estado Boleta Lote</th>
                        <th className="py-3 px-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {workerInvoiceGroups.map(group => {
                        return (
                          <tr key={group.staff_id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-gray-200">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-sm">{group.staff_name}</span>
                                <span className="text-2xs text-gray-400 font-mono">{group.staff_email}</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-gray-300 font-mono font-semibold">{group.staff_rut || "Sin RUT"}</td>
                            <td className="py-3.5 px-4 text-center font-black">
                              <span className="bg-gray-800 border border-white/10 px-2 py-0.5 rounded-full text-amber-400 text-2xs">
                                {group.payments.length}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-extrabold text-gray-200">${group.total_liquid.toLocaleString("es-CL")}</td>
                            <td className="py-3.5 px-4 text-right font-black text-amber-400 font-mono">${group.expected_gross.toLocaleString("es-CL")}</td>
                            <td className="py-3.5 px-4 text-right font-semibold text-gray-400 font-mono">${group.estimated_retention.toLocaleString("es-CL")}</td>
                            <td className="py-3.5 px-4 text-center">
                              {(() => {
                                if (group.batchStatus === "none") {
                                  return (
                                    <span className="px-2.5 py-1 rounded bg-gray-800 border border-white/10 text-gray-400 text-2xs font-extrabold whitespace-nowrap">
                                      ⚪ No requiere boleta
                                    </span>
                                  );
                                }
                                if (group.batchStatus === "verified") {
                                  return (
                                    <span 
                                      className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-2xs font-extrabold cursor-help whitespace-nowrap"
                                      title={`Boleta verified: Nº ${group.activeBatch?.invoice_number || ""}\nMonto: $${(group.activeBatch?.invoice_amount || 0).toLocaleString("es-CL")}\nFecha: ${group.activeBatch?.invoice_received_at ? new Date(group.activeBatch.invoice_received_at).toLocaleDateString("es-CL") : ""}\nNotas: ${group.activeBatch?.invoice_notes || ""}`}
                                    >
                                      🟢 Boleta Verificada (Batch)
                                    </span>
                                  );
                                }
                                if (group.batchStatus === "partial") {
                                  return (
                                    <span className="px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-2xs font-extrabold animate-pulse whitespace-nowrap">
                                      🔵 Parcialmente Verificado
                                    </span>
                                  );
                                }
                                return (
                                  <span className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-2xs font-extrabold animate-pulse whitespace-nowrap">
                                    🔴 Falta Boleta (Agrupada)
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {group.invoice_required ? (
                                group.batchStatus === "verified" ? (
                                  <button
                                    onClick={() => handleUndoWorkerInvoice(group)}
                                    className="px-3 py-1.5 rounded-xl text-red-400 hover:text-white bg-red-500/15 hover:bg-red-500/30 transition-all text-3xs font-extrabold tracking-wide uppercase border border-red-500/20 cursor-pointer"
                                  >
                                    Deshacer Boleta
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleOpenWorkerInvoiceModal(group)}
                                    className="px-3 py-1.5 rounded-xl text-amber-300 hover:text-gray-900 bg-amber-500/15 hover:bg-amber-500 transition-all text-3xs font-extrabold tracking-wide uppercase border border-amber-500/20 cursor-pointer"
                                  >
                                    Validar Boleta
                                  </button>
                                )
                              ) : (
                                <span className="text-3xs text-gray-500 font-bold italic">Exento</span>
                              )}
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

          {/* Tabla de Finanzas */}
          <motion.div variants={itemVariants}>
            <GlassCard className="overflow-hidden">
              <div className="hidden md:block overflow-x-auto">
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
                      <th className="py-4 px-6 text-left">Trabajador (Staff)</th>
                      <th className="py-4 px-6 text-left">Evento / Fecha</th>
                      <th className="py-4 px-6 text-left">Monto Honorario / Gasto</th>
                      <th className="py-4 px-6 text-left">Datos de Transferencia</th>
                      <th className="py-4 px-6 text-center">Boleta (DTE)</th>
                      <th className="py-4 px-6 text-center">Estado Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-gray-500 font-medium">
                          Cargando registros financieros...
                        </td>
                      </tr>
                    ) : filteredPayments.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="py-12 text-center text-gray-500 font-medium">
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
                              ) : p.invoice_required && !p.invoice_received ? (
                                <Square 
                                  className="w-5 h-5 text-red-500/30 cursor-not-allowed" 
                                  title="Falta boleta de honorarios. No se puede seleccionar para pago." 
                                />
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
                            <td className="py-4 px-6 text-left">
                              <div className="flex flex-col">
                                <span className="font-bold text-white flex items-center gap-1.5">
                                  {p.staff_name}
                                  {p.is_expense && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase font-sans">
                                      {p.expense_type || "Viático"}
                                    </span>
                                  )}
                                </span>
                                <span className="text-xs text-gray-400 font-mono mt-0.5">{p.staff_rut}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-left">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-200">{p.event_name}</span>
                                <span className="text-xs text-gray-400 mt-0.5">{p.event_date}</span>
                              </div>
                            </td>
                            <td className="py-4 px-6 text-left">
                              <div className="flex flex-col">
                                <span className="font-extrabold text-amber-400">
                                  ${(parseFloat(p?.monto) || 0).toLocaleString("es-CL")}
                                </span>
                                {!p.is_expense && p.attendance_log && (
                                  <span className={`text-[10px] mt-1 font-bold inline-flex items-center gap-1 cursor-help ${
                                    p.attendance_log.is_complete 
                                      ? "text-emerald-400" 
                                      : "text-amber-400 animate-pulse"
                                  }`} title={p.attendance_log.is_complete ? "Jornada completa registrada" : "Jornada incompleta o salida pendiente"}>
                                    ⏱️ {Math.floor(p.attendance_log.total_duration_minutes / 60)}h {p.attendance_log.total_duration_minutes % 60}m
                                    {p.attendance_log.verified_by_admin && " (✍️)"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-6 text-left">
                              {missingBank ? (
                                <span className="text-xs px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded-lg font-semibold inline-flex items-center gap-1">
                                  ⚠️ Sin Datos de Transferencia
                                </span>
                              ) : (
                                <div className="flex flex-col text-xs text-gray-300 gap-0.5">
                                  <span className="font-bold flex items-center gap-1">
                                    <Building className="w-3.5 h-3.5 text-gray-400" /> {p.banco_name}
                                  </span>
                                  <span className="text-gray-400 flex items-center gap-1.5">
                                    Nº Cuenta:{" "}
                                    <span className="font-mono text-white font-semibold">
                                      {revealedAccounts[p.id] ? p.cuenta_destino : maskAccountNumber(p.cuenta_destino)}
                                    </span>
                                    <button
                                      onClick={() => toggleRevealAccount(p.id)}
                                      className="text-gray-400 hover:text-amber-400 transition-colors focus:outline-none"
                                      title={revealedAccounts[p.id] ? "Ocultar número de cuenta" : "Mostrar número de cuenta"}
                                    >
                                      {revealedAccounts[p.id] ? (
                                        <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                                      ) : (
                                        <Eye className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="py-4 px-6 text-center">
                              <div className="flex flex-col items-center gap-1.5 justify-center">
                                {renderInvoiceBadge(p)}
                                
                                {p.invoice_required && !p.invoice_received && p.status !== "Pagado" && (
                                  <button
                                    onClick={() => handleOpenInvoiceModal(p)}
                                    className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-gray-900 rounded-md text-[10px] font-extrabold uppercase transition-all duration-300 active:scale-95 cursor-pointer mt-1"
                                  >
                                    Confirmar Boleta
                                  </button>
                                )}

                                {p.invoice_required && p.invoice_received && p.status !== "Pagado" && (
                                  <div className="flex gap-2 mt-1">
                                    <button
                                      onClick={() => handleOpenInvoiceModal(p)}
                                      className="text-[10px] text-gray-400 hover:text-white underline transition-colors"
                                      title="Editar boleta"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={() => handleRevertInvoice(p.id)}
                                      className="text-[10px] text-red-400 hover:text-red-300 underline transition-colors"
                                      title="Deshacer boleta"
                                    >
                                      Deshacer
                                    </button>
                                  </div>
                                )}

                                {p.status !== "Pagado" && !p.is_expense && (
                                  <button
                                    onClick={() => handleToggleInvoiceRequired(p.id, p.invoice_required)}
                                    className="text-[10px] text-gray-500 hover:text-amber-400 transition-colors mt-1 underline cursor-pointer"
                                    title={p.invoice_required ? "Eximir del requisito de boleta" : "Exigir boleta para pagar"}
                                  >
                                    {p.invoice_required ? "Eximir boleta" : "Exigir boleta"}
                                  </button>
                                )}
                              </div>
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

              {/* Vista Móvil: Tarjetas Touch-Friendly (Visible en pantallas < md) */}
              <div className="md:hidden space-y-4 p-4">
                {loading ? (
                  <div className="py-12 text-center text-gray-500 font-medium">
                    Cargando registros financieros...
                  </div>
                ) : filteredPayments.length === 0 ? (
                  <div className="py-12 text-center text-gray-500 font-medium">
                    No se encontraron transferencias que coincidan con la búsqueda.
                  </div>
                ) : (
                  filteredPayments.map(p => {
                    const isSelected = selectedIds.includes(p.id);
                    const missingBank = !p.cuenta_destino || !p.codigo_banco_destino;

                    return (
                      <GlassCard
                        key={p.id}
                        onClick={() => {
                          if (p.status === "Pagado") return;
                          if (p.invoice_required && !p.invoice_received) {
                            toast.error("Este pago requiere boleta de honorarios verificada antes de poder seleccionarlo.");
                            return;
                          }
                          handleSelectOne(p.id);
                        }}
                        className={`p-5 transition-all duration-200 flex flex-col gap-4 border select-none ${
                          isSelected ? "border-amber-500/50 bg-amber-500/[0.03]" : "border-white/5 bg-gray-900/30"
                        } ${p.status === "Pagado" ? "opacity-70" : "active:bg-white/5"}`}
                      >
                        {/* Fila Superior: Checkbox / Nombre / RUT / Estado */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {p.status === "Pagado" ? (
                              <CheckSquare className="w-6 h-6 text-gray-600/50 shrink-0" />
                            ) : p.invoice_required && !p.invoice_received ? (
                              <Square 
                                className="w-6 h-6 text-red-500/30 shrink-0 cursor-not-allowed" 
                                title="Falta boleta de honorarios. No se puede seleccionar."
                              />
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectOne(p.id);
                                }}
                                className="text-gray-400 hover:text-white transition-colors shrink-0 p-1"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-6 h-6 text-amber-500" />
                                ) : (
                                  <Square className="w-6 h-6" />
                                )}
                              </button>
                            )}
                            <div className="flex flex-col">
                              <span className="font-extrabold text-white text-sm flex items-center gap-1.5 flex-wrap">
                                {p.staff_name}
                                {p.is_expense && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[9px] font-extrabold uppercase">
                                    {p.expense_type || "Viático"}
                                  </span>
                                )}
                              </span>
                              <span className="text-[11px] text-gray-400 font-mono mt-0.5">{p.staff_rut}</span>
                            </div>
                          </div>

                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shadow-sm border shrink-0 ${
                            p.status === "Pagado"
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-red-500/10 border-red-500/30 text-red-400'
                          }`}>
                            {p.status}
                          </span>
                        </div>

                        {/* Fila Media: Información de Evento / Datos Bancarios */}
                        <div className="grid grid-cols-1 gap-4 pt-3 border-t border-white/5 text-xs text-gray-300">
                          <div className="flex flex-col gap-1">
                            <span className="text-[9px] text-gray-500 uppercase font-extrabold tracking-wider">Evento / Fecha</span>
                            <span className="font-semibold text-gray-200">{p.event_name}</span>
                            <span className="text-gray-400 text-[10px]">{p.event_date}</span>
                          </div>

                          <div className="flex flex-col gap-1 pt-1">
                            <span className="text-[9px] text-gray-500 uppercase font-extrabold tracking-wider">Datos de Transferencia</span>
                            {missingBank ? (
                              <span className="text-[10px] px-2 py-1 bg-red-500/10 text-red-400 border border-red-500/20 rounded font-semibold inline-flex items-center gap-1 w-max mt-1">
                                ⚠️ Sin Datos Bancarios
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1 bg-black/20 p-2.5 rounded-xl border border-white/5">
                                <span className="font-bold flex items-center gap-1 text-[11px] text-gray-200">
                                  🏦 {p.banco_name}
                                </span>
                                <span className="text-gray-400 text-[10px] flex items-center gap-1.5">
                                  Cuenta:{" "}
                                  <span className="font-mono text-white font-semibold">
                                    {revealedAccounts[p.id] ? p.cuenta_destino : maskAccountNumber(p.cuenta_destino)}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleRevealAccount(p.id);
                                    }}
                                    className="text-gray-400 hover:text-amber-400 transition-colors p-1"
                                    title={revealedAccounts[p.id] ? "Ocultar número de cuenta" : "Mostrar número de cuenta"}
                                  >
                                    {revealedAccounts[p.id] ? (
                                      <EyeOff className="w-3.5 h-3.5 text-amber-500" />
                                    ) : (
                                      <Eye className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Fila Boleta Mobile */}
                        <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
                          <div className="flex items-center justify-between">
                            <span className="text-[9px] text-gray-500 uppercase font-extrabold tracking-wider">Boleta de Honorarios</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {renderInvoiceBadge(p)}
                            </div>
                          </div>

                          {/* Acciones de Boleta para Mobile */}
                          {p.status !== "Pagado" && (
                            <div className="flex flex-wrap gap-2.5 items-center justify-between bg-black/20 p-2 rounded-xl mt-1">
                              {!p.is_expense && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleInvoiceRequired(p.id, p.invoice_required);
                                  }}
                                  className="text-[10px] text-gray-400 hover:text-amber-400 transition-colors underline cursor-pointer p-1"
                                >
                                  {p.invoice_required ? "Eximir boleta" : "Exigir boleta"}
                                </button>
                              )}

                              {p.invoice_required && (
                                p.invoice_received ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenInvoiceModal(p);
                                      }}
                                      className="text-[10px] text-gray-300 hover:text-white underline cursor-pointer p-1"
                                    >
                                      Editar
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRevertInvoice(p.id);
                                      }}
                                      className="text-[10px] text-red-400 hover:text-red-300 underline cursor-pointer p-1"
                                    >
                                      Deshacer
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenInvoiceModal(p);
                                    }}
                                    className="px-3 py-1 bg-amber-500 text-black font-extrabold rounded-lg text-[9px] uppercase transition-all active:scale-95 cursor-pointer ml-auto"
                                  >
                                    Confirmar Boleta
                                  </button>
                                )
                              )}
                            </div>
                          )}

                          {p.invoice_received && (
                            <p className="text-[10px] text-gray-400 font-medium italic">
                              Verificado por {p.invoice_verified_by_name || 'Admin'} el {p.invoice_received_at ? new Date(p.invoice_received_at).toLocaleDateString("es-CL") : ''}
                              {p.invoice_notes && ` (Nota: "${p.invoice_notes}")`}
                            </p>
                          )}
                        </div>

                        {/* Fila Inferior: Monto de Honorario */}
                        <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-1">
                          <div className="flex flex-col">
                            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Monto a Transferir</span>
                            {!p.is_expense && p.attendance_log && (
                              <span className={`text-[9px] mt-0.5 font-extrabold inline-flex items-center gap-1 ${
                                p.attendance_log.is_complete 
                                  ? "text-emerald-400" 
                                  : "text-amber-400 animate-pulse"
                              }`}>
                                ⏱️ {Math.floor(p.attendance_log.total_duration_minutes / 60)}h {p.attendance_log.total_duration_minutes % 60}m
                                {p.attendance_log.verified_by_admin && " (corregido)"}
                              </span>
                            )}
                          </div>
                          <span className="font-black text-amber-400 text-base">
                            ${(parseFloat(p?.monto) || 0).toLocaleString("es-CL")}
                          </span>
                        </div>
                      </GlassCard>
                    );
                  })
                )}
              </div>
            </GlassCard>
          </motion.div>
        </>
      ) : (
        <div className="space-y-6">
          {/* Barra de Filtros de Gastos */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-900/40 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className="flex flex-wrap gap-2">
              {["all", "Pendiente", "En revisión", "Aprobado", "Rechazado", "Pagado"].map((status) => {
                const label = status === "all" ? "Todos" : status;
                const count = expenses.filter(e => status === "all" || e.status === status).length;
                return (
                  <button
                    key={status}
                    onClick={() => {
                      setExpenseStatusFilter(status);
                      setSelectedExpense(null);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer touch-manipulation active:opacity-85 ${
                      expenseStatusFilter === status
                        ? "bg-amber-500 text-black shadow-lg shadow-amber-500/20"
                        : "bg-gray-800/60 text-gray-400 hover:text-white"
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
            <div className="text-sm text-gray-400 font-medium">
              Mostrando {expenses.filter(e => expenseStatusFilter === "all" || e.status === expenseStatusFilter).length} solicitudes
            </div>
          </div>

          {/* Listado de Gastos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lista */}
            <div className="lg:col-span-2 space-y-4">
              {expenses.filter(e => expenseStatusFilter === "all" || e.status === expenseStatusFilter).length === 0 ? (
                <GlassCard className="p-12 text-center flex flex-col items-center justify-center border-dashed border-gray-700/60">
                  <FileText className="w-12 h-12 text-gray-500 mb-3" />
                  <p className="text-gray-400 font-bold">No se encontraron solicitudes de viáticos.</p>
                  <p className="text-xs text-gray-500 mt-1">Las solicitudes enviadas por los trabajadores aparecerán aquí.</p>
                </GlassCard>
              ) : (
                expenses
                  .filter(e => expenseStatusFilter === "all" || e.status === expenseStatusFilter)
                  .map((e) => {
                    const isSelected = selectedExpense?.id === e.id;
                    return (
                      <GlassCard
                        key={e.id}
                        onClick={() => {
                          setSelectedExpense(e);
                          setApprovedAmountInput(e.approved_amount || e.requested_amount || "");
                          setExpenseComment(e.admin_comment || "");
                        }}
                        className={`p-5 transition-all cursor-pointer border ${
                          isSelected
                            ? "border-amber-500/50 bg-amber-500/[0.02]"
                            : "border-white/5 hover:border-gray-700/80"
                        }`}
                      >
                        <div className="flex justify-between items-start gap-4">
                          <div className="space-y-2 text-left">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wide border ${
                                e.expense_type === "Viático" ? "bg-purple-500/10 border-purple-500/30 text-purple-400" :
                                e.expense_type === "Reembolso" ? "bg-teal-500/10 border-teal-500/30 text-teal-400" :
                                e.expense_type === "Compra Operacional" ? "bg-sky-500/10 border-sky-500/30 text-sky-400" :
                                "bg-gray-500/10 border-gray-500/30 text-gray-400"
                              }`}>
                                {e.expense_type}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${
                                e.status === "Pagado" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                                e.status === "Aprobado" ? "bg-amber-500/10 border-amber-500/30 text-amber-400" :
                                e.status === "En revisión" ? "bg-blue-500/10 border-blue-500/30 text-blue-400" :
                                e.status === "Rechazado" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                                "bg-gray-500/10 border-gray-500/30 text-gray-400"
                              }`}>
                                {e.status}
                              </span>
                            </div>

                            <div>
                              <h4 className="font-extrabold text-white text-base">{e.profiles?.name || "Trabajador Desconocido"}</h4>
                              <p className="text-xs text-gray-400 font-medium font-mono mt-0.5">{e.profiles?.rut}</p>
                            </div>

                            <p className="text-sm text-gray-300 line-clamp-2 bg-black/20 p-2.5 rounded-lg border border-white/5">
                              {e.description || <span className="italic text-gray-500">Sin descripción</span>}
                            </p>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-400 pt-1">
                              <span>Fecha: <strong className="text-gray-300 font-semibold">{e.expense_date}</strong></span>
                              <span>Evento: <strong className="text-gray-300 font-semibold">{e.events?.name || "Gasto General"}</strong></span>
                            </div>
                          </div>

                          <div className="text-right space-y-2 shrink-0">
                            <div>
                              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Monto Solicitado</p>
                              <p className="text-lg font-black text-gray-300">${parseFloat(e.requested_amount).toLocaleString("es-CL")}</p>
                            </div>

                            {e.approved_amount && (
                              <div>
                                <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Monto Aprobado</p>
                                <p className="text-lg font-black text-amber-400">${parseFloat(e.approved_amount).toLocaleString("es-CL")}</p>
                              </div>
                            )}

                            {e.receipt_url && (
                              <button
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleAdminViewReceipt(e.receipt_url);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-xs font-bold text-gray-200 hover:text-white rounded-xl border border-white/5 transition-all mt-2 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                Comprobante
                              </button>
                            )}
                          </div>
                        </div>

                        {e.admin_comment && (
                          <div className="mt-3 text-xs bg-gray-900/60 p-2.5 rounded-xl border border-white/5 text-gray-300 flex items-start gap-2">
                            <MessageSquare className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                            <div className="text-left">
                              <span className="font-bold text-gray-400">Comentario Admin: </span>
                              {e.admin_comment}
                            </div>
                          </div>
                        )}
                      </GlassCard>
                    );
                  })
              )}
            </div>

            {/* Panel de Detalle y Aprobación */}
            <div className="lg:col-span-1">
              <div className="sticky top-6">
                {selectedExpense ? (
                  /* Hybrid Sidebar on Desktop (lg) / Centered Backdrop Modal on Mobile/Tablet (<lg) */
                  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 lg:relative lg:inset-auto lg:bg-transparent lg:backdrop-blur-none lg:z-auto lg:p-0 lg:flex lg:w-full lg:max-w-none">
                    <GlassCard className="p-6 border-amber-500/20 space-y-6 w-full max-w-md lg:max-w-none relative max-h-[90vh] overflow-y-auto lg:max-h-none lg:overflow-visible shadow-2xl">
                      {/* Close button for mobile screens */}
                      <button
                        onClick={() => setSelectedExpense(null)}
                        className="absolute top-4 right-4 text-gray-400 hover:text-white lg:hidden bg-white/5 p-2 rounded-full cursor-pointer hover:bg-white/10 transition-colors"
                        title="Cerrar revisión"
                      >
                        <XCircle className="w-5 h-5 text-red-400" />
                      </button>

                      <div className="text-left">
                        <h3 className="text-lg font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 flex items-center gap-2">
                          <Sliders className="w-5 h-5 text-amber-400" />
                          Revisar Solicitud
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">Gestiona el estado y monto aprobado de la solicitud.</p>
                      </div>

                      <div className="space-y-4 text-sm text-left">
                        <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                          <p className="text-gray-400 text-xs font-bold uppercase tracking-wide">Detalles de Transferencia</p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500 font-semibold">Banco:</span>
                              <p className="font-bold text-gray-300">{BANCOS_CHILE[selectedExpense.profiles?.codigo_banco_destino] || "No registrado"}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 font-semibold">Nº Cuenta:</span>
                              <p className="font-bold text-gray-300 font-mono">{selectedExpense.profiles?.cuenta_destino || "No registrada"}</p>
                            </div>
                          </div>
                        </div>

                        {/* Monto Aprobado Input */}
                        <div className="space-y-2">
                          <CurrencyInputCLP
                            label="Monto Aprobado (CLP)"
                            id="approved_amount"
                            value={approvedAmountInput}
                            onChange={(val) => setApprovedAmountInput(val)}
                            placeholder="Monto final aprobado"
                          />
                          <p className="text-[10px] text-gray-500">
                            Monto solicitado original: <strong className="text-gray-400">${parseFloat(selectedExpense.requested_amount).toLocaleString("es-CL")}</strong>
                          </p>
                        </div>

                        {/* Comentario Admin */}
                        <div className="space-y-2">
                          <label className="block text-xs font-extrabold text-gray-300 uppercase tracking-wide">Comentario Administrativo</label>
                          <textarea
                            rows="3"
                            placeholder="Agrega una glosa o motivo de la decisión..."
                            value={expenseComment}
                            onChange={(e) => setExpenseComment(e.target.value)}
                            className="w-full bg-gray-950/80 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
                          />
                        </div>

                        {/* Acciones */}
                        <div className="space-y-2 pt-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleUpdateExpenseStatus(selectedExpense.id, "Aprobado")}
                              disabled={submittingExpenseAction}
                              className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-black text-xs font-black py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Aprobar
                            </button>
                            <button
                              onClick={() => handleUpdateExpenseStatus(selectedExpense.id, "Rechazado")}
                              disabled={submittingExpenseAction}
                              className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-black py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Rechazar
                            </button>
                          </div>
                          <button
                            onClick={() => handleUpdateExpenseStatus(selectedExpense.id, "En revisión")}
                            disabled={submittingExpenseAction}
                            className="w-full bg-blue-500/20 hover:bg-blue-500/30 disabled:opacity-50 text-blue-300 text-xs font-bold py-2.5 rounded-xl transition-all border border-blue-500/20 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Poner en revisión
                          </button>
                        </div>
                      </div>
                    </GlassCard>
                  </div>
                ) : (
                  /* Hidden on mobile, only shown on desktop */
                  <div className="hidden lg:block">
                    <GlassCard className="p-6 text-center border-dashed border-gray-700/60 py-16">
                      <Sliders className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-400 text-xs font-bold">Selecciona una solicitud</p>
                      <p className="text-[10px] text-gray-500 mt-1">Haz clic en cualquier viático de la lista para revisarlo aquí.</p>
                    </GlassCard>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Validación de Boleta de Honorarios */}
      {showInvoiceModal && (selectedInvoicePayment || selectedWorkerGroup) && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-gray-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between">
              <div className="text-left">
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 flex items-center gap-2">
                  🧾 Validar Boleta de Honorarios
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Ingresa los datos para liberar el pago de <strong>{selectedInvoicePayment ? selectedInvoicePayment.staff_name : selectedWorkerGroup.staff_name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowInvoiceModal(false);
                  setSelectedInvoicePayment(null);
                  setSelectedWorkerGroup(null);
                }}
                className="text-gray-400 hover:text-white bg-white/5 p-1.5 rounded-full transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5 text-red-400" />
              </button>
            </div>

            <form onSubmit={handleSaveInvoice} className="space-y-4 text-left">
              {(() => {
                const rate = parseFloat(retentionRateSetting || 15.25);
                const liquido = selectedInvoicePayment ? (parseFloat(selectedInvoicePayment.monto) || 0) : (parseFloat(selectedWorkerGroup.total_liquid) || 0);
                const brutoEsperado = Math.round(liquido / (1 - (rate / 100)));
                const retencionEstimada = brutoEsperado - liquido;
                
                const cleanFormAmount = parseFloat(String(invoiceFormAmount).replace(/\D/g, "")) || 0;
                const difference = Math.abs(cleanFormAmount - brutoEsperado);
                const hasDifference = difference > toleranceSetting;
                const isSubmitDisabled = isSubmittingInvoice || (hasDifference && (!invoiceFormNotes.trim() || !invoiceFormConfirmDifference));

                const detailLabel = selectedInvoicePayment ? selectedInvoicePayment.event_name : `${selectedWorkerGroup.payments.length} eventos agrupados`;
                const detailDate = selectedInvoicePayment ? selectedInvoicePayment.event_date : "Lote actual de pagos pendientes";

                return (
                  <>
                    <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1.5 text-xs">
                      <span className="text-gray-500 font-bold uppercase tracking-wider block text-3xs">Resumen Tributario del Servicio</span>
                      <p className="text-gray-200 font-medium text-2xs">{detailLabel}</p>
                      <p className="text-gray-500 text-3xs">{detailDate}</p>
                      
                      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/5 mt-1.5 text-2xs">
                        <div>
                          <span className="text-gray-400 block font-semibold">Monto Líquido:</span>
                          <p className="text-amber-400 font-extrabold text-xs">${liquido.toLocaleString("es-CL")} CLP</p>
                        </div>
                        <div>
                          <span className="text-gray-400 block font-semibold">Retención Estimada ({rate}%):</span>
                          <p className="text-gray-300 font-bold text-xs">${retencionEstimada.toLocaleString("es-CL")} CLP</p>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-white/5 mt-0.5">
                          <span className="text-emerald-400/90 block font-extrabold text-[10px] uppercase tracking-wider">Monto Bruto Sugerido (SII):</span>
                          <p className="text-emerald-400 font-extrabold text-sm">${brutoEsperado.toLocaleString("es-CL")} CLP</p>
                        </div>
                      </div>
                    </div>

                    {/* Número de Boleta */}
                    <div className="space-y-1">
                      <label className="block text-2xs font-extrabold text-gray-300 uppercase tracking-wide">
                        Número de Boleta *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: 1245"
                        value={invoiceFormNum}
                        onChange={(e) => setInvoiceFormNum(e.target.value.replace(/\D/g, ""))}
                        className="w-full bg-gray-950/80 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    {/* Monto de la Boleta */}
                    <div className="space-y-1">
                      <CurrencyInputCLP
                        label="Monto de la Boleta Recibida (CLP) *"
                        id="invoice_amount_input"
                        value={invoiceFormAmount}
                        onChange={(val) => setInvoiceFormAmount(val)}
                        placeholder="Monto bruto exacto emitido"
                      />
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Debe aproximarse al Monto Bruto Sugerido (${brutoEsperado.toLocaleString("es-CL")} CLP).
                      </p>
                    </div>

                    {/* Failsafe V2: Fuerte Advertencia por Diferencia de Redondeo */}
                    {hasDifference && (
                      <motion.div
                        initial={{ opacity: 0, y: -5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 text-left"
                      >
                        <div className="flex items-start gap-1.5 text-xs text-amber-400 font-bold">
                          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                          <span>Monto difiere del bruto esperado</span>
                        </div>
                        <p className="text-[10px] text-gray-300 leading-relaxed">
                          La diferencia de <strong>${difference.toLocaleString("es-CL")} CLP</strong> supera la tolerancia máxima permitida (${toleranceSetting} CLP). 
                          <strong> Es obligatorio escribir una justificación en las Notas/Observaciones</strong> y marcar la casilla de confirmación para habilitar la liberación del pago.
                        </p>
                        
                        <label className="flex items-start gap-2 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            required
                            checked={invoiceFormConfirmDifference}
                            onChange={(e) => setInvoiceFormConfirmDifference(e.target.checked)}
                            className="accent-amber-500 rounded cursor-pointer w-3.5 h-3.5 mt-0.5 shrink-0"
                          />
                          <span className="text-[10px] text-amber-200 font-bold leading-snug">
                            Autorizo registrar esta boleta con diferencia y confirmo justificación.
                          </span>
                        </label>
                      </motion.div>
                    )}

                    {/* Fecha de Recepción */}
                    <div className="space-y-1">
                      <label className="block text-2xs font-extrabold text-gray-300 uppercase tracking-wide">
                        Fecha de Recepción *
                      </label>
                      <input
                        type="date"
                        required
                        value={invoiceFormDate}
                        onChange={(e) => setInvoiceFormDate(e.target.value)}
                        className="w-full bg-gray-950/80 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                      />
                    </div>

                    {/* Notas/Comentarios */}
                    <div className="space-y-1">
                      <label className="block text-2xs font-extrabold text-gray-300 uppercase tracking-wide">
                        Notas / Observaciones {hasDifference && <span className="text-red-400 font-black">* (Obligatorio)</span>}
                      </label>
                      <textarea
                        rows="2"
                        placeholder={hasDifference ? "Ingresa obligatoriamente el motivo de la diferencia..." : "Opcional: glosa del correo, emisor, retención, etc..."}
                        value={invoiceFormNotes}
                        onChange={(e) => setInvoiceFormNotes(e.target.value)}
                        required={hasDifference}
                        className={`w-full bg-gray-950/80 border rounded-xl py-2 px-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none text-left ${hasDifference ? 'border-amber-500/50' : 'border-gray-800'}`}
                      />
                    </div>

                    {/* Declaración Jurada / Checkbox */}
                    <label className="flex items-start gap-2.5 bg-amber-500/5 p-3 rounded-xl border border-amber-500/10 cursor-pointer hover:bg-amber-500/10 transition-all select-none">
                      <input
                        type="checkbox"
                        required
                        checked={invoiceFormConfirmEmail}
                        onChange={(e) => setInvoiceFormConfirmEmail(e.target.checked)}
                        className="accent-amber-500 rounded cursor-pointer w-4 h-4 shrink-0 mt-0.5"
                      />
                      <span className="text-[10.5px] text-amber-200/90 font-medium leading-relaxed">
                        Confirmo que he recibido y validado esta boleta en el correo tributario <strong>contacto@laampolleta.tv</strong>
                      </span>
                    </label>

                    {/* Botones de acción */}
                    <div className="flex gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInvoiceModal(false);
                          setSelectedInvoicePayment(null);
                          setSelectedWorkerGroup(null);
                        }}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold py-2.5 rounded-xl transition-all border border-white/5 text-center cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitDisabled}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed text-black text-xs font-black py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1 cursor-pointer"
                      >
                        {isSubmittingInvoice ? (
                          <span>Guardando...</span>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Validar y Liberar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </motion.div>
        </div>
      )}

      {/* Modal de Ajustes Financieros (Retención y Tolerancia V2) */}
      {isEditingSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-sm bg-gray-900/80 border border-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-2xl space-y-5"
          >
            <div className="flex items-start justify-between">
              <div className="text-left">
                <h3 className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-400 flex items-center gap-2">
                  ⚙️ Ajustes Financieros
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Configura los valores globales de cálculo de boletas del SII
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingSettings(false)}
                className="text-gray-400 hover:text-white bg-white/5 p-1 rounded-full transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5 text-red-400" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4 text-left">
              <div>
                <label className="block text-2xs font-extrabold text-gray-300 uppercase tracking-wide mb-1.5">
                  Porcentaje de Retención SII (%) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={inputRate}
                  onChange={(e) => setInputRate(e.target.value)}
                  className="w-full bg-gray-950/80 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  placeholder="Ej: 15.25"
                  required
                />
                <span className="text-[10px] text-gray-400 mt-1 block leading-normal">
                  Fórmula: Bruto = Líquido / (1 - tasa).
                </span>
              </div>

              <div>
                <label className="block text-2xs font-extrabold text-gray-300 uppercase tracking-wide mb-1.5">
                  Tolerancia de Redondeo ($ CLP) *
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={inputTolerance}
                  onChange={(e) => setInputTolerance(e.target.value)}
                  className="w-full bg-gray-950/80 border border-gray-800 rounded-xl py-2 px-3 text-xs text-white focus:outline-none focus:border-amber-500 font-mono"
                  placeholder="Ej: 10"
                  required
                />
                <span className="text-[10px] text-gray-400 mt-1 block leading-normal">
                  Diferencia máxima antes de exigir justificación y observaciones obligatorias.
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingSettings(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold py-2.5 rounded-xl transition-all border border-white/5 text-center cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingSettings}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-black text-xs font-black py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center cursor-pointer"
                >
                  {isSavingSettings ? "Guardando..." : "Guardar Ajustes"}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
