"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { postApi } from "../../../lib/api-client";
import { useCurrentUser } from "../../../lib/current-user";
import { formatDateTime } from "../../../lib/format";

type IntegritySeverity = "PASSED" | "WARNING" | "ERROR";

interface IntegrityIssue {
  severity: "WARNING" | "ERROR";
  code: string;
  message: string;
  path?: string;
  entityType?: string;
  entityId?: number;
}

interface IntegrityCheckSummary {
  key: string;
  label: string;
  passed: boolean;
  warnings: number;
  errors: number;
}

interface StorageIntegrityScanResult {
  healthScore: number;
  status: IntegritySeverity;
  passedChecks: number;
  warningCount: number;
  errorCount: number;
  totalChecks: number;
  scanDurationMs: number;
  scannedAt: string;
  storageRoot: string;
  projectsRoot: string;
  checks: IntegrityCheckSummary[];
  warnings: IntegrityIssue[];
  errors: IntegrityIssue[];
}

export default function SystemIntegrityPage() {
  const currentUser = useCurrentUser();
  const [scanResult, setScanResult] = useState<StorageIntegrityScanResult | null>(null);
  const [status, setStatus] = useState("Run an integrity scan to compare project metadata with disk storage.");
  const [running, setRunning] = useState(false);

  const canRunScan = currentUser?.role === "ADMIN";
  const visibleIssues = useMemo(() => {
    if (!scanResult) {
      return [];
    }

    return [...scanResult.errors, ...scanResult.warnings].slice(0, 100);
  }, [scanResult]);

  async function runScan() {
    setRunning(true);
    setStatus("Integrity scan running. This is read-only and will not modify files.");

    try {
      const result = await postApi<StorageIntegrityScanResult>("/api/system-integrity/scan", {});
      setScanResult(result);
      setStatus(`Integrity scan completed with ${result.errorCount} errors and ${result.warningCount} warnings.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Integrity scan failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <main className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-[#64748b]">Settings</div>
          <h2 className="mt-1 text-xl font-semibold text-white">System Integrity</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9fb0bf]">
            Read-only consistency scan for project folders, database file references, orphan storage files, and configured backup destinations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/settings"
            className="inline-flex h-10 items-center rounded-md border border-[#263545] px-4 text-sm text-[#d9e5ef]"
          >
            Back to Settings
          </Link>
          <button
            type="button"
            onClick={runScan}
            disabled={!canRunScan || running}
            className="inline-flex h-10 items-center rounded-md bg-[#2f80ed] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? "Scanning..." : "Run Integrity Scan"}
          </button>
        </div>
      </div>

      {!canRunScan ? (
        <InfoCard
          title="Administrator Access Required"
          message="Only ADMIN users can run storage integrity scans. This page is restricted because it validates server storage and backup destinations."
          tone="warning"
        />
      ) : null}

      <div className="rounded-md border border-[#263545] bg-[#111820] p-3 text-sm text-[#9fb0bf]">{status}</div>

      <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
            <div className="text-xs font-semibold uppercase text-[#64748b]">Overall Health</div>
            <div className="mt-3 flex items-end gap-3">
              <div className="text-5xl font-semibold text-white">{scanResult ? `${scanResult.healthScore}%` : "--"}</div>
              <StatusBadge status={scanResult?.status || "WARNING"} label={scanResult ? scanResult.status : "NOT SCANNED"} />
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#263545]">
              <div
                className={`h-full ${getHealthBarColor(scanResult?.status)}`}
                style={{ width: `${scanResult?.healthScore ?? 0}%` }}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <MetricTile label="Passed Checks" value={scanResult ? `${scanResult.passedChecks} / ${scanResult.totalChecks}` : "-"} />
            <MetricTile label="Warnings" value={scanResult ? String(scanResult.warningCount) : "-"} />
            <MetricTile label="Errors" value={scanResult ? String(scanResult.errorCount) : "-"} />
            <MetricTile label="Scan Duration" value={scanResult ? formatDuration(scanResult.scanDurationMs) : "-"} />
            <MetricTile label="Last Scan Time" value={scanResult ? formatDateTime(scanResult.scannedAt) : "-"} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
            <h3 className="text-sm font-semibold text-white">Storage Scope</h3>
            <div className="mt-4 grid gap-3">
              <PathRow label="Storage Root" value={scanResult?.storageRoot || "Scan not run yet"} />
              <PathRow label="Projects Root" value={scanResult?.projectsRoot || "Scan not run yet"} />
            </div>
          </div>

          <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
            <h3 className="text-sm font-semibold text-white">Checks</h3>
            <div className="mt-4 overflow-x-auto rounded-md border border-[#263545]">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-[#0f151d] text-xs uppercase text-[#64748b]">
                  <tr>
                    <th className="px-3 py-2">Check</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2 text-right">Warnings</th>
                    <th className="px-3 py-2 text-right">Errors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2937] text-[#d9e5ef]">
                  {!scanResult ? (
                    <tr>
                      <td className="px-3 py-4 text-[#9fb0bf]" colSpan={4}>
                        No scan result yet.
                      </td>
                    </tr>
                  ) : (
                    scanResult.checks.map((check) => (
                      <tr key={check.key}>
                        <td className="px-3 py-2">{check.label}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={check.errors > 0 ? "ERROR" : check.warnings > 0 ? "WARNING" : "PASSED"} label={check.passed ? "PASSED" : "NEEDS REVIEW"} />
                        </td>
                        <td className="px-3 py-2 text-right">{check.warnings}</td>
                        <td className="px-3 py-2 text-right">{check.errors}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
            <h3 className="text-sm font-semibold text-white">Warnings and Errors</h3>
            <div className="mt-4 grid gap-3">
              {!scanResult ? (
                <div className="rounded-md border border-[#263545] bg-[#0b0f14] p-4 text-sm text-[#9fb0bf]">
                  Run a scan to see integrity findings.
                </div>
              ) : visibleIssues.length === 0 ? (
                <InfoCard title="No Findings" message="Database metadata and storage files are currently consistent for the checks in this scan." tone="success" />
              ) : (
                visibleIssues.map((issue, index) => (
                  <IssueCard key={`${issue.code}-${issue.entityType || "path"}-${issue.entityId || index}`} issue={issue} />
                ))
              )}
              {scanResult && scanResult.errors.length + scanResult.warnings.length > visibleIssues.length ? (
                <div className="text-xs text-[#9fb0bf]">Showing first {visibleIssues.length} findings.</div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#263545] bg-[#111820] p-3">
      <div className="text-xs font-semibold uppercase text-[#64748b]">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-[#d9e5ef]">{value}</div>
    </div>
  );
}

function PathRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase text-[#64748b]">{label}</div>
      <div className="mt-1 rounded-md border border-[#263545] bg-[#06090d] px-3 py-2 text-sm leading-5 text-[#d9e5ef]">
        <span className="block break-all">{value}</span>
      </div>
    </div>
  );
}

function IssueCard({ issue }: { issue: IntegrityIssue }) {
  return (
    <div className={`rounded-md border p-3 ${issue.severity === "ERROR" ? "border-[#7f1d1d] bg-[#1f0d0d]" : "border-[#3f2d14] bg-[#140f08]"}`}>
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
        <div>
          <div className={`text-xs font-semibold uppercase ${issue.severity === "ERROR" ? "text-[#fca5a5]" : "text-[#f8d28b]"}`}>
            {issue.severity} / {issue.code}
          </div>
          <div className="mt-1 text-sm leading-6 text-[#d9e5ef]">{issue.message}</div>
        </div>
        {issue.entityType ? (
          <div className="shrink-0 rounded border border-[#263545] px-2 py-1 text-xs text-[#9fb0bf]">
            {issue.entityType} {issue.entityId ? `#${issue.entityId}` : ""}
          </div>
        ) : null}
      </div>
      {issue.path ? <div className="mt-2 break-all text-xs leading-5 text-[#9fb0bf]">{issue.path}</div> : null}
    </div>
  );
}

function InfoCard({ title, message, tone }: { title: string; message: string; tone: "warning" | "success" }) {
  const styles =
    tone === "success"
      ? "border-[#14532d] bg-[#07130d] text-[#86efac]"
      : "border-[#3f2d14] bg-[#140f08] text-[#f8d28b]";

  return (
    <div className={`rounded-md border p-4 ${styles}`}>
      <div className="text-sm font-semibold">{tone === "success" ? "i" : "!"} {title}</div>
      <div className="mt-1 text-sm leading-6">{message}</div>
    </div>
  );
}

function StatusBadge({ status, label }: { status: IntegritySeverity; label: string }) {
  const styles = {
    PASSED: "border-[#14532d] bg-[#07130d] text-[#86efac]",
    WARNING: "border-[#3f2d14] bg-[#140f08] text-[#f8d28b]",
    ERROR: "border-[#7f1d1d] bg-[#1f0d0d] text-[#fca5a5]",
  } satisfies Record<IntegritySeverity, string>;

  return <span className={`inline-flex rounded border px-2 py-1 text-xs font-semibold ${styles[status]}`}>{label}</span>;
}

function getHealthBarColor(status?: IntegritySeverity): string {
  if (status === "PASSED") {
    return "bg-[#22c55e]";
  }

  if (status === "ERROR") {
    return "bg-[#ef4444]";
  }

  return "bg-[#f59e0b]";
}

function formatDuration(value?: number | null): string {
  if (value === undefined || value === null) {
    return "-";
  }

  if (value < 1000) {
    return `${value} ms`;
  }

  const seconds = value / 1000;

  if (seconds < 60) {
    return `${seconds.toFixed(1)} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);

  return `${minutes} min ${remainingSeconds} sec`;
}
