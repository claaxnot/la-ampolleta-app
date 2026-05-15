import React from "react";
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";

import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Events from "./pages/Events.jsx";
import Staff from "./pages/Staff.jsx";
import CalendarPage from "./pages/Calendar.jsx";
import WorkerDashboard from "./pages/WorkerDashboard.jsx";
import Profile from "./pages/Profile.jsx";

function App() {
  // For mock login, store role in state (admin default)
  const [user, setUser] = React.useState(() => {
    const savedUser = localStorage.getItem("ampolleta_user");
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const handleLogin = (userInfo) => {
    setUser(userInfo);
    localStorage.setItem("ampolleta_user", JSON.stringify(userInfo));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("ampolleta_user");
  };

  // Simple protected route component
  const ProtectedRoute = ({ children }) => {
    return user ? children : <Navigate to="/login" replace />;
  };

  const AdminRoute = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.systemRole !== 'admin') return <Navigate to="/worker-dashboard" replace />;
    return children;
  };

  const WorkerRoute = ({ children }) => {
    if (!user) return <Navigate to="/login" replace />;
    if (user.systemRole === 'worker' && !user.avatar) {
      return <Navigate to="/profile?requireAvatar=true" replace />;
    }
    return children;
  };

  return (
    <BrowserRouter>
      <div className="relative flex h-screen bg-gray-900 text-white font-sans antialiased overflow-hidden">
      {/* Gradient / orb background */}
      <div className="absolute -top-20 -left-20 w-96 h-96 bg-red-600/20 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-24 -right-24 w-[500px] h-[500px] bg-amber-500/15 rounded-full blur-3xl"></div>
    {user && <Sidebar user={user} onLogout={handleLogout} />}
    <div className="flex-1 flex flex-col overflow-hidden">
      {user && <TopBar user={user} />}
      <div className="flex-1 overflow-auto">
        <Routes>
              <Route path="/login" element={<Login onLogin={handleLogin} />} />
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
                    onUpdateUser={(newUser) => {
                      setUser(newUser);
                      localStorage.setItem("ampolleta_user", JSON.stringify(newUser));
                    }} 
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
