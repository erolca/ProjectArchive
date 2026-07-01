"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MetricCard } from "../components/ui/metric-card";
import { getApi } from "../lib/api-client";
import { getFirstName, useCurrentUser } from "../lib/current-user";
import { formatBytes, formatDateTime } from "../lib/format";

interface DashboardSummary {
  metrics: {
    totalProjects: number;
    activeProjects: number;
    customers: number;
    plcBackups: number;
    hmiBackups: number;
    robotBackups: number;
    electricalFiles: number;
    documents: number;
    mechanicalFiles: number;
    visionFiles: number;
    cameraFiles: number;
    fatDocuments: number;
    satDocuments: number;
    serviceFiles: number;
    sparePartsFiles: number;
  };
  lastUploadedFiles: Array<{
    id: number;
    originalFileName: string;
    fileSize: string;
    currentVersionNo: string;
    uploadedAt: string;
    project: {
      id: number;
      projectCode: string;
      machineName: string;
    };
    uploadedBy?: {
      username: string;
      email: string;
    } | null;
  }>;
  recentActivities: Array<{
    id: number;
    action: string;
    details?: string | null;
    createdAt: string;
    user?: {
      username: string;
      email: string;
    } | null;
    project?: {
      id: number;
      projectCode: string;
      machineName: string;
    } | null;
  }>;
}

export default function DashboardPage() {
  const currentUser = useCurrentUser();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [status, setStatus] = useState("Loading dashboard");

  useEffect(() => {
    getApi<DashboardSummary>("/api/dashboard")
      .then((result) => {
        setSummary(result);
        setStatus("Dashboard loaded");
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Could not load dashboard.");
      });
  }, []);

  const metrics = summary?.metrics;

  return (
    <div className="space-y-5">
      <section>
        <h2 className="text-xl font-semibold text-white">Dashboard</h2>
        <p className="mt-1 text-sm text-[#9fb0bf]">Live archive status, engineering backups, and recent traceability.</p>
      </section>

      {currentUser ? (
        <section className="rounded-md border border-[#263545] bg-[#111820] p-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[#38bdf8]">Machine Archive Workspace</div>
              <h3 className="mt-2 text-xl font-semibold text-white">Welcome back, {getFirstName(currentUser)}</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <span className="rounded border border-[#2f80ed] bg-[#10243b] px-3 py-2 font-semibold text-[#93c5fd]">
                {currentUser.role}
              </span>
              <span className="rounded border border-[#263545] bg-[#0f151d] px-3 py-2 text-[#c6d3df]">
                {currentUser.department || "No department"}
              </span>
            </div>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Total Projects" value={metrics?.totalProjects ?? "-"} />
        <MetricCard label="Active Projects" value={metrics?.activeProjects ?? "-"} />
        <MetricCard label="Customers" value={metrics?.customers ?? "-"} />
        <MetricCard label="PLC Backups" value={metrics?.plcBackups ?? "-"} />
        <MetricCard label="HMI Backups" value={metrics?.hmiBackups ?? "-"} />
        <MetricCard label="Robot Backups" value={metrics?.robotBackups ?? "-"} />
        <MetricCard label="Electrical Files" value={metrics?.electricalFiles ?? "-"} />
        <MetricCard label="Documents" value={metrics?.documents ?? "-"} />
        <MetricCard label="Mechanical Files" value={metrics?.mechanicalFiles ?? "-"} />
        <MetricCard label="Vision Files" value={metrics?.visionFiles ?? "-"} />
        <MetricCard label="Camera Files" value={metrics?.cameraFiles ?? "-"} />
        <MetricCard label="FAT Documents" value={metrics?.fatDocuments ?? "-"} />
        <MetricCard label="SAT Documents" value={metrics?.satDocuments ?? "-"} />
        <MetricCard label="Service Files" value={metrics?.serviceFiles ?? "-"} />
        <MetricCard label="Spare Parts" value={metrics?.sparePartsFiles ?? "-"} />
      </section>

      {!summary ? (
        <div className="rounded-md border border-[#263545] bg-[#111820] p-4 text-sm text-[#9fb0bf]">{status}</div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
          <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Last Uploaded Files</h3>
              <Link href="/projects" className="text-xs font-semibold text-[#38bdf8]">
                Browse projects
              </Link>
            </div>
            <div className="mt-4 overflow-hidden rounded-md border border-[#263545]">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead className="bg-[#0f151d] text-xs uppercase text-[#9fb0bf]">
                  <tr>
                    <th className="px-4 py-3">File</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Version</th>
                    <th className="px-4 py-3">Size</th>
                    <th className="px-4 py-3">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lastUploadedFiles.length === 0 ? (
                    <tr className="border-t border-[#263545] text-[#9fb0bf]">
                      <td className="px-4 py-4" colSpan={5}>
                        No uploaded files yet.
                      </td>
                    </tr>
                  ) : (
                    summary.lastUploadedFiles.map((file) => (
                      <tr key={file.id} className="border-t border-[#263545] text-[#d9e5ef]">
                        <td className="px-4 py-3">{file.originalFileName}</td>
                        <td className="px-4 py-3">
                          <Link href={`/projects/${file.project.id}`} className="font-semibold text-[#38bdf8]">
                            {file.project.projectCode}
                          </Link>
                        </td>
                        <td className="px-4 py-3">{file.currentVersionNo}</td>
                        <td className="px-4 py-3">{formatBytes(file.fileSize)}</td>
                        <td className="px-4 py-3">{formatDateTime(file.uploadedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-md border border-[#263545] bg-[#111820] p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Recent Activities</h3>
              <Link href="/activity" className="text-xs font-semibold text-[#38bdf8]">
                View timeline
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {summary.recentActivities.length === 0 ? (
                <div className="rounded border border-[#263545] bg-[#0f151d] p-3 text-sm text-[#9fb0bf]">
                  No activity logged yet.
                </div>
              ) : (
                summary.recentActivities.map((activity) => (
                  <div key={activity.id} className="rounded border border-[#263545] bg-[#0f151d] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{activity.action}</span>
                      <span className="text-xs text-[#748596]">{formatDateTime(activity.createdAt)}</span>
                    </div>
                    <div className="mt-2 text-sm text-[#9fb0bf]">{activity.details || "No details recorded."}</div>
                    <div className="mt-2 text-xs text-[#748596]">
                      {activity.user?.username || "System"} {activity.project ? `- ${activity.project.projectCode}` : ""}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
