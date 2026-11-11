import { canAccess, type PermissionUser } from './roles';

/** Main-tab structure is reserved for this event's assigned lead or an admin. */
export function canEditMainSpecification(user: PermissionUser | null, siteManagerId?: string | null): boolean {
  return canAccess(user, 'specifications', 2) && !!user &&
    (user.role === 'superuser' || user.role === 'admin' || (user.role === 'foreman' && !!siteManagerId && user.id === siteManagerId));
}

/** Technicians with read access may check main-tab rows without gaining edit rights. */
export function canMarkMainSpecification(user: PermissionUser | null): boolean {
  return canAccess(user, 'specifications') &&
    (user?.role === 'staff' || canAccess(user, 'specifications', 2));
}

export function canViewSpecificationLogs(user: PermissionUser | null, siteManagerId?: string | null): boolean {
  return canAccess(user, 'specifications') && !!user &&
    (user.role === 'superuser' || user.role === 'admin' || (user.role === 'foreman' && !!siteManagerId && user.id === siteManagerId));
}

/** Technicians may adjust accessory quantities without gaining Main-tab edit rights. */
export function canAdjustSpecificationAccessories(user: PermissionUser | null, siteManagerId?: string | null): boolean {
  return canAccess(user, 'specifications') && !!user &&
    (user.role === 'staff' || (canAccess(user, 'specifications', 2) && (user.role !== 'foreman' || user.id === siteManagerId)));
}
