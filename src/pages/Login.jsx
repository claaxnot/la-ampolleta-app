import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { Lightbulb, Mail, Lock, ArrowRight, Eye, EyeOff } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { toast } from "react-hot-toast";

import { useAuth } from "../hooks/useAuth.js";

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);

  React.useEffect(() => {
    if (user) {
      if (user.systemRole === 'admin' || user.systemRole === 'viewer') {
        navigate("/dashboard");
      } else {
        navigate("/worker-dashboard");
      }
    }
  }, [user, navigate]);

  if (user) {
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setMessage("");

    // Temporary hardcoded demo login
    if (email === "cliente@laampolleta.cl" && password === "demo123") {
      const viewerInfo = {
        id: "demo-viewer-id",
        email: email,
        systemRole: "viewer",
        role: "viewer",
        name: "Cliente Viewer",
        avatar: null
      };
      onLogin(viewerInfo);
      navigate("/dashboard");
      setIsLoading(false);
      return;
    }

    // Safety timeout to prevent getting stuck in "Conectando..." in standalone PWA contexts
    const safetyTimeout = setTimeout(async () => {
      console.warn("⚠️ Login safety timeout triggered after 15s.");
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log("🔒 Session is already active in Supabase. Recovering user profile.");
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profile && profile.status !== 'Inactivo') {
            const systemRole = profile.system_role || (session.user.email === 'admin@laampolleta.tv' ? 'admin' : 'worker');
            const userInfo = {
              id: session.user.id,
              email: session.user.email,
              systemRole,
              role: profile.role || 'Staff',
              name: profile.name || session.user.email.split('@')[0],
              avatar: profile.avatar_url || null,
              cuenta_destino: profile.cuenta_destino || null,
              codigo_banco_destino: profile.codigo_banco_destino || null
            };
            onLogin(userInfo);
            if (userInfo.systemRole === 'admin') {
              navigate("/dashboard");
            } else {
              navigate("/worker-dashboard");
            }
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.error("Error in login safety timeout:", err);
      }
      setIsLoading(false);
      setError("La conexión tardó demasiado. Por favor, intenta de nuevo.");
      toast.error("⚠️ La conexión tardó demasiado. Reintenta.");
    }, 15000);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      // Fetch profile from database
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        console.warn("Could not fetch profile", profileError);
      }

      if (profile?.status === 'Inactivo' && data.user.email !== 'admin@laampolleta.tv') {
        await supabase.auth.signOut();
        throw new Error("Tu cuenta se encuentra inactiva. Contacta al administrador para habilitar tu acceso.");
      }

      const userInfo = {
        id: data.user.id,
        email: data.user.email,
        systemRole: profile?.system_role || (data.user.email === 'admin@laampolleta.tv' ? 'admin' : 'worker'),
        role: profile?.role || 'Staff',
        name: profile?.name || data.user.email.split('@')[0],
        avatar: profile?.avatar_url || null,
        cuenta_destino: profile?.cuenta_destino || null,
        codigo_banco_destino: profile?.codigo_banco_destino || null
      };

      clearTimeout(safetyTimeout);
      onLogin(userInfo);

      if (userInfo.systemRole === 'admin') {
        navigate("/dashboard");
      } else {
        navigate("/worker-dashboard");
      }

    } catch (err) {
      clearTimeout(safetyTimeout);
      console.log("Auth Error Details:", err);

      const errMessage = err?.message || "";
      let elegantErrorMessage = "Credenciales incorrectas. Verifica tu correo y contraseña.";

      if (errMessage.toLowerCase().includes("confirm")) {
        elegantErrorMessage = "Tu cuenta de correo electrónico aún no ha sido confirmada. Revisa tu bandeja de entrada.";
        toast.error("📧 " + elegantErrorMessage, { duration: 6000 });
      } else if (errMessage.toLowerCase().includes("invalid") || errMessage.toLowerCase().includes("credentials")) {
        elegantErrorMessage = "Correo o contraseña incorrectos. Por favor, inténtalo de nuevo.";
        toast.error("🔑 " + elegantErrorMessage, { duration: 4000 });
      } else if (errMessage.toLowerCase().includes("not found") || errMessage.toLowerCase().includes("user not found")) {
        elegantErrorMessage = "Esta cuenta no está registrada. Contacta al administrador.";
        toast.error("👤 " + elegantErrorMessage, { duration: 4000 });
      } else {
        elegantErrorMessage = errMessage;
        toast.error("🚨 " + elegantErrorMessage, { duration: 4000 });
      }

      setError(elegantErrorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Por favor, ingresa tu correo electrónico para recuperar tu contraseña.");
      return;
    }

    setIsLoading(true);
    try {
      const redirectToUrl = `${window.location.origin}/reset-password`;

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: redirectToUrl,
      });
      if (resetError) throw resetError;
      setMessage("Se ha enviado un enlace de recuperación a tu correo. Por favor, revisa tu bandeja de entrada o spam.");
    } catch (err) {
      console.error("Reset error:", err.message);
      setError("No se pudo enviar el correo de recuperación. Verifica la dirección o intenta nuevamente.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent text-white relative overflow-hidden p-4 md:p-0">
      <GlassCard className="w-full max-w-md p-6 md:p-8">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center mb-4 shadow-xl border border-white/10 hover:border-accent/30 transition-all duration-300">
            {!logoError ? (
              <img
                src="/logo.png"
                alt="Logo"
                onError={() => setLogoError(true)}
                className="w-14 h-14 object-contain drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]"
              />
            ) : (
              <Lightbulb className="w-8 h-8 text-accent animate-pulse" />
            )}
          </div>
          <h2 className="text-3xl font-bold text-white mb-1">Bienvenido</h2>
          <p className="text-gray-400 text-sm">Ingresa a La Ampolleta Producciones</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm text-center">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300 ml-1">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="email"
                placeholder="correo@laampolleta.tv"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-white placeholder-gray-600"
                required
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between ml-1">
              <label className="text-sm font-medium text-gray-300">Contraseña</label>
              <button
                type="button"
                onClick={handleResetPassword}
                className="text-xs text-primary hover:text-primary/80 transition-colors bg-transparent border-none p-0 cursor-pointer"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 pr-12 py-3 bg-gray-800/50 border border-gray-700/50 rounded-xl focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all text-white placeholder-gray-600"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors focus:outline-none"
                title={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>
          <Button type="submit" variant="primary" className="w-full justify-center py-3 text-sm font-semibold" disabled={isLoading}>
            {isLoading ? "Conectando..." : "Iniciar Sesión"}
            {!isLoading && <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </form>
      </GlassCard>

      {/* Sutil Footer Creds */}
      <div className="mt-6 flex flex-col items-center gap-0.5 text-center pointer-events-none select-none opacity-30 hover:opacity-60 transition-opacity duration-300">
        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          La Ampolleta Platform v3.7.3
        </span>
        <span className="text-[8px] text-gray-500 font-medium tracking-wider">
          Engineered by Cristopher Vidal
        </span>
      </div>
    </div>
  );
}