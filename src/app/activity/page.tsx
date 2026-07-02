"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getApi } from "../../lib/api-client";
import { formatDateTime } from "../../lib/format";

interface ActivityRow {
  id: number;
  action: string;
  details?: string | null;
  entityType: string;
  entityId?: number | null;
  createdAt: string;
  user?: {
    id: number;
    username: string;
    email: string;
  } | null;
  project?: {
    id: number;
    projectCode: string;
    machineName: string;
  } | null;
}

interface ActivityResponse {
  data: ActivityRow[];
  total: number;
  page: number;
  pageSize: number;
}

const actions = [
  "",
  "LOGIN",
  "PROJECT_CREATED",
  "PROJECT_UPDATED",
  "FILE_UPLOADED",
  "FILE_DOWNLOADED",
  "VERSION_CREATED",
  "PERMISSION_DENIED",
];

export default function ActivityPage() {
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [status, setStatus] = useState("Loading activity");
  const [action, setAction] = useState("");
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 25;

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (action) params.set("action", action);
    if (projectId) params.set("projectId", projectId);
    if (userId) params.set("userId", userId);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", `${dateTo}T23:59:59`);

    getApi<ActivityResponse>(`/api/activity?${params.toString()}`)
      .then((result) => {
        setActivities(result.data);
        setTotal(result.total);
        setStatus(result.total === 0 ? "No activity found." : `${result.total} activity records`);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Could not load activity.");
      });
  }, [action, projectId, userId, dateFrom, dateTo, page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Activity</h2>
        <p className="mt-1 text-sm text-[#9fb0bf]">Trace project, file, version, and security events.</p>
      </div>

      <div className="grid gap-3 rounded-md border border-[#263545] bg-[#111820] p-4 md:grid-cols-2 xl:grid-cols-5">
        <label>
          <span className="text-xs font-semibold uppercase text-[#9fb0bf]">Action</span>
          <select
            value={action}
            onChange={(event) => {
              setAction(event.target.value);
              setPage(1);
            }}
            className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white"
          >
            {actions.map((item) => (
              <option key={item || "all"} value={item}>
                {item || "All"}
              </option>
            ))}
          </select>
        </label>
        <FilterInput label="User ID" value={userId} onChange={setUserId} />
        <FilterInput label="Project ID" value={projectId} onChange={setProjectId} />
        <FilterInput label="From" type="date" value={dateFrom} onChange={setDateFrom} />
        <FilterInput label="To" type="date" value={dateTo} onChange={setDateTo} />
      </div>

      <section className="rounded-md border border-[#263545] bg-[#111820]">
        <div className="flex flex-col justify-between gap-3 border-b border-[#263545] px-4 py-3 text-sm text-[#9fb0bf] md:flex-row md:items-center">
          <span>{status}</span>
          <span>
            Page {page} of {totalPages}
          </span>
        </div>
        <div className="divide-y divide-[#263545]">
          {activities.length === 0 ? (
            <div className="p-6 text-sm text-[#9fb0bf]">
              No matching activity found. Adjust the filters or check back after project and file actions are recorded.
            </div>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="grid gap-3 p-4 md:grid-cols-[180px_1fr]">
                <div className="text-xs text-[#748596]">{formatDateTime(activity.createdAt)}</div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded border border-[#263545] bg-[#0f151d] px-2 py-1 text-xs font-semibold text-[#38bdf8]">
                      {activity.action}
                    </span>
                    <span className="break-words text-sm text-white">{activity.details || `${activity.entityType} event`}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-[#9fb0bf]">
                    <span>User: {activity.user?.username || "System"}</span>
                    {activity.project ? (
                      <Link href={`/projects/${activity.project.id}`} className="text-[#38bdf8]">
                        Project: {activity.project.projectCode}
                      </Link>
                    ) : (
                      <span>Project: -</span>
                    )}
                    <span>Entity: {activity.entityType}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-[#263545] px-4 py-3">
          <button
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            disabled={page <= 1}
            className="rounded-md border border-[#263545] px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
            disabled={page >= totalPages}
            className="rounded-md border border-[#263545] px-3 py-1 text-sm text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </section>
    </div>
  );
}

function FilterInput({
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
