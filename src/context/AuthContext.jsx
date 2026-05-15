import React, { createContext, useState, useEffect } from 'react';

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
  };

  const updateUser = (newUser) => {
    setUser(newUser);
    localStorage.setItem("ampolleta_user", JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};
