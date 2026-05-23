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

- [x] **Módulo de Finanzas y Pagos (Admin/Worker):** Visualización de transferencias y estados por mes, generación de nóminas masivas de pagos en Excel agrupadas por persona para bancos, registro obligatorio de datos de cuenta del trabajador, e implementación de la compatibilidad con el formato bancario de Transferencias Masivas.
  - [x] **Exportación bancaria compatible con Transferencias Masivas:** reordenamiento de columnas en la hoja “Resumen Transferencias”, RUT sin puntos, montos numéricos reales, columnas bancarias opcionales vacías y preservación de la hoja “Detalle de Eventos”.
- [x] **Seguridad y Auditoría del Sistema:**
  - [x] Verificación de sesión dinámica y revocación en tiempo real si una cuenta es desactivada (`Activo` / `Inactivo`).
  - [x] Exención blindada (failsafe) para el SuperAdmin (`admin@laampolleta.tv`).
  - [x] Actualización de contraseña real integrada directamente con Supabase Auth en Mi Perfil.
  - [x] Control estricto de token activo y protección de interfaz en la pantalla de Restablecer Contraseña.

## 6. Módulo de Viáticos e Integración de Nóminas
- [x] **Esquema de Base de Datos y RLS:** Crear la tabla `expense_requests` con RLS, políticas seguras y configuración para Signed URLs.
- [x] **Worker Dashboard UX:** Agregar pestaña interna de Viáticos y Reembolsos en Finanzas, formulario con carga de comprobantes, montos solicitados vs. aprobados, y Signed URLs.
- [x] **Admin Finanzas UX:** Integrar pestaña "Gestionar Viáticos" con buscador, previsualización de comprobante por Signed URL, comentarios y aprobación diferenciada.
- [x] **Cálculo de Nómina y Failsafe:** Consolidar montos de viáticos aprobados en la tabla general de Finanzas y hoja `Resumen Transferencias`, previniendo duplicaciones con `included_in_payroll` y `payroll_batch_id`.
- [x] **Exportación Excel Completa:** Agregar la hoja `Detalle Viáticos` manteniendo intactas las de `Resumen Transferencias` y `Detalle de Eventos`.

## 7. Mejoras de UX Financiera e Inputs Premium
- [x] **Integración de DatePicker en Viáticos:** Reemplazar el input de fecha nativo en el formulario de creación de viáticos por el selector premium `DatePicker.jsx` coherente con toda la aplicación.
- [x] **Campos Monetarios CLP en Tiempo Real:** Crear e integrar el componente reusable `<CurrencyInputCLP />` para formatear visualmente montos con separadores de miles y signo peso (`$`) mientras se conservan enteros puros en el estado para inputs editables en:
  - `EventModal.jsx` (tarifas personalizadas por turno de staff).
  - `WorkerDashboard.jsx` (monto solicitado del gasto).
  - `Finanzas.jsx` (monto final aprobado por el administrador).
- [x] **Corrección de Tiempos en Notificaciones (TopBar):** Corregir la consulta de asignaciones para usar `updated_at` en lugar de `created_at` al renderizar la confirmación de asistencia y la notificación de pago realizado, mostrando la fecha y hora correctas en la campana en tiempo real.
- [x] **Seguridad de Base de Datos y Hardening SQL (Supabase):** Resolver la advertencia de seguridad `0011_function_search_path_mutable` y `0029_authenticated_security_definer_function_executable` en `public.handle_new_user`, `public.sync_user_confirmation`, `public.handle_updated_at` y `public.update_updated_at_column` aplicando `search_path = ''`, `SECURITY INVOKER` y revocación explícita de privilegios RPC.

## 8. Pendientes y Tareas Futuras
- [ ] **Módulo de Subida de Boletas de Honorarios (Worker):** Subida de PDFs de boletas para eventos finalizados, con flujo de revisión y aprobación del administrador antes de liberar el pago.
- [ ] **Reportes Visuales y Gráficos de Finanzas (Admin):** Gráficos interactivos de barra/línea sobre egresos mensuales y exportación de informes analíticos en PDF.
- [ ] **Bitácora de Auditoría Operacional (Logs):** Registro e historial detallado de acciones administrativas críticas (ej: creación de eventos, cambios de estados de pago).
- [ ] Escribir archivo README.md completo con instrucciones de configuración local y variables de entorno.
- [ ] Control de ingreso-salida para anfitrionas.
- [ ] Control de pagos con boleta (si hay boleta se paga, sin boleta no se paga, verificar boleta antes de pagar).
- [ ] Agregar validación que no se puede pagar un evento si hay boleta pendiente.


