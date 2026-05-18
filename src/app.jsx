import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";

import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import SessionTimeout from "./components/security/SessionTimeout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Events from "./pages/Events.jsx";
import Staff from "./pages/Staff.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import WorkerDashboard from "./pages/WorkerDashboard.jsx";
import Profile from "./pages/Profile.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

import { useAuth } from "./hooks/useAuth.js";
import { Toaster } from "react-hot-toast";

function App() {
  const { user, login: handleLogin, logout: handleLogout, updateUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);



  // Simple protected route component
  const ProtectedRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" replace />;
  };

  const AdminRoute = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.systemRole !== 'admin' && user.systemRole !== 'viewer') return <Navigate to="/worker-dashboard" replace />;
    return children;
  };

  const WorkerRoute = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.systemRole === 'worker') {
      const missingAvatar = !user.avatar;
      const missingBank = !user.cuenta_destino || !user.codigo_banco_destino;
      if (missingAvatar || missingBank) {
        return <Navigate to={`/profile?requireAvatar=${missingAvatar}&requireBank=${missingBank}`} replace />;
      }
    }
    return children;
  };

  return (
    <BrowserRouter>
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          style: {
            background: 'rgba(17, 24, 39, 0.85)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            fontSize: '14px',
            padding: '12px 20px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }} 
      />
      <div className="relative flex h-screen bg-gray-900 text-white font-sans antialiased overflow-hidden">
      {/* Gradient / orb background */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-red-600/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-3xl"></div>
    {user && <Sidebar user={user} onLogout={handleLogout} isOpen={mobileMenuOpen} setIsOpen={setMobileMenuOpen} />}
    <div className="flex-1 flex flex-col overflow-hidden">
      {user && <TopBar user={user} onToggleMenu={() => setMobileMenuOpen(true)} />}
      {user && <SessionTimeout />}
      <div className="flex-1 overflow-auto">
        <Routes>
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
              <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <AdminRoute>
                  <Dashboard user={user} />
                </AdminRoute>
              }
            />
            <Route
              path="/worker-dashboard"
              element={
                <WorkerRoute>
                  <WorkerDashboard user={user} />
                </WorkerRoute>
              }
            />
            <Route
              path="/events"
              element={
                <AdminRoute>
                  <Events user={user} />
                </AdminRoute>
              }
            />
            <Route
              path="/staff"
              element={
                <AdminRoute>
                  <Staff />
                </AdminRoute>
              }
            />
            <Route
              path="/calendar"
              element={
                <AdminRoute>
                  <CalendarPage />
                </AdminRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile 
                    user={user} 
                    onUpdateUser={updateUser} 
                  />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to={user?.systemRole === 'worker' ? "/worker-dashboard" : "/dashboard"} replace />} />
          </Routes>
        </div>
      </div>
    </div>
  </BrowserRouter>
  );
}

export default App;
