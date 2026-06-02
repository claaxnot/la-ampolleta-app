import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, Info, Smartphone, Check, HelpCircle, ArrowRight } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications.js';
import { useAuth } from '../hooks/useAuth.js';
import Button from './Button.jsx';
import GlassCard from './GlassCard.jsx';

// Helper to check if a dismissed timestamp is within 7 days
const isWithin7Days = (timestampStr) => {
  if (!timestampStr) return false;
  try {
    const dismissedTime = new Date(timestampStr).getTime();
    const currentTime = new Date().getTime();
    const diffDays = (currentTime - dismissedTime) / (1000 * 60 * 60 * 24);
    return diffDays < 7;
  } catch (err) {
    return false;
  }
};

/**
 * 1. PUSH ONBOARDING MODAL
 * Displays a premium centered onboarding card if push notifications are compatible,
 * not subscribed, and not dismissed in the last 7 days.
 */
export const PushOnboardingModal = () => {
  const { user } = useAuth();
  const {
    pushSupported,
    pushPermission,
    isSubscribed,
    isIos,
    isStandalone,
    pushLoading,
    message,
    subscribePush
  } = usePushNotifications();

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Basic checks for rendering the modal
    if (!user || user.id === "demo-viewer-id") return;
    if (!pushSupported) return;
    if (isSubscribed || pushPermission === 'granted') return;

    // Check localStorage rules
    const isCompleted = localStorage.getItem('push_onboarding_completed') === 'true';
    if (isCompleted) return;

    const dismissedAt = localStorage.getItem('push_onboarding_dismissed_at');
    if (isWithin7Days(dismissedAt)) return;

    // Delay modal slightly for a better UX on entry
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [user, pushSupported, isSubscribed, pushPermission]);

  const handleDismiss = () => {
    localStorage.setItem('push_onboarding_dismissed_at', new Date().toISOString());
    setIsOpen(false);
  };

  const handleActivate = async () => {
    const success = await subscribePush();
    if (success) {
      // Small timeout to allow the user to see the success message
      setTimeout(() => {
        setIsOpen(false);
      }, 2500);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Dark blurred background overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Content Card */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 30 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 30 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative w-full max-w-md bg-gray-950/80 border border-amber-500/20 p-6 md:p-8 rounded-[2rem] backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] flex flex-col items-center select-none"
        >
          {/* Subtle gold ambient glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-amber-500/10 rounded-full blur-[50px] pointer-events-none" />

          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 p-1.5 rounded-full bg-white/5 border border-white/5 text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Icon Header */}
          <div className="relative mb-5 p-4 bg-amber-500/15 rounded-3xl border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center justify-center">
            <Bell className="w-8 h-8 text-amber-400 animate-bounce" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-gray-950 animate-ping" />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border border-gray-950" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-center text-white mb-2 tracking-tight">
            🔔 Activa tus notificaciones
          </h2>

          {/* IOS Special Onboarding */}
          {isIos && !isStandalone ? (
            <div className="w-full flex flex-col text-left">
              <p className="text-xs text-gray-400 leading-relaxed text-center mb-5">
                Para recibir avisos instantáneos de tus asignaciones en tu iPhone, debes agregar la aplicación a tu pantalla de inicio primero.
              </p>

              <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 text-[11px] text-gray-300 space-y-2 leading-relaxed mb-6">
                <p className="font-bold text-amber-400 flex items-center gap-1.5 mb-1.5 uppercase tracking-wider text-[10px]">
                  <Smartphone className="w-4 h-4 shrink-0" />
                  Instrucciones de instalación (iOS):
                </p>
                <p>1. Pulsa el botón de <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) en Safari.</p>
                <p>2. Desplázate hacia abajo y selecciona <strong>"Agregar a pantalla de inicio"</strong>.</p>
                <p>3. Abre la app desde tu pantalla de inicio y vuelve aquí para activar las notificaciones.</p>
              </div>

              <Button
                onClick={handleDismiss}
                variant="primary"
                className="w-full py-3 justify-center text-xs font-bold"
              >
                Entendido
              </Button>
            </div>
          ) : (
            /* Standard Android / PC / PWA Onboarding */
            <div className="w-full flex flex-col text-center">
              <p className="text-xs text-gray-400 leading-relaxed mb-5 px-1">
                Recibe alertas instantáneas en tu dispositivo y entérate al instante de novedades importantes de tu portal.
              </p>

              {/* Bullet list of advantages */}
              <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-left text-xs text-gray-300 space-y-3 mb-6">
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Nuevos eventos asignados.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Cambios importantes en tus citaciones.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Cancelaciones de jornadas.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Actualizaciones de tus estados de pago.</span>
                </div>
              </div>

              {/* Inline Feedback Alerts */}
              {message && (
                <div className={`mb-5 p-3.5 rounded-xl text-xs font-semibold border text-center ${
                  message.includes('❌') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {message}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <Button
                  onClick={handleActivate}
                  variant="primary"
                  className="flex-1 py-3 justify-center text-xs font-bold items-center gap-1.5 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                  disabled={pushLoading}
                >
                  {pushLoading ? "Activando..." : "Activar notificaciones"}
                  {!pushLoading && <ArrowRight className="w-4 h-4" />}
                </Button>
                <Button
                  onClick={handleDismiss}
                  variant="secondary"
                  className="flex-1 py-3 justify-center text-xs font-bold border-white/10 hover:bg-white/5"
                  disabled={pushLoading}
                >
                  Ahora no
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};


/**
 * 2. PUSH ONBOARDING BANNER
 * Displays a compact persistent dashboard banner if notifications are compatible,
 * not active, and the banner wasn't closed recently.
 */
export const PushOnboardingBanner = () => {
  const { user } = useAuth();
  const {
    pushSupported,
    pushPermission,
    isSubscribed,
    isIos,
    isStandalone,
    pushLoading,
    message,
    subscribePush
  } = usePushNotifications();

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!user || user.id === "demo-viewer-id") return;
    if (!pushSupported) return;
    if (isSubscribed || pushPermission === 'granted') return;

    // Check localStorage rules
    const isCompleted = localStorage.getItem('push_onboarding_completed') === 'true';
    if (isCompleted) return;

    const bannerDismissedAt = localStorage.getItem('push_banner_dismissed_at');
    if (isWithin7Days(bannerDismissedAt)) return;

    setIsVisible(true);
  }, [user, pushSupported, isSubscribed, pushPermission]);

  const handleDismiss = () => {
    localStorage.setItem('push_banner_dismissed_at', new Date().toISOString());
    setIsVisible(false);
  };

  const handleActivate = async () => {
    const success = await subscribePush();
    if (success) {
      setTimeout(() => {
        setIsVisible(false);
      }, 2500);
    }
  };

  if (!isVisible) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="mb-8 relative z-10"
    >
      <GlassCard className="p-4 md:p-5 border border-amber-500/20 bg-amber-500/[0.02] shadow-[0_4px_25px_-5px_rgba(245,158,11,0.06)] rounded-2xl relative overflow-hidden">
        {/* Gold blur highlight */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.03] rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Glowing gold circular bell badge */}
            <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-sm shrink-0 flex items-center justify-center">
              <Bell className="w-5 h-5 text-amber-400 animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                🔔 Notificaciones Web Push
              </h4>
              <p className="text-[11px] text-gray-400 leading-normal max-w-xl mt-0.5">
                {isIos && !isStandalone 
                  ? "Para iPhone: agrega la app a tu pantalla de inicio en Safari para poder recibir alertas instantáneas."
                  : "Activa las notificaciones nativas para recibir alertas instantáneas de nuevos eventos, cambios y pagos."
                }
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto shrink-0 justify-end">
            {isIos && !isStandalone ? (
              // iOS Instructions Trigger
              <div className="bg-amber-500/5 border border-amber-500/10 px-3 py-1.5 rounded-xl text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                Safari PWA Requerida
              </div>
            ) : (
              // Standard Trigger Button
              <Button
                onClick={handleActivate}
                variant="primary"
                className="py-2 px-4 text-xs font-extrabold h-9 items-center justify-center gap-1.5 shrink-0 flex-1 md:flex-none shadow-md shadow-amber-500/10"
                disabled={pushLoading}
              >
                {pushLoading ? "Activando..." : "Activar ahora"}
              </Button>
            )}

            <button
              onClick={handleDismiss}
              className="h-9 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-white text-xs font-bold transition-all shrink-0 flex-1 md:flex-none"
              disabled={pushLoading}
            >
              Ocultar
            </button>
          </div>
        </div>

        {/* Display feedback within banner */}
        {message && (
          <div className={`mt-3 p-2.5 rounded-xl text-xs font-semibold border text-center ${
            message.includes('❌') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
          }`}>
            {message}
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
};
