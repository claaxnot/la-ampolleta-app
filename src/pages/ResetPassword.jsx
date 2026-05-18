import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { Lock, Eye, EyeOff, Lightbulb } from "lucide-react";
import GlassCard from "../components/GlassCard.jsx";
import Button from "../components/Button.jsx";
import { toast } from "react-hot-toast";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  // Check if there is an active recovery session
  useEffect(() => {
    const checkSession = async () => {
      // Give Supabase client a moment to parse the URL hash fragment
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setHasSession(true);
      } else {
        // If there's a recovery token in hash, wait a bit more or warn
        if (window.location.hash.includes("access_token")) {
          setHasSession(true);
        } else {
          toast.error("El enlace de recuperación es inválido o ha expirado. Por favor, solicita uno nuevo.");
        }
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }

    setIsLoading(true);
    const loadingToast = toast.loading("Actualizando tu contraseña...");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Contraseña actualizada con éxito. Redirigiendo...", { id: loadingToast });
      
      // Auto-logout from the recovery session and redirect to login
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      console.error("Reset password error:", err);
      toast.error(err.message || "No se pudo actualizar la contraseña. Inténtalo de nuevo.", { id: loadingToast });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-transparent text-white relative overflow-hidden p-4 md:p-0">
      {/* Background orbs */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-red-600/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-3xl"></div>

      <GlassCard className="w-full max-w-md p-6 md:p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 mb-3">
            <Lightbulb className="w-6 h-6 text-primary animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Restablecer Contraseña</h2>
          <p className="text-sm text-gray-400 mt-2">
            Ingresa tu nueva contraseña para acceder al sistema de La Ampolleta.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300 ml-1">Nueva Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full bg-gray-800/40 border border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl py-2.5 pl-12 pr-12 text-white placeholder-gray-500 transition-all duration-300`}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                disabled={isLoading}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300 ml-1">Confirmar Nueva Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full bg-gray-800/40 border border-gray-700 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/30 rounded-xl py-2.5 pl-12 pr-12 text-white placeholder-gray-500 transition-all duration-300`}
                required
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                disabled={isLoading}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-2"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Restableciendo...
              </span>
            ) : (
              "Guardar Nueva Contraseña"
            )}
          </Button>

          <div className="text-center mt-4">
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="text-xs text-gray-400 hover:text-white transition-colors"
              disabled={isLoading}
            >
              Volver al Inicio de Sesión
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
