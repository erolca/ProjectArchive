import { ActivityAction, type Prisma, type RoleName } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { hashPassword } from "../../lib/password";
import { requirePermission } from "../auth/permissions";
import type { AuthenticatedUser } from "../auth/auth.types";
import { logActivity } from "../activity/activity.service";
import type { CreateUserInput, ResetUserPasswordInput, UpdateUserInput, UserListQuery } from "./user.types";
import {
  createUserSchema,
  resetUserPasswordSchema,
  updateUserSchema,
  userIdSchema,
  userListQuerySchema,
} from "./user.validators";

const USER_SELECT = {
  id: true,
  username: true,
  fullName: true,
  department: true,
  email: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
  role: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
} satisfies Prisma.UserSelect;

export async function listUsers(currentUser: AuthenticatedUser, input: UserListQuery) {
  requirePermission(currentUser, "users:update");

  const query = userListQuerySchema.parse(input);
  const where = buildUserWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [data, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      orderBy: buildUserOrderBy(query),
      skip,
      take: query.pageSize,
    }),
    prisma.user.count({
      where,
    }),
  ]);

  return {
    data,
    page: query.page,
    pageSize: query.pageSize,
    total,
  };
}

export async function createUser(currentUser: AuthenticatedUser, input: CreateUserInput) {
  requirePermission(currentUser, "users:create");

  const data = createUserSchema.parse(input);
  const role = await getRole(data.role);

  await assertUsernameAvailable(data.username);
  await assertEmailAvailable(data.email);

  const user = await prisma.user.create({
    data: {
      username: data.username,
      fullName: data.fullName,
      department: data.department,
      email: data.email,
      passwordHash: await hashPassword(data.password),
      roleId: role.id,
      isActive: data.isActive,
    },
    select: USER_SELECT,
  });

  await logActivity({
    userId: currentUser.id,
    action: ActivityAction.USER_CREATED,
    entityType: "User",
    entityId: user.id,
    details: `User ${user.username} created with role ${user.role.name}.`,
  });

  return user;
}

export async function updateUser(currentUser: AuthenticatedUser, userId: number, input: UpdateUserInput) {
  requirePermission(currentUser, "users:update");

  const id = userIdSchema.parse(userId);
  const data = updateUserSchema.parse(input);
  const existingUser = await requireExistingUser(id);

  if (existingUser.id === currentUser.id && data.isActive === false) {
    throw new Error("You cannot deactivate your own account.");
  }

  if (data.email && data.email !== existingUser.email) {
    await assertEmailAvailable(data.email, id);
  }

  const role = data.role ? await getRole(data.role) : null;
  const user = await prisma.user.update({
    where: {
      id,
    },
    data: {
      fullName: data.fullName,
      department: data.department,
      email: data.email,
      roleId: role?.id,
      isActive: data.isActive,
    },
    select: USER_SELECT,
  });
  const action = getUserUpdateActivityAction(existingUser.isActive, data.isActive);

  await logActivity({
    userId: currentUser.id,
    action,
    entityType: "User",
    entityId: user.id,
    details: `User ${user.username} updated.`,
  });

  return user;
}

export async function resetUserPassword(
  currentUser: AuthenticatedUser,
  userId: number,
  input: ResetUserPasswordInput,
) {
  requirePermission(currentUser, "users:update");

  const id = userIdSchema.parse(userId);
  const data = resetUserPasswordSchema.parse(input);
  const existingUser = await requireExistingUser(id);

  const user = await prisma.user.update({
    where: {
      id,
    },
    data: {
      passwordHash: await hashPassword(data.password),
    },
    select: USER_SELECT,
  });

  await logActivity({
    userId: currentUser.id,
    action: ActivityAction.USER_PASSWORD_RESET,
    entityType: "User",
    entityId: user.id,
    details: `Password reset for user ${existingUser.username}.`,
  });

  return user;
}

export async function deleteUser(currentUser: AuthenticatedUser, userId: number) {
  requirePermission(currentUser, "users:delete");

  const id = userIdSchema.parse(userId);
  const existingUser = await requireExistingUser(id);

  if (existingUser.id === currentUser.id) {
    throw new Error("You cannot delete your own account.");
  }

  const user = await prisma.user.update({
    where: {
      id,
    },
    data: {
      isActive: false,
      deletedAt: new Date(),
    },
    select: USER_SELECT,
  });

  await logActivity({
    userId: currentUser.id,
    action: ActivityAction.USER_DELETED,
    entityType: "User",
    entityId: user.id,
    details: `User ${existingUser.username} soft deleted.`,
  });

  return user;
}

function buildUserWhere(query: ReturnType<typeof userListQuerySchema.parse>): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [
    {
      deletedAt: null,
    },
  ];

  if (query.isActive !== undefined) {
    and.push({ isActive: query.isActive });
  }

  if (query.role) {
    and.push({
      role: {
        name: query.role,
      },
    });
  }

  if (query.q) {
    and.push({
      OR: [
        { username: { contains: query.q } },
        { fullName: { contains: query.q } },
        { department: { contains: query.q } },
        { email: { contains: query.q } },
      ],
    });
  }

  return {
    AND: and,
  };
}

function buildUserOrderBy(query: ReturnType<typeof userListQuerySchema.parse>): Prisma.UserOrderByWithRelationInput {
  if (query.sortBy === "role") {
    return {
      role: {
        name: query.sortOrder,
      },
    };
  }

  return {
    [query.sortBy]: query.sortOrder,
  };
}

function getUserUpdateActivityAction(previousActive: boolean, nextActive?: boolean): ActivityAction {
  if (previousActive && nextActive === false) {
    return ActivityAction.USER_DISABLED;
  }

  if (!previousActive && nextActive === true) {
    return ActivityAction.USER_ENABLED;
  }

  return ActivityAction.USER_UPDATED;
}

async function getRole(name: RoleName) {
  return prisma.role.findUniqueOrThrow({
    where: {
      name,
    },
  });
}

async function requireExistingUser(userId: number) {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      deletedAt: null,
    },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  return user;
}

async function assertUsernameAvailable(username: string): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (existingUser) {
    throw new Error("Username already exists.");
  }
}

async function assertEmailAvailable(email: string, excludeUserId?: number): Promise<void> {
  const existingUser = await prisma.user.findUnique({
    where: {
      email,
    },
  });

  if (existingUser && existingUser.id !== excludeUserId) {
    throw new Error("Email already exists.");
  }
}
