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
 */
export default function EventToolbar({ onSearch, onFilter, onAdd }) {
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
      className="flex flex-col md:flex-row gap-4 items-center mb-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="relative w-full md:max-w-md flex items-center space-x-2">
          <span className="text-gray-300">Buscar:</span>
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar eventos..."
            value={search}
            onChange={handleSearch}
            className="w-full pl-12 pr-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all"
          />

      </div>
      <select
        value={status}
        onChange={handleFilter}
        className="px-4 py-2 bg-black/40 border border-white/10 rounded-xl text-white focus:outline-none"
      >
        <option value="">Todos los estados</option>
        <option value="planned">Planificado</option>
        <option value="confirmed">Confirmado</option>
        <option value="active">Activo</option>
        <option value="completed">Completado</option>
      </select>
      <Button variant="primary" className="flex items-center gap-2" onClick={onAdd}>
        <Plus className="w-4 h-4" />
        Nuevo Evento
      </Button>
    </motion.div>
  );
}
