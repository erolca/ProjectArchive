import type { RoleName } from "@prisma/client";
import type { AuthenticatedUser, AuthorizationResult, Permission } from "./auth.types";

export const ROLE_PERMISSIONS: Record<RoleName, readonly Permission[]> = {
  ADMIN: [
    "users:create",
    "users:update",
    "users:delete",
    "roles:manage",
    "projects:read",
    "projects:create",
    "projects:update",
    "projects:delete",
    "files:read",
    "files:upload",
    "files:download",
    "files:delete",
    "versions:create",
    "service-records:create",
    "activity:read",
    "backups:manage",
  ],
  ENGINEER: [
    "projects:read",
    "projects:create",
    "projects:update",
    "files:read",
    "files:upload",
    "files:download",
    "versions:create",
    "activity:read",
  ],
  SERVICE: ["projects:read", "files:read", "files:download", "service-records:create"],
  GUEST: ["projects:read"],
};

export function hasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function authorizeUser(
  user: AuthenticatedUser | null,
  permission: Permission,
): AuthorizationResult {
  if (!user) {
    return {
      allowed: false,
      reason: "Authentication required.",
    };
  }

  if (!user.isActive) {
    return {
      allowed: false,
      reason: "User account is inactive.",
    };
  }

  if (!hasPermission(user.role, permission)) {
    return {
      allowed: false,
      reason: "Permission denied.",
    };
  }

  return {
    allowed: true,
  };
}

export function requirePermission(user: AuthenticatedUser | null, permission: Permission): void {
  const result = authorizeUser(user, permission);

  if (!result.allowed) {
    throw new Error(result.reason || "Permission denied.");
  }
}
