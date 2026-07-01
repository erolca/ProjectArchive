import type { RoleName } from "@prisma/client";

export interface UserListQuery {
  q?: string;
  isActive?: boolean;
  role?: RoleName;
  sortBy?: "fullName" | "username" | "email" | "department" | "role" | "isActive" | "lastLoginAt" | "createdAt" | "updatedAt";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface CreateUserInput {
  username: string;
  fullName?: string;
  department?: string;
  email: string;
  password: string;
  role: RoleName;
  isActive?: boolean;
}

export interface UpdateUserInput {
  fullName?: string;
  department?: string;
  email?: string;
  role?: RoleName;
  isActive?: boolean;
}

export interface ResetUserPasswordInput {
  password: string;
}
