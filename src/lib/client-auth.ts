"use client";

const TOKEN_KEY = "projectArchive.authToken";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredAuthToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
