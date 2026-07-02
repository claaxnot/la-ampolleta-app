import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, Calendar, LogOut, Lightbulb, User as UserIcon, X, DollarSign } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Sidebar({ user, onLogout, isOpen, setIsOpen }) {
  const location = useLocation();
  const [logoError, setLogoError] = React.useState(false);
  const [isAboutOpen, setIsAboutOpen] = React.useState(false);
  const [aboutLogoError, setAboutLogoError] = React.useState(false);

  const adminLinks = [
    { to: "/dashboard", label: "Panel de Control", icon: LayoutDashboard },
    { to: "/events", label: "Eventos", icon: CalendarDays },
    { to: "/staff", label: "Personal", icon: Users },
    { to: "/calendar", label: "Calendario", icon: Calendar },
    { to: "/finanzas", label: "Finanzas", icon: DollarSign },
  ];

  const adminWorkerLinks = [
    { to: "/worker-dashboard", label: "Mi Panel", icon: LayoutDashboard },
    { to: "/worker-dashboard?tab=finanzas", label: "Finanzas propias", icon: DollarSign },
    { to: "/profile", label: "Mi perfil", icon: UserIcon },
  ];

  const workerLinks = [
    { to: "/worker-dashboard", label: "Mi Panel", icon: LayoutDashboard },
    { to: "/worker-dashboard?tab=finanzas", label: "Finanzas", icon: DollarSign },
    { to: "/profile", label: "Mi Perfil", icon: UserIcon },
  ];

  const isLinkActive = (to) => {
    if (to === "/worker-dashboard") {
      return location.pathname === "/worker-dashboard" && !location.search.includes("tab=finanzas");
    }
    if (to === "/worker-dashboard?tab=finanzas") {
      return location.pathname === "/worker-dashboard" && location.search.includes("tab=finanzas");
    }
    return location.pathname === to;
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      <nav className={`
        fixed lg:relative inset-y-0 left-0 z-50 w-64 h-screen bg-black/80 lg:bg-black/40 backdrop-blur-3xl border-r border-white/10 text-gray-100 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        {/* Subtle background glow */}
        <div className="absolute top-0 left-0 w-full h-32 bg-accent/10 blur-3xl rounded-full -translate-y-1/2"></div>

        <div className="p-6 relative z-10">
          <div className="flex items-center justify-between lg:justify-center mb-8">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-white/5 backdrop-blur-md rounded-xl border border-white/10 hover:border-accent/30 transition-all duration-300">
                {!logoError ? (
                  <img
                    src="/isotipo.png"
                    alt="Logo"
                    onError={() => setLogoError(true)}
                    className="w-8 h-8 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                  />
                ) : (
                  <Lightbulb className="w-8 h-8 text-accent" />
                )}
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold tracking-tight text-white leading-tight">La Ampolleta</span>
                <span className="text-xs text-accent uppercase tracking-wider font-semibold">Producciones</span>
              </div>
            </div>
            {/* Close button for mobile */}
            <button
              className="lg:hidden text-gray-400 hover:text-white"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <ul className="flex-1 space-y-2 px-4 relative z-10 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-800">
          {user?.systemRole === 'worker' ? (
            workerLinks.map((link) => {
              const active = isLinkActive(link.to);
              return (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300 ${active
                      ? "bg-accent/10 text-accent font-medium shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]"
                      : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                      }`}
                  >
                    <link.icon className="w-5 h-5" />
                    {link.label}
                  </Link>
                </li>
              );
            })
          ) : (
            <>
              {/* Subtle agrupador for Admin Menu */}
              <div className="pb-1.5 px-4">
                <span className="text-[10px] font-extrabold text-amber-500/80 uppercase tracking-widest block border-b border-gray-800/60 pb-1.5 mb-1">
                  Menú Administrador
                </span>
              </div>

              {adminLinks.map((link) => {
                const active = isLinkActive(link.to);
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300 ${active
                        ? "bg-accent/10 text-accent font-medium shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                        }`}
                    >
                      <link.icon className="w-5 h-5" />
                      {link.label}
                    </Link>
                  </li>
                );
              })}

              {/* Subtle agrupador for Worker Menu */}
              <div className="pt-4 pb-1.5 px-4">
                <span className="text-[10px] font-extrabold text-amber-500/80 uppercase tracking-widest block border-b border-gray-800/60 pb-1.5 mb-1">
                  Menú Trabajador
                </span>
              </div>

              {adminWorkerLinks.map((link) => {
                const active = isLinkActive(link.to);
                return (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300 ${active
                        ? "bg-accent/10 text-accent font-medium shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]"
                        : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                        }`}
                    >
                      <link.icon className="w-5 h-5" />
                      {link.label}
                    </Link>
                  </li>
                );
              })}
            </>
          )}
        </ul>

        <div className="p-4 relative z-10 border-t border-gray-800 flex flex-col items-center gap-3">
          <button
            onClick={() => {
              onLogout();
              setIsOpen(false);
            }}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl transition-all duration-300"
          >
            <LogOut className="w-5 h-5" />
            Cerrar sesión
          </button>

          {/* Subtle Signature Trigger */}
          <button
            type="button"
            onClick={() => setIsAboutOpen(true)}
            className="group flex flex-col items-center gap-0.5 cursor-pointer select-none bg-transparent border-none p-0 focus:outline-none"
            title="Ver detalles del sistema"
          >
            <span className="text-[9px] text-gray-500 group-hover:text-amber-400/90 transition-colors font-extrabold uppercase tracking-widest">
              La Ampolleta Platform v3.7.9
            </span>
            <span className="text-[8px] text-gray-600 group-hover:text-gray-400 transition-colors font-medium tracking-wider">
              Engineered by Cristopher Vidal
            </span>
          </button>
        </div>
      </nav>

      {/* Elegant 'About Platform' Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAboutOpen(false)}
              className="absolute inset-0 bg-black/75 backdrop-blur-md"
            />

            {/* Modal Container */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-sm bg-gray-950/75 border border-white/10 p-6 rounded-3xl backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col items-center text-center select-none"
            >
              {/* Pulsing Gold Real Logo Icon */}
              <div className="p-3.5 bg-amber-500/15 rounded-2xl border border-amber-500/20 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] flex items-center justify-center w-16 h-16 transition-all duration-300">
                {!aboutLogoError ? (
                  <img
                    src="/isotipo.png"
                    alt="Logo"
                    onError={() => setAboutLogoError(true)}
                    className="w-10 h-10 object-contain drop-shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse"
                  />
                ) : (
                  <Lightbulb className="w-8 h-8 text-amber-400 animate-pulse" />
                )}
              </div>

              {/* Platform Title */}
              <div className="flex items-center gap-1.5 mb-1">
                <h3 className="text-base font-black text-white tracking-tight">La Ampolleta Platform</h3>
                <span className="text-[7px] font-extrabold bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded border border-amber-500/20 uppercase tracking-widest">
                  Internal
                </span>
              </div>
              <span className="text-[10px] text-gray-500 font-extrabold tracking-wider mb-5">Versión 3.7.9 • Producción</span>

              {/* Description */}
              <p className="text-[11px] text-gray-400 leading-relaxed max-w-[280px] mb-5">
                Sistema de control operacional, financiero y de asistencia diseñado y optimizado a medida para las operaciones de <span className="text-white font-bold">La Ampolleta Producciones</span>.
              </p>

              {/* Divider line */}
              <div className="w-full h-px bg-white/5 mb-4" />

              {/* Technical Specifications Grid */}
              <div className="w-full grid grid-cols-2 gap-y-4 gap-x-2 text-left text-xs mb-6 px-2">
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-600 uppercase tracking-widest font-extrabold">Arquitectura & Dev</span>
                  <span className="text-[11px] text-gray-200 font-bold">Cristopher Vidal</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-600 uppercase tracking-widest font-extrabold">Entorno</span>
                  <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" /> Activo
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-600 uppercase tracking-widest font-extrabold">Tech Frontend</span>
                  <span className="text-[10px] text-gray-300 font-medium">React + Vite + Tailwind</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[8px] text-gray-600 uppercase tracking-widest font-extrabold">Base de Datos</span>
                  <span className="text-[10px] text-gray-300 font-medium">PostgreSQL</span>
                </div>
              </div>

              {/* Version Build Badge */}
              <div className="text-[9px] text-gray-600 mb-6 font-bold uppercase tracking-widest">
                Build: 2026.06 • All Rights Reserved
              </div>

              {/* Dismiss Button */}
              <button
                type="button"
                onClick={() => setIsAboutOpen(false)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 active:scale-95 text-xs text-white border border-white/10 rounded-xl transition-all font-bold uppercase tracking-wider focus:outline-none"
              >
                Cerrar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

