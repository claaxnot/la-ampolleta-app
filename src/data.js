// src/data.js
// Centralized mock data for La Ampolleta Producciones

export const mockUser = {
  email: "admin@laampolleta.tv",
  password: "admin123",
  systemRole: "admin",
  role: "Administrador",
};

export const mockWorker = {
  email: "staff@laampolleta.tv",
  password: "staff123",
  systemRole: "worker",
  role: "Gerente General",
  name: "Rodrigo Calvo",
  staffId: 1,
  avatar: null
};

// =========================
// EVENTS
// =========================
export const mockEvents = [
  {
    id: 1,
    name: "Arauco Talento",
    client: "Mall Arauco",
    date: "2026-06-15",
    time: "18:00",
    location: "Mall Arauco Maipu",
    description: "Evento musical",
    requiredStaff: 5,
    status: "Planificado",
  },
  {
    id: 2,
    name: "Coca-Cola Spectacle",
    client: "Coca-Cola",
    date: "2026-06-20",
    time: "20:00",
    location: "Estadio Nacional",
    description: "Gran concierto de marca",
    requiredStaff: 8,
    status: "Confirmado",
  },
  {
    id: 3,
    name: "Tech Expo 2026",
    client: "TechWorld",
    date: "2026-07-01",
    time: "09:00",
    location: "Centro de Convenciones",
    description: "Exposición tecnológica",
    requiredStaff: 10,
    status: "Pendiente",
  },
];

// =========================
// STAFF
// =========================
export const mockStaff = [
  {
    id: 1,
    name: "Rodrigo Calvo",
    rut: "12.345.678-9",
    email: "rodrigo@laampolleta.tv",
    role: "Gerente General",
    avatar: "https://i.pravatar.cc/40?img=1",
    status: "active"
  },
  {
    id: 2,
    name: "Yerko Vera",
    rut: "15.987.654-3",
    email: "yerko@laampolleta.tv",
    role: "Montajista",
    avatar: "https://i.pravatar.cc/40?img=2",
    status: "active"
  },
  {
    id: 3,
    name: "Leonardo",
    rut: "18.123.456-7",
    email: "leonardo@laampolleta.tv",
    role: "Montajista",
    avatar: "https://i.pravatar.cc/40?img=3",
    status: "active"
  },
];

// =========================
// AVAILABILITY
// =========================
export const mockAvailability = {
  1: ["2026-06-15", "2026-06-16"],
  2: ["2026-06-15"],
  3: ["2026-06-20"],
};

// =========================
// ACTIVITIES
// =========================
export const mockActivities = [
  {
    id: 1,
    text: "Carlos aceptó asignación para el Evento Coca-Cola",
    time: "hace 5 min",
  },
  {
    id: 2,
    text: "Equipo de iluminación actualizó disponibilidad",
    time: "hace 12 min",
  },
  {
    id: 3,
    text: "Nueva producción añadida: Arauco Talento",
    time: "hace 30 min",
  },
  {
    id: 4,
    text: "Check-in de staff completado: Rodrigo Calvo",
    time: "hace 45 min",
  },
];

// =========================
// NOTIFICATIONS
// =========================
export const mockNotifications = [
  {
    id: 1,
    type: "warning",
    message: "Falta confirmar al menos 2 staff para el evento de mañana",
    time: "1h",
  },
  {
    id: 2,
    type: "info",
    message: "Entrega de equipos pendiente antes del 20/06",
    time: "2h",
  },
  {
    id: 3,
    type: "error",
    message: "Conflicto de horarios entre dos eventos",
    time: "3h",
  },
];