import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './useAuth.js';

const VAPID_PUBLIC_KEY = "BK6xAJN2En_UF2GqhoXB_UPpt_lKy__dlpOSOb7nYnhRiOv_tvGZ_NqlcqfXkGQjADrRJzxVYKLhVDcPv7ceFT0";

export const usePushNotifications = (passedUser) => {
  const { user: authUser } = useAuth();
  const currentUser = passedUser || authUser || {};

  const [pushSupported, setPushSupported] = useState(false);
  const [pushPermission, setPushPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [testPushLoading, setTestPushLoading] = useState(false);
  const [message, setMessage] = useState("");

  const checkCurrentSubscription = useCallback(async () => {
    if (!('serviceWorker' in navigator && 'PushManager' in window)) {
      setPushSupported(false);
      return;
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setIsSubscribed(!!sub);
    } catch (err) {
      console.warn("⚠️ Error al verificar suscripción push:", err);
    }
  }, []);

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
  }, [currentUser?.id, checkCurrentSubscription]);

  const subscribePush = async () => {
    if (!currentUser?.id) return false;
    setPushLoading(true);
    setMessage("");
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
        p256dh: subscriptionJson.keys?.p256dh || "",
        auth: subscriptionJson.keys?.auth || "",
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
      
      // Guardar en localStorage que se completó
      localStorage.setItem('push_onboarding_completed', 'true');
      return true;
    } catch (err) {
      console.error("❌ Error activando push:", err);
      setMessage(`❌ Error al activar push: ${err.message || err}`);
      return false;
    } finally {
      setPushLoading(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const unsubscribePush = async () => {
    if (!currentUser?.id) return false;
    setPushLoading(true);
    setMessage("");
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
      localStorage.removeItem('push_onboarding_completed');
      return true;
    } catch (err) {
      console.error("❌ Error desactivando push:", err);
      setMessage("❌ Error al intentar desactivar las notificaciones push.");
      return false;
    } finally {
      setPushLoading(false);
      setTimeout(() => setMessage(""), 5000);
    }
  };

  const sendTestPush = async () => {
    setTestPushLoading(true);
    setMessage("");
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

  return {
    pushSupported,
    pushPermission,
    isSubscribed,
    isIos,
    isStandalone,
    pushLoading,
    testPushLoading,
    message,
    setMessage,
    checkCurrentSubscription,
    subscribePush,
    unsubscribePush,
    sendTestPush
  };
};
