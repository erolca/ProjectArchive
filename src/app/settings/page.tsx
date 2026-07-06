"use client";

import Link from "next/link";
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

interface BackupProgress {
  status: string;
  overallProgress: number;
  currentProject?: string | null;
  currentCategory?: string | null;
  currentFile?: string | null;
  filesProcessed: number;
  totalFiles: number;
  projectsProcessed: number;
  totalProjects: number;
  bytesProcessed: string;
  totalBytes: string;
  elapsedMs: number;
  estimatedRemainingMs?: number | null;
  transferSpeedBytesPerSecond?: number | null;
  startedAt?: string | null;
  updatedAt?: string | null;
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
  verified: number;
  verifiedWithTimestampWarning: number;
  missing: number;
  checksumMismatch: number;
  sizeMismatch: number;
  corrupted: number;
  failed: number;
  warnings: string[];
  totalFiles: number;
  totalSize: string;
  status: string;
  elapsedMs: number;
  startTime: string;
  finishTime: string;
  destination: string;
}

type RestoreMode = "ENTIRE_ARCHIVE" | "SINGLE_PROJECT" | "SELECTED_CATEGORIES" | "SELECTED_FILES";

interface RestoreOptions {
  dryRun: boolean;
  replaceExistingFiles: boolean;
  skipExistingFiles: boolean;
  restoreToAlternativeLocation: string;
}

interface RestorePreviewFile {
  relativePath: string;
  projectCode: string;
  category?: string | null;
  size: string;
  exists: boolean;
  willRestore: boolean;
  willOverwrite: boolean;
  willSkip: boolean;
  reason: string;
}

interface RestorePreview {
  backupRunId: number;
  mode: RestoreMode;
  source: string;
  destination: string;
  filesToRestore: number;
  existingFiles: number;
  newFiles: number;
  filesToOverwrite: number;
  skippedFiles: number;
  totalFiles: number;
  totalSize: string;
  estimatedDurationSeconds: number;
  conflicts: RestorePreviewFile[];
  files: RestorePreviewFile[];
}

interface RestoreReport {
  status: string;
  restored: number;
  skipped: number;
  failed: number;
  totalSize: string;
  durationMs: number;
  destination: string;
  progress: {
    currentFile?: string | null;
    totalFiles: number;
    progressPercentage: number;
    restoredFiles: number;
    skippedFiles: number;
    failedFiles: number;
    elapsedMs: number;
    remainingMs: number;
  };
  errors: string[];
  preview: RestorePreview;
}

const RESTORE_CATEGORIES = [
  "PLC",
  "HMI",
  "ROBOT",
  "VISION",
  "CAMERA",
  "ELECTRICAL",
  "MECHANICAL",
  "PNEUMATIC",
  "DOCUMENT",
  "PHOTO",
  "VIDEO",
  "FAT",
  "SAT",
  "SERVICE",
  "COMMISSIONING",
  "SPARE_PARTS",
  "BACKUP",
];

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
  const [backupProgress, setBackupProgress] = useState<BackupProgress | null>(null);
  const [showBackupPathFallback, setShowBackupPathFallback] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [restoreStep, setRestoreStep] = useState(1);
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState("Select a backup history entry to begin.");
  const [restoreBackupRunId, setRestoreBackupRunId] = useState<number | "">("");
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("ENTIRE_ARCHIVE");
  const [restoreProjectCode, setRestoreProjectCode] = useState("");
  const [restoreCategories, setRestoreCategories] = useState<string[]>([]);
  const [restoreFiles, setRestoreFiles] = useState("");
  const [restoreOptions, setRestoreOptions] = useState<RestoreOptions>({
    dryRun: true,
    replaceExistingFiles: false,
    skipExistingFiles: true,
    restoreToAlternativeLocation: "",
  });
  const [restorePreview, setRestorePreview] = useState<RestorePreview | null>(null);
  const [restoreReport, setRestoreReport] = useState<RestoreReport | null>(null);

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

  async function loadBackupProgress() {
    const result = await getApi<BackupProgress>("/api/backup/progress");
    setBackupProgress(result);
  }

  async function runBackupNow() {
    setBackupBusy(true);
    setStatus("Backup running. Keep this page open until the operation finishes.");
    setBackupProgress(null);
    const progressInterval = window.setInterval(() => {
      void loadBackupProgress().catch(() => undefined);
    }, 750);

    try {
      await loadBackupProgress().catch(() => undefined);
      const result = await postApi<BackupRunSummary>("/api/backup/run", {});
      setStatus(`Backup completed. Copied ${result.filesCopied}, skipped ${result.filesSkipped}, failed ${result.filesFailed}.`);
      await loadBackupStatus();
      await loadBackupHistory();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Backup failed.");
      await loadBackupStatus().catch(() => undefined);
    } finally {
      window.clearInterval(progressInterval);
      await loadBackupProgress().catch(() => undefined);
      setBackupBusy(false);
    }
  }

  async function verifyBackupNow() {
    setBackupBusy(true);
    setStatus("Verifying backup against source archive.");

    try {
      const result = await postApi<BackupVerificationResult>("/api/backup/verify", {});
      setVerificationResult(result);
      setStatus(`Verification ${result.status}. Verified ${result.verified}, warnings ${result.verifiedWithTimestampWarning}, failed ${result.failed}.`);
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
      setShowBackupPathFallback(false);
      setStatus("Backup path copied. Paste it into Windows Explorer.");
      return;
    }

    setShowBackupPathFallback(true);
    setStatus(`Backup folder: ${destination}`);
  }

  async function analyzeRestoreRequest() {
    if (!restoreBackupRunId) {
      setRestoreStatus("Select a backup history entry first.");
      return;
    }

    setRestoreBusy(true);
    setRestoreStatus("Analyzing selected backup.");

    try {
      const preview = await postApi<RestorePreview>("/api/restore/analyze", buildRestorePayload());
      setRestorePreview(preview);
      setRestoreReport(null);
      setRestoreStep(3);
      setRestoreStatus(`Analysis complete. ${preview.filesToRestore} files ready, ${preview.conflicts.length} conflicts detected.`);
    } catch (error) {
      setRestoreStatus(error instanceof Error ? error.message : "Restore analysis failed.");
    } finally {
      setRestoreBusy(false);
    }
  }

  async function executeRestoreRequest() {
    if (!restoreBackupRunId) {
      setRestoreStatus("Select a backup history entry first.");
      return;
    }

    setRestoreBusy(true);
    setRestoreStep(6);
    setRestoreStatus(restoreOptions.dryRun ? "Running restore dry run." : "Executing restore.");

    try {
      const report = await postApi<RestoreReport>("/api/restore/execute", buildRestorePayload());
      setRestoreReport(report);
      setRestorePreview(report.preview);
      setRestoreStatus(`Restore ${report.status}. Restored ${report.restored}, skipped ${report.skipped}, failed ${report.failed}.`);
    } catch (error) {
      setRestoreStatus(error instanceof Error ? error.message : "Restore execution failed.");
    } finally {
      setRestoreBusy(false);
    }
  }

  function buildRestorePayload() {
    return {
      backupRunId: restoreBackupRunId,
      mode: restoreMode,
      projectCode: restoreProjectCode || undefined,
      categories: restoreCategories,
      files: restoreFiles
        .split(/\r?\n/)
        .map((file) => file.trim())
        .filter(Boolean),
      options: {
        dryRun: restoreOptions.dryRun,
        replaceExistingFiles: restoreOptions.replaceExistingFiles,
        skipExistingFiles: restoreOptions.skipExistingFiles,
        restoreToAlternativeLocation: restoreOptions.restoreToAlternativeLocation || undefined,
      },
    };
  }

  function updateRestoreOption<K extends keyof RestoreOptions>(key: K, value: RestoreOptions[K]) {
    setRestoreOptions((current) => {
      if (key === "replaceExistingFiles" && value === true) {
        return { ...current, replaceExistingFiles: true, skipExistingFiles: false };
      }

      if (key === "skipExistingFiles" && value === true) {
        return { ...current, skipExistingFiles: true, replaceExistingFiles: false };
      }

      return { ...current, [key]: value };
    });
  }

  function toggleRestoreCategory(category: string) {
    setRestoreCategories((current) =>
      current.includes(category) ? current.filter((item) => item !== category) : [...current, category],
    );
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
          <Link
            href="/settings/integrity"
            className="inline-flex items-center rounded-md border border-[#263545] px-4 py-2 text-sm text-[#d9e5ef]"
          >
            System Integrity
          </Link>
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

        <SettingsPanel title="Backup Settings" className="xl:col-span-2">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
            <div className="grid gap-4">
              <PathDisplay label="Storage Root" value={backupStatus?.storageRoot || settings.storageRoot} />
              <TextField
                label="Backup Destination"
                value={settings.fileBackupLocation || ""}
                onChange={(value) => updateField("fileBackupLocation", value)}
                placeholder="D:\\MachineArchiveBackup or \\\\NAS01\\ArchiveBackup"
              />
              {showBackupPathFallback ? (
                <label>
                  <span className="text-xs font-semibold uppercase text-[#9fb0bf]">Backup Path</span>
                  <input
                    value={settings.fileBackupLocation || backupStatus?.destination || ""}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    className="mt-1 w-full rounded-md border border-[#263545] bg-[#06090d] px-3 py-2 text-sm text-white outline-none"
                  />
                </label>
              ) : null}
            </div>
            <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4">
              <div className="text-xs font-semibold uppercase text-[#64748b]">Folder Access</div>
              <p className="mt-2 text-sm leading-6 text-[#9fb0bf]">
                Browsers cannot directly open local server folders for security reasons. Copy the backup path and paste it into Windows Explorer on a machine with access to that location.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <ActionButton onClick={runBackupNow} disabled={backupBusy || hasUnsavedChanges} primary>
                  {backupBusy ? "Running..." : "Run Backup Now"}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    setBackupBusy(true);
                    loadBackupStatus(true).finally(() => setBackupBusy(false));
                  }}
                  disabled={backupBusy || hasUnsavedChanges}
                >
                  Validate Location
                </ActionButton>
                <ActionButton onClick={copyBackupFolderPath}>Copy Backup Path</ActionButton>
                <ActionButton onClick={verifyBackupNow} disabled={backupBusy || hasUnsavedChanges}>
                  Verify Backup
                </ActionButton>
              </div>
              {hasUnsavedChanges ? (
                <div className="mt-3 text-xs text-[#f8d28b]">Save settings before validating, running, or verifying a backup.</div>
              ) : null}
            </div>
          </div>
          {backupStatus?.validation ? (
            <div className={`rounded-md border p-3 text-sm ${backupStatus.validation.valid ? "border-[#14532d] bg-[#07130d] text-[#86efac]" : "border-[#7f1d1d] bg-[#1f0d0d] text-[#fca5a5]"}`}>
              {backupStatus.validation.message}
            </div>
          ) : null}
          {backupProgress && backupProgress.status !== "IDLE" ? (
            <BackupProgressPanel progress={backupProgress} />
          ) : null}
        </SettingsPanel>

        <SettingsPanel title="Backup Status" className="xl:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricTile label="Last Backup Date" value={formatDateTime(getLastBackupValue(settings, backupStatus, "finishedAt"))} />
            <MetricTile label="Duration" value={formatDuration(getLastBackupNumber(settings, backupStatus, "durationMs"))} />
            <MetricTile label="Status" value={backupStatus?.status || settings.lastFileBackupStatus || "IDLE"} />
            <MetricTile label="Size" value={formatBytes(getLastBackupValue(settings, backupStatus, "size"))} />
            <MetricTile label="Result" value={summarizeBackupResult(getLastBackupResult(settings, backupStatus))} wide />
          </div>

          {verificationResult ? (
            <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                <div>
                  <div className="text-xs font-semibold uppercase text-[#64748b]">Verification Result</div>
                  <div className="mt-1 flex items-center gap-2">
                    <StatusPill status={verificationResult.status} />
                    <span className="text-xs text-[#9fb0bf]">{formatDateTime(verificationResult.finishTime)} / {formatDuration(verificationResult.elapsedMs)}</span>
                  </div>
                </div>
                <PathDisplay label="Destination" value={verificationResult.destination} compact />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricTile label="Verified" value={String(verificationResult.verified)} />
                <MetricTile label="Timestamp Warnings" value={String(verificationResult.verifiedWithTimestampWarning)} />
                <MetricTile label="Missing" value={String(verificationResult.missing)} />
                <MetricTile label="Checksum Mismatch" value={String(verificationResult.checksumMismatch)} />
                <MetricTile label="Size Mismatch" value={String(verificationResult.sizeMismatch)} />
                <MetricTile label="Corrupted" value={String(verificationResult.corrupted)} />
                <MetricTile label="Warnings" value={String(verificationResult.warnings.length)} />
                <MetricTile label="Failed" value={String(verificationResult.failed)} />
              </div>
              {verificationResult.warnings.length > 0 ? (
                <div className="mt-4 rounded-md border border-[#3f2d14] bg-[#140f08]">
                  <div className="border-b border-[#3f2d14] px-3 py-2 text-xs font-semibold uppercase text-[#f8d28b]">Verification Issues</div>
                  <div className="max-h-44 overflow-auto p-3 text-xs leading-5 text-[#f8d28b]">
                    {verificationResult.warnings.slice(0, 20).map((warning) => (
                      <div key={warning} className="break-all">{warning}</div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4 text-sm text-[#9fb0bf]">
              No verification has been run in this session.
            </div>
          )}
        </SettingsPanel>

        <SettingsPanel title="Backup History" className="xl:col-span-2">
          <div className="overflow-x-auto rounded-md border border-[#263545] bg-[#0b0f14]">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="bg-[#0f151d] text-xs uppercase text-[#64748b]">
                <tr>
                  <th className="px-3 py-2">Backup Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Duration</th>
                  <th className="px-3 py-2">Destination</th>
                  <th className="px-3 py-2 text-right">Copied</th>
                  <th className="px-3 py-2 text-right">Skipped</th>
                  <th className="px-3 py-2 text-right">Failed</th>
                  <th className="px-3 py-2 text-right">Total</th>
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
                    <tr key={item.id} className="align-top">
                      <td className="whitespace-nowrap px-3 py-2">{formatDateTime(item.startedAt)}</td>
                      <td className="px-3 py-2"><StatusPill status={item.status} /></td>
                      <td className="whitespace-nowrap px-3 py-2">{formatDuration(item.durationMs)}</td>
                      <td className="max-w-[300px] px-3 py-2"><span className="block break-all text-xs text-[#9fb0bf]">{item.destination}</span></td>
                      <td className="px-3 py-2 text-right">{item.filesCopied}</td>
                      <td className="px-3 py-2 text-right">{item.filesSkipped}</td>
                      <td className="px-3 py-2 text-right">{item.filesFailed}</td>
                      <td className="px-3 py-2 text-right">{item.totalFiles}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatBytes(item.totalSize)}</td>
                      <td className="px-3 py-2">{item.executedBy?.fullName || item.executedBy?.username || "System"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SettingsPanel>

        <SettingsPanel title="Disaster Recovery Restore Wizard" className="xl:col-span-2">
          <div className="grid gap-2 md:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setRestoreStep(step)}
                className={`h-10 rounded-md border px-2 text-xs font-semibold ${
                  restoreStep === step
                    ? "border-[#2f80ed] bg-[#0f2440] text-white"
                    : "border-[#263545] bg-[#0b0f14] text-[#9fb0bf]"
                }`}
              >
                Step {step}
              </button>
            ))}
          </div>

          <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4 text-sm text-[#9fb0bf]">{restoreStatus}</div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="grid gap-4">
              {restoreStep === 1 ? (
                <WizardBlock title="Step 1 - Select Backup History Entry">
                  <select
                    value={restoreBackupRunId}
                    onChange={(event) => {
                      setRestoreBackupRunId(event.target.value ? Number(event.target.value) : "");
                      setRestorePreview(null);
                      setRestoreReport(null);
                    }}
                    className="w-full rounded-md border border-[#263545] bg-[#06090d] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
                  >
                    <option value="">Select backup run</option>
                    {backupHistory.map((item) => (
                      <option key={item.id} value={item.id}>
                        #{item.id} - {formatDateTime(item.startedAt)} - {item.status} - {item.destination}
                      </option>
                    ))}
                  </select>
                </WizardBlock>
              ) : null}

              {restoreStep === 2 ? (
                <WizardBlock title="Step 2 - Analyze Selected Backup">
                  <div className="grid gap-3 md:grid-cols-2">
                    <SelectField
                      label="Restore Mode"
                      value={restoreMode}
                      onChange={(value) => setRestoreMode(value as RestoreMode)}
                      options={[
                        ["ENTIRE_ARCHIVE", "Restore entire archive"],
                        ["SINGLE_PROJECT", "Restore single project"],
                        ["SELECTED_CATEGORIES", "Restore selected categories"],
                        ["SELECTED_FILES", "Restore selected files"],
                      ]}
                    />
                    {restoreMode === "SINGLE_PROJECT" ? (
                      <TextField label="Project Code" value={restoreProjectCode} onChange={setRestoreProjectCode} placeholder="PRJ-2026-001" />
                    ) : null}
                  </div>
                  {restoreMode === "SELECTED_CATEGORIES" ? (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {RESTORE_CATEGORIES.map((category) => (
                        <label key={category} className="flex items-center gap-2 rounded border border-[#263545] bg-[#06090d] px-3 py-2 text-sm text-[#d9e5ef]">
                          <input
                            type="checkbox"
                            checked={restoreCategories.includes(category)}
                            onChange={() => toggleRestoreCategory(category)}
                          />
                          {category}
                        </label>
                      ))}
                    </div>
                  ) : null}
                  {restoreMode === "SELECTED_FILES" ? (
                    <label>
                      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">Selected Files</span>
                      <textarea
                        value={restoreFiles}
                        onChange={(event) => setRestoreFiles(event.target.value)}
                        rows={5}
                        placeholder="PRJ-2026-001/PLC/backup.zip"
                        className="mt-1 w-full rounded-md border border-[#263545] bg-[#06090d] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
                      />
                    </label>
                  ) : null}
                  <ActionButton onClick={analyzeRestoreRequest} disabled={restoreBusy || !restoreBackupRunId} primary>
                    {restoreBusy ? "Analyzing..." : "Analyze Backup"}
                  </ActionButton>
                </WizardBlock>
              ) : null}

              {restoreStep === 3 ? (
                <WizardBlock title="Step 3 - Preview Restore">
                  <RestorePreviewSummary preview={restorePreview} />
                </WizardBlock>
              ) : null}

              {restoreStep === 4 ? (
                <WizardBlock title="Step 4 - Conflict Detection">
                  <RestoreConflictList preview={restorePreview} />
                </WizardBlock>
              ) : null}

              {restoreStep === 5 ? (
                <WizardBlock title="Step 5 - Restore Options">
                  <div className="grid gap-3 md:grid-cols-2">
                    <CheckboxField label="Dry Run" checked={restoreOptions.dryRun} onChange={(checked) => updateRestoreOption("dryRun", checked)} />
                    <CheckboxField
                      label="Replace Existing Files"
                      checked={restoreOptions.replaceExistingFiles}
                      onChange={(checked) => updateRestoreOption("replaceExistingFiles", checked)}
                    />
                    <CheckboxField
                      label="Skip Existing Files"
                      checked={restoreOptions.skipExistingFiles}
                      onChange={(checked) => updateRestoreOption("skipExistingFiles", checked)}
                    />
                    <TextField
                      label="Alternative Restore Location"
                      value={restoreOptions.restoreToAlternativeLocation}
                      onChange={(value) => updateRestoreOption("restoreToAlternativeLocation", value)}
                      placeholder="Optional absolute path"
                    />
                  </div>
                </WizardBlock>
              ) : null}

              {restoreStep === 6 ? (
                <WizardBlock title="Step 6 - Execute Restore">
                  <div className="grid gap-3 md:grid-cols-2">
                    <ActionButton onClick={executeRestoreRequest} disabled={restoreBusy || !restorePreview} primary>
                      {restoreBusy ? "Executing..." : restoreOptions.dryRun ? "Run Dry Run" : "Execute Restore"}
                    </ActionButton>
                    <ActionButton onClick={() => setRestoreStatus("Restore cancelled before execution.")}>Cancel Restore</ActionButton>
                  </div>
                  {restoreBusy ? (
                    <div className="rounded-md border border-[#263545] bg-[#06090d] p-3 text-sm text-[#9fb0bf]">
                      Restore request is running. Progress is returned in the final report for this synchronous operation.
                    </div>
                  ) : null}
                  <RestoreReportView report={restoreReport} />
                </WizardBlock>
              ) : null}
            </div>

            <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4">
              <div className="text-xs font-semibold uppercase text-[#64748b]">Restore Scope</div>
              <div className="mt-3 grid gap-3 text-sm">
                <StatusLine label="Backup Run" value={restoreBackupRunId ? `#${restoreBackupRunId}` : "Not selected"} />
                <StatusLine label="Mode" value={restoreMode} />
                <StatusLine label="Dry Run" value={restoreOptions.dryRun ? "Enabled" : "Disabled"} />
                <StatusLine label="Existing Files" value={restoreOptions.replaceExistingFiles ? "Replace" : "Skip"} />
                <StatusLine label="Destination" value={restoreOptions.restoreToAlternativeLocation || "Configured Storage Root"} />
              </div>
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

function SettingsPanel({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-md border border-[#263545] bg-[#111820] p-4 ${className}`}>
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

function PathDisplay({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={compact ? "min-w-0 md:max-w-[420px]" : "min-w-0"}>
      <div className="text-xs font-semibold uppercase text-[#64748b]">{label}</div>
      <div className="mt-1 rounded-md border border-[#263545] bg-[#06090d] px-3 py-2 text-sm leading-5 text-[#d9e5ef]">
        <span className="block break-all">{value || "Not configured"}</span>
      </div>
    </div>
  );
}

function MetricTile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`min-w-0 rounded-md border border-[#263545] bg-[#0b0f14] p-3 ${wide ? "xl:col-span-2" : ""}`}>
      <div className="text-xs font-semibold uppercase text-[#64748b]">{label}</div>
      <div className="mt-1 break-words text-sm font-medium leading-5 text-[#d9e5ef]">{value || "Not available"}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const isGood = status === "PASSED" || status === "COMPLETED";
  const isWarning = status === "RUNNING" || status === "COMPLETED_WITH_ERRORS";
  const className = isGood
    ? "border-[#14532d] bg-[#07130d] text-[#86efac]"
    : isWarning
      ? "border-[#7c4a03] bg-[#1f1a0d] text-[#f8d28b]"
      : "border-[#7f1d1d] bg-[#1f0d0d] text-[#fca5a5]";

  return (
    <span className={`inline-flex max-w-full rounded border px-2 py-1 text-xs font-semibold ${className}`}>
      <span className="truncate">{status || "UNKNOWN"}</span>
    </span>
  );
}

function BackupProgressPanel({ progress }: { progress: BackupProgress }) {
  return (
    <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <div className="text-xs font-semibold uppercase text-[#64748b]">Backup Progress</div>
          <div className="mt-1 flex items-center gap-2">
            <StatusPill status={progress.status} />
            <span className="text-sm font-semibold text-white">{progress.overallProgress}%</span>
          </div>
        </div>
        <div className="text-xs text-[#9fb0bf]">
          {progress.updatedAt ? `Updated ${formatDateTime(progress.updatedAt)}` : "Waiting for progress"}
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#263545]">
        <div className="h-full bg-[#2f80ed]" style={{ width: `${Math.max(0, Math.min(100, progress.overallProgress))}%` }} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Current Project" value={progress.currentProject || "-"} />
        <MetricTile label="Current Category" value={progress.currentCategory || "-"} />
        <MetricTile label="Current File" value={progress.currentFile || "-"} wide />
        <MetricTile label="Files" value={`${progress.filesProcessed} / ${progress.totalFiles}`} />
        <MetricTile label="Projects" value={`${progress.projectsProcessed} / ${progress.totalProjects}`} />
        <MetricTile label="Elapsed" value={formatDuration(progress.elapsedMs)} />
        <MetricTile label="Remaining" value={formatDuration(progress.estimatedRemainingMs)} />
        <MetricTile label="Transfer Speed" value={formatTransferSpeed(progress.transferSpeedBytesPerSecond)} />
        <MetricTile label="Transferred" value={`${formatBytes(progress.bytesProcessed)} / ${formatBytes(progress.totalBytes)}`} wide />
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  primary = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  const className = primary
    ? "bg-[#2f80ed] font-semibold text-white"
    : "border border-[#2f80ed] text-[#38bdf8]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 rounded-md px-3 text-sm disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function WizardBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4">
      <h4 className="text-sm font-semibold text-white">{title}</h4>
      <div className="mt-4 grid gap-4">{children}</div>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label>
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#06090d] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-md border border-[#263545] bg-[#06090d] px-3 text-sm text-[#d9e5ef]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

function RestorePreviewSummary({ preview }: { preview: RestorePreview | null }) {
  if (!preview) {
    return <div className="rounded-md border border-[#263545] bg-[#06090d] p-3 text-sm text-[#9fb0bf]">Run analysis to generate a restore preview.</div>;
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Files To Restore" value={String(preview.filesToRestore)} />
        <MetricTile label="Existing Files" value={String(preview.existingFiles)} />
        <MetricTile label="New Files" value={String(preview.newFiles)} />
        <MetricTile label="Overwrite" value={String(preview.filesToOverwrite)} />
        <MetricTile label="Skipped" value={String(preview.skippedFiles)} />
        <MetricTile label="Total Files" value={String(preview.totalFiles)} />
        <MetricTile label="Total Size" value={formatBytes(preview.totalSize)} />
        <MetricTile label="Estimated Duration" value={`${preview.estimatedDurationSeconds}s`} />
      </div>
      <PathDisplay label="Source" value={preview.source} />
      <PathDisplay label="Destination" value={preview.destination} />
      <RestoreFileTable files={preview.files.slice(0, 20)} emptyText="No files selected for restore." />
    </div>
  );
}

function RestoreConflictList({ preview }: { preview: RestorePreview | null }) {
  if (!preview) {
    return <div className="rounded-md border border-[#263545] bg-[#06090d] p-3 text-sm text-[#9fb0bf]">Analyze a backup before reviewing conflicts.</div>;
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricTile label="Conflicts" value={String(preview.conflicts.length)} />
        <MetricTile label="Will Overwrite" value={String(preview.filesToOverwrite)} />
        <MetricTile label="Will Skip" value={String(preview.skippedFiles)} />
      </div>
      <RestoreFileTable files={preview.conflicts.slice(0, 30)} emptyText="No existing file conflicts detected." />
    </div>
  );
}

function RestoreFileTable({ files, emptyText }: { files: RestorePreviewFile[]; emptyText: string }) {
  return (
    <div className="overflow-x-auto rounded-md border border-[#263545] bg-[#06090d]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-[#0f151d] text-xs uppercase text-[#64748b]">
          <tr>
            <th className="px-3 py-2">File</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Size</th>
            <th className="px-3 py-2">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1f2937] text-[#d9e5ef]">
          {files.length === 0 ? (
            <tr>
              <td className="px-3 py-4 text-[#9fb0bf]" colSpan={5}>{emptyText}</td>
            </tr>
          ) : (
            files.map((file) => (
              <tr key={file.relativePath} className="align-top">
                <td className="max-w-[360px] px-3 py-2"><span className="block break-all text-xs text-[#9fb0bf]">{file.relativePath}</span></td>
                <td className="px-3 py-2">{file.projectCode}</td>
                <td className="px-3 py-2">{file.category || "-"}</td>
                <td className="whitespace-nowrap px-3 py-2">{formatBytes(file.size)}</td>
                <td className="px-3 py-2">{file.reason}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function RestoreReportView({ report }: { report: RestoreReport | null }) {
  if (!report) {
    return null;
  }

  return (
    <div className="grid gap-4 rounded-md border border-[#263545] bg-[#06090d] p-4">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
        <div>
          <div className="text-xs font-semibold uppercase text-[#64748b]">Restore Report</div>
          <div className="mt-1"><StatusPill status={report.status} /></div>
        </div>
        <div className="text-xs text-[#9fb0bf]">{formatDuration(report.durationMs)} / {report.progress.progressPercentage}%</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricTile label="Restored" value={String(report.restored)} />
        <MetricTile label="Skipped" value={String(report.skipped)} />
        <MetricTile label="Failed" value={String(report.failed)} />
        <MetricTile label="Total Size" value={formatBytes(report.totalSize)} />
        <MetricTile label="Total Files" value={String(report.progress.totalFiles)} />
        <MetricTile label="Elapsed" value={formatDuration(report.progress.elapsedMs)} />
        <MetricTile label="Remaining" value={formatDuration(report.progress.remainingMs)} />
        <MetricTile label="Current File" value={report.progress.currentFile || "-"} />
      </div>
      <PathDisplay label="Destination" value={report.destination} />
      {report.errors.length > 0 ? (
        <div className="rounded-md border border-[#7f1d1d] bg-[#1f0d0d] p-3 text-xs leading-5 text-[#fca5a5]">
          {report.errors.slice(0, 20).map((error) => (
            <div key={error} className="break-all">{error}</div>
          ))}
        </div>
      ) : null}
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

function formatTransferSpeed(value?: number | null): string {
  if (!value) {
    return "Not available";
  }

  return `${formatBytes(value)}/s`;
}
