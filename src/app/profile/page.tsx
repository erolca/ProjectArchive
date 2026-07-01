"use client";

import { FormEvent, useEffect, useState } from "react";
import { getApi, postApi, putApi } from "../../lib/api-client";
import { getDisplayName, getInitials } from "../../lib/current-user";
import { formatDateTime } from "../../lib/format";

interface Profile {
  id: number;
  username: string;
  fullName?: string | null;
  email: string;
  department?: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  role: {
    name: string;
    description?: string | null;
  };
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({ fullName: "", email: "", department: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [status, setStatus] = useState("Loading profile");
  const [passwordStatus, setPasswordStatus] = useState<string | null>(null);

  function loadProfile() {
    getApi<Profile>("/api/profile")
      .then((result) => {
        setProfile(result);
        setForm({
          fullName: result.fullName || "",
          email: result.email,
          department: result.department || "",
        });
        setStatus("Profile loaded");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Could not load profile.");
      });
  }

  useEffect(() => {
    loadProfile();
  }, []);

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("Saving profile");

    try {
      const result = await putApi<Profile>("/api/profile", form);
      setProfile(result);
      setForm({
        fullName: result.fullName || "",
        email: result.email,
        department: result.department || "",
      });
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save profile.");
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordStatus("Changing password");

    try {
      await postApi<{ changed: boolean }>("/api/profile/password", passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordStatus("Password changed.");
    } catch (error) {
      setPasswordStatus(error instanceof Error ? error.message : "Could not change password.");
    }
  }

  if (!profile) {
    return <div className="rounded-md border border-[#263545] bg-[#111820] p-4 text-sm text-[#9fb0bf]">{status}</div>;
  }

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-[#263545] bg-[#111820] p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-md border border-[#2f80ed] bg-[#10243b] text-lg font-semibold text-[#38bdf8]">
              {getInitials(profile)}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">{getDisplayName(profile)}</h2>
              <p className="mt-1 text-sm text-[#9fb0bf]">{profile.email}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{profile.role.name}</Badge>
            <Badge>{profile.department || "No department"}</Badge>
            <StatusBadge active={profile.isActive} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
          <h3 className="text-sm font-semibold text-white">Profile Details</h3>
          <dl className="mt-4 grid gap-3 text-sm">
            <Field label="Full Name" value={profile.fullName || "-"} />
            <Field label="Username" value={profile.username} />
            <Field label="Email" value={profile.email} />
            <Field label="Department" value={profile.department || "-"} />
            <Field label="Role" value={profile.role.name} />
            <Field label="Active Status" value={profile.isActive ? "Active" : "Inactive"} />
            <Field label="Last Login" value={formatDateTime(profile.lastLoginAt)} />
            <Field label="Created" value={formatDateTime(profile.createdAt)} />
          </dl>
        </div>

        <form onSubmit={handleProfileSubmit} className="rounded-md border border-[#263545] bg-[#111820] p-4">
          <h3 className="text-sm font-semibold text-white">Edit Profile</h3>
          <div className="mt-4 grid gap-4">
            <TextInput
              label="Full Name"
              value={form.fullName}
              onChange={(value) => setForm((current) => ({ ...current, fullName: value }))}
            />
            <TextInput
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            />
            <TextInput
              label="Department"
              value={form.department}
              onChange={(value) => setForm((current) => ({ ...current, department: value }))}
            />
            <div className="rounded-md border border-[#263545] bg-[#0f151d] p-3 text-sm text-[#9fb0bf]">{status}</div>
            <button type="submit" className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white">
              Save Profile
            </button>
          </div>
        </form>
      </section>

      <form id="password" onSubmit={handlePasswordSubmit} className="rounded-md border border-[#263545] bg-[#111820] p-4">
        <h3 className="text-sm font-semibold text-white">Change Password</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <TextInput
            label="Current Password"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(value) => setPasswordForm((current) => ({ ...current, currentPassword: value }))}
          />
          <TextInput
            label="New Password"
            type="password"
            value={passwordForm.newPassword}
            onChange={(value) => setPasswordForm((current) => ({ ...current, newPassword: value }))}
          />
          <TextInput
            label="Confirm Password"
            type="password"
            value={passwordForm.confirmPassword}
            onChange={(value) => setPasswordForm((current) => ({ ...current, confirmPassword: value }))}
          />
        </div>
        <div className="mt-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div className="text-sm text-[#9fb0bf]">{passwordStatus || "Password changes apply to your account only."}</div>
          <button type="submit" className="rounded-md border border-[#2f80ed] px-4 py-2 text-sm font-semibold text-[#38bdf8]">
            Change Password
          </button>
        </div>
      </form>
    </div>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      />
    </label>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3">
      <dt className="text-[#9fb0bf]">{label}</dt>
      <dd className="text-white">{value}</dd>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-[#263545] bg-[#0f151d] px-3 py-1 text-sm font-semibold text-[#c6d3df]">
      {children}
    </span>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded border border-[#22c55e] bg-[#0d2618] px-3 py-1 text-sm font-semibold text-[#86efac]">
      Active
    </span>
  ) : (
    <span className="rounded border border-[#64748b] bg-[#111827] px-3 py-1 text-sm font-semibold text-[#cbd5e1]">
      Inactive
    </span>
  );
}
