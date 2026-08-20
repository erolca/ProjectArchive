"use client";

const TOKEN_KEY = "projectArchive.authToken";
const LAST_ACTIVITY_KEY = "projectArchive.lastActivityAt";
const SESSION_ACTIVITY_EVENT = "projectArchive:session-activity";
const SESSION_OPERATION_START_EVENT = "projectArchive:session-operation-start";
const SESSION_OPERATION_END_EVENT = "projectArchive:session-operation-end";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredAuthToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  markSessionActivity();
}

export function clearStoredAuthToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(LAST_ACTIVITY_KEY);
}

export function getSessionLastActivityAt(): number {
  if (typeof window === "undefined") {
    return Date.now();
  }

  const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));

  return Number.isFinite(value) && value > 0 ? value : Date.now();
}

export function markSessionActivity(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  window.dispatchEvent(new CustomEvent(SESSION_ACTIVITY_EVENT));
}

export function notifySessionOperationStart(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_OPERATION_START_EVENT));
  }
}

export function notifySessionOperationEnd(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_OPERATION_END_EVENT));
  }
}

export async function refreshStoredSession(logActivity = false): Promise<boolean> {
  const token = getStoredAuthToken();

  if (!token) {
    return false;
  }

  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ logActivity }),
  });

  if (!response.ok) {
    return false;
  }

  const payload = await response.json() as { success?: boolean; data?: { token?: string } };

  if (!payload.success || !payload.data?.token) {
    return false;
  }

  setStoredAuthToken(payload.data.token);

  return true;
}

export async function logoutStoredSession(reason: "MANUAL" | "INACTIVITY" = "MANUAL"): Promise<void> {
  const token = getStoredAuthToken();

  if (token) {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ reason }),
    }).catch(() => undefined);
  }

  clearStoredAuthToken();
}

export const sessionEvents = {
  activity: SESSION_ACTIVITY_EVENT,
  operationStart: SESSION_OPERATION_START_EVENT,
  operationEnd: SESSION_OPERATION_END_EVENT,
};
