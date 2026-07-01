"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getStoredAuthToken } from "../../lib/client-auth";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const token = getStoredAuthToken();
    const isLoginPage = pathname === "/login";

    if (!token && !isLoginPage) {
      router.replace("/login");
      return;
    }

    if (token && isLoginPage) {
      router.replace("/");
      return;
    }

    setIsReady(true);
  }, [pathname, router]);

  if (!isReady) {
    return null;
  }

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-[#0b0f14]">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar />
        <main className="flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
