import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

// Premium Developer Console Signature
console.log(
    "%c⚡ LA AMPOLLETA PLATFORM v3.7.4 %c\n%cEngineered with ♥ by Cristopher Vidal%c\n%cEnvironment: Production | Build: 2026.06%c",
    "color:#f5b301;font-size:13px;font-weight:900;font-family:system-ui;text-transform:uppercase;letter-spacing:1px;text-shadow:0 0 10px rgba(245,158,11,0.3);",
    "",
    "color:#e2e8f0;font-size:11px;font-family:system-ui;font-weight:600;",
    "",
    "color:#64748b;font-size:9px;font-family:system-ui;font-weight:bold;letter-spacing:0.5px;",
    ""
);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <AuthProvider>
            <App />
        </AuthProvider>
    </React.StrictMode>,
);

// Registrar Service Worker para soporte PWA y notificaciones Push
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((reg) => {
                console.log('🔌 [Service Worker] - Registrado con éxito en ámbito:', reg.scope);
            })
            .catch((err) => {
                console.warn('❌ [Service Worker] - Fallo en el registro:', err);
            });
    });
}