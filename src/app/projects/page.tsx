"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StatusBadge } from "../../components/ui/status-badge";
import { getApi } from "../../lib/api-client";
import { formatDate } from "../../lib/format";

interface ProjectRow {
  id: number;
  projectCode: string;
  serialNumber: string;
  machineName: string;
  machineType?: string | null;
  status: string;
  plcBrand?: string | null;
  hmiBrand?: string | null;
  robotBrand?: string | null;
  updatedAt: string;
  customer: {
    customerName: string;
  };
}

interface ProjectListResponse {
  data: ProjectRow[];
  total: number;
  page: number;
  pageSize: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [status, setStatus] = useState("Loading projects");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [plcBrand, setPlcBrand] = useState("");
  const [hmiBrand, setHmiBrand] = useState("");
  const [robotBrand, setRobotBrand] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortOrder, setSortOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams();

    if (query) params.set("q", query);
    if (statusFilter) params.set("status", statusFilter);
    if (plcBrand) params.set("plcBrand", plcBrand);
    if (hmiBrand) params.set("hmiBrand", hmiBrand);
    if (robotBrand) params.set("robotBrand", robotBrand);
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));

    getApi<ProjectListResponse>(`/api/projects?${params.toString()}`)
      .then((result) => {
        setProjects(result.data);
        setTotal(result.total);
        setStatus(result.total === 0 ? "No projects found." : `${result.total} project records`);
      })
      .catch((error) => {
        setStatus(error instanceof Error ? error.message : "Could not load projects.");
      });
  }, [query, statusFilter, plcBrand, hmiBrand, robotBrand, sortBy, sortOrder, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Projects</h2>
          <p className="mt-1 text-sm text-[#9fb0bf]">Search and inspect archived automation projects.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Search project, serial, customer, machine"
            className="w-full rounded-md border border-[#263545] bg-[#0f151d] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed] lg:w-96"
          />
          <Link
            href="/projects/new"
            className="rounded-md bg-[#2f80ed] px-4 py-2 text-center text-sm font-semibold text-white"
          >
            New Project
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-md border border-[#263545] bg-[#111820] p-4 md:grid-cols-2 xl:grid-cols-6">
        <SelectFilter
          label="Status"
          value={statusFilter}
          onChange={(value) => {
            setStatusFilter(value);
            setPage(1);
          }}
          options={["", "DESIGN", "SOFTWARE", "COMMISSIONING", "COMPLETED", "SERVICE", "ARCHIVED"]}
        />
        <TextFilter
          label="PLC Brand"
          value={plcBrand}
          onChange={(value) => {
            setPlcBrand(value);
            setPage(1);
          }}
        />
        <TextFilter
          label="HMI Brand"
          value={hmiBrand}
          onChange={(value) => {
            setHmiBrand(value);
            setPage(1);
          }}
        />
        <TextFilter
          label="Robot Brand"
          value={robotBrand}
          onChange={(value) => {
            setRobotBrand(value);
            setPage(1);
          }}
        />
        <SelectFilter
          label="Sort"
          value={sortBy}
          onChange={setSortBy}
          options={["updatedAt", "createdAt", "projectCode", "customerName", "machineName", "status"]}
        />
        <SelectFilter label="Order" value={sortOrder} onChange={setSortOrder} options={["desc", "asc"]} />
      </div>

      <div className="overflow-hidden rounded-md border border-[#263545] bg-[#111820]">
        <div className="flex flex-col justify-between gap-3 border-b border-[#263545] px-4 py-3 text-sm text-[#9fb0bf] md:flex-row md:items-center">
          <span>{status}</span>
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="rounded-md border border-[#263545] bg-[#0b0f14] px-2 py-1 text-white"
            >
              {[10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left text-sm">
            <thead className="bg-[#0f151d] text-xs uppercase text-[#9fb0bf]">
              <tr>
                <th className="px-4 py-3">Project Code</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Machine</th>
                <th className="px-4 py-3">PLC</th>
                <th className="px-4 py-3">HMI</th>
                <th className="px-4 py-3">Robot</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr className="border-t border-[#263545] text-[#9fb0bf]">
                  <td className="px-4 py-6" colSpan={8}>
                    No matching projects found. Adjust the filters or create a new project.
                  </td>
                </tr>
              ) : (
                projects.map((project) => (
                  <tr key={project.id} className="border-t border-[#263545] text-[#d9e5ef]">
                    <td className="px-4 py-3">
                      <Link href={`/projects/${project.id}`} className="font-semibold text-[#38bdf8]">
                        {project.projectCode}
                      </Link>
                    </td>
                    <td className="max-w-[220px] px-4 py-3"><span className="block break-words">{project.customer.customerName}</span></td>
                    <td className="max-w-[260px] px-4 py-3"><span className="block break-words">{project.machineName}</span></td>
                    <td className="px-4 py-3">{project.plcBrand || "-"}</td>
                    <td className="px-4 py-3">{project.hmiBrand || "-"}</td>
                    <td className="px-4 py-3">{project.robotBrand || "-"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={project.status} />
                    </td>
                    <td className="px-4 py-3">{formatDate(project.updatedAt)}</td>
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
      </div>
    </div>
  );
}

function TextFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      />
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
    <label className="block">
      <span className="text-xs font-semibold uppercase text-[#9fb0bf]">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-md border border-[#263545] bg-[#0b0f14] px-3 py-2 text-sm text-white outline-none focus:border-[#2f80ed]"
      >
        {options.map((option) => (
          <option key={option || "all"} value={option}>
            {option || "All"}
          </option>
        ))}
      </select>
    </label>
  );
}
