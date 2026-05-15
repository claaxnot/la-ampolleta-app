export const permissions = {
  admin: {
    canEdit: true,
    canDelete: true,
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
