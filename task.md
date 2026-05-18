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
- [x] **Debug de Autenticación:** Normalización estricta de RUT (`12345678-9`, sin puntos) y contraseñas numéricas por defecto (`12345678`), previniendo errores de inicio de sesión.
- [x] **Manejo de Errores Robustos:** Toasts elegantes en la pantalla de inicio de sesión para correos no confirmados, credenciales incorrectas y cuentas inexistentes.

## 3. Módulos de Administración (Admin)
- [x] **Dashboard:** Resumen estadístico, tabla de eventos recientes y línea de tiempo de actividad.
- [x] **Eventos:** CRUD completo (Crear, leer, editar, eliminar), asignación de staff a eventos.
- [x] **Personal (Staff):** Gestión de trabajadores, activar/inactivar, visualización de avatares y buscador/filtros.
- [x] **Calendario Global:** Vista general mensual con todos los eventos planificados.
- [x] **Reenvío de Correo:** Botón premium para reenviar el correo de activación de Supabase a los trabajadores.
- [x] **Toggle de Planificación:** Opción "Información operacional pendiente" para ocultar o advertir tiempos no programados.

## 4. Portal del Trabajador (Worker)
- [x] **Panel Principal:** Visualización de eventos asignados.
- [x] **Gestión de Asignaciones:** Flujo de Aceptar o Rechazar participación en eventos.
- [x] **Disponibilidad Avanzada:** Calendario interactivo con Click-Cycling en tiempo real (`available` -> `busy` -> `none`) con tooltip informativo.
- [x] **Sincronización en Tiempo Real:** Integración de canal WebSocket (Supabase Realtime) para actualizar en vivo el WorkerDashboard si un admin edita un evento asignado.
- [x] **Notificaciones Operativas:** Panel interactivo para leer, marcar como leídas, y desvanecer notificaciones con Framer Motion.
- [x] **Layout Adaptativo Inteligente:** Ocultación automática de horarios de montaje y detalles técnicos para roles simples (Anfitrionas/Promotoras) y eventos sin producción técnica compleja.

## 5. Diseño UI/UX y Responsividad
- [x] Paleta de colores premium (Amber/Red/Dark).
- [x] Tarjetas Glassmorphism (`GlassCard`) y animaciones fluidas con Framer Motion.
- [x] Adaptación completa para dispositivos móviles (Menú Hamburguesa, Sidebar tipo Drawer, grillas responsivas).

- [x] **Filtrado Inteligente de Staff:** Mostrar quién está disponible (según su calendario) al momento de asignarlo a un evento en el EventModal, con alertas operacionales preventivas ante doble asignación o no disponibilidad.
- [x] **Persistencia de Notificaciones:** Tabla física `notifications` en Supabase para conservar el historial de mensajes de los trabajadores (completamente funcional con tiempo real y tolerancia a fallos).

- [x] **Módulo de Finanzas y Pagos (Admin/Worker):** Visualización de transferencias y estados por mes, generación de nóminas masivas de pagos en Excel agrupadas por persona para bancos, y registro obligatorio de datos de cuenta del trabajador.
- [x] **Seguridad y Auditoría del Sistema:**
  - [x] Verificación de sesión dinámica y revocación en tiempo real si una cuenta es desactivada (`Activo` / `Inactivo`).
  - [x] Exención blindada (failsafe) para el SuperAdmin (`admin@laampolleta.tv`).
  - [x] Actualización de contraseña real integrada directamente con Supabase Auth en Mi Perfil.
  - [x] Control estricto de token activo y protección de interfaz en la pantalla de Restablecer Contraseña.

## 6. Pendientes y Tareas Futuras
- [ ] **Módulo de Subida de Boletas de Honorarios (Worker):** Subida de PDFs de boletas para eventos finalizados, con flujo de revisión y aprobación del administrador antes de liberar el pago.
- [ ] **Reportes Visuales y Gráficos de Finanzas (Admin):** Gráficos interactivos de barra/línea sobre egresos mensuales y exportación de informes analíticos en PDF.
- [ ] **Bitácora de Auditoría Operacional (Logs):** Registro e historial detallado de acciones administrativas críticas (ej: creación de eventos, cambios de estados de pago).
- [ ] Escribir archivo README.md completo con instrucciones de configuración local y variables de entorno.
