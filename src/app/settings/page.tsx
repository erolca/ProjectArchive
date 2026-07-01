"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getApi, putApi } from "../../lib/api-client";

interface SystemSettings {
  id: number;
  companyName: string;
  companyLogoUrl?: string | null;
  storageRoot: string;
  fileBackupLocation?: string | null;
  databaseBackupSchedule?: string | null;
  fileBackupSchedule?: string | null;
  maximumUploadSizeMb: number;
  departments: string[];
  updatedAt: string;
}

const emptySettings: SystemSettings = {
  id: 1,
  companyName: "",
  companyLogoUrl: "",
  storageRoot: "",
  fileBackupLocation: "",
  databaseBackupSchedule: "",
  fileBackupSchedule: "",
  maximumUploadSizeMb: 2048,
  departments: [],
  updatedAt: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(emptySettings);
  const [savedSettings, setSavedSettings] = useState<SystemSettings>(emptySettings);
  const [newDepartment, setNewDepartment] = useState("");
  const [status, setStatus] = useState("Loading settings");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getApi<SystemSettings>("/api/settings")
      .then((result) => {
        setSettings(normalizeSettings(result));
        setSavedSettings(normalizeSettings(result));
        setStatus("Settings loaded");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Could not load settings.");
      });
  }, []);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(savedSettings),
    [settings, savedSettings],
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setStatus("Saving settings");

    try {
      const result = await putApi<SystemSettings>("/api/settings", {
        companyName: settings.companyName,
        companyLogoUrl: settings.companyLogoUrl || undefined,
        storageRoot: settings.storageRoot,
        fileBackupLocation: settings.fileBackupLocation || undefined,
        databaseBackupSchedule: settings.databaseBackupSchedule || undefined,
        fileBackupSchedule: settings.fileBackupSchedule || undefined,
        maximumUploadSizeMb: settings.maximumUploadSizeMb,
        departments: settings.departments,
      });
      const normalized = normalizeSettings(result);
      setSettings(normalized);
      setSavedSettings(normalized);
      setStatus("Settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  function updateField<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function addDepartment() {
    const value = newDepartment.trim();

    if (!value || settings.departments.includes(value)) {
      return;
    }

    updateField("departments", [...settings.departments, value]);
    setNewDepartment("");
  }

  function removeDepartment(department: string) {
    updateField(
      "departments",
      settings.departments.filter((item) => item !== department),
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Settings</h2>
          <p className="mt-1 text-sm text-[#9fb0bf]">Operational settings for archive ownership, storage, and backups.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setSettings(savedSettings);
              setStatus("Changes cancelled.");
            }}
            disabled={!hasUnsavedChanges || saving}
            className="rounded-md border border-[#263545] px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!hasUnsavedChanges || saving}
            className="rounded-md bg-[#2f80ed] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </div>

      {hasUnsavedChanges ? (
        <div className="rounded-md border border-[#f59e0b] bg-[#1f1a0d] p-3 text-sm text-[#f8d28b]">
          You have unsaved settings changes.
        </div>
      ) : null}

      <div className="rounded-md border border-[#263545] bg-[#111820] p-3 text-sm text-[#9fb0bf]">{status}</div>

      <section className="grid gap-4 xl:grid-cols-2">
        <SettingsPanel title="Company Information">
          <TextField label="Company Name" value={settings.companyName} onChange={(value) => updateField("companyName", value)} />
          <TextField
            label="Company Logo URL"
            value={settings.companyLogoUrl || ""}
            onChange={(value) => updateField("companyLogoUrl", value)}
          />
        </SettingsPanel>

        <SettingsPanel title="Storage">
          <TextField label="Storage Root" value={settings.storageRoot} onChange={(value) => updateField("storageRoot", value)} />
          <TextField
            label="File Backup Location"
            value={settings.fileBackupLocation || ""}
            onChange={(value) => updateField("fileBackupLocation", value)}
          />
          <NumberField
            label="Maximum Upload Size (MB)"
            value={settings.maximumUploadSizeMb}
            onChange={(value) => updateField("maximumUploadSizeMb", value)}
          />
        </SettingsPanel>

        <SettingsPanel title="Backup Schedules">
          <TextField
            label="Database Backup Schedule"
            value={settings.databaseBackupSchedule || ""}
            onChange={(value) => updateField("databaseBackupSchedule", value)}
            placeholder="Daily 02:00"
          />
          <TextField
            label="File Backup Schedule"
            value={settings.fileBackupSchedule || ""}
            onChange={(value) => updateField("fileBackupSchedule", value)}
            placeholder="Daily 03:00"
          />
        </SettingsPanel>

        <SettingsPanel title="Departments">
          <div className="flex gap-2">
            <input
              value={newDepartment}
              onChange={(event) => setNewDepartment(event.target.value)}
              className="min-w-0 flex-1 rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
              placeholder="Add department"
            />
            <button type="button" onClick={addDepartment} className="rounded-md border border-[#2f80ed] px-3 py-2 text-sm text-[#38bdf8]">
              Add
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {settings.departments.length === 0 ? (
              <div className="text-sm text-[#9fb0bf]">No departments configured.</div>
            ) : (
              settings.departments.map((department) => (
                <span key={department} className="inline-flex items-center gap-2 rounded border border-[#263545] bg-[#0f151d] px-2 py-1 text-sm text-[#d9e5ef]">
                  {department}
                  <button type="button" onClick={() => removeDepartment(department)} className="text-[#fca5a5]">
                    Remove
                  </button>
                </span>
              ))
            )}
          </div>
        </SettingsPanel>
      </section>
    </form>
  );
}

function SettingsPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <div className="mt-4 grid gap-4">{children}</div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      />
    </label>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <input
        type="number"
        min={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      />
    </label>
  );
}

function normalizeSettings(settings: SystemSettings): SystemSettings {
  return {
    ...settings,
    companyLogoUrl: settings.companyLogoUrl || "",
    fileBackupLocation: settings.fileBackupLocation || "",
    databaseBackupSchedule: settings.databaseBackupSchedule || "",
    fileBackupSchedule: settings.fileBackupSchedule || "",
    departments: settings.departments || [],
  };
}
