import { RoleName } from "@prisma/client";
import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value === "" ? undefined : value));

export const userListQuerySchema = z.object({
  q: optionalText(255),
  isActive: z.boolean().optional(),
  role: z.enum(RoleName).optional(),
  sortBy: z
    .enum(["fullName", "username", "email", "department", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt"])
    .default("updatedAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
});

export const createUserSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3)
    .max(80)
    .regex(/^[A-Za-z0-9._-]+$/, "Username may contain letters, numbers, dots, underscores, and dashes."),
  fullName: optionalText(160),
  department: optionalText(120),
  email: z.string().trim().email().max(255).toLowerCase(),
  password: z.string().min(1),
  role: z.enum(RoleName),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = z
  .object({
    fullName: optionalText(160),
    department: optionalText(120),
    email: z.string().trim().email().max(255).toLowerCase().optional(),
    role: z.enum(RoleName).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one user field must be provided.",
  });

export const resetUserPasswordSchema = z.object({
  password: z.string().min(1),
});

export const userIdSchema = z.number().int().positive();
