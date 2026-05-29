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
- [x] **Fase 1: Preparación y Base de Datos (Supabase)**
  - [x] Crear script de migración SQL `supabase_invoice_migration.sql` en la raíz del proyecto.
  - [x] Ejecutar alteración de tabla `event_assignments` para agregar las 7 nuevas columnas.
- [x] **Fase 2: Interfaz Administrativa (Finanzas.jsx)**
  - [x] Extender consulta Supabase `fetchPayments` para traer los 7 nuevos campos de boleta de `event_assignments`.
  - [x] Agregar selector toggle en grilla de pagos para activar/desactivar `invoice_required` en tiempo real.
  - [x] Implementar badges visuales tricolores (`Falta boleta`, `Boleta verificada`, `No requiere boleta`).
  - [x] Deshabilitar botón individual "Marcar pagado" si falta boleta.
  - [x] Deshabilitar checkbox de fila y omitir del botón de nómina múltiple si falta boleta.
  - [x] Control de pagos con boleta (si hay boleta se paga, sin boleta no se paga, verificar boleta antes de pagar).
  - [x] Agregar validación que no se puede pagar un evento si hay boleta pendiente.
  - [x] Crear el modal esmerilado (`GlassCard`) "Confirmar Boleta" con los inputs requeridos, validación de montos CLP y confirmación de correo.
  - [x] Programar el guardado e integración de metadata en Supabase para validar la boleta.
- [x] **Fase 3: Transparencia para Trabajadores (WorkerDashboard.jsx)**
  - [x] Modificar consulta de asignaciones `fetchMyEvents` para obtener `invoice_required` e `invoice_received`.
  - [x] Mostrar badge de estado de boleta en la grilla de pagos históricos del trabajador para evitar consultas a soporte.
- [x] **Fase 4: Exportación Bancaria y Tributaria (Excel)**
  - [x] Mantener la hoja `"Resumen Transferencias"` intacta para conservar compatibilidad bancaria de 13 columnas.
  - [x] Agregar una hoja nueva `"Auditoría Boletas"` con todo el detalle tributario requerido.
- [x] **Fase 5: Verificación Local y Compilación**
  - [x] Realizar pruebas locales de flujo completo (crear pago, validar bloqueo, verificar, liberar pago).
  - [x] Ejecutar `npm run build` para asegurar la correcta compilación en producción.
- [x] **Fase 6: Consolidación de Finanzas V3 y UX Responsivo**
  - [x] Limpieza completa de CTAs duplicados a nivel individual, centralizando la validación en el bloque de lotes del trabajador.
  - [x] Rediseño responsivo de filtros en breakpoint `lg` con scroll lateral `shrink-0` y `.scrollbar-none` para eliminar solapamientos de capas y bloqueos táctiles.

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

## 8. Módulo de Control de Asistencia y Reloj de Personal (Anfitrionas)
- [x] **Esquema de Base de Datos Seguro (Supabase):** Crear la tabla `event_attendance_logs` y funciones RPC seguras (`mark_event_check_in` / `mark_event_check_out`) con políticas RLS e inmutabilidad garantizada por la hora del servidor (`NOW()`) en el huso chileno.
- [x] **Configuración Administrativa Flexible:** Agregar toggles glassmorphic en `EventModal.jsx` para habilitar asistencia y/o flexibilizar la exigencia de asignación confirmada por evento.
- [x] **Worker Clock-In/Clock-Out Dashboard:** Widget responsive de asistencia con timer activo en tiempo real e indicador de jornada finalizada.
- [x] **Auditoría Horaria y Suscripción Real-Time:** Integrar grilla en `EventDetails.jsx` con suscripción WebSocket y panel de corrección manual para el administrador.
- [x] **Trazabilidad y Auditoría de Ajustes:** Forzar obligatoriedad del ingreso del motivo de corrección y resguardar marcas originales.
- [x] **Integración de Nóminas y Finanzas:** Consultar y renderizar horas reales trabajadas en los pagos de Finanzas (`Finanzas.jsx`) con badges `⏱️ Xh Ym` e indicadores de pulso de jornadas incompletas.
- [x] **Inputs Premium y Selectores Cohesivos:** Reemplazar selectores nativos por componentes personalizados `DatePicker` y `ClockPicker` con iconografía WebKit invertida de alta fidelidad.

## 9. Pendientes y Tareas Futuras
- [ ] **Reportes Visuales y Gráficos de Finanzas (Admin):** Gráficos interactivos de barra/línea sobre egresos mensuales y exportación de informes analíticos en PDF.
- [ ] **Bitácora de Auditoría Operacional (Logs):** Registro e historial detallado de acciones administrativas críticas (ej: creación de eventos, cambios de estados de pago).
- [ ] Escribir archivo README.md completo con instrucciones de configuración local y variables de entorno.

## 10. Mejoras en Calendario y Auditoría de Eventos Finalizados
- [x] **Sincronización en Tiempo Real del Calendario:** Integrar canal WebSocket en `Calendar.jsx` para refrescar los eventos en vivo ante cambios en la BD.
- [x] **Estandarización de Colores en Calendario:** Sincronizar colores por estado en `Calendar.jsx` (Confirmado/Activo=Verde, Finalizado/Completado=Gris, Cancelado=Rojo, Planificado=Ámbar).
- [x] **Módulo de Auditoría en Detalle de Eventos Finalizados:** Modificar `EventDetails.jsx` para obtener `custom_rate` y renderizar la grilla detallada de personal y asistencia siempre que un evento esté finalizado o completado.
- [x] **Badges de Ausencia y Control Desactivado:** Integrar badges de advertencia sutiles cuando no existan logs de asistencia o cuando el control de ingreso haya estado desactivado.
- [x] **Compilación de Producción:** Ejecutar `npm run build` para garantizar la correcta compilación en producción.

## 11. Optimización del Dashboard de Eventos y Visibilidad Financiera (SII Lotes V3 y Viáticos)
- [x] **Segmentación Contable por Trabajador y Período Mensual (SII Lotes V3):** Reestructurar el hook contable de agrupamiento en el backend y frontend del panel administrativo para separar los eventos por cada mes calendario (formato YYYY-MM), resolviendo discrepancias contables y alineándose con la legislación del SII.
- [x] **Filtro Mensual por Defecto en Finanzas:** Inicializar dinámicamente el selector del período al mes actual de operaciones para evitar confusión visual y agilizar la navegación contable del administrador al cargar el panel de finanzas.
- [x] **Sincronización Total de la Nómina y Lotes:** Restringir la visualización de la tabla consolidada de boletas (`CONTROL DE BOLETAS POR TRABAJADOR`) al período exacto que el administrador tenga filtrado.
- [x] **Ocultación de Boletas de Períodos Futuros (Tablero del Trabajador):** Restringir visualmente en el portal del trabajador la tarjeta consolidada de boletas de meses que no han comenzado, mostrando solo el mes actual y meses pasados pendientes de pago.
- [x] **Foco Predeterminado de Viáticos en Pendientes:** Configurar la pestaña de Viáticos y Reembolsos para mostrar por defecto las solicitudes en estado `"Pendiente"`, permitiendo una toma de decisiones y aprobaciones administrativas inmediatas.

## 12. Endurecimiento de Seguridad y Rendimiento Supabase (Advisor Hardening)
- [x] **Parche de Seguridad en Autenticación:** Aplicar `SECURITY DEFINER` e inyección segura con `search_path = ''` y llamadas cualificadas a `public.handle_new_user` y `public.sync_user_confirmation`, restringiendo los privilegios RPC.
- [x] **Parche de Seguridad en Asistencia:** Aplicar `SET search_path = ''` y llamadas de catálogo a `public.mark_event_check_in` y `public.mark_event_check_out`, bloqueando accesos anónimos e inyectando `pg_catalog.now()` AT TIME ZONE 'UTC'.
- [x] **Parche de Rendimiento RLS (InitPlan Caching):** Resolver alerta de inicialización de RLS en `public.profiles` reemplazando la llamada directa `auth.uid()` por la subconsulta optimizada `(SELECT auth.uid()) IS NOT NULL` en la política `"Enable read access for all authenticated users"`.

## 13. Mejoras Operativas y Estructura Organizacional (Mayo 2026)
- [x] **Alineación de Calendario Lunes-Domingo:** Corregir el cálculo de desfase de días en `DatePicker.jsx` para que el inicio de semana comience de forma natural el día Lunes y finalice el Domingo, previniendo errores de visualización de turnos.
- [x] **Ampliación del Catálogo de Roles Operacionales:** Integrar en el formulario de creación de eventos los 10 nuevos tipos de evento clave (Montaje/Desmontaje, CCTV, Fletes, Servicios Especiales, Visita Técnica, etc.).
- [x] **Autocompletado de Ubicaciones y Malls:** Incorporar catálogo precargado de 16 Malls en `EventModal.jsx` con direcciones físicas y coordenadas GPS, facilitando la autocompletación inteligente del formulario con protección anti-sobreescritura para personalizaciones manuales previas.
- [x] **Acceso Híbrido a Portal Trabajador para Administradores:** Habilitar de manera sutil el acceso al WorkerDashboard para roles directivos (`admin` / `viewer`) sin alterar permisos principales en la BD. Integrar el agrupador `"MENÚ TRABAJADOR"` en la barra lateral (`Sidebar.jsx`) y aislar las finanzas individuales y boletas por el identificador del usuario autenticado.
- [x] **Clima Resiliente y Autorreparable de Alta Velocidad:** Diseñar un sistema de doble endpoint que aborta en 2.0 segundos mediante `AbortController` si la API primaria (Open-Meteo) está caída (502 Bad Gateway), saltando automáticamente al fallback de `wttr.in` de manera completamente imperceptible para el usuario y con logs limpios en consola.

## 14. Validación Automática de Boletas y Sincronización SII (Finanzas 3.5)
- [x] **Corrección de Desplazamiento de Fecha de Emisión:** Reemplazar el formateador del objeto Date local de JS por manipulación directa de string reversible `DD-MM-YYYY`, solucionando el desfase de -1 día causado por zonas horarias del navegador.
- [x] **Optimización de Ventana de Sincronización IMAP:** Restablecer la ventana de escaneo automático de correos a 30 días en el script de sincronización `sync-sii-invoices.js` y en la función Deno de Supabase.
- [x] **Generación de Respaldo Failsafe Pre-3.5:** Crear el archivo comprimido `backup_pre_finanzas_3_5.zip` basado en el último commit estable de Git antes del despliegue contable de la versión 3.5.
- [x] **Rediseño Responsivo de Botones de Confirmación:** Distribución automática por breakpoints (`flex-col` en móvil, `sm:flex-row` en tablets y `lg:flex-col` en desktop) para evitar desbordamientos y cortes de bordes en pantallas móviles pequeñas.
- [x] **Simplificación Visual de Asistencia Confirmada:** Ocultar el gran botón verde redundante de confirmación una vez que la asistencia está dada, dejando una visual ultra limpia con el enlace de cancelación y los detalles del evento.
- [x] **Bloqueo Operacional Horario (Check-In/Out):** Restringir el botón "Marcar Entrada" estrictamente al día del evento (con mensaje dinámico preventivo en ámbar) y el "Marcar Salida" a un plazo de hasta 24h tras el check-in (con advertencia en rojo por expiración).
- [x] **Depuración de Errores de Inicialización:** Corregir el error de referencia temporal (`ReferenceError`) en la inicialización de `todayStr` reubicando su declaración de forma segura al inicio del callback.
- [x] **Reportes del Sistema en Excel General:** Integrar en el panel de control administrativo (`Dashboard.jsx`) un generador de reportes en Excel de 3 hojas (Resumen de KPIs, Listado completo detallado de eventos, y Registro completo de auditoría de actividad reciente) mediante SheetJS (XLSX).



