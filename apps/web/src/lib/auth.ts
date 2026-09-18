import type { Role, Session, User } from "@/types";

/**
 * Phase 2: the backend (Spring Security + `jjwt`) now issues and verifies
 * the real JWT — see `authStore.login()` / `lib/api.ts`. What's left here
 * is exactly what the Phase 1 doc comment said would survive the move
 * unchanged: the permission functions. They're still useful client-side
 * for driving the UI (hiding a button, redirecting a route) even though
 * the backend is now the actual authority — every one of these checks is
 * re-enforced server-side in `security/PermissionService`, so a client
 * that lies about them simply gets a 403 back.
 */

export function sessionMinutesRemaining(session: Session): number {
  return Math.max(0, (new Date(session.expiresAtUtc).getTime() - Date.now()) / 60_000);
}

// --- Permissions ---------------------------------------------------------

export function canManageLocation(user: User | null, locationId: string): boolean {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  return user.role === "MANAGER" && user.managedLocationIds.includes(locationId);
}

export function canApproveSwapsAt(user: User | null, locationId: string): boolean {
  return canManageLocation(user, locationId);
}

export function canViewAuditLog(user: User | null): boolean {
  return !!user && (user.role === "ADMIN" || user.role === "MANAGER");
}

export function canExportAuditLog(user: User | null): boolean {
  return user?.role === "ADMIN";
}

export function canManageUsers(user: User | null): boolean {
  return user?.role === "ADMIN";
}

/** Locations, the skills catalog, and scheduling-rule thresholds are
 * organization-wide setup, not per-location — admin only, same as user
 * management, never delegated to a location manager. */
export function canManageSettings(user: User | null): boolean {
  return user?.role === "ADMIN";
}

export function routeAllowed(user: User | null, roles: Role[]): boolean {
  return !!user && roles.includes(user.role);
}

// --- Demo credentials panel ------------------------------------------------
//
// Real auth now happens against the backend (`POST /auth/login`, checked
// with BCrypt against `AppUser.passwordHash`), but every seeded account
// still shares one password per role — see the backend's
// `user/DemoPasswords.java` — purely so the login screen's "click a name to
// fill the form" panel works without ten different credentials to remember.
// This constant exists only to render that panel; it plays no role in
// actually authenticating anyone.

const DEMO_PASSWORDS: Record<Role, string> = {
  ADMIN: "Admin@123",
  MANAGER: "Manager@123",
  STAFF: "Staff@123",
};

export function demoPasswordFor(role: Role): string {
  return DEMO_PASSWORDS[role];
}

export function roleHomePath(role: Role): string {
  if (role === "ADMIN") return "/admin";
  if (role === "MANAGER") return "/schedule";
  return "/my-shifts";
}
