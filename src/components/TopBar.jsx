import React, { useState, useEffect, useRef } from "react";
import { Bell, User as UserIcon, Menu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase.js";

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

    console.log("🔌 [REALTIME] - Subscribiendo TopBar a notificaciones en vivo para:", user.systemRole);
    
    let channel;
    
    if (user.systemRole === 'admin') {
      channel = supabase
        .channel('topbar-realtime-admin')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'event_assignments' },
          () => {
            console.log("🔔 [REALTIME] - Cambio detectado en asignaciones. Recargando...");
            fetchNotifications();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'events' },
          () => {
            console.log("🔔 [REALTIME] - Cambio detectado en eventos. Recargando...");
            fetchNotifications();
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            console.log("🔔 [REALTIME] - Cambio detectado en perfiles. Recargando...");
            fetchNotifications();
          }
        )
        .subscribe((status) => {
          console.log(`🔌 [REALTIME STATUS ADMIN]: ${status}`);
        });
    } else {
      channel = supabase
        .channel('topbar-realtime-worker')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'event_assignments' },
          () => {
            console.log("🔔 [REALTIME] - Cambio detectado en asignaciones del trabajador. Recargando...");
            fetchNotifications();
          }
        )
        .subscribe((status) => {
          console.log(`🔌 [REALTIME STATUS WORKER]: ${status}`);
        });
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;
    
    const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
    let combinedNotifs = [];

    if (user.systemRole === 'admin') {
      const { data: recentEventsData } = await supabase.from('events').select('id, name, created_at').order('created_at', { ascending: false }).limit(3);
      const { data: recentStaffData } = await supabase.from('profiles').select('id, name, role, created_at').order('created_at', { ascending: false }).limit(3);
      
      // Consultar asignaciones recientes confirmadas o rechazadas de forma segura y retrocompatible
      let recentAssignments = [];
      const { data: dataWithUpdate, error: updateErr } = await supabase
        .from('event_assignments')
        .select(`
          id,
          status,
          updated_at,
          profiles:staff_id (name),
          events:event_id (name)
        `)
        .neq('status', 'Pendiente')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!updateErr && dataWithUpdate) {
        recentAssignments = dataWithUpdate.map(a => ({
          ...a,
          notification_date: a.updated_at
        }));
      } else {
        const { data: dataWithCreate } = await supabase
          .from('event_assignments')
          .select(`
            id,
            status,
            created_at,
            profiles:staff_id (name),
            events:event_id (name)
          `)
          .neq('status', 'Pendiente')
          .order('created_at', { ascending: false })
          .limit(5);
        if (dataWithCreate) {
          recentAssignments = dataWithCreate.map(a => ({
            ...a,
            notification_date: a.created_at
          }));
        }
      }
      
      if (recentEventsData) {
        recentEventsData.forEach(e => {
          combinedNotifs.push({
            id: `e-${e.id}`,
            message: `Nuevo evento: ${e.name}`,
            time: getTimeAgo(e.created_at),
            date: new Date(e.created_at),
            read: readIds.includes(`e-${e.id}`)
          });
        });
      }
      if (recentStaffData) {
        recentStaffData.forEach(s => {
          combinedNotifs.push({
            id: `s-${s.id}`,
            message: `Nuevo staff: ${s.name} (${s.role})`,
            time: getTimeAgo(s.created_at),
            date: new Date(s.created_at),
            read: readIds.includes(`s-${s.id}`)
          });
        });
      }
      if (recentAssignments) {
        recentAssignments.forEach(a => {
          const staffName = a.profiles?.name || 'Un trabajador';
          const eventName = a.events?.name || 'un evento';
          const statusText = a.status === 'Confirmado' ? '✅ ACEPTÓ' : '❌ RECHAZÓ';
          
          combinedNotifs.push({
            id: `a-status-${a.id}-${a.status}`,
            message: `${staffName} ${statusText} la asignación para "${eventName}"`,
            time: getTimeAgo(a.notification_date),
            date: new Date(a.notification_date),
            read: readIds.includes(`a-status-${a.id}-${a.status}`)
          });
        });
      }
    } else {
      // Worker
      const { data: assignments } = await supabase
        .from('event_assignments')
        .select('id, status, created_at, events(name)')
        .eq('staff_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
        
      if (assignments) {
        assignments.forEach(a => {
          let statusPrefix = "🔔 Has sido asignado a";
          if (a.status === 'Confirmado') statusPrefix = "✅ Confirmaste tu asistencia a";
          if (a.status === 'Rechazado') statusPrefix = "❌ Rechazaste la asignación a";

          combinedNotifs.push({
            id: `a-${a.id}-${a.status}`,
            message: `${statusPrefix}: ${a.events?.name || 'Un evento'}`,
            time: getTimeAgo(a.created_at),
            date: new Date(a.created_at),
            read: readIds.includes(`a-${a.id}-${a.status}`)
          });
        });
      }

      if (!user.avatar || !user.cuenta_destino) {
        combinedNotifs.push({
          id: 'sys-profile',
          message: "⚠️ Recuerda completar tu perfil (Foto y Datos Bancarios).",
          time: "Sistema",
          date: new Date(),
          read: readIds.includes('sys-profile')
        });
      }
    }

    combinedNotifs.sort((a, b) => b.date - a.date);
    setNotifications(combinedNotifs.slice(0, 5));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllAsRead = () => {
    const updatedNotifs = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updatedNotifs);
    
    const readIds = JSON.parse(localStorage.getItem('readNotifs') || '[]');
    updatedNotifs.forEach(n => {
      if (!readIds.includes(n.id)) readIds.push(n.id);
    });
    localStorage.setItem('readNotifs', JSON.stringify(readIds));
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
          <div className="flex flex-col items-end hidden sm:flex">
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
