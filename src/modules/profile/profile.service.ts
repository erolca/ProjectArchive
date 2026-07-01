import type { Prisma } from "@prisma/client";
import { hashPassword, verifyPassword } from "../../lib/password";
import { prisma } from "../../lib/prisma";
import type { AuthenticatedUser } from "../auth/auth.types";
import { changePasswordSchema, updateProfileSchema } from "./profile.validators";

const PROFILE_SELECT = {
  id: true,
  username: true,
  fullName: true,
  email: true,
  department: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      name: true,
      description: true,
    },
  },
} satisfies Prisma.UserSelect;

export async function getOwnProfile(user: AuthenticatedUser) {
  const profile = await prisma.user.findFirst({
    where: {
      id: user.id,
      deletedAt: null,
    },
    select: PROFILE_SELECT,
  });

  if (!profile) {
    throw new Error("User not found.");
  }

  return profile;
}

export async function updateOwnProfile(user: AuthenticatedUser, input: unknown) {
  const data = updateProfileSchema.parse(input);
  const existingEmail = await prisma.user.findUnique({
    where: {
      email: data.email,
    },
  });

  if (existingEmail && existingEmail.id !== user.id) {
    throw new Error("Email already exists.");
  }

  return prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      fullName: data.fullName,
      email: data.email,
      department: data.department,
    },
    select: PROFILE_SELECT,
  });
}

export async function changeOwnPassword(user: AuthenticatedUser, input: unknown) {
  const data = changePasswordSchema.parse(input);
  const existingUser = await prisma.user.findFirst({
    where: {
      id: user.id,
      deletedAt: null,
    },
  });

  if (!existingUser) {
    throw new Error("User not found.");
  }

  const currentPasswordMatches = await verifyPassword(data.currentPassword, existingUser.passwordHash);

  if (!currentPasswordMatches) {
    throw new Error("Current password is incorrect.");
  }

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      passwordHash: await hashPassword(data.newPassword),
    },
  });

  return {
    changed: true,
  };
}
