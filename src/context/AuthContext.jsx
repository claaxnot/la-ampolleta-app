import React, { createContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase.js';

export const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const savedUser = localStorage.getItem("ampolleta_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (userInfo) => {
    setUser(userInfo);
    localStorage.setItem("ampolleta_user", JSON.stringify(userInfo));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("ampolleta_user");
    supabase.auth.signOut().catch(e => console.error("Error signing out:", e));
  };

  const updateUser = (newUser) => {
    setUser(newUser);
    localStorage.setItem("ampolleta_user", JSON.stringify(newUser));
  };

  // Helper to sync profile information
  const syncProfileWithUser = async (userId, userEmail) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('status, system_role, role, name, avatar_url, cuenta_destino, codigo_banco_destino')
        .eq('id', userId)
        .single();

      if (error) throw error;

      if (profile) {
        // If inactive, log out immediately (exempting the system superadmin)
        if (profile.status === 'Inactivo' && userEmail !== 'admin@laampolleta.tv') {
          console.warn("🔒 [SECURITY]: User account has been deactivated. Logging out.");
          logout();
          return null;
        }

        const systemRole = profile.system_role || (userEmail === 'admin@laampolleta.tv' ? 'admin' : 'worker');
        const updated = {
          id: userId,
          email: userEmail,
          systemRole,
          role: profile.role || 'Staff',
          name: profile.name || userEmail.split('@')[0],
          avatar: profile.avatar_url || null,
          cuenta_destino: profile.cuenta_destino || null,
          codigo_banco_destino: profile.codigo_banco_destino || null
        };
        
        setUser(updated);
        localStorage.setItem("ampolleta_user", JSON.stringify(updated));
        return updated;
      }
    } catch (err) {
      console.error("🔒 [SECURITY] Failed to sync user profile:", err);
    }
    return null;
  };

  // 1. Initial Session Recovery and onAuthStateChange listener (unconditional on mount)
  useEffect(() => {
    const recoverSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          console.log("🔒 [SECURITY] Session found on startup. Recovering user data.");
          await syncProfileWithUser(session.user.id, session.user.email);
        } else {
          // If Supabase session is null, check if we have a stale non-demo user and clear it
          const savedUser = localStorage.getItem("ampolleta_user");
          if (savedUser) {
            const parsed = JSON.parse(savedUser);
            if (parsed && parsed.id !== "demo-viewer-id") {
              console.log("🔒 [SECURITY] No active Supabase session found on startup. Clearing stale localStorage.");
              setUser(null);
              localStorage.removeItem("ampolleta_user");
            }
          }
        }
      } catch (err) {
        console.error("Failed to recover session on mount:", err);
      }
    };

    recoverSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`🔒 [AUTH EVENT] - ${event}`);
      if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem("ampolleta_user");
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        if (session?.user) {
          await syncProfileWithUser(session.user.id, session.user.email);
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // 2. Active Session Status Verification (runs periodically to avoid mount/login race conditions)
  useEffect(() => {
    if (!user || user.id === "demo-viewer-id") return;

    const verifyUserStatus = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('status, system_role, role, name, avatar_url, cuenta_destino, codigo_banco_destino')
          .eq('id', user.id)
          .single();

        if (error) throw error;

        if (profile?.status === 'Inactivo' && user.email !== 'admin@laampolleta.tv') {
          console.warn("🔒 [SECURITY]: User account has been deactivated. Logging out.");
          logout();
          return;
        }

        if (profile) {
          const systemRole = profile.system_role || (user.email === 'admin@laampolleta.tv' ? 'admin' : 'worker');
          const dbAvatar = profile.avatar_url || null;
          const dbCuenta = profile.cuenta_destino || null;
          const dbBanco = profile.codigo_banco_destino || null;
          const dbRole = profile.role || 'Staff';
          const dbName = profile.name || user.name;

          if (
            systemRole !== user.systemRole ||
            dbRole !== user.role ||
            dbName !== user.name ||
            dbAvatar !== user.avatar ||
            dbCuenta !== user.cuenta_destino ||
            dbBanco !== user.codigo_banco_destino
          ) {
            console.log("🔒 [SECURITY]: Profile details updated in database. Syncing session.");
            updateUser({
              ...user,
              systemRole,
              role: dbRole,
              name: dbName,
              avatar: dbAvatar,
              cuenta_destino: dbCuenta,
              codigo_banco_destino: dbBanco
            });
          }
        }
      } catch (err) {
        console.error("🔒 [SECURITY] Failed to verify user profile:", err);
      }
    };

    // Verify periodically every 2 minutes while active instead of immediately on mount/login
    const interval = setInterval(verifyUserStatus, 120000);

    return () => {
      clearInterval(interval);
    };
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
