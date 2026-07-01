"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { postApi } from "../../lib/api-client";
import { getStoredAuthToken, setStoredAuthToken } from "../../lib/client-auth";

interface LoginResponse {
  token: string;
  expiresIn: string;
  user: {
    username: string;
    role: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (getStoredAuthToken()) {
      router.replace("/");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const result = await postApi<LoginResponse>("/api/auth/login", {
        usernameOrEmail,
        password,
      });

      setStoredAuthToken(result.token);
      setStatus(`Signed in as ${result.user.username} (${result.user.role}).`);
      router.replace("/");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#070b10] text-white">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="relative hidden border-r border-[#263545] bg-[#0b0f14] px-10 py-10 lg:flex lg:flex-col lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-3 border border-[#263545] bg-[#111820] px-4 py-3">
              <div className="grid h-10 w-10 place-items-center border border-[#2f80ed] bg-[#10243b] text-sm font-bold text-[#38bdf8]">
                NRM
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-[#9fb0bf]">NRM Engineering</div>
                <div className="text-sm font-semibold text-white">Industrial Automation Systems</div>
              </div>
            </div>

            <div className="mt-20 max-w-2xl">
              <div className="text-xs uppercase tracking-[0.2em] text-[#38bdf8]">Secure Engineering Archive</div>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-white">
                Industrial Digital Machine Archive
              </h1>
              <p className="mt-5 text-base leading-7 text-[#9fb0bf]">
                Centralized access for machine software, drawings, commissioning records, service history, backups, and
                controlled version archives.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm">
            {["PLC/HMI", "Robot", "Machine Docs"].map((item) => (
              <div key={item} className="border border-[#263545] bg-[#111820] p-3">
                <div className="text-xs uppercase text-[#748596]">Archive</div>
                <div className="mt-1 font-semibold text-[#d9e5ef]">{item}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-screen flex-col justify-between px-5 py-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between">
            <div className="lg:hidden">
              <div className="text-xs uppercase tracking-[0.18em] text-[#38bdf8]">NRM Engineering</div>
              <div className="text-sm font-semibold text-white">Industrial Digital Machine Archive</div>
            </div>
            <div className="ml-auto text-xs font-semibold text-[#748596]">v1.0.0</div>
          </div>

          <div className="mx-auto w-full max-w-md">
            <div className="mb-6">
              <div className="text-xs uppercase tracking-[0.16em] text-[#38bdf8]">Authorized Access</div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Sign in to continue</h2>
              <p className="mt-2 text-sm text-[#9fb0bf]">Use your engineering archive account credentials.</p>
            </div>

            <form onSubmit={handleSubmit} className="border border-[#263545] bg-[#111820] p-5 shadow-2xl">
              <div className="space-y-4">
                <label className="block">
                  <span className="text-sm text-[#c6d3df]">Username / Email</span>
                  <input
                    value={usernameOrEmail}
                    onChange={(event) => setUsernameOrEmail(event.target.value)}
                    className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-3 text-sm text-white outline-none focus:border-[#2f80ed]"
                    autoComplete="username"
                    disabled={isSubmitting}
                  />
                </label>
                <label className="block">
                  <span className="text-sm text-[#c6d3df]">Password</span>
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    type="password"
                    className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-3 text-sm text-white outline-none focus:border-[#2f80ed]"
                    autoComplete="current-password"
                    disabled={isSubmitting}
                  />
                </label>

                <div className="min-h-11 rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-[#9fb0bf]">
                  {status || "Enter credentials to open the machine archive."}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-md bg-[#2f80ed] px-4 py-3 text-sm font-semibold text-white hover:bg-[#1f6fd2] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Signing in..." : "Sign In"}
                </button>
              </div>
            </form>
          </div>

          <footer className="flex flex-col gap-1 text-xs text-[#748596] sm:flex-row sm:items-center sm:justify-between">
            <span>&copy; 2026 NRM Engineering</span>
            <span>Industrial Digital Machine Archive</span>
          </footer>
        </section>
      </div>
    </main>
  );
}
