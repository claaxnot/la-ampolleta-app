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

  // Dynamic status & session verification
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

        // If inactive, log out immediately (exempting the system superadmin)
        if (profile?.status === 'Inactivo' && user.email !== 'admin@laampolleta.tv') {
          console.warn("🔒 [SECURITY]: User account has been deactivated. Logging out.");
          logout();
          return;
        }

        // If their profile properties changed, sync session details dynamically
        if (profile) {
          const systemRole = profile.system_role || (user.email === 'admin@laampolleta.tv' ? 'admin' : 'worker');
          if (
            systemRole !== user.systemRole ||
            profile.role !== user.role ||
            profile.name !== user.name ||
            profile.avatar_url !== user.avatar ||
            profile.cuenta_destino !== user.cuenta_destino ||
            profile.codigo_banco_destino !== user.codigo_banco_destino
          ) {
            console.log("🔒 [SECURITY]: Profile updated in database. Syncing session.");
            updateUser({
              ...user,
              systemRole,
              role: profile.role || 'Staff',
              name: profile.name || user.name,
              avatar: profile.avatar_url || null,
              cuenta_destino: profile.cuenta_destino || null,
              codigo_banco_destino: profile.codigo_banco_destino || null
            });
          }
        }
      } catch (err) {
        console.error("🔒 [SECURITY] Failed to verify user profile:", err);
      }
    };

    verifyUserStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        localStorage.removeItem("ampolleta_user");
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        if (session?.user) {
          verifyUserStatus();
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
