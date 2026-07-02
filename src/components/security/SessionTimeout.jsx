import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase.js";
import { useAuth } from "../../hooks/useAuth.js";
import { motion, AnimatePresence } from "framer-motion";
import GlassCard from "../GlassCard.jsx";
import Button from "../Button.jsx";

// Inactivity constants (ms)
const WARNING_TIME = 60 * 1000; // 1 minute before logout

export default function SessionTimeout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.systemRole === "admin" || user?.role === "admin";
  const inactivityLimit = isAdmin ? 10 * 60 * 1000 : 5 * 60 * 1000;

  const [showWarning, setShowWarning] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const warningTimer = useRef(null);
  const logoutTimer = useRef(null);

  // Clear all timers
  const clearTimers = () => {
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (logoutTimer.current) clearTimeout(logoutTimer.current);
    warningTimer.current = null;
    logoutTimer.current = null;
  };

  // Perform logout actions
  const performLogout = async (showMessage = true) => {
    clearTimers();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Supabase signOut error", e);
    }
    logout(); // clears context & localStorage (via AuthProvider)
    localStorage.removeItem("lastActivity");
    sessionStorage.clear();
    if (showMessage) setShowToast(true);
    navigate("/login", { replace: true });
  };

  // Reset inactivity timer
  const resetTimer = () => {
    clearTimers();
    setShowWarning(false);
    // store last activity timestamp
    localStorage.setItem("lastActivity", Date.now().toString());
    // Show warning after (inactivityLimit - WARNING_TIME)
    warningTimer.current = setTimeout(() => {
      setShowWarning(true);
    }, inactivityLimit - WARNING_TIME);
    // Logout after full limit
    logoutTimer.current = setTimeout(() => {
      performLogout(true);
    }, inactivityLimit);
  };

  // Register activity listeners
  useEffect(() => {
    if (!user) return; // do nothing when not logged in
    const events = ["mousemove", "click", "keydown", "scroll", "touchstart"];
    
    let lastReset = Date.now();
    const handler = () => {
      const now = Date.now();
      // Throttling: solo re-inicializamos el timer si pasaron más de 5 segundos de inactividad
      if (now - lastReset > 5000) {
        lastReset = now;
        resetTimer();
      }
    };

    events.forEach((ev) => window.addEventListener(ev, handler));
    
    // beforeunload store timestamp
    const beforeUnload = () => {
      localStorage.setItem("lastActivity", Date.now().toString());
    };
    window.addEventListener("beforeunload", beforeUnload);

    // Sync between tabs/windows
    const handleStorageChange = (e) => {
      if (e.key === "lastActivity") {
        const lastVal = parseInt(e.newValue, 10);
        if (lastVal && !isNaN(lastVal)) {
          const elapsed = Date.now() - lastVal;
          if (elapsed < inactivityLimit) {
            clearTimers();
            const hasReachedWarning = elapsed >= (inactivityLimit - WARNING_TIME);
            setShowWarning(hasReachedWarning);

            const remainingWarning = Math.max(0, inactivityLimit - WARNING_TIME - elapsed);
            const remainingLogout = Math.max(0, inactivityLimit - elapsed);

            warningTimer.current = setTimeout(() => setShowWarning(true), remainingWarning);
            logoutTimer.current = setTimeout(() => performLogout(true), remainingLogout);
          } else {
            // Already expired in another tab
            performLogout(false);
          }
        }
      }
    };
    window.addEventListener("storage", handleStorageChange);

    // Initial timer setup (also check previous timestamp)
    const last = parseInt(localStorage.getItem("lastActivity"), 10);
    if (last && !isNaN(last)) {
      const elapsed = Date.now() - last;
      if (elapsed >= inactivityLimit) {
        // session already expired while tab was closed
        performLogout(false);
        return; // no need to set timers
      } else {
        // start clean and adjust remaining timers based on elapsed time without overlaps
        clearTimers();
        const hasReachedWarning = elapsed >= (inactivityLimit - WARNING_TIME);
        setShowWarning(hasReachedWarning);

        const remainingWarning = Math.max(0, inactivityLimit - WARNING_TIME - elapsed);
        const remainingLogout = Math.max(0, inactivityLimit - elapsed);

        warningTimer.current = setTimeout(() => setShowWarning(true), remainingWarning);
        logoutTimer.current = setTimeout(() => performLogout(true), remainingLogout);
      }
    } else {
      resetTimer();
    }

    // Cleanup on unmount
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, handler));
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("storage", handleStorageChange);
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, inactivityLimit]);

  // Toast auto‑dismiss after 5 seconds
  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  if (!user) return null;

  return (
    <>
      {/* Warning Modal */}
      <AnimatePresence>
        {showWarning && (
          <motion.div
            className="fixed inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GlassCard className="p-6 md:p-8 max-w-md w-full bg-gray-900/80 border border-white/10 backdrop-blur-xl">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                Sesión inactiva
              </h2>
              <p className="text-gray-300 mb-6">
                Tu sesión expirará en <span className="text-amber-400 font-medium">1 minuto</span> por inactividad.
              </p>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowWarning(false);
                    resetTimer();
                  }}
                >
                  Continuar sesión
                </Button>
                <Button
                  variant="primary"
                  onClick={() => performLogout(true)}
                >
                  Cerrar ahora
                </Button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-4 py-2 rounded-xl shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            Tu sesión expiró por seguridad debido a inactividad.
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
