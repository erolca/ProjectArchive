import type { RoleName } from "@prisma/client";

export type Permission =
  | "users:create"
  | "users:update"
  | "users:delete"
  | "roles:manage"
  | "projects:read"
  | "projects:create"
  | "projects:update"
  | "projects:delete"
  | "files:read"
  | "files:upload"
  | "files:download"
  | "files:delete"
  | "versions:create"
  | "service-records:create"
  | "activity:read"
  | "backups:manage";

export interface AuthenticatedUser {
  id: number;
  username: string;
  fullName?: string | null;
  email: string;
  department?: string | null;
  role: RoleName;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
}

export interface AuthTokenPayload {
  sub: string;
  userId: number;
  username: string;
  email: string;
  role: RoleName;
  sessionStartedAt?: number;
  lastActivityAt?: number;
  maxExpiresAt?: number;
  iat?: number;
  exp?: number;
}

export interface SessionPolicy {
  inactivityTimeoutMinutes: number;
  warningMinutes: number;
  maxLifetimeHours: number;
  slidingEnabled: boolean;
}

export interface SessionStatus {
  policy: SessionPolicy;
  sessionStartedAt: number;
  lastActivityAt: number;
  maxExpiresAt: number;
  expiresAt?: number | null;
}

export interface LoginInput {
  usernameOrEmail: string;
  password: string;
}

export interface LoginResult {
  user: AuthenticatedUser;
  token: string;
  expiresIn: string;
  session: SessionStatus;
}

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}
