export const permissions = {
  admin: {
    canEdit: true,
    canDelete: true,
    canCreate: true,
  },
  productor: {
    canEdit: true,
    canDelete: false,
    canCreate: true,
  },
  viewer: {
    canEdit: false,
    canDelete: false,
    canCreate: false,
  },
  worker: {
    canEdit: false,
    canDelete: false,
    canCreate: false,
  }
};
