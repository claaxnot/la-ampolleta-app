import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, Calendar, LogOut, Lightbulb, User as UserIcon, X, DollarSign } from "lucide-react";

export default function Sidebar({ user, onLogout, isOpen, setIsOpen }) {
  const location = useLocation();
  const [logoError, setLogoError] = React.useState(false);

  const adminLinks = [
    { to: "/dashboard", label: "Menú", icon: LayoutDashboard },
    { to: "/events", label: "Eventos", icon: CalendarDays },
    { to: "/staff", label: "Personal", icon: Users },
    { to: "/calendar", label: "Calendario", icon: Calendar },
    { to: "/finanzas", label: "Finanzas", icon: DollarSign },
    { to: "/profile", label: "Mi Perfil", icon: UserIcon },
  ];

  const workerLinks = [
    { to: "/worker-dashboard", label: "Mi Panel", icon: LayoutDashboard },
    { to: "/worker-dashboard?tab=finanzas", label: "Finanzas", icon: DollarSign },
    { to: "/profile", label: "Mi Perfil", icon: UserIcon },
  ];

  const links = user?.systemRole === 'worker' ? workerLinks : adminLinks;

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

      <ul className="flex-1 space-y-2 px-4 relative z-10">
        {links.map((link) => {
          const active = isLinkActive(link.to);
          return (
            <li key={link.to}>
              <Link
                to={link.to}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300 ${
                  active 
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
      </ul>
      
      <div className="p-4 relative z-10 border-t border-gray-800">
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
      </div>
    </nav>
    </>
  );
}

