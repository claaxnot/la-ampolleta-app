import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, Lock, Save, User as UserIcon, Upload, Eye, EyeOff, Building, Bell, BellOff, Smartphone, Send, Info } from "lucide-react";
import { useLocation } from "react-router-dom";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { supabase } from "../lib/supabase.js";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4 } }
};

export default function Profile({ user, onUpdateUser }) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const requireAvatar = searchParams.get("requireAvatar") === "true";
  const requireBank = searchParams.get("requireBank") === "true";

  // Simulamos que obtenemos el usuario actual. En la vida real esto viene del contexto de Auth.
  const currentUser = user || {};

  const [avatarUrl, setAvatarUrl] = useState(currentUser.avatar || "");
  const [passwords, setPasswords] = useState({
    current: "",
    newPass: "",
    confirmPass: "",
  });
  const [showPasswords, setShowPasswords] = useState(false);

  const [message, setMessage] = useState("");

  // --- PUSH NOTIFICATIONS STATES & HANDLERS ---
  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);

  // Clave pública VAPID generada
  const VAPID_PUBLIC_KEY = "BK6xAJN2En_UF2GqhoXB_UPpt_lKy__dlpOSOb7nYnhRiOv_tvGZ_NqlcqfXkGQjADrRJzxVYKLhVDcPv7ceFT0";

  useEffect(() => {
    // Detectar iOS y modo PWA instalado (standalone)
    const ua = window.navigator.userAgent.toLowerCase();
    const isIphone = ua.indexOf('iphone') > -1 || ua.indexOf('ipad') > -1;
    setIsIos(isIphone);

    const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Compatibilidad nativa
    const isSupported = 'serviceWorker' in navigator && 'PushManager' in window;
    setPushSupported(isSupported);

    if (isSupported) {
      setPushPermission(Notification.permission);
      checkCurrentSubscription();
    }
  }, [currentUser.id]);

  const checkCurrentSubscription = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.warn("⚠️ Error al verificar suscripción push:", err);
    }
  };

  const subscribePush = async () => {
    if (!currentUser.id) return;
    setPushLoading(true);
    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);

      if (permission !== 'granted') {
        throw new Error("El permiso de notificaciones fue denegado.");
      }

      const reg = await navigator.serviceWorker.ready;

      // Convertir llave VAPID a array binario para PushManager
      const urlBase64ToUint8Array = (base64String) => {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
          .replace(/\-/g, '+')
          .replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const subscribeOptions = {
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      };

      const subscription = await reg.pushManager.subscribe(subscribeOptions);
      console.log("🔌 Suscripción Web Push obtenida con éxito:", subscription);

      const subscriptionJson = subscription.toJSON();

      const ua = window.navigator.userAgent;
      let browserName = "Otro";
      if (ua.indexOf("Chrome") > -1) browserName = "Chrome";
      else if (ua.indexOf("Safari") > -1) browserName = "Safari";
      else if (ua.indexOf("Firefox") > -1) browserName = "Firefox";
      else if (ua.indexOf("Edge") > -1) browserName = "Edge";

      let platformName = "Desktop";
      if (ua.indexOf("Android") > -1) platformName = "Android";
      else if (ua.indexOf("iPhone") > -1 || ua.indexOf("iPad") > -1) platformName = "iOS";

      const payload = {
        user_id: currentUser.id,
        endpoint: subscription.endpoint,
        p256dh: subscriptionJson.keys.p256dh,
        auth: subscriptionJson.keys.auth,
        platform: platformName,
        browser: browserName,
        device_label: `${browserName} en ${platformName}`,
        active: true,
        last_seen_at: new Date().toISOString(),
        revoked_at: null
      };

      // Guardar/Actualizar en Supabase
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(payload, { onConflict: 'user_id, endpoint' });

      if (error) throw error;

      setIsSubscribed(true);
      setMessage("✅ ¡Notificaciones push activadas correctamente!");
    } catch (err) {
      console.error("❌ Error activando push:", err);
      setMessage(`❌ Error al activar push: ${err.message || err}`);
    } finally {
      setPushLoading(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const unsubscribePush = async () => {
    if (!currentUser.id) return;
    setPushLoading(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();

      if (sub) {
        await sub.unsubscribe();

        // Marcar inactiva en Supabase
        const { error } = await supabase
          .from('push_subscriptions')
          .update({ active: false, revoked_at: new Date().toISOString() })
          .eq('user_id', currentUser.id)
          .eq('endpoint', sub.endpoint);

        if (error) console.error("⚠️ Error marcando suscripción inactiva:", error);
      }

      setIsSubscribed(false);
      setMessage("✅ Notificaciones push desactivadas en este dispositivo.");
    } catch (err) {
      console.error("❌ Error desactivando push:", err);
      setMessage("❌ Error al intentar desactivar las notificaciones push.");
    } finally {
      setPushLoading(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const sendTestPush = async () => {
    setTestPushLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-test-push', {
        body: {}
      });

      if (error) throw error;

      if (data && data.success === false) {
        setMessage(`⚠️ Alerta de envío: ${data.message || 'Error de envío'}`);
      } else {
        setMessage("✅ Notificación de prueba enviada con éxito.");
      }
    } catch (err) {
      console.error("❌ Error en send-test-push:", err);
      setMessage("❌ Error de comunicación con la Edge Function. Verifica que esté desplegada.");
    } finally {
      setTestPushLoading(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handlePasswordChange = (e) => {
    setPasswords({ ...passwords, [e.target.name]: e.target.value });
  };

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      // Activa el modo cámara para que React renderice el elemento <video>
      setIsCameraActive(true);

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;

      // Esperar un instante para que el elemento <video> termine de renderizarse
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      setIsCameraActive(false);
      setMessage("❌ No se pudo acceder a la cámara. Verifica los permisos.");
      setTimeout(() => setMessage(""), 3000);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const MAX_SIZE = 400;
      let width = videoRef.current.videoWidth;
      let height = videoRef.current.videoHeight;

      if (width > height) {
        if (width > MAX_SIZE) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        }
      } else {
        if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");

      // Flip canvas to match mirrored video
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, width, height);

      // Comprimir a JPEG con 60% de calidad para no saturar la base de datos
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      setAvatarUrl(dataUrl);
      if (onUpdateUser) {
        onUpdateUser({ ...currentUser, avatar: dataUrl });
      }

      // Save to Supabase Profiles
      if (currentUser.id) {
        supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', currentUser.id).then(({ error }) => {
          if (error) console.error("Error saving avatar to DB", error);
        });
      }

      stopCamera();
      setMessage("📸 Foto capturada y guardada. Ahora puedes usar el sistema.");
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const handleUpdateAvatar = (e) => {
    e.preventDefault();
    setMessage("✅ Foto de perfil actualizada correctamente.");
    setTimeout(() => setMessage(""), 3000);
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwords.newPass !== passwords.confirmPass) {
      setMessage("❌ Las nuevas contraseñas no coinciden.");
      setTimeout(() => setMessage(""), 3000);
      return;
    }
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwords.newPass
      });
      if (error) throw error;
      
      setMessage("✅ Contraseña actualizada correctamente.");
      setPasswords({ current: "", newPass: "", confirmPass: "" });
    } catch (err) {
      console.error("Error updating password:", err);
      setMessage(`❌ Error: ${err.message}`);
    }
    setTimeout(() => setMessage(""), 4000);
  };



  return (
    <motion.div
      className="p-6 lg:p-8 min-h-[calc(100vh-64px)]"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.header variants={itemVariants} className="mb-8">
        <h1 className="text-3xl lg:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-200 to-amber-500">
          Mi Perfil
        </h1>
        <p className="text-gray-400 mt-1">Administra tu información personal y seguridad.</p>
      </motion.header>

      {requireAvatar && !currentUser.avatar && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl text-sm font-medium border bg-amber-500/10 text-amber-400 border-amber-500/20"
        >
          ⚠️ Es obligatorio tomar tu fotografía de seguridad antes de poder acceder a tu panel de eventos.
        </motion.div>
      )}


      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-4 rounded-xl text-sm font-medium border ${message.includes('❌') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}
        >
          {message}
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Columna Izquierda: Información y Foto */}
        <motion.section variants={itemVariants} className="lg:col-span-1 space-y-6">
          <GlassCard className="p-6 flex flex-col items-center text-center">
            <div className="relative group mb-4">
              <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)] bg-gray-800 flex items-center justify-center">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  <UserIcon className="w-10 h-10 text-gray-500" />
                )}
              </div>
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer">
                <Camera className="w-8 h-8 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-white">{currentUser.name || "Usuario"}</h2>
            <p className="text-sm text-gray-400 capitalize">{currentUser.role}</p>
            <p className="text-sm text-gray-500 mt-2">{currentUser.email}</p>
          </GlassCard>

          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <UserIcon className="w-5 h-5 text-amber-400" />
              Actualizar Foto
            </h3>
            <form onSubmit={handleUpdateAvatar} className="space-y-4">
              <div className="flex flex-col">

                {!isCameraActive ? (
                  <div className="flex flex-col items-center gap-3 bg-gray-800/50 border border-gray-700 rounded-xl p-5 text-center">
                    <div className="p-3 bg-amber-500/10 rounded-full">
                      <Camera className="w-8 h-8 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm text-white font-semibold">Verificación Facial Requerida</p>
                      <p className="text-xs text-gray-400 mt-2 leading-relaxed">Por políticas de seguridad, debes tomar una fotografía de tu rostro en tiempo real para actualizar tu imagen de perfil.</p>
                    </div>
                    <Button type="button" onClick={startCamera} variant="primary" className="w-full justify-center text-sm py-2 mt-3">
                      Activar Cámara
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] border border-amber-500/50 shadow-lg">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover transform -scale-x-100"
                      />
                      {/* Biometric Guide Overlay */}
                      <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center overflow-hidden">
                        <div className="w-36 h-48 border-2 border-dashed border-amber-400/70 rounded-[100px] shadow-[0_0_0_999px_rgba(0,0,0,0.6)] flex items-center justify-center relative">
                          <span className="absolute -bottom-8 text-amber-400 font-bold text-[10px] uppercase tracking-widest bg-black/60 px-3 py-1 rounded-full whitespace-nowrap">
                            Centra tu rostro aquí
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" onClick={stopCamera} variant="secondary" className="flex-1 justify-center text-sm py-2">
                        Cancelar
                      </Button>
                      <Button type="button" onClick={capturePhoto} variant="primary" className="flex-1 justify-center text-sm py-2 bg-emerald-600 hover:bg-emerald-500 border-none text-white">
                        Tomar Foto
                      </Button>
                    </div>
                  </div>
                )}

              </div>
              <Button type="submit" variant="secondary" className="w-full justify-center text-sm py-2 mt-4 bg-white/5 border-white/10" disabled={isCameraActive}>
                Guardar Cambios
              </Button>
            </form>
          </GlassCard>
        </motion.section>

        {/* Columna Derecha: Seguridad */}
        <motion.section variants={itemVariants} className="lg:col-span-2">
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Seguridad y Contraseña
            </h2>

            <form onSubmit={handleUpdatePassword} className="space-y-6 max-w-md">
              <div className="flex flex-col">
                <label className="text-gray-300 mb-1 text-sm font-medium">Contraseña Actual</label>
                <div className="relative">
                  <input
                    type={showPasswords ? "text" : "password"}
                    name="current"
                    value={passwords.current}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                  >
                    {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-gray-300 mb-1 text-sm font-medium">Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPasswords ? "text" : "password"}
                    name="newPass"
                    value={passwords.newPass}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                  >
                    {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="text-gray-300 mb-1 text-sm font-medium">Confirmar Nueva Contraseña</label>
                <div className="relative">
                  <input
                    type={showPasswords ? "text" : "password"}
                    name="confirmPass"
                    value={passwords.confirmPass}
                    onChange={handlePasswordChange}
                    placeholder="••••••••"
                    className="w-full bg-gray-800/50 border border-gray-700 rounded-xl p-2.5 pr-10 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 transition-colors"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 focus:outline-none"
                  >
                    {showPasswords ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <Button type="submit" variant="primary" className="flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Actualizar Contraseña
                </Button>
              </div>
            </form>
          </GlassCard>

          <GlassCard className="p-6 md:p-8 mt-6">
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-amber-400" />
              Notificaciones Push
            </h2>

            <p className="text-xs text-gray-400 mb-6 leading-relaxed">
              Las notificaciones push te permiten enterarte al instante de nuevos eventos asignados, cambios importantes en tus jornadas o actualizaciones de tus pagos, incluso si tienes la aplicación cerrada o el dispositivo bloqueado.
            </p>

            <div className="space-y-4">
              {!pushSupported ? (
                <div className="p-4 rounded-xl border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex gap-2.5">
                  <BellOff className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold block mb-1">Navegador no compatible</strong>
                    Tu navegador o dispositivo actual no soporta notificaciones push.
                  </div>
                </div>
              ) : isIos && !isStandalone ? (
                <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-xs flex flex-col gap-2">
                  <div className="flex gap-2.5">
                    <Smartphone className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-bold block mb-1">Instalación PWA Requerida en iOS</strong>
                      Para activar notificaciones en iPhone, debes agregar la app a tu pantalla de inicio primero.
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-300 bg-black/40 p-3 rounded-lg border border-white/5 space-y-1.5 leading-normal">
                    <p className="font-semibold text-amber-400">Pasos para instalar:</p>
                    <p>1. Pulsa el botón de <strong>Compartir</strong> (icono de cuadrado con flecha hacia arriba) en Safari.</p>
                    <p>2. Desplázate hacia abajo y selecciona <strong>"Agregar a pantalla de inicio"</strong>.</p>
                    <p>3. Abre la app desde tu pantalla de inicio y vuelve aquí para activar las notificaciones.</p>
                  </div>
                </div>
              ) : isSubscribed ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 text-emerald-400 text-xs flex gap-2.5">
                    <Bell className="w-4 h-4 shrink-0 mt-0.5 animate-bounce" />
                    <div>
                      <strong className="font-bold block mb-1">✅ Notificaciones activas</strong>
                      Las notificaciones push están activas en este dispositivo.
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 pt-2">
                    <Button 
                      type="button" 
                      onClick={sendTestPush} 
                      variant="secondary" 
                      className="text-xs py-2 px-4 justify-center border-amber-500/20 hover:bg-amber-500/5 text-amber-400 flex items-center gap-2"
                      disabled={testPushLoading}
                    >
                      <Send className="w-3.5 h-3.5" />
                      {testPushLoading ? "Enviando..." : "Enviar notificación de prueba"}
                    </Button>
                    <Button 
                      type="button" 
                      onClick={unsubscribePush} 
                      variant="secondary" 
                      className="text-xs py-2 px-4 justify-center border-red-500/20 hover:bg-red-500/5 text-red-400"
                      disabled={pushLoading}
                    >
                      {pushLoading ? "Procesando..." : "Desactivar en este dispositivo"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {pushPermission === 'denied' && (
                    <div className="p-3 rounded-lg border border-red-500/10 bg-red-500/5 text-red-400 text-xs flex gap-2">
                      <Info className="w-4 h-4 shrink-0" />
                      <span>El permiso de notificaciones está bloqueado. Por favor restablece los permisos en los ajustes del sitio web de tu navegador para poder activarlo.</span>
                    </div>
                  )}
                  <Button 
                    type="button" 
                    onClick={subscribePush} 
                    variant="primary" 
                    className="w-full sm:w-auto text-xs py-2.5 px-5 justify-center flex items-center gap-2"
                    disabled={pushLoading || pushPermission === 'denied'}
                  >
                    <Bell className="w-4 h-4" />
                    {pushLoading ? "Activando..." : "Activar notificaciones en este dispositivo"}
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>

        </motion.section>

      </div>
    </motion.div>
  );
}
