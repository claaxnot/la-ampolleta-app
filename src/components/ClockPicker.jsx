import React, { useState, useEffect, useRef } from "react";
import { Clock, Check } from "lucide-react";

export default function ClockPicker({ value, onChange, label, id, error }) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState("hours"); // "hours" | "minutes"
  const popoverRef = useRef(null);

  // Parse current value (HH:MM)
  const parseTime = (timeStr) => {
    if (!timeStr || !timeStr.includes(":")) {
      return { hour: 12, minute: 0, period: "PM" };
    }
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h >= 12 ? "PM" : "AM";
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return { hour: h, minute: m, period };
  };

  const { hour: currentHour, minute: currentMinute, period: currentPeriod } = parseTime(value);

  // Format and save time
  const saveTime = (h, m, p) => {
    let rawHour = h;
    if (p === "PM" && rawHour < 12) rawHour += 12;
    if (p === "AM" && rawHour === 12) rawHour = 0;
    
    const formattedHour = String(rawHour).padStart(2, "0");
    const formattedMinute = String(m).padStart(2, "0");
    onChange(`${formattedHour}:${formattedMinute}`);
  };

  const hoursList = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const minutesList = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

  // Get coordinates for placement on clock face (diameter 180px, radius 90px, center 90, 90)
  const getCoords = (index, total, radius = 64) => {
    const angle = (index * 360 / total) * (Math.PI / 180);
    const x = Math.sin(angle) * radius;
    const y = -Math.cos(angle) * radius;
    return { x: 90 + x, y: 90 + y };
  };

  // Close when clicking outside
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

  const handleHourSelect = (h) => {
    saveTime(h, currentMinute, currentPeriod);
    setMode("minutes"); // Auto switch to minutes
  };

  const handleMinuteSelect = (m) => {
    saveTime(currentHour, m, currentPeriod);
  };

  const togglePeriod = (p) => {
    saveTime(currentHour, currentMinute, p);
  };

  // Calculate hand rotation angle
  const getHandRotation = () => {
    if (mode === "hours") {
      const index = hoursList.indexOf(currentHour);
      return index * 30; // 360 / 12 = 30 deg per hour
    } else {
      // Find nearest 5-minute index
      const index = minutesList.indexOf(Math.round(currentMinute / 5) * 5 % 60);
      return index >= 0 ? index * 30 : (currentMinute * 6); // 360 / 60 = 6 deg per minute
    }
  };

  return (
    <div className="flex flex-col relative w-full">
      {label && <label className="text-gray-300 mb-1.5 text-xs font-semibold">{label}</label>}
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          readOnly
          value={value || ""}
          onClick={() => {
            setIsOpen(true);
            setMode("hours");
          }}
          placeholder="--:--"
          className={`w-full bg-gray-800/50 border rounded-xl p-2.5 pr-10 text-sm text-white placeholder-gray-500 cursor-pointer focus:outline-none focus:border-amber-500/50 transition-colors ${error ? 'border-red-500 focus:ring-red-500' : 'border-gray-700'}`}
        />
        <Clock className="absolute right-3.5 w-4 h-4 text-amber-400/80 pointer-events-none" />
      </div>

      {isOpen && (
        <div 
          ref={popoverRef}
          className="absolute z-50 mt-2 top-full left-0 bg-gray-950/95 border border-white/10 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl w-[220px] flex flex-col items-center select-none"
        >
          {/* Header Display */}
          <div className="flex items-center justify-between w-full mb-3.5 px-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode("hours")}
                className={`text-2xl font-black transition-colors ${mode === "hours" ? "text-amber-400" : "text-gray-500 hover:text-gray-300"}`}
              >
                {String(currentHour).padStart(2, "0")}
              </button>
              <span className="text-2xl font-black text-gray-600">:</span>
              <button
                type="button"
                onClick={() => setMode("minutes")}
                className={`text-2xl font-black transition-colors ${mode === "minutes" ? "text-amber-400" : "text-gray-500 hover:text-gray-300"}`}
              >
                {String(currentMinute).padStart(2, "0")}
              </button>
            </div>
            
            {/* AM/PM Toggle */}
            <div className="flex flex-col gap-0.5 text-[9px] font-bold">
              <button
                type="button"
                onClick={() => togglePeriod("AM")}
                className={`px-1.5 py-0.5 rounded-md transition-colors ${currentPeriod === "AM" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-gray-500 hover:text-gray-300"}`}
              >
                AM
              </button>
              <button
                type="button"
                onClick={() => togglePeriod("PM")}
                className={`px-1.5 py-0.5 rounded-md transition-colors ${currentPeriod === "PM" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-gray-500 hover:text-gray-300"}`}
              >
                PM
              </button>
            </div>
          </div>

          {/* Clock Face Container */}
          <div className="relative w-[180px] h-[180px] bg-gray-900/60 border border-white/5 rounded-full flex items-center justify-center shadow-inner">
            
            {/* Clock Hand */}
            <div 
              className="absolute w-1 bg-amber-500 origin-bottom rounded-full transition-transform duration-300 ease-out"
              style={{
                height: "64px",
                bottom: "90px",
                transform: `rotate(${getHandRotation()}deg)`,
                transformOrigin: "bottom center"
              }}
            >
              {/* Circular selector on target value */}
              <div className="absolute -top-2.5 -left-3 w-7 h-7 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] border border-amber-300/30 flex items-center justify-center text-[10px] font-black text-black">
                {mode === "hours" ? currentHour : String(currentMinute).padStart(2, "0")}
              </div>
            </div>

            {/* Center Pivot Dot */}
            <div className="absolute w-2 h-2 rounded-full bg-amber-500 z-20" />

            {/* Numbers Placement */}
            {mode === "hours" ? (
              hoursList.map((h, i) => {
                const { x, y } = getCoords(i, 12);
                const isSelected = currentHour === h;
                return (
                  <button
                    key={`h-${h}`}
                    type="button"
                    onClick={() => handleHourSelect(h)}
                    style={{ left: `${x - 12}px`, top: `${y - 12}px` }}
                    className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-200 z-10 ${isSelected ? "text-transparent pointer-events-none" : "text-gray-300 hover:bg-white/10 hover:text-white font-semibold"}`}
                  >
                    {h}
                  </button>
                );
              })
            ) : (
              minutesList.map((m, i) => {
                const { x, y } = getCoords(i, 12);
                const isSelected = Math.round(currentMinute / 5) * 5 % 60 === m;
                return (
                  <button
                    key={`m-${m}`}
                    type="button"
                    onClick={() => handleMinuteSelect(m)}
                    style={{ left: `${x - 12}px`, top: `${y - 12}px` }}
                    className={`absolute w-6 h-6 rounded-full flex items-center justify-center text-[10px] transition-all duration-200 z-10 ${isSelected ? "text-transparent pointer-events-none" : "text-gray-400 hover:bg-white/10 hover:text-white font-semibold"}`}
                  >
                    {String(m).padStart(2, "0")}
                  </button>
                );
              })
            )}
          </div>

          {/* Quick Confirmation Button */}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="mt-3.5 w-full py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-extrabold text-[11px] rounded-xl transition-all shadow-[0_4px_15px_rgba(245,158,11,0.3)] active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3 h-3 stroke-[3]" />
            <span>Confirmar Hora</span>
          </button>
        </div>
      )}
    </div>
  );
}
