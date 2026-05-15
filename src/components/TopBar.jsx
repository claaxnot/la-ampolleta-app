import React, { useState, useEffect, useRef } from "react";
import { Bell, User as UserIcon, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function TopBar({ user, onToggleMenu }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([
    { id: 1, message: user?.systemRole === 'admin' ? "Un nuevo trabajador ha sido registrado en el sistema." : "¡Has sido asignado al evento 'Arauco Talento'!", time: "Hace 5 min", read: false },
    { id: 2, message: user?.systemRole === 'admin' ? "Leonardo ha sido marcado como inactivo." : "Recuerda subir tu fotografía biométrica en Mi Perfil.", time: "Hace 2 horas", read: false },
    { id: 3, message: "Reporte semanal generado con éxito.", time: "Hace 1 día", read: true },
  ]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  // Cerrar al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-30">
      
      {/* Mobile Menu Button */}
      <button 
        onClick={onToggleMenu}
        className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none"
      >
        <Menu className="w-6 h-6" />
      </button>

      <div className="flex items-center gap-4 md:gap-6 ml-auto">
        
        {/* Notificaciones */}
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors focus:outline-none"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.8)]"></span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 shadow-2xl rounded-2xl overflow-hidden z-50"
              >
                <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                  <h3 className="font-semibold text-white">Notificaciones</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs text-amber-500 hover:text-amber-400 font-medium">
                      Marcar todo leído
                    </button>
                  )}
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-400">No hay notificaciones</div>
                  ) : (
                    notifications.map(notif => (
                      <div key={notif.id} className={`p-4 border-b border-gray-700/50 hover:bg-white/5 transition-colors ${!notif.read ? 'bg-amber-500/5' : ''}`}>
                        <div className="flex gap-3">
                          <div className="mt-1">
                            {!notif.read ? (
                              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            ) : (
                              <div className="w-2 h-2 bg-transparent"></div>
                            )}
                          </div>
                          <div>
                            <p className={`text-sm ${!notif.read ? 'text-gray-200 font-medium' : 'text-gray-400'}`}>
                              {notif.message}
                            </p>
                            <span className="text-xs text-gray-500 mt-2 block">{notif.time}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User Profile Mini */}
        <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-white/10">
          <div className="flex flex-col items-end hidden sm:flex">
            <span className="text-sm font-medium text-white">{user?.name || (user?.systemRole === 'admin' ? 'Administrador' : 'Usuario')}</span>
            <span className="text-xs text-gray-400 capitalize">{user?.role || user?.systemRole}</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden">
            {user?.avatar_url || user?.avatar ? (
              <img src={user.avatar_url || user.avatar} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <UserIcon className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
