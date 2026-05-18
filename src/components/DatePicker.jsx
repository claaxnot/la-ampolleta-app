import React, { useState, useEffect, useRef } from "react";
import { Calendar, ChevronLeft, ChevronRight, Check } from "lucide-react";

export default function DatePicker({ value, onChange, label, id, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

  // Parse value (YYYY-MM-DD) or fallback to today
  const parseDate = (dateStr) => {
    if (!dateStr || !dateStr.includes("-")) {
      return new Date();
    }
    const [y, m, d] = dateStr.split("-").map(Number);
    // Use local timezone to prevent UTC date shifting
    return new Date(y, m - 1, d);
  };

  const selectedDate = parseDate(value);
  
  // viewDate controls which month is currently visible in the picker grid
  const [viewDate, setViewDate] = useState(selectedDate);

  // Synchronize viewDate when the value changes externally
  useEffect(() => {
    if (value) {
      setViewDate(parseDate(value));
    }
  }, [value]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthsSpanish = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];
  
  const weekdays = ["D", "L", "M", "M", "J", "V", "S"];

  // Generate calendar days
  const getCalendarDays = () => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevDaysInMonth = new Date(year, month, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday

    const days = [];

    // Pad previous month's ending days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevDaysInMonth - i,
        isCurrentMonth: false,
        monthOffset: -1
      });
    }

    // Current month's days
    for (let i = 1; i <= daysInMonth; i++) {
      days.push({
        day: i,
        isCurrentMonth: true,
        monthOffset: 0
      });
    }

    // Pad next month's beginning days
    const totalCells = days.length <= 35 ? 35 : 42;
    const nextDaysCount = totalCells - days.length;
    for (let i = 1; i <= nextDaysCount; i++) {
      days.push({
        day: i,
        isCurrentMonth: false,
        monthOffset: 1
      });
    }

    return days;
  };

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleDaySelect = (dayObj) => {
    const d = new Date(year, month + dayObj.monthOffset, dayObj.day);
    const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    onChange(formatted);
    setIsOpen(false);
  };

  const isToday = (dayObj) => {
    const d = new Date();
    const checkDate = new Date(year, month + dayObj.monthOffset, dayObj.day);
    return (
      d.getDate() === checkDate.getDate() &&
      d.getMonth() === checkDate.getMonth() &&
      d.getFullYear() === checkDate.getFullYear()
    );
  };

  const isSelected = (dayObj) => {
    if (!value) return false;
    const checkDate = new Date(year, month + dayObj.monthOffset, dayObj.day);
    return (
      selectedDate.getDate() === checkDate.getDate() &&
      selectedDate.getMonth() === checkDate.getMonth() &&
      selectedDate.getFullYear() === checkDate.getFullYear()
    );
  };

  // Format date to readable string (e.g. "18 May 2026")
  const getReadableDate = () => {
    if (!value) return "";
    const monthsShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    return `${selectedDate.getDate()} ${monthsShort[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  };

  return (
    <div className="flex flex-col relative w-full">
      {label && <label className="text-gray-300 mb-1.5 text-xs font-semibold">{label}</label>}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          readOnly
          value={getReadableDate()}
          onClick={() => setIsOpen(true)}
          placeholder="Seleccionar Fecha"
          className={`w-full bg-gray-800/50 border rounded-xl p-2.5 pr-10 text-sm text-white placeholder-gray-500 cursor-pointer focus:outline-none focus:border-amber-500/50 transition-colors ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`}
        />
        <Calendar className="absolute right-3.5 w-4 h-4 text-amber-400/80 pointer-events-none" />
      </div>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute z-50 mt-2 top-full left-0 bg-gray-950/95 border border-white/10 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl w-[220px] flex flex-col select-none"
        >
          {/* Calendar Header */}
          <div className="flex items-center justify-between w-full mb-3">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-extrabold text-amber-400 uppercase tracking-wider">
              {monthsSpanish[month]} {year}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-[10px] font-bold text-gray-500 text-center mb-1">
            {weekdays.map((wd, i) => (
              <span key={`wd-${i}`}>{wd}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {getCalendarDays().map((dayObj, i) => {
              const selected = isSelected(dayObj);
              const today = isToday(dayObj);
              return (
                <button
                  key={`day-${i}`}
                  type="button"
                  onClick={() => handleDaySelect(dayObj)}
                  className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-semibold transition-all ${
                    selected
                      ? "bg-amber-500 text-black font-extrabold shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                      : today
                      ? "border border-amber-500/50 text-amber-400 font-bold"
                      : dayObj.isCurrentMonth
                      ? "text-gray-300 hover:bg-white/10 hover:text-white"
                      : "text-gray-600 hover:bg-white/5 hover:text-gray-400"
                  }`}
                >
                  {dayObj.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
