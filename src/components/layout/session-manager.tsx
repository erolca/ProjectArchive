"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { getApi } from "../../lib/api-client";
import {
  getSessionLastActivityAt,
  logoutStoredSession,
  markSessionActivity,
  refreshStoredSession,
  sessionEvents,
} from "../../lib/client-auth";

interface SessionStatus {
  policy: {
    inactivityTimeoutMinutes: number;
    warningMinutes: number;
    maxLifetimeHours: number;
    slidingEnabled: boolean;
  };
  sessionStartedAt: number;
  lastActivityAt: number;
  maxExpiresAt: number;
  expiresAt?: number | null;
}

const DEFAULT_SESSION_STATUS: SessionStatus = {
  policy: {
    inactivityTimeoutMinutes: 30,
    warningMinutes: 2,
    maxLifetimeHours: 12,
    slidingEnabled: true,
  },
  sessionStartedAt: Date.now(),
  lastActivityAt: Date.now(),
  maxExpiresAt: Date.now() + 12 * 60 * 60 * 1000,
  expiresAt: null,
};

export function SessionManager() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [session, setSession] = useState<SessionStatus>(DEFAULT_SESSION_STATUS);
  const [showWarning, setShowWarning] = useState(false);
  const [remainingMs, setRemainingMs] = useState(DEFAULT_SESSION_STATUS.policy.inactivityTimeoutMinutes * 60 * 1000);
  const activeOperations = useRef(0);
  const lastActivityWrite = useRef(0);

  const redirectToLogin = useCallback(async (reason: "MANUAL" | "INACTIVITY") => {
    const search = searchParams.toString();
    const returnTo = `${pathname}${search ? `?${search}` : ""}`;

    await logoutStoredSession(reason);
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    let mounted = true;

    getApi<SessionStatus>("/api/auth/session")
      .then((result) => {
        if (mounted) {
          setSession(result);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const recordActivity = () => {
      const now = Date.now();

      if (now - lastActivityWrite.current < 30_000) {
        return;
      }

      lastActivityWrite.current = now;
      markSessionActivity();
      setShowWarning(false);
    };

    const operationStart = () => {
      activeOperations.current += 1;
      recordActivity();
      setShowWarning(false);
    };

    const operationEnd = () => {
      activeOperations.current = Math.max(0, activeOperations.current - 1);
      recordActivity();
    };

    const events: Array<keyof WindowEventMap> = ["click", "keydown", "mousemove", "scroll", "focus"];

    events.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener(sessionEvents.activity, recordActivity);
    window.addEventListener(sessionEvents.operationStart, operationStart);
    window.addEventListener(sessionEvents.operationEnd, operationEnd);

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener(sessionEvents.activity, recordActivity);
      window.removeEventListener(sessionEvents.operationStart, operationStart);
      window.removeEventListener(sessionEvents.operationEnd, operationEnd);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const inactivityMs = session.policy.inactivityTimeoutMinutes * 60 * 1000;
      const warningMs = session.policy.warningMinutes * 60 * 1000;
      const inactivityRemaining = inactivityMs - (now - getSessionLastActivityAt());
      const maxRemaining = session.maxExpiresAt - now;
      const nextRemaining = Math.min(inactivityRemaining, maxRemaining);

      setRemainingMs(Math.max(0, nextRemaining));

      if (activeOperations.current > 0) {
        setShowWarning(false);
        return;
      }

      if (maxRemaining <= 0 || inactivityRemaining <= 0) {
        window.clearInterval(interval);
        void redirectToLogin("INACTIVITY");
        return;
      }

      setShowWarning(inactivityRemaining <= warningMs);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [redirectToLogin, session]);

  async function staySignedIn() {
    const refreshed = await refreshStoredSession(true);

    if (!refreshed) {
      await redirectToLogin("INACTIVITY");
      return;
    }

    markSessionActivity();
    setShowWarning(false);

    const nextSession = await getApi<SessionStatus>("/api/auth/session").catch(() => null);

    if (nextSession) {
      setSession(nextSession);
    }
  }

  if (!showWarning) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-md border border-[#f59e0b] bg-[#111820] p-5 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-wide text-[#f8d28b]">Security</div>
        <h2 className="mt-2 text-xl font-semibold text-white">Session Expiring</h2>
        <p className="mt-3 text-sm leading-6 text-[#c6d3df]">
          Your session will expire in {formatRemainingMinutes(remainingMs)} due to inactivity.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={staySignedIn}
            className="h-10 rounded-md bg-[#2f80ed] px-4 text-sm font-semibold text-white"
          >
            Stay Signed In
          </button>
          <button
            type="button"
            onClick={() => void redirectToLogin("MANUAL")}
            className="h-10 rounded-md border border-[#263545] px-4 text-sm text-[#d9e5ef]"
          >
            Logout Now
          </button>
        </div>
      </div>
    </div>
  );
}

function formatRemainingMinutes(value: number): string {
  const minutes = Math.max(1, Math.ceil(value / 60_000));

  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
