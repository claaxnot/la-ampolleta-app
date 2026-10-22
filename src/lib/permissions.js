export const permissions = {
  admin: {
    canEdit: true,
    canDelete: true,
    canCreate: true,
    canManageClients: true,
  },
  productor: {
    canEdit: true,
    canDelete: false,
    canCreate: true,
    canManageClients: false,
  },
  viewer: {
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canManageClients: false,
  },
  worker: {
    canEdit: false,
    canDelete: false,
    canCreate: false,
    canManageClients: false,
  }
};
