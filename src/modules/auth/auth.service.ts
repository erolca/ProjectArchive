import { ActivityAction, type ActivityAction as ActivityActionType, type RoleName } from "@prisma/client";
import { createAuthToken, extractBearerToken, getSessionExpiresIn, verifyAuthToken } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { verifyPassword } from "../../lib/password";
import { authorizeUser, requirePermission } from "./permissions";
import type { AuthenticatedUser, LoginInput, LoginResult, Permission } from "./auth.types";

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

  return {
    user: authenticatedUser,
    token: createAuthToken(authenticatedUser),
    expiresIn: getSessionExpiresIn(),
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
