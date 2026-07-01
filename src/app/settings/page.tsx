"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { getApi, postApi, putApi } from "../../lib/api-client";
import { formatBytes, formatDateTime } from "../../lib/format";

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
  lastFileBackupStartedAt?: string | null;
  lastFileBackupFinishedAt?: string | null;
  lastFileBackupDurationMs?: number | null;
  lastFileBackupStatus?: string | null;
  lastFileBackupSize?: string | null;
  lastFileBackupResult?: BackupRunSummary | null;
  lastFileBackupDestination?: string | null;
  updatedAt: string;
}

interface BackupStatus {
  storageRoot: string;
  sourcePath: string;
  destination?: string | null;
  status: string;
  lastBackup?: {
    startedAt?: string | null;
    finishedAt?: string | null;
    durationMs?: number | null;
    status?: string | null;
    size?: string | null;
    result?: BackupRunSummary | null;
    destination?: string | null;
  };
  validation?: {
    valid: boolean;
    destination?: string | null;
    message: string;
  };
}

interface BackupRunSummary {
  filesCopied: number;
  filesSkipped: number;
  filesFailed: number;
  totalFiles: number;
  totalSize: string;
  elapsedMs: number;
  startTime: string;
  finishTime: string;
  destination: string;
  errors: string[];
}

interface BackupHistoryItem {
  id: number;
  startedAt: string;
  finishedAt?: string | null;
  durationMs?: number | null;
  status: string;
  destination: string;
  filesCopied: number;
  filesSkipped: number;
  filesFailed: number;
  totalFiles: number;
  totalSize: string;
  executedBy?: {
    username: string;
    fullName?: string | null;
    email: string;
  } | null;
}

interface BackupVerificationResult {
  verifiedFiles: number;
  missingFiles: number;
  mismatchedFiles: number;
  corruptedFiles: number;
  totalFiles: number;
  totalSize: string;
  status: string;
  elapsedMs: number;
  startTime: string;
  finishTime: string;
  destination: string;
  issues: string[];
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
  lastFileBackupStatus: "",
  lastFileBackupSize: null,
  lastFileBackupResult: null,
  lastFileBackupDestination: "",
  updatedAt: "",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>(emptySettings);
  const [savedSettings, setSavedSettings] = useState<SystemSettings>(emptySettings);
  const [newDepartment, setNewDepartment] = useState("");
  const [status, setStatus] = useState("Loading settings");
  const [saving, setSaving] = useState(false);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [backupHistory, setBackupHistory] = useState<BackupHistoryItem[]>([]);
  const [verificationResult, setVerificationResult] = useState<BackupVerificationResult | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    void loadSettings();
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
      await loadBackupStatus();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function loadSettings() {
    try {
      const [settingsResult, backupResult, historyResult] = await Promise.all([
        getApi<SystemSettings>("/api/settings"),
        getApi<BackupStatus>("/api/backup/status"),
        getApi<BackupHistoryItem[]>("/api/backup/history"),
      ]);
      const normalized = normalizeSettings(settingsResult);
      setSettings(normalized);
      setSavedSettings(normalized);
      setBackupStatus(backupResult);
      setBackupHistory(historyResult);
      setStatus("Settings loaded");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load settings.");
    }
  }

  async function loadBackupStatus(validate = false) {
    const result = await getApi<BackupStatus>(validate ? "/api/backup/status?validate=true" : "/api/backup/status");
    setBackupStatus(result);

    if (result.validation) {
      setStatus(result.validation.message);
    }
  }

  async function loadBackupHistory() {
    const result = await getApi<BackupHistoryItem[]>("/api/backup/history");
    setBackupHistory(result);
  }

  async function runBackupNow() {
    setBackupBusy(true);
    setStatus("Backup running. Keep this page open until the operation finishes.");

    try {
      const result = await postApi<BackupRunSummary>("/api/backup/run", {});
      setStatus(`Backup completed. Copied ${result.filesCopied}, skipped ${result.filesSkipped}, failed ${result.filesFailed}.`);
      await loadBackupStatus();
      await loadBackupHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Backup failed.");
      await loadBackupStatus().catch(() => undefined);
    } finally {
      setBackupBusy(false);
    }
  }

  async function verifyBackupNow() {
    setBackupBusy(true);
    setStatus("Verifying backup against source archive.");

    try {
      const result = await postApi<BackupVerificationResult>("/api/backup/verify", {});
      setVerificationResult(result);
      setStatus(`Verification ${result.status}. Verified ${result.verifiedFiles}, missing ${result.missingFiles}, mismatched ${result.mismatchedFiles}, corrupted ${result.corruptedFiles}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Backup verification failed.");
    } finally {
      setBackupBusy(false);
    }
  }

  async function copyBackupFolderPath() {
    const destination = settings.fileBackupLocation || backupStatus?.destination;

    if (!destination) {
      setStatus("No backup folder is configured.");
      return;
    }

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(destination);
      setStatus("Backup folder path copied.");
      return;
    }

    setStatus(`Backup folder: ${destination}`);
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

        <SettingsPanel title="Project Storage Backup">
          <ReadOnlyField label="Storage Root" value={backupStatus?.storageRoot || settings.storageRoot} />
          <div className="flex items-center justify-center text-[#64748b]">v</div>
          <TextField
            label="Backup Destination"
            value={settings.fileBackupLocation || ""}
            onChange={(value) => updateField("fileBackupLocation", value)}
            placeholder="D:\\MachineArchiveBackup or \\\\NAS01\\ArchiveBackup"
          />
          <div className="grid gap-3 rounded-md border border-[#263545] bg-[#0b0f14] p-3 md:grid-cols-2">
            <StatusLine label="Last Backup Date" value={formatDateTime(getLastBackupValue(settings, backupStatus, "finishedAt"))} />
            <StatusLine label="Last Backup Duration" value={formatDuration(getLastBackupNumber(settings, backupStatus, "durationMs"))} />
            <StatusLine label="Last Backup Status" value={backupStatus?.status || settings.lastFileBackupStatus || "IDLE"} />
            <StatusLine label="Last Backup Size" value={formatBytes(getLastBackupValue(settings, backupStatus, "size"))} />
            <StatusLine label="Last Backup Result" value={summarizeBackupResult(getLastBackupResult(settings, backupStatus))} wide />
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <button
              type="button"
              onClick={runBackupNow}
              disabled={backupBusy || hasUnsavedChanges}
              className="rounded-md bg-[#2f80ed] px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {backupBusy ? "Running..." : "Run Backup Now"}
            </button>
            <button
              type="button"
              onClick={() => {
                setBackupBusy(true);
                loadBackupStatus(true).finally(() => setBackupBusy(false));
              }}
              disabled={backupBusy || hasUnsavedChanges}
              className="rounded-md border border-[#2f80ed] px-3 py-2 text-sm text-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Validate Backup Location
            </button>
            <button
              type="button"
              onClick={copyBackupFolderPath}
              className="rounded-md border border-[#263545] px-3 py-2 text-sm text-white"
            >
              Open Backup Folder
            </button>
            <button
              type="button"
              onClick={verifyBackupNow}
              disabled={backupBusy || hasUnsavedChanges}
              className="rounded-md border border-[#2f80ed] px-3 py-2 text-sm text-[#38bdf8] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Verify Backup
            </button>
          </div>
          {hasUnsavedChanges ? (
            <div className="text-xs text-[#f8d28b]">Save settings before validating or running a backup.</div>
          ) : null}
          {backupStatus?.validation ? (
            <div className={`rounded-md border p-3 text-sm ${backupStatus.validation.valid ? "border-[#14532d] bg-[#07130d] text-[#86efac]" : "border-[#7f1d1d] bg-[#1f0d0d] text-[#fca5a5]"}`}>
              {backupStatus.validation.message}
            </div>
          ) : null}
          {verificationResult ? (
            <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-3">
              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div>
                  <div className="text-xs font-semibold uppercase text-[#64748b]">Verification Result</div>
                  <div className={verificationResult.status === "PASSED" ? "text-sm font-semibold text-[#86efac]" : "text-sm font-semibold text-[#fca5a5]"}>
                    {verificationResult.status}
                  </div>
                </div>
                <div className="text-xs text-[#9fb0bf]">{formatDateTime(verificationResult.finishTime)} / {formatDuration(verificationResult.elapsedMs)}</div>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-4">
                <StatusLine label="Verified" value={String(verificationResult.verifiedFiles)} />
                <StatusLine label="Missing" value={String(verificationResult.missingFiles)} />
                <StatusLine label="Mismatched" value={String(verificationResult.mismatchedFiles)} />
                <StatusLine label="Corrupted" value={String(verificationResult.corruptedFiles)} />
              </div>
              {verificationResult.issues.length > 0 ? (
                <div className="mt-3 max-h-32 overflow-auto rounded border border-[#263545] bg-[#06090d] p-2 text-xs text-[#fca5a5]">
                  {verificationResult.issues.slice(0, 10).map((issue) => (
                    <div key={issue}>{issue}</div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="rounded-md border border-[#263545] bg-[#0b0f14]">
            <div className="border-b border-[#263545] px-3 py-2 text-xs font-semibold uppercase text-[#9fb0bf]">Backup History</div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="text-xs uppercase text-[#64748b]">
                  <tr>
                    <th className="px-3 py-2">Backup Date</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Duration</th>
                    <th className="px-3 py-2">Destination</th>
                    <th className="px-3 py-2">Copied</th>
                    <th className="px-3 py-2">Skipped</th>
                    <th className="px-3 py-2">Failed</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Size</th>
                    <th className="px-3 py-2">Executed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2937] text-[#d9e5ef]">
                  {backupHistory.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-[#9fb0bf]" colSpan={10}>No backup history yet.</td>
                    </tr>
                  ) : (
                    backupHistory.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">{formatDateTime(item.startedAt)}</td>
                        <td className="px-3 py-2">{item.status}</td>
                        <td className="px-3 py-2">{formatDuration(item.durationMs)}</td>
                        <td className="max-w-[220px] truncate px-3 py-2" title={item.destination}>{item.destination}</td>
                        <td className="px-3 py-2">{item.filesCopied}</td>
                        <td className="px-3 py-2">{item.filesSkipped}</td>
                        <td className="px-3 py-2">{item.filesFailed}</td>
                        <td className="px-3 py-2">{item.totalFiles}</td>
                        <td className="px-3 py-2">{formatBytes(item.totalSize)}</td>
                        <td className="px-3 py-2">{item.executedBy?.fullName || item.executedBy?.username || "System"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
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

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <input
        value={value}
        readOnly
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#06090d] px-3 py-2 text-sm text-[#9fb0bf] outline-none"
      />
    </label>
  );
}

function StatusLine({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <div className="text-xs font-semibold uppercase text-[#64748b]">{label}</div>
      <div className="mt-1 break-words text-sm text-[#d9e5ef]">{value || "Not available"}</div>
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

function getLastBackupValue(settings: SystemSettings, backupStatus: BackupStatus | null, key: "finishedAt" | "size"): string | null {
  if (key === "finishedAt") {
    return backupStatus?.lastBackup?.finishedAt || settings.lastFileBackupFinishedAt || null;
  }

  return backupStatus?.lastBackup?.size || settings.lastFileBackupSize || null;
}

function getLastBackupNumber(settings: SystemSettings, backupStatus: BackupStatus | null, key: "durationMs"): number | null {
  if (key === "durationMs") {
    return backupStatus?.lastBackup?.durationMs ?? settings.lastFileBackupDurationMs ?? null;
  }

  return null;
}

function getLastBackupResult(settings: SystemSettings, backupStatus: BackupStatus | null): BackupRunSummary | null {
  return backupStatus?.lastBackup?.result || settings.lastFileBackupResult || null;
}

function summarizeBackupResult(result: BackupRunSummary | null): string {
  if (!result) {
    return "No backup has been run.";
  }

  return `Copied ${result.filesCopied}, skipped ${result.filesSkipped}, failed ${result.filesFailed}, total ${result.totalFiles}.`;
}

function formatDuration(value?: number | null): string {
  if (!value) {
    return "Not available";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  const seconds = Math.round(value / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
}
