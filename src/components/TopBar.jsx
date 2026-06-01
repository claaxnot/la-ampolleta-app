import React, { useState, useEffect, useRef } from "react";
import { Bell, User as UserIcon, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase.js";
import toast from "react-hot-toast";

export default function TopBar({ user, onToggleMenu }) {
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef(null);

  const [notifications, setNotifications] = useState([]);

  const getTimeAgo = (dateString) => {
    if (!dateString) return "Hace poco";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return `Hace unos segundos`;
    if (diffInSeconds < 3600) return `Hace ${Math.floor(diffInSeconds / 60)} min`;
    if (diffInSeconds < 86400) return `Hace ${Math.floor(diffInSeconds / 3600)} horas`;
    return `Hace ${Math.floor(diffInSeconds / 86400)} días`;
  };

  useEffect(() => {
    if (!user) return;
    
    fetchNotifications();

    let channel;

    const setupSubscription = () => {
      if (channel) {
        supabase.removeChannel(channel);
      }

      console.log("🔌 [REALTIME] - Subscribiendo TopBar a notificaciones en vivo para el usuario:", user.id);
      
      channel = supabase
        .channel(`topbar-notifications-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications' },
          (payload) => {
            console.log("🔔 [REALTIME INSERT] - Cambio detectado:", payload);
            if (payload.new && payload.new.user_id === user.id) {
              fetchNotifications();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'notifications' },
          (payload) => {
            console.log("🔔 [REALTIME UPDATE] - Cambio detectado:", payload);
            if (payload.new && payload.new.user_id === user.id) {
              fetchNotifications();
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'notifications' },
          (payload) => {
            console.log("🔔 [REALTIME DELETE] - Cambio detectado:", payload);
            if (payload.old && payload.old.user_id === user.id) {
              fetchNotifications();
            }
          }
        )
        .subscribe((status) => {
          console.log(`🔌 [REALTIME STATUS TOPBAR]: ${status}`);
        });
    };

    // Configurar suscripción inicial
    setupSubscription();

    // Re-suscribir si el estado de autenticación cambia en Supabase (soluciona race condition asíncrona)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`🔑 [AUTH EVENT TOPBAR]: ${event}`);
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setupSubscription();
      }
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (subscription) subscription.unsubscribe();
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;

      const formatted = (data || []).map(n => ({
        id: n.id,
        title: n.title,
        message: n.description || n.message || "",
        time: getTimeAgo(n.created_at),
        date: new Date(n.created_at),
        read: n.read,
        related_event_id: n.related_event_id,
        related_assignment_id: n.related_assignment_id,
        related_payment_id: n.related_payment_id
      }));

      setNotifications(formatted);
    } catch (err) {
      console.warn("⚠️ [TOPBAR - NOTIFICATIONS]: Error al obtener notificaciones físicas de Supabase:", err);
      setNotifications([]);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAsRead = async (notifId) => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notifId);
      if (error) throw error;
    } catch (err) {
      console.error("❌ [TOPBAR]: Error al marcar notificación como leída:", err);
    }
  };

  const handleNotificationClick = async (notif) => {
    if (!notif.read) {
      await handleMarkAsRead(notif.id);
    }
    if (notif.related_event_id) {
      console.log("🔗 [TOPBAR]: Navegando / Interactuando con evento ID:", notif.related_event_id);
    }
  };

  const markAllAsRead = async () => {
    // Optimistic UI update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
      toast.success("Notificaciones marcadas como leídas", { duration: 1500 });
    } catch (err) {
      console.error("❌ [TOPBAR]: Error al marcar todas las notificaciones como leídas:", err);
    }
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
        className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors focus:outline-none"
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
                      <div 
                        key={notif.id} 
                        onClick={() => handleNotificationClick(notif)}
                        className={`p-4 border-b border-gray-700/50 hover:bg-white/5 transition-colors cursor-pointer ${!notif.read ? 'bg-amber-500/5' : ''}`}
                      >
                        <div className="flex gap-3">
                          <div className="mt-1">
                            {!notif.read ? (
                              <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                            ) : (
                              <div className="w-2 h-2 bg-transparent"></div>
                            )}
                          </div>
                          <div>
                            <span className={`text-xs block font-extrabold tracking-wide uppercase mb-0.5 ${!notif.read ? 'text-amber-400' : 'text-gray-500'}`}>
                              {notif.title || "Notificación"}
                            </span>
                            <p className={`text-xs ${!notif.read ? 'text-gray-200 font-medium' : 'text-gray-400'}`}>
                              {notif.message}
                            </p>
                            <span className="text-[10px] text-gray-500 mt-1 block">{notif.time}</span>
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

        {/* Viewer Badge */}
        {user?.systemRole === 'viewer' && (
          <div className="hidden sm:flex items-center">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-semibold tracking-wide">
              Modo Vista / Solo lectura
            </span>
          </div>
        )}

        {/* User Profile Mini */}
        <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-white/10">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-white">{user?.name || (user?.systemRole === 'admin' ? 'Administrador' : 'Usuario')}</span>
            <span className="text-xs text-gray-400 capitalize">{user?.role === 'viewer' ? 'Cliente Viewer' : (user?.role || user?.systemRole)}</span>
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
