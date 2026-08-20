import { ActivityAction, type ActivityAction as ActivityActionType, type RoleName } from "@prisma/client";
import { createAuthToken, extractBearerToken, getSessionExpiresIn, verifyAuthToken } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { verifyPassword } from "../../lib/password";
import { authorizeUser, requirePermission } from "./permissions";
import type { AuthTokenPayload, AuthenticatedUser, LoginInput, LoginResult, Permission, SessionPolicy, SessionStatus } from "./auth.types";

const SETTINGS_ID = 1;
const DEFAULT_SESSION_POLICY: SessionPolicy = {
  inactivityTimeoutMinutes: 30,
  warningMinutes: 2,
  maxLifetimeHours: 12,
  slidingEnabled: true,
};

export async function login(input: LoginInput): Promise<LoginResult> {
  const usernameOrEmail = input.usernameOrEmail.trim();

  if (!usernameOrEmail || !input.password) {
    await logAuthActivity({
      action: ActivityAction.LOGIN_FAILED,
      details: "Login failed: missing username/email or password.",
    });
    throw new Error("Invalid credentials.");
  }

  const user = await prisma.user.findFirst({
    where: {
      deletedAt: null,
      OR: [{ username: usernameOrEmail }, { email: usernameOrEmail.toLowerCase() }],
    },
    include: {
      role: true,
    },
  });

  if (!user || !user.isActive) {
    await logAuthActivity({
      action: ActivityAction.LOGIN_FAILED,
      details: `Login failed for username/email: ${usernameOrEmail}.`,
    });
    throw new Error("Invalid credentials.");
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);

  if (!passwordMatches) {
    await logAuthActivity({
      action: ActivityAction.LOGIN_FAILED,
      userId: user.id,
      details: `Login failed for user id: ${user.id}.`,
    });
    throw new Error("Invalid credentials.");
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  });

  await logAuthActivity({
    action: ActivityAction.LOGIN,
    userId: user.id,
    details: `Login successful for user id: ${user.id}.`,
  });

  const authenticatedUser = toAuthenticatedUser({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    role: user.role.name,
  });

  const policy = await getSessionPolicy();
  const session = createSessionStatus(policy);

  return {
    user: authenticatedUser,
    token: createSessionToken(authenticatedUser, policy, session),
    expiresIn: getSessionExpiresIn(),
    session,
  };
}

async function logAuthActivity(input: {
  action: ActivityActionType;
  userId?: number;
  details: string;
}): Promise<void> {
  await prisma.activityLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: "User",
      entityId: input.userId,
      details: input.details,
    },
  });
}

export async function getCurrentUserFromToken(token: string | null): Promise<AuthenticatedUser | null> {
  if (!token) {
    return null;
  }

  let payload;

  try {
    payload = verifyAuthToken(token);
  } catch {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      isActive: true,
      deletedAt: null,
    },
    include: {
      role: true,
    },
  });

  if (!user) {
    return null;
  }

  return toAuthenticatedUser({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    role: user.role.name,
  });
}

export async function refreshSessionFromAuthorizationHeader(
  authorizationHeader?: string | null,
  options: { logActivity?: boolean } = {},
): Promise<{ user: AuthenticatedUser; token: string; expiresIn: string; session: SessionStatus }> {
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    throw new Error("Authentication required.");
  }

  let payload: AuthTokenPayload;

  try {
    payload = verifyAuthToken(token);
  } catch {
    throw new Error("Authentication required.");
  }

  const user = await getCurrentUserFromToken(token);

  if (!user) {
    throw new Error("Authentication required.");
  }

  const policy = await getSessionPolicy();
  const now = Date.now();
  const sessionStartedAt = payload.sessionStartedAt || getPayloadIssuedAt(payload) || now;
  const maxExpiresAt = payload.maxExpiresAt || sessionStartedAt + policy.maxLifetimeHours * 60 * 60 * 1000;

  if (now >= maxExpiresAt) {
    throw new Error("Authentication required.");
  }

  const session: SessionStatus = {
    policy,
    sessionStartedAt,
    lastActivityAt: now,
    maxExpiresAt,
    expiresAt: calculateSessionTokenExpiresAt(now, maxExpiresAt, policy),
  };

  if (options.logActivity) {
    await logAuthActivity({
      action: ActivityAction.SESSION_EXTENDED,
      userId: user.id,
      details: `Session extended for user id: ${user.id}.`,
    });
  }

  return {
    user,
    token: createSessionToken(user, policy, session),
    expiresIn: getSessionExpiresIn(),
    session,
  };
}

export async function getSessionStatusFromAuthorizationHeader(authorizationHeader?: string | null): Promise<SessionStatus> {
  const token = extractBearerToken(authorizationHeader);

  if (!token) {
    throw new Error("Authentication required.");
  }

  let payload: AuthTokenPayload;

  try {
    payload = verifyAuthToken(token);
  } catch {
    throw new Error("Authentication required.");
  }

  const policy = await getSessionPolicy();
  const now = Date.now();
  const sessionStartedAt = payload.sessionStartedAt || getPayloadIssuedAt(payload) || now;
  const maxExpiresAt = payload.maxExpiresAt || sessionStartedAt + policy.maxLifetimeHours * 60 * 60 * 1000;

  return {
    policy,
    sessionStartedAt,
    lastActivityAt: payload.lastActivityAt || getPayloadIssuedAt(payload) || now,
    maxExpiresAt,
    expiresAt: payload.exp ? payload.exp * 1000 : null,
  };
}

export async function logoutFromAuthorizationHeader(
  authorizationHeader?: string | null,
  reason: "MANUAL" | "INACTIVITY" = "MANUAL",
): Promise<void> {
  const token = extractBearerToken(authorizationHeader);
  const user = await getCurrentUserFromToken(token);

  if (!user) {
    return;
  }

  await logAuthActivity({
    action: reason === "INACTIVITY" ? ActivityAction.AUTO_LOGOUT : ActivityAction.LOGOUT,
    userId: user.id,
    details: reason === "INACTIVITY"
      ? `Automatic logout due to inactivity for user id: ${user.id}.`
      : `Manual logout for user id: ${user.id}.`,
  });
}

export async function getSessionPolicy(): Promise<SessionPolicy> {
  const settings = await prisma.systemSettings.upsert({
    where: {
      id: SETTINGS_ID,
    },
    update: {},
    create: {
      id: SETTINGS_ID,
      storageRoot: process.env.STORAGE_ROOT || "storage",
      departments: ["Automation", "Electrical", "Mechanical", "Service"],
    },
    select: {
      sessionInactivityTimeoutMinutes: true,
      sessionWarningMinutes: true,
      sessionMaxLifetimeHours: true,
      sessionSlidingEnabled: true,
    },
  });

  return {
    inactivityTimeoutMinutes: settings.sessionInactivityTimeoutMinutes || DEFAULT_SESSION_POLICY.inactivityTimeoutMinutes,
    warningMinutes: settings.sessionWarningMinutes || DEFAULT_SESSION_POLICY.warningMinutes,
    maxLifetimeHours: settings.sessionMaxLifetimeHours || DEFAULT_SESSION_POLICY.maxLifetimeHours,
    slidingEnabled: settings.sessionSlidingEnabled,
  };
}

export async function getCurrentUserFromAuthorizationHeader(
  authorizationHeader?: string | null,
): Promise<AuthenticatedUser | null> {
  return getCurrentUserFromToken(extractBearerToken(authorizationHeader));
}

export async function requireAuthenticatedUser(token: string | null): Promise<AuthenticatedUser> {
  const user = await getCurrentUserFromToken(token);

  if (!user) {
    throw new Error("Authentication required.");
  }

  return user;
}

export async function requireAuthorizedUser(
  token: string | null,
  permission: Permission,
): Promise<AuthenticatedUser> {
  const user = await requireAuthenticatedUser(token);

  requirePermission(user, permission);

  return user;
}

export async function canCurrentUser(token: string | null, permission: Permission) {
  const user = await getCurrentUserFromToken(token);

  return authorizeUser(user, permission);
}

function toAuthenticatedUser(user: {
  id: number;
  username: string;
  fullName?: string | null;
  email: string;
  department?: string | null;
  role: RoleName;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt?: Date;
}): AuthenticatedUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    department: user.department,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
  };
}

function createSessionStatus(policy: SessionPolicy): SessionStatus {
  const now = Date.now();
  const maxExpiresAt = now + policy.maxLifetimeHours * 60 * 60 * 1000;

  return {
    policy,
    sessionStartedAt: now,
    lastActivityAt: now,
    maxExpiresAt,
    expiresAt: calculateSessionTokenExpiresAt(now, maxExpiresAt, policy),
  };
}

function createSessionToken(user: AuthenticatedUser, policy: SessionPolicy, session: SessionStatus): string {
  const now = Date.now();
  const expiresAt = session.expiresAt || calculateSessionTokenExpiresAt(now, session.maxExpiresAt, policy);
  const expiresInSeconds = Math.max(1, Math.floor((expiresAt - now) / 1000));

  return createAuthToken(user, {
    expiresInSeconds,
    sessionStartedAt: session.sessionStartedAt,
    lastActivityAt: session.lastActivityAt,
    maxExpiresAt: session.maxExpiresAt,
  });
}

function calculateSessionTokenExpiresAt(now: number, maxExpiresAt: number, policy: SessionPolicy): number {
  if (!policy.slidingEnabled) {
    return maxExpiresAt;
  }

  return Math.min(maxExpiresAt, now + policy.inactivityTimeoutMinutes * 60 * 1000);
}

function getPayloadIssuedAt(payload: AuthTokenPayload): number | null {
  return payload.iat ? payload.iat * 1000 : null;
}
