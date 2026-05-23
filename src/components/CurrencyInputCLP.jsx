import React from "react";

// Format helper to display CLP standard thousands separation (e.g. 15000 -> "15.000")
const formatCLP = (val) => {
  if (val === undefined || val === null || val === "") return "";
  const numString = String(val).replace(/\D/g, "");
  if (!numString) return "";
  const num = parseInt(numString, 10);
  return num.toLocaleString("es-CL");
};

export default function CurrencyInputCLP({
  value,
  onChange,
  label,
  placeholder = "0",
  id,
  className = "",
  required = false,
  disabled = false,
  error = null,
  compact = false
}) {
  const displayValue = formatCLP(value);

  const handleInputChange = (e) => {
    const rawVal = e.target.value;
    
    // Sanitize non-digit characters to keep a clean integer internally
    const digits = rawVal.replace(/\D/g, "");
    const numericValue = digits ? parseInt(digits, 10) : "";
    
    onChange(numericValue);
  };

  // Compact layout: perfectly suited for table lists or tight spaces
  if (compact) {
    return (
      <div className="relative flex items-center w-24">
        <span className="absolute left-2 text-gray-500 font-bold text-xs pointer-events-none select-none">
          $
        </span>
        <input
          type="text"
          id={id}
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full bg-gray-800/80 border border-gray-700 rounded px-2 py-1 pl-5 text-xs text-white text-right placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors ${className}`}
        />
      </div>
    );
  }

  // Standard premium glassmorphism input: perfectly suited for full forms
  return (
    <div className="flex flex-col relative w-full text-left">
      {label && (
        <label htmlFor={id} className="text-gray-300 mb-1 text-xs font-bold uppercase tracking-wider">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <span className="absolute left-3.5 text-gray-400 font-bold text-sm pointer-events-none select-none">
          $
        </span>
        <input
          type="text"
          id={id}
          value={displayValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`w-full bg-gray-950/60 border rounded-xl p-3 pl-8 text-sm text-white text-right focus:outline-none focus:border-amber-500 transition-all ${
            error ? "border-red-500/50 focus:ring-red-500/30" : "border-white/10"
          } ${className}`}
        />
      </div>
      {error && <span className="text-red-400 text-xs mt-1">{error}</span>}
    </div>
  );
}
