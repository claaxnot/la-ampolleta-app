import React, { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus } from "lucide-react";
import Button from "./Button.jsx";

/**
 * EventToolbar – search, filter, and add new event button.
 * Props:
 *   onSearch(term: string)
 *   onFilter(status: string)
 *   onAdd()
 *   canCreate(boolean)
 */
export default function EventToolbar({ 
  onSearch, 
  onFilter, 
  onAdd, 
  canCreate = true, 
  selectedYear,
  onYearChange,
  yearOptions = [],
  selectedMonth, 
  onMonthChange,
  monthOptions = []
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const handleSearch = (e) => {
    const val = e.target.value;
    setSearch(val);
    onSearch(val);
  };

  const handleFilter = (e) => {
    const val = e.target.value;
    setStatus(val);
    onFilter(val);
  };

  return (
    <motion.div
      className="flex flex-col xl:flex-row gap-4 items-center mb-6 w-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Buscador */}
      <div className="relative w-full xl:max-w-md flex items-center space-x-2">
        <span className="text-gray-300 text-sm font-semibold shrink-0">Buscar:</span>
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar eventos por nombre..."
            value={search}
            onChange={handleSearch}
            className="w-full pl-10 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center w-full xl:w-auto ml-auto">
        {/* Filtro por Año */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-gray-300 text-sm font-semibold whitespace-nowrap shrink-0">Año:</span>
          <select
            value={selectedYear}
            onChange={(e) => onYearChange(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 transition-colors text-sm"
          >
            <option value="all">Todos</option>
            {yearOptions.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Filtro por Mes */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-gray-300 text-sm font-semibold whitespace-nowrap shrink-0">Mes:</span>
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="w-full sm:w-auto px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 transition-colors text-sm"
          >
            <option value="all">Todos</option>
            {monthOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Filtro por Estado */}
        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <span className="text-gray-300 text-sm font-semibold whitespace-nowrap shrink-0">Estado:</span>
          <select
            value={status}
            onChange={handleFilter}
            className="w-full sm:w-auto px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary/50 transition-colors text-sm"
          >
            <option value="">Todos los estados</option>
            <option value="planned">Planificado</option>
            <option value="confirmed">Confirmado</option>
            <option value="active">Activo</option>
            <option value="completed">Completado</option>
          </select>
        </div>

        {/* Botón Nuevo Evento */}
        <Button 
          variant="primary" 
          className={`w-full sm:w-auto flex items-center justify-center gap-2 shrink-0 ${!canCreate ? 'opacity-50 cursor-not-allowed' : ''}`} 
          onClick={(e) => {
            if (!canCreate) {
              e.preventDefault();
              return;
            }
            onAdd();
          }}
          title={!canCreate ? "Disponible solo para administradores" : ""}
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Evento</span>
        </Button>
      </div>
    </motion.div>
  );
}
