"use client";

import { useEffect, useState } from "react";
import { getApi } from "./api-client";

export interface CurrentUser {
  id: number;
  username: string;
  fullName?: string | null;
  email: string;
  department?: string | null;
  role: "ADMIN" | "ENGINEER" | "SERVICE" | "GUEST";
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    getApi<CurrentUser>("/api/auth/me")
      .then(setUser)
      .catch(() => setUser(null));
  }, []);

  return user;
}

export function getDisplayName(user: Pick<CurrentUser, "fullName" | "username">): string {
  return user.fullName?.trim() || user.username;
}

export function getFirstName(user: Pick<CurrentUser, "fullName" | "username">): string {
  return getDisplayName(user).split(/\s+/)[0] || user.username;
}

export function getInitials(user: Pick<CurrentUser, "fullName" | "username">): string {
  const name = getDisplayName(user);
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}
