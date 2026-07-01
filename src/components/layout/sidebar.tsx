"use client";

import Link from "next/link";
import { getDisplayName, getInitials, useCurrentUser } from "../../lib/current-user";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/projects", label: "Projects" },
  { href: "/activity", label: "Activity" },
  { href: "/profile", label: "Profile" },
  { href: "/users", label: "Users" },
  { href: "/settings", label: "Settings" },
];

export function Sidebar() {
  const user = useCurrentUser();

  return (
    <aside className="hidden min-h-screen w-64 border-r border-[#263545] bg-[#0f151d] lg:block">
      <div className="border-b border-[#263545] px-5 py-5">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#38bdf8]">Archive</div>
        <div className="mt-1 text-lg font-semibold text-white">ProjectArchive</div>
      </div>
      <nav className="space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-md px-3 py-2 text-sm font-medium text-[#c6d3df] hover:bg-[#16202a] hover:text-white"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mx-3 mt-4 rounded-md border border-[#263545] bg-[#111820] p-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md border border-[#2f80ed] bg-[#10243b] text-sm font-semibold text-[#38bdf8]">
            {user ? getInitials(user) : "--"}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{user ? getDisplayName(user) : "Loading user"}</div>
            <div className="mt-1 text-xs text-[#9fb0bf]">{user?.role || "-"}</div>
          </div>
        </div>
        <div className="mt-3 border-t border-[#263545] pt-2 text-xs text-[#748596]">
          {user?.department || "No department"}
        </div>
      </div>
    </aside>
  );
}
