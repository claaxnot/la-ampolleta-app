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

  const toggleRevealAccount = (id) => {
    setRevealedAccounts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskAccountNumber = (accountNumber) => {
    if (!accountNumber) return "No registrada";
    const str = String(accountNumber);
    if (str.length <= 4) return "•••• " + str;
    return "•••• " + str.slice(-4);
  };

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
              event_name: e.events?.name ? `[Viático] ${e.events.name}` : `[Gasto] ${e.expense_type}`,
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
              assignment_status: "Confirmado"
            };
          });
      }

      if (assignments) {
        // Formatear y calcular montos de eventos
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
            assignment_status: a.status
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
    const loadingToast = toast.loading("Generando enlace seguro...");
    try {
      const { data, error } = await supabase.storage
        .from("receipts")
        .createSignedUrl(receiptUrl, 900); // 15 minutos de vigencia

      if (error) throw error;

      if (data?.signedUrl) {
        toast.success("¡Enlace generado! Abriendo comprobante...", { id: loadingToast });
        window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      } else {
        throw new Error("No se pudo obtener el enlace firmado.");
      }
    } catch (err) {
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

      const selectedEventPayments = selectedPayments.filter(p => !p.is_expense);
      const selectedExpensePayments = selectedPayments.filter(p => p.is_expense);

      // 1. HOJA 1: RESUMEN DE TRANSFERENCIAS (Agrupar y sumar todos los montos)
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

      // 2. HOJA 2: DESGLOSE COMPLETO POR EVENTO (Solo eventos, manteniendo Rol Staff)
      const dataDesglose = selectedEventPayments.map(p => ({
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

      // 3. HOJA 3: DETALLE VIÁTICOS (Generación de enlaces de comprobantes válidos por 7 días)
      const selectedExpenseIds = selectedExpensePayments.map(p => p.expense_id);
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

      const workbook = XLSX.utils.book_new();

      // Hoja 1
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

      // Hoja 2
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

      // Hoja 3
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

      toast.success("¡Nómina de Excel de Pagos (3 Hojas) descargada con éxito!", { id: loadingToast });
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
      const selectedEventPayments = filteredPayments.filter(p => !p.is_expense);
      const selectedExpensePayments = filteredPayments.filter(p => p.is_expense);

      // 1. HOJA 1: RESUMEN DE TRANSFERENCIAS
      const grouped = {};
      filteredPayments.forEach(p => {
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
      const dataDesglose = selectedEventPayments.map(p => ({
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
      const selectedExpenseIds = selectedExpensePayments.map(p => p.expense_id);
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

      const workbook = XLSX.utils.book_new();

      // Hoja 1
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

      // Hoja 2
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

      // Hoja 3
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

      toast.success("¡Reporte financiero filtrado (3 Hojas) descargado con éxito!", { id: loadingToast });
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

    const matchesFinished = includeFuture || p.is_finished;

    return matchesSearch && matchesStatus && matchesMonth && matchesFinished;
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

      {/* Tabs Administrador de Finanzas */}
      <motion.div variants={itemVariants} className="flex items-center gap-2 bg-gray-900/60 p-1.5 rounded-xl border border-white/5 max-w-sm mb-6">
        <button
          onClick={() => setAdminTab("nominas")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
            adminTab === "nominas" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          Nóminas y Pagos
        </button>
        <button
          onClick={() => setAdminTab("viaticos")}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
            adminTab === "viaticos" ? "bg-amber-500/20 text-amber-300 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Aprobación Viáticos
        </button>
      </motion.div>

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

              <label className="flex items-center gap-2 cursor-pointer bg-gray-800/40 border border-gray-700/60 rounded-xl px-3.5 py-1.5 text-xs font-semibold text-gray-300 hover:text-white hover:border-amber-500/30 transition-all select-none h-[38px]">
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
                      <th className="py-4 px-6 text-left">Trabajador (Staff)</th>
                      <th className="py-4 px-6 text-left">Evento / Fecha</th>
                      <th className="py-4 px-6 text-left">Monto Honorario / Gasto</th>
                      <th className="py-4 px-6 text-left">Datos de Transferencia</th>
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
                            <td className="py-4 px-6 text-left">
                              <div className="flex flex-col">
                                <span className="font-bold text-white flex items-center gap-1.5">
                                  {p.staff_name}
                                  {p.is_expense && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase font-sans">
                                      Viático
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
                              <span className="font-extrabold text-amber-400">
                                ${p.monto.toLocaleString("es-CL")}
                              </span>
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
        </>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="space-y-6"
        >
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
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
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
        </motion.div>
      )}
    </motion.div>
  );
}
