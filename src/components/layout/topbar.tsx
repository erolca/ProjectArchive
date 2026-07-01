"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clearStoredAuthToken } from "../../lib/client-auth";
import { getDisplayName, getInitials, useCurrentUser } from "../../lib/current-user";

export function Topbar() {
  const router = useRouter();
  const user = useCurrentUser();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  function handleLogout() {
    clearStoredAuthToken();
    router.replace("/login");
  }

  return (
    <header className="flex min-h-16 items-center justify-between border-b border-[#263545] bg-[#111820] px-4 lg:px-6">
      <div>
        <div className="text-xs uppercase tracking-[0.16em] text-[#9fb0bf]">Industrial Automation</div>
        <h1 className="text-base font-semibold text-white">Project Archive System</h1>
      </div>
      <div className="relative">
        <button
          onClick={() => setIsMenuOpen((value) => !value)}
          className="flex items-center gap-3 rounded-md border border-[#263545] bg-[#0f151d] px-3 py-2 text-left hover:border-[#2f80ed]"
        >
          <div className="grid h-9 w-9 place-items-center rounded-md border border-[#2f80ed] bg-[#10243b] text-sm font-semibold text-[#38bdf8]">
            {user ? getInitials(user) : "--"}
          </div>
          <div className="hidden min-w-40 sm:block">
            <div className="flex items-center gap-2">
              <span className="max-w-44 truncate text-sm font-semibold text-white">
                {user ? getDisplayName(user) : "Loading user"}
              </span>
              {user ? <RoleBadge role={user.role} /> : null}
            </div>
            <div className="mt-1 text-xs text-[#9fb0bf]">{user?.department || "No department"}</div>
          </div>
        </button>

        {isMenuOpen ? (
          <div className="absolute right-0 z-50 mt-2 w-56 rounded-md border border-[#263545] bg-[#111820] p-2 shadow-xl">
            <Link
              href="/profile"
              onClick={() => setIsMenuOpen(false)}
              className="block rounded px-3 py-2 text-sm text-[#d9e5ef] hover:bg-[#16202a] hover:text-white"
            >
              My Profile
            </Link>
            <Link
              href="/profile#password"
              onClick={() => setIsMenuOpen(false)}
              className="block rounded px-3 py-2 text-sm text-[#d9e5ef] hover:bg-[#16202a] hover:text-white"
            >
              Change Password
            </Link>
            <button
              onClick={handleLogout}
              className="mt-1 block w-full rounded px-3 py-2 text-left text-sm font-semibold text-[#fca5a5] hover:bg-[#2a1010]"
            >
              Logout
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}

function RoleBadge({ role }: { role: string }) {
  return (
    <span className="rounded border border-[#2f80ed] bg-[#10243b] px-2 py-0.5 text-xs font-semibold text-[#93c5fd]">
      {role}
    </span>
  );
}
