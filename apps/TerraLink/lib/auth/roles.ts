/** Roles that can manage workspace settings and members */
export const ADMIN_ROLES = ["owner", "admin"] as const;

/** Roles that can create/edit/delete business data */
export const EDITOR_ROLES = ["owner", "admin", "analyst"] as const;

/** Roles that can upload evidence */
export const UPLOAD_ROLES = ["owner", "admin", "analyst", "reviewer", "supplier_manager"] as const;

export function canEdit(role: string): boolean {
  return (EDITOR_ROLES as readonly string[]).includes(role);
}

export function isAdmin(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}

export function canUpload(role: string): boolean {
  return (UPLOAD_ROLES as readonly string[]).includes(role);
}
