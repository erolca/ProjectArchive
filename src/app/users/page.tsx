"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useState } from "react";
import { deleteApi, getApi, postApi, putApi } from "../../lib/api-client";
import { formatDateTime } from "../../lib/format";

type RoleName = "ADMIN" | "ENGINEER" | "SERVICE" | "GUEST";

interface UserRow {
  id: number;
  username: string;
  fullName?: string | null;
  department?: string | null;
  email: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  role: {
    name: RoleName;
  };
}

interface UserListResponse {
  data: UserRow[];
  total: number;
  page: number;
  pageSize: number;
}

const roles: RoleName[] = ["ADMIN", "ENGINEER", "SERVICE", "GUEST"];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("Loading users");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);

  function refreshUsers() {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (query) params.set("q", query);
    if (role) params.set("role", role);
    if (activeFilter) params.set("isActive", activeFilter);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);

    getApi<UserListResponse>(`/api/users?${params.toString()}`)
      .then((result) => {
        setUsers(result.data);
        setTotal(result.total);
        setStatus(result.total === 0 ? "No users found." : `${result.total} user records`);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Could not load users.");
      });
  }

  useEffect(() => {
    refreshUsers();
  }, [query, role, activeFilter, sortBy, sortOrder, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Users</h2>
          <p className="mt-1 text-sm text-[#9fb0bf]">Manage application accounts, roles, and active access.</p>
        </div>
        <button onClick={() => setCreateOpen(true)} className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white">
          New User
        </button>
      </div>

      <div className="grid gap-3 rounded-md border border-[#263545] bg-[#111820] p-4 md:grid-cols-2 xl:grid-cols-6">
        <label>
          <span className="text-xs font-semibold uppercase text-[#9fb0bf]">Search</span>
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Username, full name, email"
            className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
          />
        </label>
        <SelectFilter
          label="Role"
          value={role}
          onChange={(value) => {
            setRole(value);
            setPage(1);
          }}
          options={["", ...roles]}
        />
        <SelectFilter
          label="Status"
          value={activeFilter}
          onChange={(value) => {
            setActiveFilter(value);
            setPage(1);
          }}
          options={["", "true", "false"]}
        />
        <SelectFilter
          label="Sort"
          value={sortBy}
          onChange={(value) => {
            setSortBy(value);
            setPage(1);
          }}
          options={["fullName", "username", "email", "department", "role", "isActive", "lastLoginAt", "createdAt", "updatedAt"]}
        />
        <SelectFilter
          label="Order"
          value={sortOrder}
          onChange={(value) => {
            setSortOrder(value);
            setPage(1);
          }}
          options={["desc", "asc"]}
        />
        <label>
          <span className="text-xs font-semibold uppercase text-[#9fb0bf]">Rows</span>
          <select
            value={pageSize}
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white"
          >
            {[10, 20, 50].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="overflow-hidden rounded-md border border-[#263545] bg-[#111820]">
        <div className="border-b border-[#263545] px-4 py-3 text-sm text-[#9fb0bf]">{status}</div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead className="bg-[#0f151d] text-xs uppercase text-[#9fb0bf]">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last Login</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr className="border-t border-[#263545] text-[#9fb0bf]">
                  <td className="px-4 py-4" colSpan={8}>
                    {status}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="border-t border-[#263545] text-[#d9e5ef]">
                    <td className="px-4 py-3">
                      <div className="break-words font-semibold text-white">{user.fullName || user.username}</div>
                      <div className="break-all text-xs text-[#748596]">{user.username}</div>
                    </td>
                    <td className="max-w-[180px] px-4 py-3"><span className="block break-words">{user.department || "-"}</span></td>
                    <td className="max-w-[260px] px-4 py-3"><span className="block break-all">{user.email}</span></td>
                    <td className="px-4 py-3">
                      <RoleBadge role={user.role.name} />
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={user.isActive} />
                    </td>
                    <td className="px-4 py-3">{formatDateTime(user.lastLoginAt)}</td>
                    <td className="px-4 py-3">{formatDateTime(user.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingUser(user)}
                          className="rounded-md border border-[#2f80ed] px-3 py-1 text-xs font-semibold text-[#38bdf8]"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeletingUser(user)}
                          className="rounded-md border border-[#ef4444] px-3 py-1 text-xs font-semibold text-[#fca5a5]"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-[#263545] px-4 py-3 text-sm text-[#9fb0bf] md:flex-row md:items-center">
          <span>
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={page <= 1}
              className="rounded-md border border-[#263545] px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={page >= totalPages}
              className="rounded-md border border-[#263545] px-3 py-1 text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {createOpen ? (
        <CreateUserDialog
          onClose={() => setCreateOpen(false)}
          onSaved={() => {
            setCreateOpen(false);
            refreshUsers();
          }}
        />
      ) : null}

      {editingUser ? (
        <EditUserDialog
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            refreshUsers();
          }}
        />
      ) : null}

      {deletingUser ? (
        <ConfirmDialog
          title="Delete User"
          message={`Soft delete ${deletingUser.username}? The account will be deactivated and hidden from user lists.`}
          confirmLabel="Delete User"
          onCancel={() => setDeletingUser(null)}
          onConfirm={() => {
            deleteApi<UserRow>(`/api/users/${deletingUser.id}`)
              .then(() => {
                setDeletingUser(null);
                refreshUsers();
              })
              .catch((error) => {
                setStatus(error instanceof Error ? error.message : "Could not delete user.");
                setDeletingUser(null);
              });
          }}
        />
      ) : null}
    </div>
  );
}

function CreateUserDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await postApi<UserRow>("/api/users", {
        username: String(form.get("username") || ""),
        fullName: String(form.get("fullName") || ""),
        department: String(form.get("department") || ""),
        email: String(form.get("email") || ""),
        password: String(form.get("password") || ""),
        role: String(form.get("role") || "GUEST"),
        isActive: form.get("isActive") === "on",
      });
      onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not create user.");
    }
  }

  return (
    <Dialog title="New User" onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <TextInput name="username" label="Username" required />
        <TextInput name="fullName" label="Full Name" />
        <TextInput name="department" label="Department" />
        <TextInput name="email" label="Email" type="email" required />
        <TextInput name="password" label="Password" type="password" required />
        <RoleSelect defaultValue="ENGINEER" />
        <CheckboxInput name="isActive" label="Active" defaultChecked />
        {status ? <div className="text-sm text-[#fca5a5]">{status}</div> : null}
        <DialogActions onCancel={onClose} submitLabel="Create User" />
      </form>
    </Dialog>
  );
}

function EditUserDialog({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await putApi<UserRow>(`/api/users/${user.id}`, {
        fullName: String(form.get("fullName") || ""),
        department: String(form.get("department") || ""),
        email: String(form.get("email") || ""),
        role: String(form.get("role") || user.role.name),
        isActive: form.get("isActive") === "on",
      });
      onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update user.");
    }
  }

  return (
    <Dialog title={`Edit ${user.username}`} onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <TextInput name="fullName" label="Full Name" defaultValue={user.fullName || ""} />
        <TextInput name="department" label="Department" defaultValue={user.department || ""} />
        <TextInput name="email" label="Email" type="email" defaultValue={user.email} required />
        <RoleSelect defaultValue={user.role.name} />
        <CheckboxInput name="isActive" label="Active" defaultChecked={user.isActive} />
        {status ? <div className="text-sm text-[#fca5a5]">{status}</div> : null}
        <div className="flex flex-col justify-between gap-2 border-t border-[#263545] pt-4 sm:flex-row">
          <button
            type="button"
            onClick={() => setResetOpen(true)}
            className="rounded-md border border-[#f59e0b] px-4 py-2 text-sm font-semibold text-[#f8d28b]"
          >
            Reset Password
          </button>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-[#263545] px-4 py-2 text-sm text-white">
              Cancel
            </button>
            <button type="submit" className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white">
              Save Changes
            </button>
          </div>
        </div>
      </form>
      {resetOpen ? (
        <ResetPasswordDialog
          user={user}
          onClose={() => setResetOpen(false)}
          onSaved={() => {
            setResetOpen(false);
            onSaved();
          }}
        />
      ) : null}
    </Dialog>
  );
}

function ResetPasswordDialog({ user, onClose, onSaved }: { user: UserRow; onClose: () => void; onSaved: () => void }) {
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);

    try {
      await postApi<UserRow>(`/api/users/${user.id}/password`, {
        password: String(form.get("password") || ""),
      });
      onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not reset password.");
    }
  }

  return (
    <Dialog title="Reset Password" onClose={onClose}>
      <form onSubmit={handleSubmit} className="grid gap-4">
        <p className="text-sm text-[#9fb0bf]">Set a new password for {user.username}.</p>
        <TextInput name="password" label="New Password" type="password" required />
        {status ? <div className="text-sm text-[#fca5a5]">{status}</div> : null}
        <DialogActions onCancel={onClose} submitLabel="Reset Password" />
      </form>
    </Dialog>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <div className="space-y-4">
        <p className="text-sm text-[#c6d3df]">{message}</p>
        <div className="flex justify-end gap-2 border-t border-[#263545] pt-4">
          <button onClick={onCancel} className="rounded-md border border-[#263545] px-4 py-2 text-sm text-white">
            Cancel
          </button>
          <button onClick={onConfirm} className="rounded-md bg-[#dc2626] px-4 py-2 text-sm font-semibold text-white">
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}

function Dialog({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-md border border-[#263545] bg-[#111820] p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="rounded-md border border-[#263545] px-3 py-1 text-sm text-[#c6d3df]">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogActions({ onCancel, submitLabel }: { onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-[#263545] pt-4">
      <button type="button" onClick={onCancel} className="rounded-md border border-[#263545] px-4 py-2 text-sm text-white">
        Cancel
      </button>
      <button type="submit" className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white">
        {submitLabel}
      </button>
    </div>
  );
}

function TextInput({
  name,
  label,
  type = "text",
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="text-sm text-[#c6d3df]">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      />
    </label>
  );
}

function RoleSelect({ defaultValue }: { defaultValue: RoleName }) {
  return (
    <label>
      <span className="text-sm text-[#c6d3df]">Role</span>
      <select
        name="role"
        defaultValue={defaultValue}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      >
        {roles.map((item) => (
          <option key={item} value={item}>
            {item}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxInput({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#c6d3df]">
      <input name={name} type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
      {label}
    </label>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <select
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white"
      >
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {option === "true" ? "Active" : option === "false" ? "Inactive" : option || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="rounded border border-[#22c55e] bg-[#0d2618] px-2 py-1 text-xs font-semibold text-[#86efac]">
      Active
    </span>
  ) : (
    <span className="rounded border border-[#64748b] bg-[#111827] px-2 py-1 text-xs font-semibold text-[#cbd5e1]">
      Inactive
    </span>
  );
}

function RoleBadge({ role }: { role: RoleName }) {
  const styles: Record<RoleName, string> = {
    ADMIN: "border-[#ef4444] bg-[#2a1010] text-[#fca5a5]",
    ENGINEER: "border-[#2f80ed] bg-[#10243b] text-[#93c5fd]",
    SERVICE: "border-[#f59e0b] bg-[#2b1f0b] text-[#f8d28b]",
    GUEST: "border-[#64748b] bg-[#111827] text-[#cbd5e1]",
  };

  return <span className={`rounded border px-2 py-1 text-xs font-semibold ${styles[role]}`}>{role}</span>;
}
