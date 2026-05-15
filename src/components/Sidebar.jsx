import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, CalendarDays, Users, Calendar, LogOut, Lightbulb, User as UserIcon } from "lucide-react";

export default function Sidebar({ user, onLogout }) {
  const adminLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/events", label: "Eventos", icon: CalendarDays },
    { to: "/staff", label: "Personal", icon: Users },
    { to: "/calendar", label: "Calendario", icon: Calendar },
    { to: "/profile", label: "Mi Perfil", icon: UserIcon },
  ];

  const workerLinks = [
    { to: "/worker-dashboard", label: "Mi Panel", icon: LayoutDashboard },
    { to: "/profile", label: "Mi Perfil", icon: UserIcon },
  ];

  const links = user?.systemRole === 'worker' ? workerLinks : adminLinks;

  return (
    <nav className="w-64 h-screen bg-black/40 backdrop-blur-3xl border-r border-white/10 text-gray-100 flex flex-col shadow-2xl relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute top-0 left-0 w-full h-32 bg-accent/10 blur-3xl rounded-full -translate-y-1/2"></div>
      
      <div className="p-6 relative z-10">
        <div className="flex items-center gap-3 justify-center mb-8">
          <div className="p-2 bg-accent/20 rounded-xl">
            <Lightbulb className="w-8 h-8 text-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-xl font-bold tracking-tight text-white leading-tight">La Ampolleta</span>
            <span className="text-xs text-accent uppercase tracking-wider font-semibold">Producciones</span>
          </div>
        </div>
      </div>

      <ul className="flex-1 space-y-2 px-4 relative z-10">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              className={({ isActive }) =>
                `flex items-center gap-3 py-3 px-4 rounded-xl transition-all duration-300 ${
                  isActive 
                  ? "bg-accent/10 text-accent font-medium shadow-[inset_0_0_0_1px_rgba(245,158,11,0.2)]" 
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
                }`
              }
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
      
      <div className="p-4 relative z-10 border-t border-gray-800">
        <button
          onClick={onLogout}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 text-sm font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-xl transition-all duration-300"
        >
          <LogOut className="w-5 h-5" />
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}

