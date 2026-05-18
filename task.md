# La Ampolleta Producciones - Roadmap del Proyecto

## 1. Configuración Inicial y Arquitectura
- [x] Inicializar proyecto con Vite + React.
- [x] Configurar Tailwind CSS con temas oscuros, animaciones y glassmorphism.
- [x] Integrar base de datos y backend con Supabase (reemplazando Firebase inicial).
- [x] Configurar despliegue continuo en Vercel y repositorio en GitHub (reemplazando Netlify).
- [x] Implementar enrutamiento (React Router) protegiendo rutas (AdminRoute, WorkerRoute, ProtectedRoute).

## 2. Autenticación y Usuarios
- [x] Interfaz de Login interactiva y responsiva.
- [x] Integración de Auth con Supabase (Email/Password).
- [x] Sistema de Roles de Usuario: Administrador, Trabajador (Worker), y Visor (Viewer).
- [x] Modo Demo / Solo Lectura para clientes (rol "Viewer") con bloqueos visuales y de código.
- [x] Perfil de usuario con cambio de contraseña.
- [x] Captura obligatoria de foto biométrica con cámara web para los trabajadores.

## 3. Módulos de Administración (Admin)
- [x] **Dashboard:** Resumen estadístico, tabla de eventos recientes y línea de tiempo de actividad.
- [x] **Eventos:** CRUD completo (Crear, leer, editar, eliminar), asignación de staff a eventos.
- [x] **Personal (Staff):** Gestión de trabajadores, activar/inactivar, visualización de avatares y buscador/filtros.
- [x] **Calendario Global:** Vista general mensual con todos los eventos planificados.

## 4. Portal del Trabajador (Worker)
- [x] **Panel Principal:** Visualización de eventos asignados.
- [x] **Gestión de Asignaciones:** Flujo de Aceptar o Rechazar participación en eventos.
- [x] **Disponibilidad:** Mini calendario para marcar días disponibles o no disponibles.

## 5. Diseño UI/UX y Responsividad
- [x] Paleta de colores premium (Amber/Red/Dark).
- [x] Tarjetas Glassmorphism (`GlassCard`) y animaciones fluidas con Framer Motion.
- [x] Adaptación completa para dispositivos móviles (Menú Hamburguesa, Sidebar tipo Drawer, grillas responsivas).

## 6. Pendientes y Tareas Futuras
- [ ] Escribir archivo README.md completo con instrucciones de configuración local y variables de entorno.
- [ ] Implementar tests unitarios y de integración para asegurar que la app no se rompa con nuevas funciones.
- [ ] Añadir paginación real a las tablas de eventos y staff para optimizar rendimiento cuando la base de datos crezca.
- [ ] Refinar las notificaciones de la campanita superior (actualmente simuladas) para que vengan de la base de datos.
- [ ] Solicitar numero de cuenta y banco a los funcionarios
